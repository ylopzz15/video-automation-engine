import type { Page } from 'playwright';
import type { SceneAction } from '@video-engine/config';
import { ensureCursor, moveCursorTo, hideCursor, showCursor } from './cursor';
import { isPlaywrightSelector, getElementCenter, resolveLocator } from './locators';

export interface ActionExecutorOptions {
  /** Retardo entre acciones (ms) */
  slowMo: number;
  /** Mostrar indicador visual en clics */
  highlightClicks: boolean;
  /** Mostrar cursor visible que se mueve hacia los elementos */
  showCursor: boolean;
  /** Directorio para guardar screenshots de acciones */
  screenshotDir: string;
  /** ID de la escena actual (para nombrar artefactos) */
  sceneId: string;
}

/**
 * Ejecuta una acción de escena en la página de Playwright.
 *
 * Cuando showCursor está habilitado, un cursor visible se desplaza
 * hacia el elemento objetivo antes de click, fill, hover y press.
 */
export async function executeAction(
  page: Page,
  action: SceneAction,
  options: ActionExecutorOptions,
): Promise<string | undefined> {
  if (options.slowMo > 0) {
    await delay(options.slowMo);
  }

  if (options.showCursor) {
    await ensureCursor(page);
  }

  switch (action.action) {
    case 'goto':
      await page.goto(action.url!, {
        waitUntil: action.waitUntil ?? 'load',
      });
      // Re-inyectar cursor tras navegación (nuevo DOM)
      if (options.showCursor) {
        await ensureCursor(page);
      }
      return undefined;

    case 'click':
      return await handleClick(page, action, options);

    case 'fill':
      if (options.showCursor) {
        await moveCursorTo(page, action.selector!);
      }
      await resolveLocator(page, action.selector!).fill(action.value!);
      return undefined;

    case 'wait':
      await delay(action.duration!);
      return undefined;

    case 'scroll':
      // Ocultar cursor durante scroll para un aspecto más limpio
      if (options.showCursor) {
        await hideCursor(page);
      }
      await handleScroll(page, action);
      if (options.showCursor) {
        await showCursor(page);
      }
      return undefined;

    case 'hover':
      if (options.showCursor) {
        await moveCursorTo(page, action.selector);
      }
      await handleHover(page, action);
      return undefined;

    case 'press':
      if (options.showCursor && action.selector) {
        await moveCursorTo(page, action.selector);
      }
      await handlePress(page, action);
      return undefined;

    case 'screenshot':
      // Ocultar cursor durante captura para que no aparezca en la imagen
      if (options.showCursor) {
        await hideCursor(page);
      }
      const result = await handleScreenshot(page, action, options);
      if (options.showCursor) {
        await showCursor(page);
      }
      return result;

    default:
      throw new Error(`Unknown action: ${(action as any).action}`);
  }
}

// --- Handlers de acciones ---

async function handleClick(
  page: Page,
  action: { selector: string; delay?: number },
  options: ActionExecutorOptions,
): Promise<undefined> {
  if (action.delay) {
    await delay(action.delay);
  }

  if (options.showCursor) {
    await moveCursorTo(page, action.selector);
  }

  if (options.highlightClicks) {
    await highlightElement(page, action.selector);
  }

  await resolveLocator(page, action.selector).click();
  return undefined;
}

/**
 * Scroll suave interpolado por frames con requestAnimationFrame.
 * Usa easing programático para producir movimiento natural en el video,
 * independiente del comportamiento de smooth-scroll del navegador.
 */
async function handleScroll(
  page: Page,
  action: { y: number; x: number; selector?: string; duration: number; easing: string },
): Promise<void> {
  await page.evaluate(
    ({ x, y, selector, duration, easing }) => {
      return new Promise<void>((resolve) => {
        const target = selector
          ? document.querySelector(selector)
          : document.documentElement;

        if (!target) {
          resolve();
          return;
        }

        const easings: Record<string, (t: number) => number> = {
          'linear': (t) => t,
          'ease-in': (t) => t * t,
          'ease-out': (t) => t * (2 - t),
          'ease-in-out': (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
        };

        const easeFn = easings[easing] || easings['ease-in-out'];
        const startTime = performance.now();
        const isDocument = target === document.documentElement;
        const startX = isDocument ? window.scrollX : target.scrollLeft;
        const startY = isDocument ? window.scrollY : target.scrollTop;

        function step(now: number) {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = easeFn(progress);

          const currentX = startX + x * eased;
          const currentY = startY + y * eased;

          if (isDocument) {
            window.scrollTo(currentX, currentY);
          } else {
            target!.scrollLeft = currentX;
            target!.scrollTop = currentY;
          }

          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            resolve();
          }
        }

        requestAnimationFrame(step);
      });
    },
    {
      x: action.x,
      y: action.y,
      selector: action.selector ?? null,
      duration: action.duration,
      easing: action.easing,
    },
  );

  // Pequeño buffer para que el último frame se estabilice en la grabación
  await delay(100);
}

async function handleHover(
  page: Page,
  action: { selector: string; duration?: number },
): Promise<void> {
  await resolveLocator(page, action.selector).hover();

  if (action.duration) {
    await delay(action.duration);
  }
}

async function handlePress(
  page: Page,
  action: { key: string; selector?: string },
): Promise<void> {
  if (action.selector) {
    await resolveLocator(page, action.selector).press(action.key);
  } else {
    await page.keyboard.press(action.key);
  }
}

async function handleScreenshot(
  page: Page,
  action: { name?: string; fullPage: boolean; selector?: string },
  options: ActionExecutorOptions,
): Promise<string> {
  const filename = action.name
    ? `${action.name}.png`
    : `${options.sceneId}-step-screenshot.png`;

  const screenshotPath = `${options.screenshotDir}/${filename}`;

  if (action.selector) {
    const element = resolveLocator(page, action.selector);
    await element.screenshot({ path: screenshotPath });
  } else {
    await page.screenshot({ path: screenshotPath, fullPage: action.fullPage });
  }

  return screenshotPath;
}

// --- Indicador visual de clic ---

/**
 * Inyecta un indicador de clic altamente visible sobre el elemento objetivo.
 *
 * Soporta selectores CSS y nativos de Playwright (text=, role=, etc).
 * Para selectores nativos, las coordenadas se resuelven vía Locator API.
 *
 * El efecto tiene 3 capas para máxima visibilidad en cualquier fondo:
 * 1. Ripple exterior expandiéndose (señal de "algo ocurrió aquí")
 * 2. Anillo interior con borde blanco (marca la posición)
 * 3. Punto central sólido (indica el punto exacto del clic)
 */
async function highlightElement(page: Page, selector: string): Promise<void> {
  let center: { x: number; y: number } | null = null;

  if (isPlaywrightSelector(selector)) {
    center = await getElementCenter(page, selector);
  } else {
    center = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }, selector);
  }

  if (!center) return;

  await page.evaluate(({ cx, cy }) => {
    // Inyectar keyframes una sola vez por página
    if (!document.getElementById('__ve-click-styles')) {
      const style = document.createElement('style');
      style.id = '__ve-click-styles';
      style.textContent = `
        @keyframes __ve-ripple-expand {
          0% { transform: translate(-50%, -50%) scale(0.3); opacity: 1; }
          70% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
          100% { transform: translate(-50%, -50%) scale(1.8); opacity: 0; }
        }
        @keyframes __ve-ring-pulse {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
          20% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          80% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(0.6); opacity: 0; }
        }
        @keyframes __ve-dot-pop {
          0% { transform: translate(-50%, -50%) scale(0); }
          30% { transform: translate(-50%, -50%) scale(1.3); }
          50% { transform: translate(-50%, -50%) scale(1); }
          100% { transform: translate(-50%, -50%) scale(1); }
        }
      `;
      document.head.appendChild(style);
    }

    const container = document.createElement('div');
    Object.assign(container.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: '2147483647',
    });

    // Capa 1: Ripple exterior
    const ripple = document.createElement('div');
    Object.assign(ripple.style, {
      position: 'absolute',
      left: `${cx}px`,
      top: `${cy}px`,
      width: '80px',
      height: '80px',
      borderRadius: '50%',
      border: '4px solid rgba(255, 82, 82, 0.9)',
      boxShadow: '0 0 20px rgba(255, 82, 82, 0.5), inset 0 0 20px rgba(255, 82, 82, 0.2)',
      animation: '__ve-ripple-expand 800ms ease-out forwards',
    });

    // Capa 2: Anillo interior
    const ring = document.createElement('div');
    Object.assign(ring.style, {
      position: 'absolute',
      left: `${cx}px`,
      top: `${cy}px`,
      width: '44px',
      height: '44px',
      borderRadius: '50%',
      background: 'rgba(255, 82, 82, 0.25)',
      border: '3px solid rgba(255, 255, 255, 0.95)',
      boxShadow: '0 0 12px rgba(0, 0, 0, 0.4), 0 0 4px rgba(255, 82, 82, 0.8)',
      animation: '__ve-ring-pulse 900ms ease-in-out forwards',
    });

    // Capa 3: Punto central
    const dot = document.createElement('div');
    Object.assign(dot.style, {
      position: 'absolute',
      left: `${cx}px`,
      top: `${cy}px`,
      width: '14px',
      height: '14px',
      borderRadius: '50%',
      background: 'rgba(255, 82, 82, 1)',
      border: '2px solid white',
      boxShadow: '0 0 8px rgba(0, 0, 0, 0.5)',
      animation: '__ve-dot-pop 400ms ease-out forwards',
    });

    container.appendChild(ripple);
    container.appendChild(ring);
    container.appendChild(dot);
    document.body.appendChild(container);

    setTimeout(() => container.remove(), 950);
  }, { cx: center.x, cy: center.y });

  // Esperar a que la animación completa se capture en el video (~27 frames a 30fps)
  await delay(900);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

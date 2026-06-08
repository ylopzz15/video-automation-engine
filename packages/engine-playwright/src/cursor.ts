import type { Page } from 'playwright';
import { isPlaywrightSelector, getElementCenter } from './locators';

/**
 * Gestiona un cursor visual superpuesto en la página.
 *
 * El cursor es un SVG de puntero renderizado como elemento fixed-position.
 * Se desplaza hacia los elementos objetivo con animación eased antes de
 * las interacciones, dando al espectador contexto de dónde ocurre la acción.
 *
 * Decisiones de diseño:
 * - SVG con drop-shadow para visibilidad en cualquier fondo
 * - Transición CSS (no animación JS) para grabarse limpiamente a cualquier fps
 * - 24px base funciona tanto en 1920x1080 como en mobile
 * - Inicia fuera de pantalla y aparece en el primer movimiento
 * - Soporta selectores CSS y nativos de Playwright (text=, role=, etc)
 */

const CURSOR_ID = '__ve-cursor-overlay';

/**
 * Inyecta el elemento cursor en la página si no existe.
 * Idempotente — seguro de llamar múltiples veces.
 */
export async function ensureCursor(page: Page): Promise<void> {
  await page.evaluate((id) => {
    if (document.getElementById(id)) return;

    const cursor = document.createElement('div');
    cursor.id = id;

    cursor.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 2L5 20L9.5 15.5L13 22L16 20.5L12.5 14L19 14L5 2Z"
              fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
    `;

    Object.assign(cursor.style, {
      position: 'fixed',
      left: '-40px',
      top: '-40px',
      width: '24px',
      height: '24px',
      pointerEvents: 'none',
      zIndex: '2147483646',
      transition: 'left 0.4s cubic-bezier(0.25, 0.1, 0.25, 1), top 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)',
      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
      willChange: 'left, top',
    });

    document.body.appendChild(cursor);
  }, CURSOR_ID);
}

/**
 * Anima el cursor hacia el centro del elemento identificado por el selector.
 * Soporta selectores CSS y nativos de Playwright (text=, role=, etc).
 *
 * Retorna las coordenadas (x, y) donde aterrizó el cursor, o null si no se encontró.
 */
export async function moveCursorTo(
  page: Page,
  selector: string,
  durationMs: number = 400,
): Promise<{ x: number; y: number } | null> {
  let coords: { x: number; y: number } | null = null;

  if (isPlaywrightSelector(selector)) {
    // Selectores nativos: resolver vía Locator API de Playwright
    coords = await getElementCenter(page, selector);
  } else {
    // Selectores CSS: resolver en-página con querySelector (más rápido, sin IPC extra)
    coords = await page.evaluate(
      (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      },
      selector,
    );
  }

  if (!coords) return null;

  await moveCursorToPoint(page, coords.x, coords.y, durationMs);
  return coords;
}

/**
 * Mueve el cursor a coordenadas específicas en el viewport.
 */
export async function moveCursorToPoint(
  page: Page,
  x: number,
  y: number,
  durationMs: number = 400,
): Promise<void> {
  await page.evaluate(
    ({ id, x, y, duration }) => {
      const cursor = document.getElementById(id);
      if (!cursor) return;

      cursor.style.transition = `left ${duration}ms cubic-bezier(0.25, 0.1, 0.25, 1), top ${duration}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
      cursor.style.left = `${x}px`;
      cursor.style.top = `${y}px`;
    },
    { id: CURSOR_ID, x, y, duration: durationMs },
  );

  await delay(durationMs + 50);
}

/**
 * Oculta el cursor (durante scroll o capturas de pantalla).
 */
export async function hideCursor(page: Page): Promise<void> {
  await page.evaluate((id) => {
    const cursor = document.getElementById(id);
    if (cursor) {
      cursor.style.opacity = '0';
      cursor.style.transition = 'opacity 0.2s ease';
    }
  }, CURSOR_ID);
  await delay(200);
}

/**
 * Muestra el cursor nuevamente tras ocultarlo.
 */
export async function showCursor(page: Page): Promise<void> {
  await page.evaluate((id) => {
    const cursor = document.getElementById(id);
    if (cursor) {
      cursor.style.opacity = '1';
      cursor.style.transition = 'opacity 0.2s ease';
    }
  }, CURSOR_ID);
  await delay(200);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

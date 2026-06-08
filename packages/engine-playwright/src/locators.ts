import type { Page, Locator } from 'playwright';

/**
 * Prefijos de selectores nativos de Playwright que no pueden resolverse
 * con document.querySelector() dentro de page.evaluate().
 */
const PLAYWRIGHT_PREFIXES = [
  'text=',
  'role=',
  'data-testid=',
  'aria-label=',
  'label=',
  'placeholder=',
  'alt=',
  'title=',
  'has-text=',
];

/**
 * Resultado del parsing de un selector semántico role=...[name="..."].
 */
export interface ParsedRoleSelector {
  role: string;
  name?: string;
}

/**
 * Determina si un selector usa sintaxis nativa de Playwright (no CSS).
 */
export function isPlaywrightSelector(selector: string): boolean {
  return PLAYWRIGHT_PREFIXES.some((prefix) => selector.startsWith(prefix))
    || selector.startsWith('//')  // XPath
    || selector.startsWith('..')  // XPath relativo
    || selector.startsWith('>>'); // Selector encadenado
}

/**
 * Parsea un selector semántico con formato:
 *   role=link[name="Get started"]
 *   role=button[name="Login"]
 *   role=textbox[name="Email"]
 *
 * Retorna null si no es un selector de rol con name.
 */
export function parseRoleSelector(selector: string): ParsedRoleSelector | null {
  // Formato: role=<role>[name="<name>"]
  const match = selector.match(/^role=(\w+)\[name="([^"]+)"\]$/);
  if (match) {
    return { role: match[1], name: match[2] };
  }

  // Formato sin name: role=<role>
  const simpleMatch = selector.match(/^role=(\w+)$/);
  if (simpleMatch) {
    return { role: simpleMatch[1] };
  }

  return null;
}

/**
 * Resuelve un selector a un Locator de Playwright.
 *
 * Prioridad de resolución:
 * 1. role=<role>[name="..."] → page.getByRole(role, { name })
 * 2. role=<role> → page.getByRole(role)
 * 3. text=... → page.locator('text=...')
 * 4. Cualquier otro → page.locator(selector)
 *
 * Este es el punto central donde los selectores generados por Discovery
 * se convierten en locators ejecutables de Playwright.
 */
export function resolveLocator(page: Page, selector: string, debug = false): Locator {
  // 1. Intentar parsear como selector semántico role=...[name="..."]
  const parsed = parseRoleSelector(selector);

  if (parsed) {
    if (debug) {
      const nameInfo = parsed.name ? `, { name: "${parsed.name}" }` : '';
      console.log(`  [locator] ${selector} → page.getByRole("${parsed.role}"${nameInfo}).first()`);
    }

    if (parsed.name) {
      return page.getByRole(parsed.role as any, { name: parsed.name }).first();
    }
    return page.getByRole(parsed.role as any).first();
  }

  // 2. Fallback: usar page.locator directamente (text=, css, xpath, etc)
  if (debug) {
    console.log(`  [locator] ${selector} → page.locator("${selector}")`);
  }

  return page.locator(selector);
}

/**
 * Obtiene un Locator de Playwright para cualquier selector.
 * Wrapper de compatibilidad — usa resolveLocator internamente.
 */
export function getLocator(page: Page, selector: string): Locator {
  return resolveLocator(page, selector);
}

/**
 * Obtiene las coordenadas del centro del bounding box de un elemento.
 * Usa resolveLocator para soportar selectores semánticos.
 *
 * Retorna null si el elemento no se encuentra o no es visible.
 */
export async function getElementCenter(
  page: Page,
  selector: string,
): Promise<{ x: number; y: number } | null> {
  try {
    const locator = resolveLocator(page, selector);
    const box = await locator.first().boundingBox({ timeout: 5000 });

    if (!box) return null;

    return {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    };
  } catch {
    return null;
  }
}

/**
 * Elemento interactivo descubierto en una página.
 * Diseñado para ser consumido por generadores de workflows y
 * producir selectores compatibles con Playwright.
 */
export interface InteractiveElement {
  /** Rol semántico del elemento (button, link, textbox, searchbox, etc) */
  role: string;
  /** Texto visible del elemento */
  text?: string;
  /** Label/nombre accesible asociado */
  label?: string;
  /** Nombre accesible (accessible name, extraído del snapshot) */
  name?: string;
  /** Placeholder del input (si aplica) */
  placeholder?: string;
  /** Referencia del snapshot MCP (ej: 'e32') */
  ref?: string;
  /** Selector compatible con Playwright (ej: role=link[name="Get started"]) */
  locator?: string;
}

/**
 * Mapa de elementos interactivos descubiertos en una página.
 * Representa la estructura de UI que el framework puede automatizar.
 */
export interface PageMap {
  /** Título de la página (<title> o heading principal) */
  title?: string;
  buttons: InteractiveElement[];
  inputs: InteractiveElement[];
  links: InteractiveElement[];
}

/**
 * Contrato para proveedores de descubrimiento.
 * Un provider inspecciona una URL y retorna su PageMap.
 */
export interface DiscoveryProvider {
  inspect(url: string): Promise<PageMap>;
}

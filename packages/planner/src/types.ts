import type { PageMap } from '@video-engine/discovery';

/**
 * Paso individual dentro de un plan de automatización.
 * Representa una acción concreta sobre un elemento de la página.
 */
export interface PlanStep {
  /** Tipo de acción (click, fill, goto, scroll, etc) */
  action: string;
  /** Texto o nombre accesible del elemento objetivo */
  target: string;
  /** Valor a introducir (para acciones fill) */
  value?: string;
  /** Locator Playwright generado por Discovery (role=..., text=...) */
  locator?: string;
}

/**
 * Contrato para planificadores.
 * Un planner recibe un prompt en lenguaje natural y un PageMap,
 * y genera una secuencia de PlanSteps ejecutables.
 */
export interface Planner {
  createPlan(prompt: string, pageMap: PageMap): Promise<PlanStep[]>;
}

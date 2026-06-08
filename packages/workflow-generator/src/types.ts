import type { PlanStep } from '@video-engine/planner';

/**
 * Opciones para la generación de workflows.
 */
export interface WorkflowGeneratorOptions {
  /** Título del video/workflow generado */
  title?: string;
  /** URL inicial para el goto (si aplica) */
  baseUrl?: string;
}

/**
 * Contrato para generadores de workflow.
 * Convierte un array de PlanStep en un formato ejecutable por el engine.
 */
export interface WorkflowGenerator {
  generate(plan: PlanStep[], options?: WorkflowGeneratorOptions): Promise<string>;
}

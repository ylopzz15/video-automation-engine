import type { PageMap, InteractiveElement } from '@video-engine/discovery';
import type { Planner, PlanStep } from './types';

/**
 * Planificador genérico basado en scoring textual.
 *
 * Funciona con cualquier aplicación web. No contiene lógica de dominio.
 *
 * Estrategia:
 * 1. Normaliza el prompt (minúsculas, sin acentos).
 * 2. Puntúa cada elemento del PageMap contra el prompt.
 * 3. Ordena por score descendente.
 * 4. Genera PlanSteps para los elementos que superen el umbral mínimo.
 */
export class RuleBasedPlanner implements Planner {
  private threshold: number;

  constructor(options?: { threshold?: number }) {
    this.threshold = options?.threshold ?? 1;
  }

  async createPlan(prompt: string, pageMap: PageMap): Promise<PlanStep[]> {
    const scored = this.scoreAll(prompt, pageMap);

    // Filtrar por umbral y ordenar por score descendente
    const matches = scored
      .filter((s) => s.score >= this.threshold)
      .sort((a, b) => b.score - a.score);

    // Deduplicar: si dos elementos tienen el mismo texto normalizado,
    // mantener solo el de mayor prioridad (button > link > input)
    const deduplicated = this.deduplicate(matches.map((m) => m.element));

    return deduplicated.map((element) => ({
      action: this.inferAction(element),
      target: element.text || element.label || element.locator || '',
      locator: element.locator,
    }));
  }

  /**
   * Puntúa un prompt contra un elemento individual.
   * Público para permitir testing y extensión.
   *
   * Criterios de scoring:
   * - Coincidencia exacta completa → 10 puntos
   * - Coincidencia de substring contenido → 7 puntos
   * - Cada palabra significativa que coincide → +2 puntos
   * - Coincidencia parcial de palabra (prefijo) → +1 punto
   */
  scorePromptAgainstElement(prompt: string, element: InteractiveElement): number {
    const normalizedPrompt = this.normalize(prompt);
    const elementText = this.normalize(element.text || element.label || '');

    if (!elementText) return 0;

    // Coincidencia exacta: el texto del elemento es idéntico al prompt
    if (normalizedPrompt === elementText) {
      return 10;
    }

    // Coincidencia de substring: el texto del elemento aparece completo en el prompt
    if (normalizedPrompt.includes(elementText)) {
      return 7;
    }

    // El prompt aparece completo en el texto del elemento
    if (elementText.includes(normalizedPrompt)) {
      return 7;
    }

    // Coincidencia por palabras
    const promptWords = this.tokenize(normalizedPrompt);
    const elementWords = this.tokenize(elementText);

    let score = 0;

    for (const ew of elementWords) {
      // Coincidencia exacta de palabra
      if (promptWords.includes(ew)) {
        score += 2;
        continue;
      }

      // Coincidencia parcial (prefijo/sufijo)
      const partial = promptWords.some(
        (pw) => pw.startsWith(ew) || ew.startsWith(pw),
      );
      if (partial) {
        score += 1;
      }
    }

    return score;
  }

  /**
   * Puntúa todos los elementos del PageMap contra el prompt.
   */
  private scoreAll(
    prompt: string,
    pageMap: PageMap,
  ): Array<{ element: InteractiveElement; score: number }> {
    const all: InteractiveElement[] = [
      ...pageMap.buttons,
      ...pageMap.links,
      ...pageMap.inputs,
    ];

    return all.map((element) => ({
      element,
      score: this.scorePromptAgainstElement(prompt, element),
    }));
  }

  /**
   * Infiere la acción apropiada según el rol del elemento.
   */
  private inferAction(element: InteractiveElement): string {
    switch (element.role) {
      case 'textbox':
      case 'searchbox':
      case 'combobox':
      case 'spinbutton':
      case 'textarea':
        return 'fill';
      case 'link':
      case 'button':
      default:
        return 'click';
    }
  }

  /**
   * Normaliza texto: minúsculas y sin acentos.
   */
  private normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /**
   * Tokeniza texto en palabras significativas (>= 3 caracteres).
   */
  private tokenize(text: string): string[] {
    return text.split(/\s+/).filter((w) => w.length >= 3);
  }

  /**
   * Deduplica elementos con el mismo texto normalizado.
   * Prioridad: button > link > input.
   * Mantiene el orden original (por score descendente).
   */
  private deduplicate(elements: InteractiveElement[]): InteractiveElement[] {
    const seen = new Map<string, InteractiveElement>();

    for (const el of elements) {
      const key = this.normalize(el.text || el.label || '');
      if (!key) continue;

      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, el);
      } else if (this.rolePriority(el.role) > this.rolePriority(existing.role)) {
        // Reemplazar por el de mayor prioridad
        seen.set(key, el);
      }
    }

    // Mantener el orden original de inserción
    return [...seen.values()];
  }

  /**
   * Prioridad numérica por rol: button > link > input.
   */
  private rolePriority(role: string): number {
    switch (role) {
      case 'button': return 3;
      case 'link': return 2;
      case 'textbox':
      case 'searchbox':
      case 'combobox':
      case 'spinbutton':
      case 'textarea':
        return 1;
      default:
        return 0;
    }
  }
}

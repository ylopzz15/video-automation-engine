import type { PageMap, InteractiveElement } from '@video-engine/discovery';
import type { Planner, PlanStep } from './types';
import { RuleBasedPlanner } from './rule-based-planner';

export interface LLMPlannerOptions {
  /** API key para el LLM (default: process.env.LLM_API_KEY) */
  apiKey?: string;
  /** Modelo a usar (default: 'claude-sonnet-4-20250514') */
  model?: string;
  /** URL base de la API (default: 'https://api.anthropic.com') */
  baseUrl?: string;
  /** Máximo de tokens en la respuesta */
  maxTokens?: number;
}

/**
 * Planificador basado en LLM para ejecución autónoma (CI/CD, producción).
 *
 * En modo interactivo (con KIRO en el IDE), KIRO actúa directamente como
 * el planner — inspecciona la página, razona sobre el PageMap y genera
 * el YAML sin necesidad de API key ni llamadas externas.
 *
 * Esta clase está diseñada para el caso donde el framework se ejecuta
 * sin KIRO presente (scripts automatizados, pipelines CI/CD) y necesita
 * un LLM externo para razonar sobre las acciones.
 *
 * Si no hay API key configurada, cae al RuleBasedPlanner como fallback.
 */
export class LLMPlanner implements Planner {
  private options: Required<LLMPlannerOptions>;
  private fallback: RuleBasedPlanner;

  constructor(options: LLMPlannerOptions = {}) {
    this.options = {
      apiKey: options.apiKey ?? process.env.LLM_API_KEY ?? '',
      model: options.model ?? 'claude-sonnet-4-20250514',
      baseUrl: options.baseUrl ?? 'https://api.anthropic.com',
      maxTokens: options.maxTokens ?? 1024,
    };
    this.fallback = new RuleBasedPlanner();
  }

  async createPlan(prompt: string, pageMap: PageMap): Promise<PlanStep[]> {
    if (!this.options.apiKey) {
      console.warn('[LLMPlanner] No LLM_API_KEY found, falling back to RuleBasedPlanner');
      return this.fallback.createPlan(prompt, pageMap);
    }

    try {
      return await this.callLLM(prompt, pageMap);
    } catch (err: any) {
      console.warn(`[LLMPlanner] LLM call failed: ${err.message}. Falling back to RuleBasedPlanner`);
      return this.fallback.createPlan(prompt, pageMap);
    }
  }

  private async callLLM(prompt: string, pageMap: PageMap): Promise<PlanStep[]> {
    const systemPrompt = this.buildSystemPrompt(pageMap);
    const userMessage = prompt;

    const body = {
      model: this.options.model,
      max_tokens: this.options.maxTokens,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage },
      ],
    };

    const response = await fetch(`${this.options.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.options.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API ${response.status}: ${errorText}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text?: string }>;
    };

    const text = data.content
      .filter((block) => block.type === 'text' && block.text)
      .map((block) => block.text!)
      .join('');

    return this.parseResponse(text);
  }

  private buildSystemPrompt(pageMap: PageMap): string {
    const elements = this.serializePageMap(pageMap);

    return `Eres un planificador de automatización web. Tu trabajo es convertir instrucciones en lenguaje natural en una secuencia de acciones ejecutables sobre una página web.

CONTEXTO DE LA PÁGINA:
Título: "${pageMap.title ?? '(sin título)'}"

ELEMENTOS DISPONIBLES:
${elements}

ACCIONES DISPONIBLES:
- click: hacer clic en un elemento. Requiere "target" (texto visible) y "locator" (selector Playwright).
- fill: escribir texto en un input. Requiere "target" (label del campo), "locator" (selector), y "value" (texto a escribir).
- goto: navegar a una URL. Requiere "target" (la URL).

REGLAS:
1. Solo usa elementos que existan en la lista de ELEMENTOS DISPONIBLES.
2. Usa el "locator" exacto del elemento. No inventes selectores.
3. Si el usuario menciona datos para llenar (nombre, email, etc), usa la acción "fill" con el valor mencionado.
4. Si el usuario quiere hacer clic en algo, busca el botón o link más relevante.
5. Genera los pasos en el orden lógico que un humano seguiría.
6. Si no hay un elemento que corresponda a lo que el usuario pide, no lo incluyas.

FORMATO DE RESPUESTA:
Responde SOLO con un array JSON de PlanSteps. Sin explicaciones, sin markdown, sin texto adicional.

Ejemplo:
[
  { "action": "click", "target": "Nuevo Tripulante", "locator": "role=button[name=\\"Nuevo Tripulante\\"]" },
  { "action": "fill", "target": "Nombre", "locator": "role=textbox[name=\\"Nombre\\"]", "value": "Juan Pérez" },
  { "action": "click", "target": "Guardar", "locator": "role=button[name=\\"Guardar\\"]" }
]`;
  }

  private serializePageMap(pageMap: PageMap): string {
    const lines: string[] = [];

    if (pageMap.buttons.length > 0) {
      lines.push('BOTONES:');
      for (const el of pageMap.buttons) {
        lines.push(`  - [${el.role}] "${el.text ?? el.name}" → locator: ${el.locator}`);
      }
    }

    if (pageMap.inputs.length > 0) {
      lines.push('INPUTS:');
      for (const el of pageMap.inputs) {
        lines.push(`  - [${el.role}] "${el.label ?? el.name}" → locator: ${el.locator}`);
      }
    }

    if (pageMap.links.length > 0) {
      lines.push('LINKS:');
      for (const el of pageMap.links) {
        lines.push(`  - [${el.role}] "${el.text ?? el.name}" → locator: ${el.locator}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Parsea la respuesta del LLM como JSON array de PlanStep.
   * Intenta extraer el JSON si viene envuelto en markdown o texto.
   */
  private parseResponse(text: string): PlanStep[] {
    let jsonStr = text.trim();

    // Extraer JSON si viene dentro de markdown code block
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    // Extraer el primer array JSON que encontremos
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) {
      throw new Error('LLM response is not an array');
    }

    // Validar estructura mínima de cada step
    return parsed.map((step: any) => {
      if (!step.action || !step.target) {
        throw new Error(`Invalid PlanStep: ${JSON.stringify(step)}`);
      }
      return {
        action: step.action,
        target: step.target,
        value: step.value,
        locator: step.locator,
      } as PlanStep;
    });
  }
}

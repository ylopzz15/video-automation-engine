import type { PlanStep } from '@video-engine/planner';
import type { WorkflowGenerator, WorkflowGeneratorOptions } from './types';

/**
 * Genera un workflow YAML compatible con el engine de video.
 *
 * Convierte PlanStep[] en el formato YAML que consume @video-engine/config:
 *   scenes:
 *     - id: step-0
 *       steps:
 *         - action: click
 *           selector: "text=Target"
 */
export class YamlWorkflowGenerator implements WorkflowGenerator {
  async generate(plan: PlanStep[], options?: WorkflowGeneratorOptions): Promise<string> {
    const title = options?.title ?? 'Generated Workflow';
    const lines: string[] = [];

    // Header
    lines.push(`title: "${this.escapeYaml(title)}"`);
    lines.push('');
    lines.push('output:');
    lines.push('  fps: 30');
    lines.push('  format: mp4');
    lines.push('  path: ./output/generated.mp4');
    lines.push('');
    lines.push('playwright:');
    lines.push('  slowMo: 200');
    lines.push('  highlightClicks: true');
    lines.push('  showCursor: true');
    lines.push('  persistentContext: true');
    lines.push('');
    lines.push('scenes:');

    // Generar escena con goto inicial si se proporciona baseUrl
    if (options?.baseUrl) {
      lines.push(`  - id: navigate`);
      lines.push(`    description: "Navegar a la página"`);
      lines.push(`    steps:`);
      lines.push(`      - action: goto`);
      lines.push(`        url: ${options.baseUrl}`);
      lines.push(`        waitUntil: networkidle`);
    }

    // Generar una escena por cada PlanStep
    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      const sceneId = `step-${i}`;
      const stepYaml = this.planStepToYaml(step);

      lines.push(`  - id: ${sceneId}`);
      lines.push(`    steps:`);
      lines.push(...stepYaml.map((l) => `      ${l}`));
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Convierte un PlanStep en líneas YAML de una acción.
   * Usa step.locator (generado por Discovery) si existe, fallback a step.target.
   */
  private planStepToYaml(step: PlanStep): string[] {
    const selector = step.locator ?? this.toSelector(step.target);

    switch (step.action) {
      case 'click':
        return this.generateClick(selector);
      case 'fill':
        return this.generateFill(selector, step.value);
      case 'goto':
        return this.generateGoto(step.target);
      default:
        return this.generateClick(selector);
    }
  }

  private generateClick(selector: string): string[] {
    return [
      `- action: click`,
      `  selector: "${this.escapeYaml(selector)}"`,
    ];
  }

  private generateFill(selector: string, value?: string): string[] {
    return [
      `- action: click`,
      `  selector: "${this.escapeYaml(selector)}"`,
      `- action: fill`,
      `  selector: "${this.escapeYaml(selector)}"`,
      `  value: "${this.escapeYaml(value ?? '')}"`,
    ];
  }

  private generateGoto(url: string): string[] {
    return [
      `- action: goto`,
      `  url: ${url}`,
      `  waitUntil: networkidle`,
    ];
  }

  /**
   * Convierte un target en un selector Playwright.
   * Si ya tiene formato de locator (text=, role=), lo usa directamente.
   * Si no, genera un selector text= por defecto.
   */
  private toSelector(target: string): string {
    if (
      target.startsWith('text=') ||
      target.startsWith('role=') ||
      target.startsWith('#') ||
      target.startsWith('.') ||
      target.startsWith('[') ||
      target.startsWith('//')
    ) {
      return target;
    }

    return `text=${target}`;
  }

  private escapeYaml(text: string): string {
    return text.replace(/"/g, '\\"');
  }
}

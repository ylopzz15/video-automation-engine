/**
 * Ejemplo: Generar un workflow YAML con acciones de formulario (click + fill).
 *
 * Uso:
 *   npx ts-node packages/workflow-generator/examples/generate-form-workflow.ts
 */
import { YamlWorkflowGenerator } from '../src';
import type { PlanStep } from '@video-engine/planner';

async function main() {
  const generator = new YamlWorkflowGenerator();

  const plan: PlanStep[] = [
    { action: 'fill', target: 'role=textbox[name="Username"]', value: 'john.doe' },
    { action: 'fill', target: 'role=textbox[name="Email"]', value: 'john@example.com' },
    { action: 'fill', target: 'role=textbox[name="Password"]', value: '********' },
    { action: 'click', target: 'Register' },
  ];

  console.log('📋 Plan de entrada:\n');
  for (const step of plan) {
    const val = step.value ? ` = "${step.value}"` : '';
    console.log(`  → [${step.action}] "${step.target}"${val}`);
  }

  const yaml = await generator.generate(plan, {
    title: 'User Registration Form',
    baseUrl: 'https://app.example.com/register',
  });

  console.log('\n📄 YAML generado:\n');
  console.log(yaml);
}

main();

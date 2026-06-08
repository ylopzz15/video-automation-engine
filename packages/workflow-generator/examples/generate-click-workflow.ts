/**
 * Ejemplo: Generar un workflow YAML con acciones de click.
 *
 * Uso:
 *   npx ts-node packages/workflow-generator/examples/generate-click-workflow.ts
 */
import { YamlWorkflowGenerator } from '../src';
import type { PlanStep } from '@video-engine/planner';

async function main() {
  const generator = new YamlWorkflowGenerator();

  const plan: PlanStep[] = [
    { action: 'click', target: 'Create Account' },
    { action: 'click', target: 'Accept Terms' },
    { action: 'click', target: 'Submit' },
  ];

  console.log('📋 Plan de entrada:\n');
  for (const step of plan) {
    console.log(`  → [${step.action}] "${step.target}"`);
  }

  const yaml = await generator.generate(plan, {
    title: 'Account Creation Flow',
    baseUrl: 'https://app.example.com/signup',
  });

  console.log('\n📄 YAML generado:\n');
  console.log(yaml);
}

main();

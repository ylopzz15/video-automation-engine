/**
 * Ejemplo genérico: Planificar la creación de un proyecto.
 *
 * Uso:
 *   npx ts-node packages/planner/examples/create-project.ts
 */
import { RuleBasedPlanner } from '../src';
import type { PageMap } from '@video-engine/discovery';

async function main() {
  const planner = new RuleBasedPlanner();

  const pageMap: PageMap = {
    title: 'Project Manager',
    buttons: [
      { role: 'button', text: 'New Project', locator: 'text=New Project' },
      { role: 'button', text: 'Archive', locator: 'text=Archive' },
      { role: 'button', text: 'Submit', locator: 'text=Submit' },
    ],
    inputs: [
      { role: 'textbox', label: 'Project Name', locator: 'role=textbox[name="Project Name"]' },
      { role: 'textbox', label: 'Description', locator: 'role=textbox[name="Description"]' },
      { role: 'combobox', label: 'Team', locator: 'role=combobox[name="Team"]' },
    ],
    links: [
      { role: 'link', text: 'Projects', locator: 'text=Projects' },
      { role: 'link', text: 'Members', locator: 'text=Members' },
      { role: 'link', text: 'Reports', locator: 'text=Reports' },
    ],
  };

  const prompts = [
    'Create new project',
    'Fill project name',
    'Select team',
    'Go to reports',
    'Submit the form',
  ];

  console.log(`📋 Page: "${pageMap.title}"\n`);

  for (const prompt of prompts) {
    const plan = await planner.createPlan(prompt, pageMap);
    console.log(`🎯 "${prompt}"`);
    if (plan.length === 0) {
      console.log('   (no matches)\n');
    } else {
      for (const step of plan) {
        console.log(`   → ${step.action}: "${step.target}"`);
      }
      console.log('');
    }
  }
}

main();

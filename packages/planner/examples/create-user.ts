/**
 * Ejemplo genérico: Planificar la creación de un usuario.
 *
 * Uso:
 *   npx ts-node packages/planner/examples/create-user.ts
 */
import { RuleBasedPlanner } from '../src';
import type { PageMap } from '@video-engine/discovery';

async function main() {
  const planner = new RuleBasedPlanner();

  const pageMap: PageMap = {
    title: 'User Management',
    buttons: [
      { role: 'button', text: 'Create User', locator: 'text=Create User' },
      { role: 'button', text: 'Delete', locator: 'text=Delete' },
      { role: 'button', text: 'Save', locator: 'text=Save' },
      { role: 'button', text: 'Cancel', locator: 'text=Cancel' },
    ],
    inputs: [
      { role: 'textbox', label: 'Username', locator: 'role=textbox[name="Username"]' },
      { role: 'textbox', label: 'Email', locator: 'role=textbox[name="Email"]' },
      { role: 'textbox', label: 'Password', locator: 'role=textbox[name="Password"]' },
    ],
    links: [
      { role: 'link', text: 'Users', locator: 'text=Users' },
      { role: 'link', text: 'Settings', locator: 'text=Settings' },
      { role: 'link', text: 'Dashboard', locator: 'text=Dashboard' },
    ],
  };

  const prompts = [
    'Create a new user',
    'Fill in the email',
    'Save the form',
    'Go to settings',
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

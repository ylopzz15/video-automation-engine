/**
 * Ejemplo genérico: Planificar la creación de un ticket de soporte.
 *
 * Uso:
 *   npx ts-node packages/planner/examples/create-ticket.ts
 */
import { RuleBasedPlanner } from '../src';
import type { PageMap } from '@video-engine/discovery';

async function main() {
  const planner = new RuleBasedPlanner();

  const pageMap: PageMap = {
    title: 'Help Desk - Support Tickets',
    buttons: [
      { role: 'button', text: 'Create Ticket', locator: 'text=Create Ticket' },
      { role: 'button', text: 'Assign', locator: 'text=Assign' },
      { role: 'button', text: 'Close Ticket', locator: 'text=Close Ticket' },
      { role: 'button', text: 'Add Comment', locator: 'text=Add Comment' },
    ],
    inputs: [
      { role: 'textbox', label: 'Subject', locator: 'role=textbox[name="Subject"]' },
      { role: 'textarea', label: 'Description', locator: 'role=textarea[name="Description"]' },
      { role: 'combobox', label: 'Priority', locator: 'role=combobox[name="Priority"]' },
      { role: 'combobox', label: 'Category', locator: 'role=combobox[name="Category"]' },
    ],
    links: [
      { role: 'link', text: 'All Tickets', locator: 'text=All Tickets' },
      { role: 'link', text: 'My Tickets', locator: 'text=My Tickets' },
      { role: 'link', text: 'Knowledge Base', locator: 'text=Knowledge Base' },
    ],
  };

  const prompts = [
    'Create a new ticket',
    'Fill in the subject',
    'Set the priority',
    'Add a comment',
    'Go to my tickets',
    'Close this ticket',
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

const { RuleBasedPlanner } = require('../dist');

const planner = new RuleBasedPlanner();

// Test scoring genérico
const cases = [
  { prompt: 'create account', element: { role: 'button', text: 'Create Account' } },
  { prompt: 'crear cuenta', element: { role: 'button', text: 'Crear Cuenta' } },
  { prompt: 'submit form', element: { role: 'button', text: 'Submit' } },
  { prompt: 'go to settings', element: { role: 'link', text: 'Settings' } },
  { prompt: 'fill email', element: { role: 'textbox', label: 'Email Address' } },
  { prompt: 'no match at all', element: { role: 'button', text: 'Delete' } },
];

console.log('Scoring tests:\n');
for (const { prompt, element } of cases) {
  const score = planner.scorePromptAgainstElement(prompt, element);
  const label = element.text || element.label;
  console.log(`  "${prompt}" vs "${label}" → score: ${score}`);
}

// Test plan completo
console.log('\n\nFull plan test:\n');

const pageMap = {
  title: 'Generic App',
  buttons: [
    { role: 'button', text: 'Create Account', locator: 'text=Create Account' },
    { role: 'button', text: 'Login', locator: 'text=Login' },
    { role: 'button', text: 'Submit', locator: 'text=Submit' },
  ],
  inputs: [
    { role: 'textbox', label: 'Email', locator: 'role=textbox[name="Email"]' },
    { role: 'textbox', label: 'Password', locator: 'role=textbox[name="Password"]' },
  ],
  links: [
    { role: 'link', text: 'About', locator: 'text=About' },
    { role: 'link', text: 'Contact', locator: 'text=Contact' },
  ],
};

const prompts = ['create account', 'fill email', 'login', 'submit'];

async function run() {
  for (const prompt of prompts) {
    const plan = await planner.createPlan(prompt, pageMap);
    console.log(`  "${prompt}" → ${JSON.stringify(plan)}`);
  }
}

run();

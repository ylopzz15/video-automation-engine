/**
 * Pruebas unitarias para parseRoleSelector y resolución de locators.
 *
 * Uso:
 *   node packages/engine-playwright/tests/locators.test.js
 */
const { parseRoleSelector, isPlaywrightSelector } = require('../dist/locators');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ ${message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ ${message}`);
    console.log(`     Expected: ${JSON.stringify(expected)}`);
    console.log(`     Actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

// --- parseRoleSelector tests ---

console.log('\n🧪 parseRoleSelector:\n');

assertEqual(
  parseRoleSelector('role=link[name="Get started"]'),
  { role: 'link', name: 'Get started' },
  'link con name'
);

assertEqual(
  parseRoleSelector('role=button[name="Login"]'),
  { role: 'button', name: 'Login' },
  'button con name'
);

assertEqual(
  parseRoleSelector('role=textbox[name="Email"]'),
  { role: 'textbox', name: 'Email' },
  'textbox con name'
);

assertEqual(
  parseRoleSelector('role=combobox[name="Country"]'),
  { role: 'combobox', name: 'Country' },
  'combobox con name'
);

assertEqual(
  parseRoleSelector('role=button'),
  { role: 'button', name: undefined },
  'role sin name'
);

assertEqual(
  parseRoleSelector('text=Hello'),
  null,
  'text= no es role selector'
);

assertEqual(
  parseRoleSelector('#my-id'),
  null,
  'CSS id no es role selector'
);

assertEqual(
  parseRoleSelector('.my-class'),
  null,
  'CSS class no es role selector'
);

assertEqual(
  parseRoleSelector('role=link[name="Star microsoft/playwright on GitHub"]'),
  { role: 'link', name: 'Star microsoft/playwright on GitHub' },
  'name largo con espacios y slashes'
);

// --- isPlaywrightSelector tests ---

console.log('\n🧪 isPlaywrightSelector:\n');

assert(isPlaywrightSelector('role=link[name="Get started"]') === true, 'role= es Playwright');
assert(isPlaywrightSelector('text=Hello') === true, 'text= es Playwright');
assert(isPlaywrightSelector('data-testid=login') === true, 'data-testid= es Playwright');
assert(isPlaywrightSelector('//div[@class]') === true, 'XPath es Playwright');
assert(isPlaywrightSelector('#my-id') === false, 'CSS id no es Playwright');
assert(isPlaywrightSelector('.my-class') === false, 'CSS class no es Playwright');
assert(isPlaywrightSelector('div > span') === false, 'CSS complejo no es Playwright');

// --- Resumen ---

console.log(`\n${'─'.repeat(40)}`);
console.log(`\n📊 Resultados: ${passed} passed, ${failed} failed\n`);

if (failed > 0) process.exit(1);

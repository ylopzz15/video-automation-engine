/**
 * Ejemplo end-to-end: Discovery → PageMap → Planner → Plan
 *
 * Uso:
 *   npx ts-node packages/planner/examples/discover-and-plan.ts <url> "<prompt>"
 *
 * Ejemplo:
 *   npx ts-node packages/planner/examples/discover-and-plan.ts https://example.com "crear cuenta"
 */
import { MCPDiscoveryProvider } from '@video-engine/discovery';
import { RuleBasedPlanner } from '../src';

async function main() {
  const url = process.argv[2];
  const prompt = process.argv[3];

  if (!url || !prompt) {
    console.error('Uso: discover-and-plan <url> "<prompt>"');
    console.error('');
    console.error('Ejemplo:');
    console.error('  npx ts-node discover-and-plan.ts https://example.com "crear cuenta"');
    process.exit(1);
  }

  console.log(`\n🌐 URL: ${url}`);
  console.log(`💬 Prompt: "${prompt}"\n`);
  console.log('─'.repeat(50));

  // 1. Discovery: inspeccionar la página
  console.log('\n🔍 Ejecutando discovery...\n');
  const discovery = new MCPDiscoveryProvider();

  let pageMap;
  try {
    pageMap = await discovery.inspect(url);
  } catch (err: any) {
    console.error(`❌ Error en discovery: ${err.message}`);
    await discovery.close();
    process.exit(1);
  }

  // 2. Mostrar resultados de discovery
  console.log(`📄 Página: "${pageMap.title || '(sin título)'}"\n`);

  if (pageMap.buttons.length > 0) {
    console.log(`  Botones (${pageMap.buttons.length}):`);
    for (const btn of pageMap.buttons) {
      console.log(`    • "${btn.text}" → ${btn.locator}`);
    }
  }

  if (pageMap.inputs.length > 0) {
    console.log(`  Inputs (${pageMap.inputs.length}):`);
    for (const input of pageMap.inputs) {
      console.log(`    • [${input.role}] "${input.label}" → ${input.locator}`);
    }
  }

  if (pageMap.links.length > 0) {
    console.log(`  Links (${pageMap.links.length}):`);
    for (const link of pageMap.links) {
      console.log(`    • "${link.text}" → ${link.locator}`);
    }
  }

  const total = pageMap.buttons.length + pageMap.inputs.length + pageMap.links.length;
  console.log(`\n  Total: ${total} elementos interactivos`);

  // 3. Planner: generar plan de acciones
  console.log('\n' + '─'.repeat(50));
  console.log('\n🧠 Ejecutando planner...\n');

  const planner = new RuleBasedPlanner();
  const plan = await planner.createPlan(prompt, pageMap);

  if (plan.length === 0) {
    console.log('  ⚠️  No se encontraron coincidencias para el prompt.');
    console.log('  Intenta con un prompt más cercano al texto visible de los elementos.');
  } else {
    console.log(`  Plan (${plan.length} paso${plan.length > 1 ? 's' : ''}):\n`);
    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      console.log(`    ${i + 1}. [${step.action}] "${step.target}"`);
    }
  }

  console.log('\n' + '─'.repeat(50));
  console.log(`\n📦 JSON:\n`);
  console.log(JSON.stringify(plan, null, 2));

  // Cleanup
  await discovery.close();
}

main();

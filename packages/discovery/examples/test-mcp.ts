/**
 * Test de conectividad con Microsoft Playwright MCP (@playwright/mcp).
 *
 * Verifica:
 * 1. Conexión al servidor MCP vía stdio
 * 2. browser_navigate funciona
 * 3. browser_snapshot retorna datos
 * 4. El parsing produce un PageMap válido
 *
 * Uso:
 *   npx ts-node packages/discovery/examples/test-mcp.ts
 */
import { MCPDiscoveryProvider } from '../src';

async function main() {
  const url = 'https://playwright.dev';

  console.log('🧪 Test: Microsoft Playwright MCP (@playwright/mcp)\n');
  console.log(`   URL de prueba: ${url}\n`);
  console.log('─'.repeat(50));
  console.log('\n⏳ Conectando al servidor MCP...\n');

  const provider = new MCPDiscoveryProvider();

  try {
    const startTime = Date.now();
    const pageMap = await provider.inspect(url);
    const elapsed = Date.now() - startTime;

    console.log(`✅ Conexión exitosa (${elapsed}ms)\n`);
    console.log('─'.repeat(50));
    console.log('\n📄 Resultados:\n');

    console.log(`  Título: "${pageMap.title || '(no detectado)'}"`);
    console.log(`  Botones: ${pageMap.buttons.length}`);
    console.log(`  Inputs:  ${pageMap.inputs.length}`);
    console.log(`  Links:   ${pageMap.links.length}`);

    const total = pageMap.buttons.length + pageMap.inputs.length + pageMap.links.length;
    console.log(`  Total:   ${total} elementos\n`);

    // Mostrar primeros elementos de cada tipo
    if (pageMap.buttons.length > 0) {
      console.log('  Primeros botones:');
      for (const btn of pageMap.buttons.slice(0, 5)) {
        console.log(`    • "${btn.text}" → ${btn.locator}`);
      }
      console.log('');
    }

    if (pageMap.inputs.length > 0) {
      console.log('  Primeros inputs:');
      for (const input of pageMap.inputs.slice(0, 5)) {
        console.log(`    • [${input.role}] "${input.label}" → ${input.locator}`);
      }
      console.log('');
    }

    if (pageMap.links.length > 0) {
      console.log('  Primeros links:');
      for (const link of pageMap.links.slice(0, 10)) {
        console.log(`    • "${link.text}" → ${link.locator}`);
      }
      console.log('');
    }

    console.log('─'.repeat(50));
    console.log('\n📦 PageMap JSON (resumido):\n');
    console.log(JSON.stringify({
      title: pageMap.title,
      buttons: pageMap.buttons.length,
      inputs: pageMap.inputs.length,
      links: pageMap.links.length,
      sample: {
        firstButton: pageMap.buttons[0] || null,
        firstInput: pageMap.inputs[0] || null,
        firstLink: pageMap.links[0] || null,
      },
    }, null, 2));

    console.log('\n✅ Test completado exitosamente.');
  } catch (err: any) {
    console.error(`\n❌ Error: ${err.message}`);
    console.error('\nVerifica que @playwright/mcp esté disponible:');
    console.error('  npx @playwright/mcp@latest --help');
    process.exit(1);
  } finally {
    await provider.close();
  }
}

main();

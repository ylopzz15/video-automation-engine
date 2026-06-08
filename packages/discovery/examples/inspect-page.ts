/**
 * Ejemplo: Inspeccionar una página con MCPDiscoveryProvider.
 *
 * Uso:
 *   npx ts-node packages/discovery/examples/inspect-page.ts https://example.com
 */
import { MCPDiscoveryProvider, InteractiveElement } from '../src';

async function main() {
  const url = process.argv[2];

  if (!url) {
    console.error('Uso: ts-node inspect-page.ts <url>');
    console.error('Ejemplo: ts-node inspect-page.ts https://example.com');
    process.exit(1);
  }

  console.log(`🔍 Inspeccionando: ${url}\n`);

  const provider = new MCPDiscoveryProvider();

  try {
    const pageMap = await provider.inspect(url);

    if (pageMap.title) {
      console.log(`Título: ${pageMap.title}\n`);
    }

    console.log(`Elementos descubiertos:\n`);

    printSection('Botones', pageMap.buttons);
    printSection('Inputs', pageMap.inputs);
    printSection('Links', pageMap.links);

    const total = pageMap.buttons.length + pageMap.inputs.length + pageMap.links.length;
    console.log(`\n Total: ${total} elementos interactivos`);
  } catch (err: any) {
    console.error(`\n❌ Error: ${err.message}`);
  } finally {
    await provider.close();
  }
}

function printSection(name: string, elements: InteractiveElement[]) {
  console.log(`  ${name}: ${elements.length}`);
  for (const el of elements) {
    const label = el.text || el.label || '(sin texto)';
    const locator = el.locator ? ` → ${el.locator}` : '';
    console.log(`    • [${el.role}] "${label}"${locator}`);
  }
  if (elements.length > 0) console.log('');
}

main();

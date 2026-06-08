/**
 * Ejemplo: Crear un plan de acciones a partir de un prompt y un PageMap simulado.
 *
 * Uso:
 *   npx ts-node packages/planner/examples/create-plan.ts
 */
import { RuleBasedPlanner } from '../src';
import type { PageMap } from '@video-engine/discovery';

async function main() {
  const planner = new RuleBasedPlanner();

  // PageMap simulado (como si viniera de MCPDiscoveryProvider)
  const pageMap: PageMap = {
    title: 'AVIA - Sistema de Gestión',
    buttons: [
      { role: 'button', text: 'Registrar Piloto', locator: 'text=Registrar Piloto' },
      { role: 'button', text: 'Guardar', locator: 'text=Guardar' },
      { role: 'button', text: 'Cancelar', locator: 'text=Cancelar' },
    ],
    inputs: [
      { role: 'textbox', label: 'Nombre', locator: 'role=textbox[name="Nombre"]' },
      { role: 'textbox', label: 'Email', locator: 'role=textbox[name="Email"]' },
    ],
    links: [
      { role: 'link', text: 'Documentos', locator: 'text=Documentos' },
      { role: 'link', text: 'Tripulación', locator: 'text=Tripulación' },
      { role: 'link', text: 'Configuración', locator: 'text=Configuración' },
    ],
  };

  // Probar distintos prompts
  const prompts = [
    'Registrar piloto',
    'Ir a documentos',
    'Llenar el nombre',
    'Guardar los cambios',
  ];

  console.log(`📋 PageMap: "${pageMap.title}"\n`);
  console.log(`   Botones: ${pageMap.buttons.map((b) => b.text).join(', ')}`);
  console.log(`   Inputs: ${pageMap.inputs.map((i) => i.label).join(', ')}`);
  console.log(`   Links: ${pageMap.links.map((l) => l.text).join(', ')}`);
  console.log('\n---\n');

  for (const prompt of prompts) {
    const plan = await planner.createPlan(prompt, pageMap);

    console.log(`🎯 Prompt: "${prompt}"`);
    if (plan.length === 0) {
      console.log('   (sin coincidencias)\n');
    } else {
      for (const step of plan) {
        console.log(`   → ${step.action}: "${step.target}"`);
      }
      console.log('');
    }
  }
}

main();

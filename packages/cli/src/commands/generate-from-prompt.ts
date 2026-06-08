import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CommandModule } from 'yargs';
import { MCPDiscoveryProvider } from '@video-engine/discovery';
import { LLMPlanner } from '@video-engine/planner';
import { YamlWorkflowGenerator } from '@video-engine/workflow-generator';

interface GenerateFromPromptArgs {
  url: string;
  prompt: string;
  output?: string;
}

export const generateFromPromptCommand: CommandModule<{}, GenerateFromPromptArgs> = {
  command: 'generate-from-prompt',
  describe: 'Discover a page, plan actions from a prompt, and generate a workflow YAML',
  builder: (yargs) =>
    yargs
      .option('url', {
        alias: 'u',
        type: 'string',
        demandOption: true,
        describe: 'URL to inspect',
      })
      .option('prompt', {
        alias: 'p',
        type: 'string',
        demandOption: true,
        describe: 'Natural language prompt describing the desired action',
      })
      .option('output', {
        alias: 'o',
        type: 'string',
        default: './output/generated.yml',
        describe: 'Output path for the generated YAML',
      }),

  handler: async (args) => {
    const discovery = new MCPDiscoveryProvider();

    try {
      console.log(`\n🌐 URL: ${args.url}`);
      console.log(`💬 Prompt: "${args.prompt}"\n`);
      console.log('─'.repeat(50));

      // 1. Discovery
      console.log('\n🔍 Descubriendo elementos de la página...\n');
      const pageMap = await discovery.inspect(args.url);

      console.log(`📄 Página: "${pageMap.title || '(sin título)'}"\n`);

      const total = pageMap.buttons.length + pageMap.inputs.length + pageMap.links.length;

      if (pageMap.buttons.length > 0) {
        console.log(`  Botones (${pageMap.buttons.length}):`);
        for (const btn of pageMap.buttons) {
          console.log(`    • "${btn.text}"`);
        }
      }
      if (pageMap.inputs.length > 0) {
        console.log(`  Inputs (${pageMap.inputs.length}):`);
        for (const input of pageMap.inputs) {
          console.log(`    • [${input.role}] "${input.label}"`);
        }
      }
      if (pageMap.links.length > 0) {
        console.log(`  Links (${pageMap.links.length}):`);
        for (const link of pageMap.links) {
          console.log(`    • "${link.text}"`);
        }
      }

      console.log(`\n  Total: ${total} elementos interactivos`);

      // 2. Planner
      console.log('\n' + '─'.repeat(50));
      console.log('\n🧠 Generando plan de acciones...\n');

      const planner = new LLMPlanner();
      const plan = await planner.createPlan(args.prompt, pageMap);

      if (plan.length === 0) {
        console.log('  ⚠️  No se encontraron coincidencias para el prompt.');
        console.log('  Intenta con un prompt más cercano al texto visible de los elementos.');
        await discovery.close();
        return;
      }

      console.log(`  Plan (${plan.length} paso${plan.length > 1 ? 's' : ''}):`);
      for (const step of plan) {
        console.log(`    → [${step.action}] "${step.target}"`);
      }

      // 3. Workflow Generator
      console.log('\n' + '─'.repeat(50));
      console.log('\n📝 Generando workflow YAML...\n');

      const generator = new YamlWorkflowGenerator();
      const yaml = await generator.generate(plan, {
        title: `Workflow: ${args.prompt}`,
        baseUrl: args.url,
      });

      // 4. Guardar archivo
      const outputPath = path.resolve(args.output!);
      const outputDir = path.dirname(outputPath);
      fs.mkdirSync(outputDir, { recursive: true });
      fs.writeFileSync(outputPath, yaml, 'utf-8');

      console.log(`  ✅ YAML guardado en: ${outputPath}\n`);
      console.log('─'.repeat(50));
      console.log('\n📄 Contenido:\n');
      console.log(yaml);
    } catch (err: any) {
      console.error(`\n❌ Error: ${err.message}`);
      process.exit(1);
    } finally {
      await discovery.close();
    }
  },
};

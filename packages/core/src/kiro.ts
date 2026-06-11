import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as yaml from 'js-yaml';
import { Pipeline } from './pipeline';
import { Engine } from './types';
import { generateNarration } from '@video-engine/narration-generator';
import type { VideoConfig } from '@video-engine/config';

/**
 * Interfaces de las dependencias que Kiro necesita.
 * Inyectadas por constructor para evitar acoplamientos circulares.
 */
export interface DiscoveryAdapter {
  inspect(url: string): Promise<any>;
  close(): Promise<void>;
}

export interface PlannerAdapter {
  createPlan(script: string, pageMap: any): Promise<Array<{ action: string; target: string; value?: string; locator?: string }>>;
}

export interface WorkflowGeneratorAdapter {
  generate(plan: any[], options?: { title?: string; baseUrl?: string }): Promise<string>;
}

export interface ConfigLoaderAdapter {
  validate(data: unknown, source?: string): VideoConfig;
}

export interface KiroOptions {
  apiKey?: string;
  discovery: DiscoveryAdapter;
  planner: PlannerAdapter;
  workflowGenerator: WorkflowGeneratorAdapter;
  configLoader: ConfigLoaderAdapter;
  engines: Engine[];
}

export interface RecordOptions {
  url: string;
  script: string;
  output?: string;
}

export interface RecordResult {
  videoPath: string;
  yamlContent: string;
}

/**
 * API de alto nivel del framework.
 *
 * Orquesta el flujo completo:
 * URL → Discovery → Planner → WorkflowGenerator → Engine → Video
 */
export class Kiro {
  private options: KiroOptions;

  constructor(options: KiroOptions) {
    this.options = options;
  }

  async record(opts: RecordOptions): Promise<RecordResult> {
    const { discovery, planner, workflowGenerator, configLoader, engines } = this.options;
    const outputPath = path.resolve(opts.output ?? './output/recording.mp4');

    try {
      // 1. Discovery → PageMap
      const pageMap = await discovery.inspect(opts.url);

      // 2. Planner → PlanSteps
      const plan = await planner.createPlan(opts.script, pageMap);

      if (plan.length === 0) {
        throw new Error('El planner no generó ningún paso. Intenta con un script más específico.');
      }

      // 3. WorkflowGenerator → YAML en memoria
      const yamlContent = await workflowGenerator.generate(plan, {
        title: `Recording: ${opts.script}`,
        baseUrl: opts.url,
      });

      // 4. Parsear el YAML generado como VideoConfig
      const config = configLoader.validate(
        yaml.load(yamlContent) as unknown,
        'generated-workflow',
      );

      // Sobreescribir output path
      config.output.path = outputPath;

      // 5. Ejecutar Pipeline (Playwright → FFmpeg)
      const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiro-record-'));
      const outputDir = path.dirname(outputPath);
      fs.mkdirSync(outputDir, { recursive: true });

      // Generar narración automática si hay engine de voz configurado
      if (config.voice) {
        const narrationScripts = generateNarration(config.scenes);
        
        // Inyectar narración en escenas que no tienen texto manual
        for (const script of narrationScripts) {
          const scene = config.scenes.find(s => s.id === script.sceneId);
          if (scene && !scene.narration) {
            scene.narration = script.text;
          }
        }
      }

        const pipeline = new Pipeline();
        for (const engine of engines) {
          pipeline.use(engine);
        }

        await pipeline.run({
          config,
          workDir,
          assets: new Map(),
          metadata: {},
        });

      return { videoPath: outputPath, yamlContent };
    } finally {
      await discovery.close();
    }
  }
}

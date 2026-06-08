import { Engine, PipelineContext, PipelineResult, StageResult } from './types';
import type { Plugin, HookName } from '@video-engine/plugin-api';

/**
 * Orquestador del pipeline de generación de video.
 * Ejecuta engines en secuencia y notifica a plugins en cada fase.
 */
export class Pipeline {
  private engines: Engine[] = [];
  private plugins: Plugin[] = [];

  use(engine: Engine): this {
    this.engines.push(engine);
    return this;
  }

  plugin(plugin: Plugin): this {
    this.plugins.push(plugin);
    return this;
  }

  async run(ctx: PipelineContext): Promise<PipelineResult> {
    const stages: StageResult[] = [];
    const start = Date.now();

    await this.emit('pipeline:start', ctx);

    for (const engine of this.engines) {
      await this.emit('stage:before', ctx, engine.name);

      const result = await engine.execute(ctx);
      stages.push(result);

      await this.emit('stage:after', ctx, engine.name, result);
    }

    await this.emit('pipeline:end', ctx);

    return {
      outputPath: ctx.assets.get('output') ?? '',
      duration: Date.now() - start,
      stages,
    };
  }

  private async emit(hook: HookName, ...args: unknown[]): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.hooks[hook]) {
        await plugin.hooks[hook]!(...args);
      }
    }
  }
}

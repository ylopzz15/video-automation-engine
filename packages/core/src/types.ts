import type { VideoConfig } from '@video-engine/config';

export interface PipelineContext {
  config: VideoConfig;
  workDir: string;
  assets: Map<string, string>;
  metadata: Record<string, unknown>;
}

export interface PipelineResult {
  outputPath: string;
  duration: number;
  stages: StageResult[];
}

export interface StageResult {
  engine: string;
  durationMs: number;
  artifacts: string[];
  scenes?: SceneResult[];
}

export interface SceneResult {
  sceneId: string;
  videoPath: string;
  durationMs: number;
  screenshotPath?: string;
}

export abstract class Engine {
  abstract readonly name: string;

  abstract execute(ctx: PipelineContext): Promise<StageResult>;

  /** Limpieza opcional de recursos. Sobreescribir en subclases si es necesario. */
  async cleanup(_ctx: PipelineContext): Promise<void> {}
}

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Engine, PipelineContext, StageResult, SceneResult } from '@video-engine/core';

const execFileAsync = promisify(execFile);

export interface FFmpegEngineOptions {
  /** Ruta al binario de ffmpeg (debe estar en PATH si se omite) */
  ffmpegPath?: string;
  /** Flags adicionales para la salida (ej: ['-preset', 'fast']) */
  extraArgs?: string[];
  /** Sobreescribir archivo de salida sin preguntar */
  overwrite?: boolean;
}

export class FFmpegEngine extends Engine {
  readonly name = 'ffmpeg';
  private options: Required<FFmpegEngineOptions>;

  constructor(options: FFmpegEngineOptions = {}) {
    super();
    this.options = {
      ffmpegPath: options.ffmpegPath ?? 'ffmpeg',
      extraArgs: options.extraArgs ?? [],
      overwrite: options.overwrite ?? true,
    };
  }

  async execute(ctx: PipelineContext): Promise<StageResult> {
    const start = Date.now();

    const sceneResults = this.getSceneResults(ctx);
    this.validateSceneVideos(sceneResults);

    const concatFilePath = this.writeConcatFile(sceneResults, ctx.workDir);
    const outputPath = this.resolveOutputPath(ctx);
    const outputDir = path.dirname(outputPath);
    fs.mkdirSync(outputDir, { recursive: true });

    await this.runFFmpeg(concatFilePath, outputPath);

    if (!fs.existsSync(outputPath)) {
      throw new Error(`FFmpeg did not produce output file: ${outputPath}`);
    }

    ctx.assets.set('output', outputPath);

    return {
      engine: this.name,
      durationMs: Date.now() - start,
      artifacts: [outputPath, concatFilePath],
    };
  }

  /**
   * Obtiene los SceneResult[] del contexto del pipeline.
   * PlaywrightEngine los almacena en ctx.metadata.sceneResults
   * y los paths de video en ctx.assets['scene-videos'].
   */
  private getSceneResults(ctx: PipelineContext): SceneResult[] {
    if (ctx.metadata.sceneResults && Array.isArray(ctx.metadata.sceneResults)) {
      return ctx.metadata.sceneResults as SceneResult[];
    }

    // Fallback: reconstruir desde assets si no hay metadata estructurada
    const raw = ctx.assets.get('scene-videos');
    if (!raw) {
      throw new Error(
        'No scene videos found in pipeline context. ' +
        'Ensure the Playwright engine runs before FFmpeg.',
      );
    }

    const videoPaths: string[] = JSON.parse(raw);
    return videoPaths.map((videoPath, i) => ({
      sceneId: `scene-${i}`,
      videoPath,
      durationMs: 0,
    }));
  }

  /**
   * Verifica que cada escena tenga un archivo de video existente en disco.
   * Lanza error descriptivo con la lista de escenas faltantes.
   */
  private validateSceneVideos(scenes: SceneResult[]): void {
    if (scenes.length === 0) {
      throw new Error('No scenes to concatenate. Pipeline produced zero scene results.');
    }

    const missing: string[] = [];

    for (const scene of scenes) {
      if (!scene.videoPath) {
        missing.push(`Scene "${scene.sceneId}": no video path`);
      } else if (!fs.existsSync(scene.videoPath)) {
        missing.push(`Scene "${scene.sceneId}": file not found at ${scene.videoPath}`);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Missing scene video files:\n${missing.map((m) => `  • ${m}`).join('\n')}`,
      );
    }
  }

  /**
   * Genera el archivo concat.txt para el demuxer de FFmpeg.
   * Formato: file '/ruta/absoluta/a/scene.webm'
   * Nota: FFmpeg requiere barras normales y comillas simples escapadas.
   */
  private writeConcatFile(scenes: SceneResult[], workDir: string): string {
    const concatPath = path.join(workDir, 'concat.txt');

    const lines = scenes.map((scene) => {
      const normalized = scene.videoPath.replace(/\\/g, '/').replace(/'/g, "'\\''");
      return `file '${normalized}'`;
    });

    fs.writeFileSync(concatPath, lines.join('\n'), 'utf-8');
    return concatPath;
  }

  /**
   * Resuelve la ruta final del video de salida.
   * Si la ruta del config es relativa, se resuelve desde workDir.
   */
  private resolveOutputPath(ctx: PipelineContext): string {
    const configPath = ctx.config.output.path;

    if (path.isAbsolute(configPath)) {
      return configPath;
    }

    return path.resolve(ctx.workDir, configPath);
  }

  /**
   * Ejecuta FFmpeg para concatenar los videos de escena en el output final.
   * Usa el concat demuxer → re-codifica a H.264 mp4 con faststart.
   */
  private async runFFmpeg(concatFilePath: string, outputPath: string): Promise<void> {
    const args: string[] = [];

    if (this.options.overwrite) {
      args.push('-y');
    }

    args.push(
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFilePath,
    );

    args.push(
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
    );

    if (this.options.extraArgs.length > 0) {
      args.push(...this.options.extraArgs);
    }

    args.push(outputPath);

    try {
      const { stderr } = await execFileAsync(this.options.ffmpegPath, args, {
        maxBuffer: 10 * 1024 * 1024,
      });

      // FFmpeg escribe progreso a stderr — no es un error
      if (process.env.VIDEO_ENGINE_DEBUG) {
        console.error('[ffmpeg stderr]', stderr);
      }
    } catch (err: any) {
      const message = err.stderr || err.message || 'Unknown FFmpeg error';
      throw new Error(`FFmpeg failed:\n${message}`);
    }
  }
}

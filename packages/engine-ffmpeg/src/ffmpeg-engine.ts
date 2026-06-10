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
  /** Directorio raíz del proyecto (para resolver frames/) */
  projectRoot?: string;
}

interface FrameConfig {
  image: string;
  totalWidth: number;
  totalHeight: number;
  screen: { x: number; y: number; width: number; height: number };
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
      projectRoot: options.projectRoot ?? process.cwd(),
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

    // Paso 1: concatenar escenas en video intermedio
    const frameConfig = this.resolveFrame(ctx);
    const rawVideoPath = frameConfig
      ? path.join(ctx.workDir, 'raw-concat.mp4')
      : outputPath;

    await this.runConcat(concatFilePath, rawVideoPath);

    // Paso 2: si hay frame, superponer el video en el marco del dispositivo
    if (frameConfig) {
      await this.applyFrame(rawVideoPath, outputPath, frameConfig);
    }

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
   * Resuelve la configuración de frame si está definida en el config.
   * Busca frames/optimized/{frame}.png (pre-procesado por prepare-frames).
   */
  private resolveFrame(ctx: PipelineContext): FrameConfig | null {
    const frameName = (ctx.config as any).frame;
    if (!frameName) return null;

    const framesDir = path.join(this.options.projectRoot, 'frames');
    const framesJsonPath = path.join(framesDir, 'frames.json');

    if (!fs.existsSync(framesJsonPath)) {
      throw new Error(`frames/frames.json not found at ${framesJsonPath}`);
    }

    const framesData = JSON.parse(fs.readFileSync(framesJsonPath, 'utf-8'));
    const config = framesData[frameName];

    if (!config) {
      throw new Error(`Frame "${frameName}" not found in frames/frames.json`);
    }

    // Usa la versión optimizada (pre-procesada por npm run prepare-frames)
    const optimizedPath = path.join(framesDir, 'optimized', config.image);
    const originalPath = path.join(framesDir, config.image);
    const imagePath = fs.existsSync(optimizedPath) ? optimizedPath : originalPath;

    if (!fs.existsSync(imagePath)) {
      throw new Error(`Frame image not found: ${imagePath}. Run: npm run prepare-frames`);
    }

    return {
      image: imagePath,
      totalWidth: config.totalWidth,
      totalHeight: config.totalHeight,
      screen: config.screen,
    };
  }

  /**
   * Aplica el marco de dispositivo sobre el video.
   * Estrategia: plantilla como fondo (input 0), video posicionado en el hueco (input 1).
   * La isla dinámica y bordes del frame ya son opacos en el PNG y no se modifican.
   */
private async applyFrame(
    inputVideo: string,
    outputPath: string,
    frame: FrameConfig,
  ): Promise<void> {
    const { screen, image, totalWidth, totalHeight } = frame;

    // 1. [1:v]scale: Escala el video grabado al tamaño de la pantalla del dispositivo.
    // 2. [vid]pad: Expande el lienzo al tamaño total de la plantilla y ubica el video en x,y.
    // 3. [padded][0:v]overlay: Coloca la plantilla PNG (con su centro transparente) ENCIMA del lienzo.
    const filterComplex =
      `[1:v]scale=${screen.width}:${screen.height}[vid];` +
      `[vid]pad=${totalWidth}:${totalHeight}:${screen.x}:${screen.y}:color=black[padded];` +
      `[padded][0:v]overlay=0:0:eof_action=repeat[out]`;

    const args: string[] = [];

    if (this.options.overwrite) {
      args.push('-y');
    }

    args.push(
      '-i', image,
      '-i', inputVideo,
      '-filter_complex', filterComplex,
      '-map', '[out]',
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-shortest',
      outputPath,
    );

    try {
      await execFileAsync(this.options.ffmpegPath, args, {
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (err: any) {
      const message = err.stderr || err.message || 'Unknown FFmpeg error';
      throw new Error(`FFmpeg frame overlay failed:\n${message}`);
    }
  }

  private getSceneResults(ctx: PipelineContext): SceneResult[] {
    if (ctx.metadata.sceneResults && Array.isArray(ctx.metadata.sceneResults)) {
      return ctx.metadata.sceneResults as SceneResult[];
    }

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

  private writeConcatFile(scenes: SceneResult[], workDir: string): string {
    const concatPath = path.join(workDir, 'concat.txt');

    const lines = scenes.map((scene) => {
      const normalized = scene.videoPath.replace(/\\/g, '/').replace(/'/g, "'\\''");
      return `file '${normalized}'`;
    });

    fs.writeFileSync(concatPath, lines.join('\n'), 'utf-8');
    return concatPath;
  }

  private resolveOutputPath(ctx: PipelineContext): string {
    const configPath = ctx.config.output.path;

    if (path.isAbsolute(configPath)) {
      return configPath;
    }

    return path.resolve(ctx.workDir, configPath);
  }

  /**
   * Concatena los videos de escena en un solo archivo.
   */
  private async runConcat(concatFilePath: string, outputPath: string): Promise<void> {
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

      if (process.env.VIDEO_ENGINE_DEBUG) {
        console.error('[ffmpeg stderr]', stderr);
      }
    } catch (err: any) {
      const message = err.stderr || err.message || 'Unknown FFmpeg error';
      throw new Error(`FFmpeg failed:\n${message}`);
    }
  }
}

import * as path from 'node:path';
import * as fs from 'node:fs';
import { chromium, Browser, BrowserContext, Page, devices } from 'playwright';
import { Engine, PipelineContext, StageResult, SceneResult } from '@video-engine/core';
import type { SceneConfig, PlaywrightConfig, ViewportConfig } from '@video-engine/config';
import { executeAction, ActionExecutorOptions } from './actions';

export interface PlaywrightEngineOptions {
  /** Ejecutar en modo headless (false = headed para debug) */
  headless?: boolean;
  /** Retardo en ms entre acciones (para grabación más fluida) */
  slowMo?: number;
  /** Capturar screenshot al finalizar cada escena */
  screenshotOnComplete?: boolean;
  /** Mostrar indicador visual en clics */
  highlightClicks?: boolean;
  /** Mostrar cursor visible que se desplaza hacia los elementos */
  showCursor?: boolean;
  /** Configuración de viewport personalizada */
  viewport?: Partial<ViewportConfig>;
  /** Reutilizar un solo Context/Page entre todas las escenas */
  persistentContext?: boolean;
}

export class PlaywrightEngine extends Engine {
  readonly name = 'playwright';
  private browser: Browser | null = null;
  private engineOptions: PlaywrightEngineOptions;

  constructor(options: PlaywrightEngineOptions = {}) {
    super();
    this.engineOptions = options;
  }

  async execute(ctx: PipelineContext): Promise<StageResult> {
    const start = Date.now();

    const yamlConfig = ctx.config.playwright;
    const resolved = this.resolveOptions(yamlConfig);

  if (!resolved.persistentContext) {
    this.browser = await chromium.launch({
      headless: resolved.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

    const { scenes } = ctx.config;
    const viewport = this.resolveViewport(resolved);

    let result: StageResult;

    if (resolved.persistentContext) {
      result = await this.executeSharedContext(scenes, viewport, ctx.workDir, resolved, start);
    } else {
      result = await this.executeIsolatedScenes(scenes, viewport, ctx.workDir, resolved, start);
    }
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    // Almacenar paths de video para engines downstream (FFmpeg)
    const videoPaths = (result.scenes ?? []).map((r) => r.videoPath);
    ctx.assets.set('scene-videos', JSON.stringify(videoPaths));
    ctx.metadata.sceneResults = result.scenes;

    return result;
  }

  /**
   * Modo persistentContext: un solo Context/Page para todas las escenas.
   * El estado (navegación, cookies, formularios) persiste entre escenas.
   * Produce un único archivo de video con todo el flujo.
   */
  private async executeSharedContext(
  scenes: SceneConfig[],
  viewport: ResolvedViewport,
  workDir: string,
  options: ResolvedOptions,
  startTime: number,
): Promise<StageResult> {
  const videoDir = path.join(workDir, 'videos', 'shared');
  const screenshotDir = path.join(workDir, 'screenshots');
  fs.mkdirSync(videoDir, { recursive: true });
  fs.mkdirSync(screenshotDir, { recursive: true });

  const profileDir = path.join(process.cwd(), '.browser-profile');
  fs.mkdirSync(profileDir, { recursive: true });

  // launchPersistentContext guarda sesión completa entre ejecuciones
  const context: BrowserContext = await chromium.launchPersistentContext(profileDir, {
    headless: options.headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    slowMo: options.slowMo,
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor,
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
    userAgent: viewport.userAgent,
    recordVideo: {
      dir: videoDir,
      size: { width: viewport.width, height: viewport.height },
    },
  });

  context.setDefaultTimeout(30_000);

  const page: Page = await context.newPage();
  const sceneResults: SceneResult[] = [];
  const artifacts: string[] = [];

  for (const scene of scenes) {
    const sceneStart = Date.now();

    console.log(`[scene] ${scene.id}`);
    console.log(`[page-url] ${page.url()}`);

    const actionOptions: ActionExecutorOptions = {
      slowMo: options.slowMo,
      highlightClicks: options.highlightClicks,
      showCursor: options.showCursor,
      screenshotDir,
      sceneId: scene.id,
    };

    for (const step of scene.steps) {
      try {
        await executeAction(page, step, actionOptions);
      } catch (err: any) {
        console.log(`[SKIP] ${scene.id} → ${step.action}: ${err.message?.split('\n')[0]}`);
      }
    }

    let screenshotPath: string | undefined;
    if (options.screenshotOnComplete) {
      screenshotPath = path.join(screenshotDir, `scene-${scene.id}-final.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      artifacts.push(screenshotPath);
    }

    sceneResults.push({
      sceneId: scene.id,
      videoPath: '',
      durationMs: Date.now() - sceneStart,
      screenshotPath,
    });
  }

  // Cerrar para finalizar el archivo de video
  await page.close();
  await context.close();

  // Renombrar el video generado
  const videoFile = this.findVideoFile(videoDir);
  const finalVideoPath = path.join(workDir, 'recording.webm');
  fs.renameSync(videoFile, finalVideoPath);
  artifacts.push(finalVideoPath);

  for (const sr of sceneResults) {
    sr.videoPath = finalVideoPath;
  }

  return {
    engine: this.name,
    durationMs: Date.now() - startTime,
    artifacts,
    scenes: sceneResults,
  };
}

  /**
   * Modo aislado (original): cada escena tiene su propio Context/Page.
   * Cada escena produce un .webm independiente.
   */
  private async executeIsolatedScenes(
    scenes: SceneConfig[],
    viewport: ResolvedViewport,
    workDir: string,
    options: ResolvedOptions,
    startTime: number,
  ): Promise<StageResult> {
    const artifacts: string[] = [];
    const sceneResults: SceneResult[] = [];

    for (const scene of scenes) {
      const sceneResult = await this.recordIsolatedScene(scene, viewport, workDir, options);
      sceneResults.push(sceneResult);
      artifacts.push(sceneResult.videoPath);

      if (sceneResult.screenshotPath) {
        artifacts.push(sceneResult.screenshotPath);
      }
    }

    return {
      engine: this.name,
      durationMs: Date.now() - startTime,
      artifacts,
      scenes: sceneResults,
    };
  }

  private async recordIsolatedScene(
    scene: SceneConfig,
    viewport: ResolvedViewport,
    workDir: string,
    options: ResolvedOptions,
  ): Promise<SceneResult> {
    const sceneStart = Date.now();
    const videoDir = path.join(workDir, 'videos', scene.id);
    const screenshotDir = path.join(workDir, 'screenshots');
    fs.mkdirSync(videoDir, { recursive: true });
    fs.mkdirSync(screenshotDir, { recursive: true });

    const context: BrowserContext = await this.browser!.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.deviceScaleFactor,
      isMobile: viewport.isMobile,
      hasTouch: viewport.hasTouch,
      userAgent: viewport.userAgent,
      recordVideo: {
        dir: videoDir,
        size: { width: viewport.width, height: viewport.height },
      },
    });

    context.setDefaultTimeout(30_000);

    const page: Page = await context.newPage();

    console.log(`[scene] ${scene.id}`);
    console.log(`[page-url] ${page.url()}`);

    const actionOptions: ActionExecutorOptions = {
      slowMo: options.slowMo,
      highlightClicks: options.highlightClicks,
      showCursor: options.showCursor,
      screenshotDir,
      sceneId: scene.id,
    };

    for (const step of scene.steps) {
      await executeAction(page, step, actionOptions);
    }

    let screenshotPath: string | undefined;
    if (options.screenshotOnComplete) {
      screenshotPath = path.join(screenshotDir, `scene-${scene.id}-final.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
    }

    await page.close();
    await context.close();

    const videoFile = this.findVideoFile(videoDir);
    const finalVideoPath = path.join(workDir, `scene-${scene.id}.webm`);
    fs.renameSync(videoFile, finalVideoPath);

    return {
      sceneId: scene.id,
      videoPath: finalVideoPath,
      durationMs: Date.now() - sceneStart,
      screenshotPath,
    };
  }

  /**
   * Fusiona la configuración YAML con las opciones del constructor.
   */
  private resolveOptions(yamlConfig?: PlaywrightConfig): ResolvedOptions {
    return {
      headless: this.engineOptions.headless ?? yamlConfig?.headless ?? true,
      slowMo: this.engineOptions.slowMo ?? yamlConfig?.slowMo ?? 0,
      screenshotOnComplete:
        this.engineOptions.screenshotOnComplete ?? yamlConfig?.screenshotOnComplete ?? true,
      highlightClicks:
        this.engineOptions.highlightClicks ?? yamlConfig?.highlightClicks ?? false,
      showCursor:
        this.engineOptions.showCursor ?? yamlConfig?.showCursor ?? true,
      persistentContext:
        this.engineOptions.persistentContext ?? yamlConfig?.persistentContext ?? false,
      viewport: this.engineOptions.viewport ?? yamlConfig?.viewport,
    };
  }

  /**
   * Resuelve las dimensiones del viewport.
   */
  private resolveViewport(options: ResolvedOptions): ResolvedViewport {
    const vp = options.viewport;

    if (vp?.device) {
      const device = devices[vp.device];
      if (!device) {
        throw new Error(
          `Unknown device "${vp.device}". See Playwright docs for valid device names.`,
        );
      }
      return {
        width: device.viewport.width,
        height: device.viewport.height,
        deviceScaleFactor: device.deviceScaleFactor,
        isMobile: device.isMobile ?? false,
        hasTouch: device.hasTouch ?? false,
        userAgent: device.userAgent,
      };
    }

    return {
      width: vp?.width ?? 1920,
      height: vp?.height ?? 1080,
      deviceScaleFactor: vp?.deviceScaleFactor ?? 1,
      isMobile: vp?.isMobile ?? false,
      hasTouch: vp?.hasTouch ?? false,
    };
  }

  private findVideoFile(dir: string): string {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.webm'));
    if (files.length === 0) {
      throw new Error(`No video file found in ${dir}`);
    }
    return path.join(dir, files[0]);
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// --- Tipos internos ---

interface ResolvedOptions {
  headless: boolean;
  slowMo: number;
  screenshotOnComplete: boolean;
  highlightClicks: boolean;
  showCursor: boolean;
  persistentContext: boolean;
  viewport?: Partial<ViewportConfig>;
}

interface ResolvedViewport {
  width: number;
  height: number;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
  userAgent?: string;
}

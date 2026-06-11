import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import type { CommandModule } from 'yargs';
import { loadConfig } from '@video-engine/config';
import { Pipeline } from '@video-engine/core';
import { PlaywrightEngine } from '@video-engine/engine-playwright';
import { FFmpegEngine } from '@video-engine/engine-ffmpeg';
import { generateNarration } from '@video-engine/narration-generator';

interface GenerateArgs {
  config: string;
  output?: string;
  verbose?: boolean;
}

function resolveFFmpegPath(): string {
  if (process.env.FFMPEG_PATH) {
    return process.env.FFMPEG_PATH;
  }

  try {
    const installer = require('@ffmpeg-installer/ffmpeg');
    if (installer.path) return installer.path;
  } catch {}

  try {
    const cmd = process.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg';
    const result = execSync(cmd, { encoding: 'utf-8' }).trim().split('\n')[0];
    if (result) return result.trim();
  } catch {}

  return 'ffmpeg';
}

export const generateCommand: CommandModule<{}, GenerateArgs> = {
  command: 'generate',
  describe: 'Generate a product video from a YAML config',
  builder: (yargs) =>
    yargs
      .option('config', {
        alias: 'c',
        type: 'string',
        demandOption: true,
        describe: 'Path to the YAML config file',
      })
      .option('output', {
        alias: 'o',
        type: 'string',
        describe: 'Override output path',
      })
      .option('verbose', {
        alias: 'v',
        type: 'boolean',
        default: false,
        describe: 'Enable verbose logging',
      }),

  handler: async (args) => {
    try {
      const config = loadConfig(args.config);

      if (args.output) {
        config.output.path = args.output;
      }

      const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-engine-'));
      const ffmpegPath = resolveFFmpegPath();

      if (args.verbose) {
        console.log(`[video-engine] Config loaded: ${config.title}`);
        console.log(`[video-engine] Work dir: ${workDir}`);
        console.log(`[video-engine] Scenes: ${config.scenes.length}`);
        console.log(`[video-engine] FFmpeg: ${ffmpegPath}`);
      }

      // Inyectar narración automática si hay voz configurada
      if (config.voice) {
        const narrationScripts = generateNarration(config.scenes);
        for (const script of narrationScripts) {
          const scene = config.scenes.find(s => s.id === script.sceneId);
          if (scene && !scene.narration) {
            scene.narration = script.text;
          }
        }
      }

      // Construir pipeline
      const pipeline = new Pipeline()
        .use(new PlaywrightEngine());

      // Activar Polly si hay narración en cualquier escena
      const hasNarration = config.scenes.some((s: any) => s.narration);
      if (hasNarration) {
        const { PollyEngine } = await import('@video-engine/engine-polly');
        pipeline.use(new PollyEngine());
      }

      pipeline.use(new FFmpegEngine({ ffmpegPath }));

      const result = await pipeline.run({
        config,
        workDir,
        assets: new Map(),
        metadata: {},
      });

      console.log(`\n✅ Video generated: ${result.outputPath}`);
      console.log(`   Duration: ${result.duration}ms`);
      console.log(`   Stages: ${result.stages.map((s) => s.engine).join(' → ')}`);
    } catch (err: any) {
      console.error(`\n❌ Error: ${err.message}`);
      process.exit(1);
    }
  },
};
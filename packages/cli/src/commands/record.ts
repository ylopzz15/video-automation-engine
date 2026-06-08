import { execSync } from 'node:child_process';
import type { CommandModule } from 'yargs';
import { Kiro } from '@video-engine/core';
import { MCPDiscoveryProvider } from '@video-engine/discovery';
import { LLMPlanner } from '@video-engine/planner';
import { YamlWorkflowGenerator } from '@video-engine/workflow-generator';
import { PlaywrightEngine } from '@video-engine/engine-playwright';
import { FFmpegEngine } from '@video-engine/engine-ffmpeg';
import { validate } from '@video-engine/config';

interface RecordArgs {
  url: string;
  script: string;
  output?: string;
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

export const recordCommand: CommandModule<{}, RecordArgs> = {
  command: 'record',
  describe: 'Record a video from a URL and a natural language script',
  builder: (yargs) =>
    yargs
      .option('url', {
        alias: 'u',
        type: 'string',
        demandOption: true,
        describe: 'URL to record',
      })
      .option('script', {
        alias: 's',
        type: 'string',
        demandOption: true,
        describe: 'Natural language script describing what to do',
      })
      .option('output', {
        alias: 'o',
        type: 'string',
        default: './output/recording.mp4',
        describe: 'Output path for the video',
      }),

  handler: async (args) => {
    console.log(`\n🎬 KIRO Record`);
    console.log(`   URL: ${args.url}`);
    console.log(`   Script: "${args.script}"`);
    console.log(`   Output: ${args.output}\n`);

    const kiro = new Kiro({
      discovery: new MCPDiscoveryProvider(),
      planner: new LLMPlanner(),
      workflowGenerator: new YamlWorkflowGenerator(),
      configLoader: { validate },
      engines: [
        new PlaywrightEngine(),
        new FFmpegEngine({ ffmpegPath: resolveFFmpegPath() }),
      ],
    });

    try {
      const result = await kiro.record({
        url: args.url,
        script: args.script,
        output: args.output,
      });

      console.log(`\n✅ Video grabado: ${result.videoPath}`);
    } catch (err: any) {
      console.error(`\n❌ Error: ${err.message}`);
      process.exit(1);
    }
  },
};

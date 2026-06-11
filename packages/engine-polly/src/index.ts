import * as fs from 'node:fs';
import * as path from 'node:path';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { Engine, PipelineContext, StageResult } from '@video-engine/core';

export class PollyEngine extends Engine {
  readonly name = 'polly';
  private client: PollyClient;
  private defaultVoiceId: string;
  private defaultLanguageCode: string;

  constructor(options?: { region?: string; voiceId?: string; languageCode?: string }) {
    super();
    this.client = new PollyClient({ region: options?.region ?? process.env.AWS_REGION ?? 'us-east-1' });
    this.defaultVoiceId = options?.voiceId ?? 'Mia';
    this.defaultLanguageCode = options?.languageCode ?? 'es-MX';
  }

  async execute(ctx: PipelineContext): Promise<StageResult> {
    const start = Date.now();
    const artifacts: string[] = [];
    const { scenes } = ctx.config;

    const voiceId = ctx.config.voice?.voiceId ?? this.defaultVoiceId;
    const languageCode = ctx.config.voice?.languageCode ?? this.defaultLanguageCode;

    let hasNarration = false;
    for (const scene of scenes) {
      if (!scene.narration) continue;
      hasNarration = true;

      const audioPath = path.join(ctx.workDir, `audio-${scene.id}.mp3`);
      await this.synthesize(scene.narration, voiceId, languageCode, audioPath);
      artifacts.push(audioPath);
    }

    if (!hasNarration) {
      console.log('[polly] No narration found in scenes, skipping audio generation');
    }

    ctx.assets.set('audio', artifacts.join(','));

    return {
      engine: this.name,
      durationMs: Date.now() - start,
      artifacts,
    };
  }

  private async synthesize(
    text: string,
    voiceId: string,
    languageCode: string,
    outputPath: string,
  ): Promise<void> {
    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: 'mp3',
      VoiceId: voiceId as any,
      LanguageCode: languageCode as any,
      Engine: 'neural',
    });

    const response = await this.client.send(command);

    if (response.AudioStream) {
      const buffer = await streamToBuffer(response.AudioStream as any);
      fs.writeFileSync(outputPath, buffer);
    }
  }
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

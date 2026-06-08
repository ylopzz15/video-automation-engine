#!/usr/bin/env node
import 'dotenv/config';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { generateCommand } from './commands/generate';
import { generateFromPromptCommand } from './commands/generate-from-prompt';
import { recordCommand } from './commands/record';

yargs(hideBin(process.argv))
  .scriptName('video-engine')
  .command(recordCommand)
  .command(generateCommand)
  .command(generateFromPromptCommand)
  .demandCommand(1, 'You must specify a command')
  .strict()
  .help()
  .parse();

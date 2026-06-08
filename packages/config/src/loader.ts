import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { videoConfigSchema, VideoConfig } from './schema';
import { ZodError } from 'zod';

export interface LoadConfigOptions {
  /** Valores que se fusionan sobre el YAML parseado antes de la validación */
  overrides?: Partial<VideoConfig>;
}

/**
 * Carga y valida un archivo de configuración YAML.
 * Lanza errores descriptivos si el archivo no existe o falla la validación.
 */
export function loadConfig(filePath: string, options: LoadConfigOptions = {}): VideoConfig {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Config file not found: ${absolutePath}`);
  }

  const ext = path.extname(absolutePath).toLowerCase();
  if (ext !== '.yml' && ext !== '.yaml') {
    throw new Error(`Unsupported config format "${ext}". Use .yml or .yaml`);
  }

  const raw = fs.readFileSync(absolutePath, 'utf-8');
  let parsed: unknown;

  try {
    parsed = yaml.load(raw);
  } catch (err: any) {
    throw new Error(`YAML parse error in ${absolutePath}: ${err.message}`);
  }

  if (options.overrides) {
    parsed = { ...(parsed as object), ...options.overrides };
  }

  return validate(parsed, absolutePath);
}

/**
 * Valida un objeto crudo contra el schema VideoConfig con Zod.
 */
export function validate(data: unknown, source = 'config'): VideoConfig {
  const result = videoConfigSchema.safeParse(data);

  if (!result.success) {
    const messages = formatZodErrors(result.error, source);
    throw new Error(messages);
  }

  return result.data as unknown as VideoConfig;
}

function formatZodErrors(error: ZodError, source: string): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path.join('.');
    return `  • ${path || '(root)'}: ${issue.message}`;
  });

  return `Validation failed for "${source}":\n${lines.join('\n')}`;
}

import { z } from 'zod';

// --- Acciones de escena ---

const gotoActionSchema = z.object({
  action: z.literal('goto'),
  url: z.string().url(),
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional(),
});

const clickActionSchema = z.object({
  action: z.literal('click'),
  selector: z.string(),
  delay: z.number().positive().optional(),
});

const fillActionSchema = z.object({
  action: z.literal('fill'),
  selector: z.string(),
  value: z.string(),
});

const waitActionSchema = z.object({
  action: z.literal('wait'),
  duration: z.number().positive().describe('Wait time in milliseconds'),
});

const scrollActionSchema = z.object({
  action: z.literal('scroll'),
  /** Píxeles verticales (positivo = abajo, negativo = arriba) */
  y: z.number().default(300),
  /** Píxeles horizontales (positivo = derecha, negativo = izquierda) */
  x: z.number().default(0),
  /** Selector del contenedor a hacer scroll (si se omite, scroll de página) */
  selector: z.string().optional(),
  /** Duración de la animación de scroll en milisegundos */
  duration: z.number().positive().default(800),
  /** Función de easing para la animación */
  easing: z.enum(['linear', 'ease-in', 'ease-out', 'ease-in-out']).default('ease-in-out'),
});

const hoverActionSchema = z.object({
  action: z.literal('hover'),
  selector: z.string(),
  /** Tiempo en ms que se mantiene el hover antes de continuar */
  duration: z.number().positive().optional(),
});

const pressActionSchema = z.object({
  action: z.literal('press'),
  /** Tecla o combinación (ej: 'Enter', 'Control+A', 'Escape') */
  key: z.string(),
  /** Elemento objetivo — si se omite, presiona en el elemento enfocado */
  selector: z.string().optional(),
});

const screenshotActionSchema = z.object({
  action: z.literal('screenshot'),
  /** Nombre personalizado del archivo (sin extensión) */
  name: z.string().optional(),
  /** Capturar toda la altura de scroll de la página */
  fullPage: z.boolean().default(false),
  /** Capturar solo un elemento específico */
  selector: z.string().optional(),
});

export const sceneActionSchema = z.discriminatedUnion('action', [
  gotoActionSchema,
  clickActionSchema,
  fillActionSchema,
  waitActionSchema,
  scrollActionSchema,
  hoverActionSchema,
  pressActionSchema,
  screenshotActionSchema,
]);

// --- Escena ---

export const sceneSchema = z.object({
  id: z.string().min(1),
  description: z.string().optional(),
  steps: z.array(sceneActionSchema).min(1),
  narration: z.string().optional(),
  duration: z.number().positive().optional(),
});

// --- Voz ---

export const voiceSchema = z.object({
  engine: z.enum(['polly']),
  voiceId: z.string().min(1),
  languageCode: z.string().min(2),
  speed: z.number().positive().default(1.0),
});

// --- Viewport ---

export const viewportSchema = z.object({
  width: z.number().int().positive().default(1920),
  height: z.number().int().positive().default(1080),
  deviceScaleFactor: z.number().positive().default(1),
  isMobile: z.boolean().default(false),
  hasTouch: z.boolean().default(false),
  /** Nombre de dispositivo predefinido (sobreescribe width/height/isMobile) */
  device: z.string().optional(),
});

// --- Salida ---

export const outputSchema = z.object({
  fps: z.number().int().positive().default(30),
  format: z.enum(['mp4', 'webm']).default('mp4'),
  path: z.string().min(1),
});

// --- Opciones de Playwright (en el YAML de configuración) ---

export const playwrightOptionsSchema = z.object({
  /** Configuración de viewport personalizada */
  viewport: viewportSchema.optional(),
  /** Retardo en ms entre cada acción (para grabación más fluida) */
  slowMo: z.number().nonnegative().default(0),
  /** Mostrar indicador visual de clic */
  highlightClicks: z.boolean().default(false),
  /** Mostrar cursor visible que se mueve hacia los elementos */
  showCursor: z.boolean().default(true),
  /** Capturar screenshot al finalizar cada escena */
  screenshotOnComplete: z.boolean().default(true),
  /** Ejecutar en modo headless */
  headless: z.boolean().default(true),
  /** Reutilizar un solo Context/Page entre todas las escenas (para flujos secuenciales) */
  persistentContext: z.boolean().default(false),
}).optional();

// --- Configuración raíz ---

export const videoConfigSchema = z.object({
  title: z.string().min(1),
  version: z.string().optional(),
  voice: voiceSchema.optional(),
  output: outputSchema,
  playwright: playwrightOptionsSchema,
  scenes: z.array(sceneSchema).min(1),
});

// --- Tipos inferidos (output = después de parsear con defaults aplicados) ---

export type GotoAction = z.output<typeof gotoActionSchema>;
export type ClickAction = z.output<typeof clickActionSchema>;
export type FillAction = z.output<typeof fillActionSchema>;
export type WaitAction = z.output<typeof waitActionSchema>;
export type ScrollAction = z.output<typeof scrollActionSchema>;
export type HoverAction = z.output<typeof hoverActionSchema>;
export type PressAction = z.output<typeof pressActionSchema>;
export type ScreenshotAction = z.output<typeof screenshotActionSchema>;
export type SceneAction = z.output<typeof sceneActionSchema>;
export type SceneConfig = z.output<typeof sceneSchema>;
export type VoiceConfig = z.output<typeof voiceSchema>;

export interface ViewportConfig {
  width: number;
  height: number;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
  device?: string;
}

export interface PlaywrightConfig {
  viewport?: ViewportConfig;
  slowMo: number;
  highlightClicks: boolean;
  showCursor: boolean;
  screenshotOnComplete: boolean;
  headless: boolean;
  persistentContext: boolean;
}

export interface OutputConfig {
  fps: number;
  format: 'mp4' | 'webm';
  path: string;
}

export interface VideoConfig {
  title: string;
  version?: string;
  voice?: VoiceConfig;
  output: OutputConfig;
  playwright?: PlaywrightConfig;
  scenes: SceneConfig[];
}

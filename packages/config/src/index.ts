export { loadConfig, validate } from './loader';
export {
  videoConfigSchema,
  sceneSchema,
  voiceSchema,
  outputSchema,
  viewportSchema,
  playwrightOptionsSchema,
  sceneActionSchema,
} from './schema';
export type {
  VideoConfig,
  SceneConfig,
  SceneAction,
  GotoAction,
  ClickAction,
  FillAction,
  WaitAction,
  ScrollAction,
  HoverAction,
  PressAction,
  ScreenshotAction,
  VoiceConfig,
  OutputConfig,
  ViewportConfig,
  PlaywrightConfig,
} from './schema';

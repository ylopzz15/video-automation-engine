import type { SceneConfig } from '@video-engine/config';

export interface NarrationScript {
  sceneId: string;
  text: string;
  /** Delay en ms antes de iniciar el audio de esta escena (default: 500ms) */
  delayMs: number;
}

/**
 * Genera narración automática por escena basada en las acciones del YAML.
 * No requiere API key — usa templates predefinidos.
 */
export function generateNarration(scenes: SceneConfig[]): NarrationScript[] {
  return scenes.map((scene) => ({
    sceneId: scene.id,
    text: scene.narration ?? inferNarration(scene),
    delayMs: 500,
  }));
}

function inferNarration(scene: SceneConfig): string {
  const actions = scene.steps.map((s) => s.action);
  const hasLogin = hasLoginPattern(scene);
  const hasForm = hasFormPattern(scene);
  const sceneLabel = humanizeId(scene.id);

  // Login
  if (hasLogin) {
    return 'Iniciamos sesión en la aplicación con nuestras credenciales.';
  }

  // Formulario
  if (hasForm) {
    return `Completamos el formulario en la sección de ${sceneLabel}.`;
  }

  // Solo navegación
  if (actions.includes('goto') && actions.length <= 2) {
    return `Navegamos a la aplicación.`;
  }

  // Click en módulo conocido
  const clickTarget = getClickTarget(scene);
  if (clickTarget) {
    return `Accedemos al módulo de ${clickTarget}.`;
  }

  // Scroll
  if (actions.includes('scroll') && !actions.includes('click')) {
    return `Exploramos el contenido de la sección ${sceneLabel}.`;
  }

  // Fallback por sceneId
  return `Exploramos la sección de ${sceneLabel}.`;
}

function hasLoginPattern(scene: SceneConfig): boolean {
  const steps = scene.steps;
  const hasFillEmail = steps.some(
    (s) => s.action === 'fill' &&
    (('selector' in s && s.selector?.toLowerCase().includes('email')) ||
     ('selector' in s && s.selector?.toLowerCase().includes('correo')))
  );
  const hasFillPassword = steps.some(
    (s) => s.action === 'fill' &&
    'selector' in s &&
    (s.selector?.toLowerCase().includes('contraseña') ||
     s.selector?.toLowerCase().includes('password'))
  );
  return hasFillEmail && hasFillPassword;
}

function hasFormPattern(scene: SceneConfig): boolean {
  const fillCount = scene.steps.filter((s) => s.action === 'fill').length;
  return fillCount >= 2;
}

function getClickTarget(scene: SceneConfig): string | null {
  const knownModules: Record<string, string> = {
    documentos: 'documentos',
    documents: 'documentos',
    fpl: 'planes de vuelo',
    ajustes: 'ajustes',
    settings: 'configuración',
    inicio: 'inicio',
    home: 'inicio',
    dashboard: 'inicio',
    perfil: 'perfil',
    profile: 'perfil',
  };

  for (const step of scene.steps) {
    if (step.action === 'click' && 'selector' in step) {
      const selector = step.selector?.toLowerCase() ?? '';
      for (const [key, label] of Object.entries(knownModules)) {
        if (selector.includes(key)) {
          return label;
        }
      }
    }
  }
  return null;
}

function humanizeId(id: string): string {
  return id
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
}
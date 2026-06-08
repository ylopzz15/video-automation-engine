export type HookName =
  | 'pipeline:start'
  | 'pipeline:end'
  | 'stage:before'
  | 'stage:after';

export interface Plugin {
  readonly name: string;
  hooks: Partial<Record<HookName, (...args: any[]) => Promise<void> | void>>;
}

/** Helper para definir un plugin con tipado correcto. */
export function definePlugin(plugin: Plugin): Plugin {
  return plugin;
}

import type { DiscoveryProvider, PageMap } from './types';

/**
 * Provider base que retorna un PageMap vacío.
 * Sirve como punto de partida para implementaciones concretas.
 */
export class NoopDiscoveryProvider implements DiscoveryProvider {
  async inspect(_url: string): Promise<PageMap> {
    return {
      title: undefined,
      buttons: [],
      inputs: [],
      links: [],
    };
  }
}

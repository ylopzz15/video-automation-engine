import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { DiscoveryProvider, PageMap, InteractiveElement } from './types';

export interface MCPDiscoveryOptions {
  /** Comando para iniciar el servidor Playwright MCP (default: 'npx') */
  command?: string;
  /** Argumentos del comando (default: ['@playwright/mcp@latest']) */
  args?: string[];
  /** Variables de entorno adicionales para el proceso MCP */
  env?: Record<string, string>;
  /** Modo debug: imprime información detallada del parsing */
  debug?: boolean;
}

/**
 * Implementación de DiscoveryProvider usando Microsoft Playwright MCP.
 *
 * Se conecta al servidor @playwright/mcp como proceso hijo vía stdio,
 * navega a la URL indicada y extrae los elementos interactivos visibles
 * usando browser_snapshot.
 *
 * Genera locators robustos usando getByRole semántico:
 * - Botones: role=button[name="..."]
 * - Links: role=link[name="..."]
 * - Inputs: role=textbox[name="..."]
 * - Fallback: text=... solo si el nombre accesible está vacío
 */
export class MCPDiscoveryProvider implements DiscoveryProvider {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private options: Required<MCPDiscoveryOptions>;

  constructor(options: MCPDiscoveryOptions = {}) {
    this.options = {
      command: options.command ?? 'npx',
      args: options.args ?? ['@playwright/mcp@latest'],
      env: options.env ?? {},
      debug: options.debug ?? false,
    };
  }

  async inspect(url: string): Promise<PageMap> {
    await this.ensureConnected();

    await this.callTool('browser_navigate', { url });
    const snapshot = await this.callTool('browser_snapshot', {});

    const title = this.extractTitle(snapshot);
    const elements = this.parseSnapshot(snapshot);

    return {
      title,
      buttons: elements.buttons,
      inputs: elements.inputs,
      links: elements.links,
    };
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.client) return;

    this.transport = new StdioClientTransport({
      command: this.options.command,
      args: this.options.args,
      env: { ...process.env, ...this.options.env } as Record<string, string>,
    });

    this.client = new Client(
      { name: 'video-engine-discovery', version: '0.1.0' },
      { capabilities: {} },
    );

    await this.client.connect(this.transport);
  }

  private async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    if (!this.client) {
      throw new Error('MCP client not connected');
    }

    const result = await this.client.callTool({ name, arguments: args });

    const content = result.content as Array<{ type: string; text?: string }>;
    const textBlocks = content
      .filter((block) => block.type === 'text' && block.text)
      .map((block) => block.text!);

    return textBlocks.join('\n');
  }

  private extractTitle(snapshot: string): string | undefined {
    const lines = snapshot.split('\n');

    // Buscar heading level 1
    for (const line of lines) {
      const match = line.match(/heading\s+"([^"]+)"\s+\[level=1\]/);
      if (match) return match[1];
    }

    // Fallback: document title
    for (const line of lines) {
      const match = line.match(/^\s*-?\s*document\s+"([^"]+)"/);
      if (match) return match[1];
    }

    return undefined;
  }

  /**
   * Parsea el snapshot de accesibilidad de Playwright MCP.
   *
   * Formato detectado:
   *   - button "Toggle navigation bar" [ref=e7] [cursor=pointer]:
   *   - link "Get started" [ref=e32] [cursor=pointer]:
   *   - textbox "Search" [ref=e16]:
   *
   * Extrae: role, nombre accesible (entre comillas), ref.
   */
  private parseSnapshot(snapshot: string): {
    buttons: InteractiveElement[];
    inputs: InteractiveElement[];
    links: InteractiveElement[];
  } {
    const buttons: InteractiveElement[] = [];
    const inputs: InteractiveElement[] = [];
    const links: InteractiveElement[] = [];

    const lines = snapshot.split('\n');

    // Regex genérica para capturar: role "name" [ref=XX]
    const elementRegex = /^\s*-?\s*(button|link|textbox|searchbox|combobox|spinbutton|textarea)\s+"([^"]*)"(?:\s+\[ref=([^\]]+)\])?/;

    for (const line of lines) {
      const match = line.match(elementRegex);
      if (!match) continue;

      const role = match[1];
      const name = match[2];
      const ref = match[3] || undefined;

      // Ignorar elementos sin nombre accesible significativo
      if (!name || name.trim() === '') continue;

      const element: InteractiveElement = {
        role,
        name,
        ref,
        locator: this.buildLocator(role, name),
      };

      // Asignar text o label según el tipo
      if (role === 'button' || role === 'link') {
        element.text = name;
      } else {
        element.label = name;
      }

      if (this.options.debug) {
        console.log(`  [debug] ${role} | name="${name}" | ref=${ref} | locator=${element.locator}`);
      }

      // Clasificar por tipo
      switch (role) {
        case 'button':
          buttons.push(element);
          break;
        case 'link':
          links.push(element);
          break;
        default:
          inputs.push(element);
          break;
      }
    }

    return { buttons, inputs, links };
  }

  /**
   * Genera un locator robusto compatible con Playwright.
   *
   * Prioridad:
   * 1. role=<role>[name="..."] — semántico, estable, recomendado por Playwright
   * 2. text=... — fallback si el nombre está vacío
   *
   * Estos locators son directamente ejecutables por page.locator():
   *   page.locator('role=button[name="Get started"]')
   *   page.getByRole('button', { name: 'Get started' })
   */
  private buildLocator(role: string, name: string): string {
    if (!name || name.trim() === '') {
      return `role=${role}`;
    }

    // Escapar comillas dentro del name
    const escapedName = name.replace(/"/g, '\\"');

    // Usar role-based locator (más robusto que text=)
    return `role=${role}[name="${escapedName}"]`;
  }
}

# AUDIT.md — Estado del proyecto al 8 de junio 2026

## 1. Qué es el proyecto

Un framework que genera videos MP4 de demostración de cualquier aplicación web. El usuario describe en lenguaje natural qué grabar (o lo define en YAML), y el framework automatiza un navegador, ejecuta las acciones y produce el video.

**Problema que resuelve:** crear demos de producto, tutoriales y recorridos de software sin grabar pantalla manualmente.

**Quién lo usa:** developers que necesitan generar videos reproducibles de sus apps. En modo interactivo se usa con KIRO en el IDE; en modo autónomo se ejecuta desde CLI.

---

## 2. Estado actual (v0.3)

### Qué funciona hoy

- **Grabación de video desde YAML**: defines un workflow declarativo y genera un MP4. **Este es el flujo principal.**
- **KIRO como planner**: en modo interactivo, KIRO inspecciona la página con Playwright MCP, razona qué acciones ejecutar, genera el YAML y lo ejecuta con `generate`. No se usa API key externa.
- **Viewport mobile y desktop**: configurable, incluyendo iPhone 15, dispositivos Playwright.
- **Acciones**: goto, click, fill, wait, scroll, hover, press, screenshot.
- **Selectores semánticos**: `role=button[name="..."]`, `text=...`, CSS, XPath.
- **Cursor visible**: SVG overlay que se mueve hacia los elementos antes de interactuar.
- **Highlight de clics**: animación visual de 3 capas (ripple + ring + dot).
- **Scroll suave**: interpolación por frames con easing configurable.
- **Discovery**: inspección automática de cualquier URL vía Playwright MCP. Genera PageMap con botones, links e inputs con locators.
- **Workflow Generator**: convierte PlanStep[] en YAML ejecutable.
- **Comando `generate`**: ejecuta un YAML directamente. **Este es el comando que se usa.**
- **FFmpeg auto-incluido**: `@ffmpeg-installer/ffmpeg` se descarga con npm install, sin configuración.
- **Frame overlay (experimental)**: superpone un mockup de iPhone sobre el video grabado.
- **persistentContext**: modo donde todas las escenas comparten un solo Page/Context (necesario para flujos con login).

### Qué NO se usa actualmente

- **RuleBasedPlanner**: solo sirve como fallback. KIRO genera planes mucho mejores directamente.

### Qué no funciona todavía

- **Narración con Polly**: el código existe (`engine-polly`) pero no está conectado al pipeline. No genera audio.
- **waitForNavigation / waitForSelector**: no hay acciones inteligentes de espera. Solo `wait` con milisegundos fijos.
- **Variables en YAML**: no hay soporte para `${VARIABLE}`. Las credenciales en los templates son texto plano (se documentan en .env.example pero el engine no sustituye variables).
- **Dry-run**: no hay forma de validar un workflow sin ejecutar el browser.
- **Tests automatizados**: solo 1 archivo de test (`locators.test.js`). No hay test suite.

### Limitaciones conocidas

- El RuleBasedPlanner no puede generar flujos multi-paso. Solo matchea 1 elemento por vez.
- Discovery inspecciona la página en viewport desktop (no tiene opción de viewport mobile).
- Los `wait` con ms fijos son frágiles — si la app tarda más, el workflow falla.
- El frame overlay no tiene tests y los valores de posición están hardcodeados en frames.json.
- No hay manejo de errores con retry en el engine (si un click falla, todo falla).

---

## 3. Arquitectura real

### Flujo de información

```
                    ┌─────────────┐
                    │    CLI      │
                    │ (yargs)     │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
         record       generate    generate-from-prompt
              │            │            │
              │            │            ▼
              │            │      ┌───────────┐
              │            │      │ Discovery │ ← Playwright MCP
              │            │      └─────┬─────┘
              │            │            │ PageMap
              │            │            ▼
              │            │      ┌───────────┐
              │            │      │  Planner  │ ← LLM o RuleBased
              │            │      └─────┬─────┘
              │            │            │ PlanStep[]
              │            │            ▼
              │            │      ┌───────────┐
              │            │      │ Workflow   │
              │            │      │ Generator  │
              │            │      └─────┬─────┘
              │            │            │ YAML string
              ▼            ▼            ▼
         ┌──────────────────────────────────┐
         │           Config (Zod)            │
         │     Parsea y valida YAML          │
         └───────────────┬──────────────────┘
                         │ VideoConfig
                         ▼
         ┌──────────────────────────────────┐
         │         Core Pipeline             │
         │   Ejecuta engines en secuencia    │
         └───────┬──────────────────┬───────┘
                 │                  │
                 ▼                  ▼
         ┌──────────────┐   ┌─────────────┐
         │  Playwright   │   │   FFmpeg    │
         │  Engine       │   │   Engine    │
         │ (graba .webm) │   │ (→ .mp4)   │
         └──────────────┘   └─────────────┘
```

### Qué hace cada paquete (la realidad)

| Paquete | Qué hace realmente |
|---------|-------------------|
| `cli` | 3 comandos yargs: `generate`, `record`, `generate-from-prompt`. Carga .env con dotenv. |
| `config` | Schema Zod para el YAML + loader con js-yaml. Exporta tipos TypeScript. |
| `core` | Clase `Pipeline` (ejecuta engines en secuencia), clase `Kiro` (orquesta todo), clase abstracta `Engine`, tipos. |
| `discovery` | `MCPDiscoveryProvider`: inicia `@playwright/mcp` como proceso hijo, navega, parsea el snapshot de accesibilidad → PageMap. |
| `planner` | `RuleBasedPlanner` (scoring textual + dedup) y `LLMPlanner` (llama Claude API). Ambos implementan `Planner.createPlan()`. |
| `workflow-generator` | `YamlWorkflowGenerator`: convierte PlanStep[] en string YAML compatible con el schema de config. |
| `engine-playwright` | Lanza Chromium, graba video por escena (modo aislado) o todo junto (modo persistentContext). Ejecuta acciones: goto, click, fill, etc. Incluye cursor overlay y click highlight. |
| `engine-ffmpeg` | Concatena los .webm de cada escena en un .mp4 con libx264. Opcionalmente aplica un frame overlay (mockup de dispositivo). |
| `engine-polly` | Código escrito pero deshabilitado. Sintetiza voz con AWS Polly. No se ejecuta en el pipeline actual. |
| `plugin-api` | Interface `Plugin` con hooks (pipeline:start, stage:before, etc). No tiene implementaciones reales. |

### Dependencias entre paquetes

```
config ← core ← engine-playwright
              ← engine-ffmpeg
              ← engine-polly
              ← cli

discovery (independiente, usa @modelcontextprotocol/sdk)
planner ← discovery
workflow-generator ← planner
cli ← todo (discovery, planner, workflow-generator, core, config, engines)
```

---

## 4. Cómo ejecutarlo hoy

### Requisitos

- Node.js 20+
- Windows, macOS o Linux

### Instalación

```bash
git clone <repo>
cd video-automation-engine
npm install
npx tsc --build packages/cli/tsconfig.json --force
```

FFmpeg se instala automáticamente con `npm install` vía `@ffmpeg-installer/ffmpeg`.

### El comando más simple para generar un video

```bash
node packages/cli/dist/index.js generate -c templates/test-playwright.yml -v
```

Esto navega a playwright.dev, hace click en "Get started" y genera un MP4.

### Flujo real de uso (modo interactivo con KIRO)

1. Dile a KIRO: "Graba un video en https://example.com haciendo click en Get started"
2. KIRO inspecciona la página con Playwright MCP
3. KIRO genera el YAML con los selectores correctos
4. KIRO ejecuta: `node packages/cli/dist/index.js generate -c output/mi-video.yml`
5. Sale el MP4

---

## 5. Decisiones técnicas importantes

### KIRO es el planner en modo interactivo

No se usa API key externa. En el flujo real de hoy:
1. El usuario le dice a KIRO qué grabar
2. KIRO inspecciona la página con Playwright MCP (discovery)
3. KIRO razona sobre el PageMap y genera el YAML directamente
4. KIRO ejecuta `generate` con ese YAML

El `LLMPlanner` y el comando `record` existen en el código para un futuro modo autónomo (CI/CD sin KIRO presente), pero hoy no se usan.

### FFmpeg incluido en npm

Un developer nuevo no necesita instalar FFmpeg globalmente. `@ffmpeg-installer/ffmpeg` descarga el binario correcto para la plataforma al hacer `npm install`. Se puede sobreescribir con `FFMPEG_PATH` en `.env` si se necesita una versión específica.

### El Recorder no está separado todavía

`engine-playwright` mezcla: grabación de video + ejecución de acciones + efectos visuales (cursor, highlight). Esto dificulta hacer dry-run (ejecutar sin grabar) o testear acciones sin video. Separar en Runtime + Recorder es P1 del roadmap.

### persistentContext vs modo aislado

- **persistentContext: true** — un solo BrowserContext para todas las escenas. El estado (login, cookies, navegación) persiste. Un solo archivo .webm. Necesario para flujos con autenticación.
- **persistentContext: false** — cada escena crea un nuevo Context. Útil si cada escena es independiente. Produce un .webm por escena que FFmpeg concatena.

---

## 6. Lo que viene

### P1 — Estabilidad (próximo)

| Qué | Por qué |
|-----|---------|
| `waitForNavigation` / `waitForSelector` como acciones | Eliminar `wait` con ms fijos. Hoy los workflows son frágiles. |
| Variables en YAML (`${VARIABLE}`) | Credenciales no deben ser texto plano en los templates. |
| Separar Runtime de Recorder | Poder ejecutar sin grabar (dry-run), testear acciones. |
| Tests unitarios | Regresiones silenciosas. Solo hay 1 test file hoy. |

### P2 — Inteligencia

| Qué | Por qué |
|-----|---------|
| Narración con AWS Polly | El código existe, falta conectar al pipeline y sincronizar timing. |
| Discovery iterativo | Inspeccionar → actuar → re-inspeccionar. Para flujos dinámicos (login → dashboard). |
| Discovery con viewport mobile | Hoy inspecciona en desktop y los elementos mobile pueden ser diferentes. |

### P3 — Experiencia

| Qué | Por qué |
|-----|---------|
| `--dry-run` | Validar workflows sin abrir browser. |
| Preview mode | Ejecutar sin grabar, solo mostrar plan. |
| Mejor error reporting | Hoy si un selector no existe, solo dice "timeout". |

---

## Deuda técnica conocida

1. **No hay sustitución de variables en YAML** — los templates con `${AVIA_EMAIL}` no funcionan realmente, el engine recibe el string literal.
2. **Frame overlay experimental** — funciona pero no está integrado limpiamente en el pipeline. Los valores de posición están hardcodeados en frames.json.
3. **Sin tests** — cualquier refactor puede romper cosas sin aviso.
4. **Código muerto**: `record`, `generate-from-prompt`, `LLMPlanner`, `RuleBasedPlanner` están en el codebase pero no se usan en el flujo real. Son infraestructura para un futuro modo autónomo.
5. **`engine-polly` no probado** — puede tener incompatibilidades de tipos.

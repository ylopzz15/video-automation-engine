# KIRO Framework — Architecture Steering

## Qué es este proyecto

Un framework para developers que genera videos de demostración 
narrados de cualquier aplicación web.

El usuario da una URL y un script en lenguaje natural.
El framework graba un MP4 con las acciones ejecutadas + narración.

## Uso esperado (contrato público)

### CLI (uso principal)
npx kiro record \
  --url https://miapp.com \
  --script "Inicia sesión, luego muestra cómo llenar el módulo de tripulantes"

### API (uso avanzado)
import { Kiro } from '@kiro/core'

const kiro = new Kiro()
await kiro.record({
  url: 'https://miapp.com',
  script: 'Inicia sesión, luego muestra el módulo de tripulantes',
  output: './demo.mp4'
})

## Reglas del framework

### El core NUNCA debe contener:
- Credenciales de ninguna app
- URLs específicas de ningún cliente
- Lógica específica de ninguna página
- Paths de máquinas específicas
- Console.log de debug

### El usuario configura via:
- .env → credenciales y API keys
- kiro.config.ts → preferencias del proyecto
- El script en lenguaje natural → qué grabar

### Separación de responsabilidades
- discovery   → inspecciona cualquier página, devuelve PageMap
- planner     → convierte script humano en PlanSteps
- engine      → ejecuta acciones y graba video
- narration   → genera audio con Polly y lo mezcla (fase 2)
- core        → orquesta todo, expone la API pública
- cli         → interfaz de línea de comandos

## Herramientas disponibles para KIRO

### Playwright MCP
KIRO tiene acceso a Playwright MCP para inspeccionar páginas web.
Úsalo para ver qué hay en cualquier página antes de generar el YAML.

Herramientas principales:
- browser_navigate → navegar a una URL
- browser_snapshot → capturar snapshot de accesibilidad de la página actual
- browser_click → hacer click en un elemento
- browser_type → escribir texto en un campo
- browser_wait_for → esperar a que aparezca texto o pasen segundos

### video-engine CLI
El framework se ejecuta con estos comandos:

# Ejecutar un YAML existente → MP4
node packages/cli/dist/index.js generate -c output/workflow.yml -v

# Generar YAML desde URL + prompt (páginas públicas)
node packages/cli/dist/index.js generate-from-prompt \
  --url https://miapp.com \
  --prompt "click en el botón de registro"

## Flujo de trabajo para grabar videos

### CASO 1: Página pública (sin login)
1. Usar browser_navigate para abrir la URL
2. Usar browser_snapshot para ver qué hay en la página
3. Generar el YAML con los selectores reales del snapshot
4. Ejecutar: node packages/cli/dist/index.js generate -c output/workflow.yml -v

### CASO 2: Página autenticada (con login)
1. Usar browser_navigate para abrir la URL de login
2. Usar browser_snapshot para ver el formulario de login
3. Usar browser_type y browser_click para hacer login
4. Usar browser_snapshot para ver la página resultante
5. Navegar a cada sección necesaria e inspeccionar con browser_snapshot
6. Con todos los selectores reales, generar el YAML completo
7. Ejecutar: node packages/cli/dist/index.js generate -c output/workflow.yml -v

### CASO 3: Flujo con múltiples secciones
1. Inspeccionar cada sección por separado con Playwright MCP
2. Generar un YAML con múltiples scenes
3. Usar persistentContext: true para mantener la sesión entre scenes
4. Ejecutar todo en un solo comando generate

## Reglas de trabajo de KIRO

### SIEMPRE antes de generar un YAML:
- Inspecciona la página con browser_snapshot
- Usa los selectores exactos del snapshot, nunca los adivines
- Si hay login, haz el login con Playwright MCP primero
- Verifica que los selectores existen antes de escribirlos en el YAML

### NUNCA:
- Adivines selectores sin haber inspeccionado la página
- Pongas credenciales en archivos YAML o de código
- Modifiques el core, config, discovery, engine-ffmpeg sin instrucción explícita
- Agregues features nuevas sin que se pidan
- Refactorices código que no está en la tarea actual

### Formato del YAML obligatorio para flujos con login:
playwright:
  persistentContext: true
  slowMo: 400
  highlightClicks: true
  showCursor: true
  viewport:
    width: 390
    height: 844
    isMobile: true
    hasTouch: true

### Selectores — usar siempre en este orden de preferencia:
1. role=button[name="Texto"] → más estable
2. role=textbox[name="Label"] → para inputs
3. role=link[name="Texto"] → para links
4. text=Texto visible → fallback
5. CSS (#id, .clase) → último recurso

## Estructura del proyecto

packages/
├── cli/                 # Comandos: generate, record, generate-from-prompt
├── core/                # Clase Kiro, Pipeline orquestador
├── config/              # Schema y validación de YAML
├── discovery/           # Inspección automática de páginas (programático)
├── planner/             # RuleBasedPlanner + LLMPlanner
├── workflow-generator/  # PlanSteps → YAML
├── engine-playwright/   # Grabación de video con Playwright
├── engine-ffmpeg/       # Concatenación y frame overlay
├── engine-polly/        # Narración con AWS Polly (fase 2)
└── plugin-api/          # Contratos para extensiones

frames/                  # Plantillas PNG de dispositivos
├── plantilla-iphone.png # Plantilla iPhone con fondo azul
└── frames.json          # Coordenadas de cada plantilla

output/                  # Videos y YAMLs generados (no subir al repo)
.browser-profile/        # Perfil del browser con sesiones (no subir al repo)

## Roadmap

### Completado 
- Discovery automático de páginas públicas
- Planner con RuleBasedPlanner y LLMPlanner
- Engine Playwright con grabación, cursor, highlights
- Engine FFmpeg con concatenación y frame overlay
- Plantilla iPhone con fondo azul
- Comando generate, record, generate-from-prompt
- Clase Kiro con método record()
- FFmpeg auto-instalado via @ffmpeg-installer
- Sesión persistente con launchPersistentContext

### Siguiente 
- Narración con AWS Polly
- Comando merge para unir videos
- waitForNavigation / waitForSelector
- Variables en YAML ({{variable}})
- Modo dry-run

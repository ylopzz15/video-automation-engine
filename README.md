# Video Automation Engine

Framework para la generación automatizada de demos de producto, tutoriales y recorridos interactivos de software mediante flujos declarativos en YAML.

Construido sobre Playwright y FFmpeg, permite automatizar navegadores, capturar interacciones reales de usuario y producir videos reproducibles de alta calidad — con soporte para generación automática de workflows desde lenguaje natural.

---

## Características

* Generación automatizada de videos MP4
* Automatización de navegador mediante Playwright
* Flujos declarativos definidos en YAML
* **Generación automática de workflows desde lenguaje natural**
* **Discovery automático de interfaces web**
* **LLM Planner para prompts complejos**
* Cursor visible durante la reproducción
* Resaltado visual de clics
* Scroll suave y configurable
* Compatibilidad con dispositivos desktop y móviles
* Soporte para locators nativos de Playwright
* Arquitectura modular basada en engines
* FFmpeg incluido automáticamente — sin instalación manual

---

## Arquitectura

```text
video-automation-engine/
│
├── packages/
│   ├── cli/                  # Comandos: generate, record
│   ├── config/               # Schema y validación de YAML
│   ├── core/                 # Clase Kiro, Pipeline orquestador
│   ├── discovery/            # Inspección automática de páginas
│   ├── planner/              # RuleBasedPlanner + LLMPlanner
│   ├── workflow-generator/   # PlanSteps → YAML
│   ├── engine-playwright/    # Grabación de video
│   ├── engine-ffmpeg/        # Concatenación de escenas
│   └── plugin-api/           # Contratos para extensiones
│
├── output/
├── package.json
└── tsconfig.base.json
```

### Componentes

| Paquete              | Descripción                                        |
| -------------------- | -------------------------------------------------- |
| `cli`                | Interfaz de línea de comandos                      |
| `config`             | Carga y validación de configuración YAML           |
| `core`               | Clase Kiro, Pipeline orquestador y tipos           |
| `discovery`          | Inspección automática de interfaces web            |
| `planner`            | Conversión de lenguaje natural a acciones          |
| `workflow-generator` | Generación de YAML desde plan de acciones          |
| `engine-playwright`  | Automatización del navegador y grabación           |
| `engine-ffmpeg`      | Renderizado y composición de video                 |
| `plugin-api`         | Contratos para extensiones y plugins               |

---

## Instalación

### Requisitos

* Node.js 20 o superior

FFmpeg y Playwright se instalan automáticamente con `npm install`.

### Clonar el repositorio

```bash
git clone https://github.com/ylopzz15/video-automation-engine.git
cd video-automation-engine
```

### Instalar dependencias

```bash
npm install
```

### Compilar el proyecto

```bash
npx tsc --build
```

---

## Uso

### Modo interactivo (con KIRO)

La forma más fácil. Dile a KIRO en el chat:

```
Graba un video en https://miapp.com haciendo:
inicia sesión, luego muestra cómo llenar el módulo de tripulantes
```

KIRO inspecciona la página automáticamente, genera el plan de acciones y ejecuta el video. Sin configuración adicional.

---

### Modo CLI — desde YAML

Define tu workflow en YAML y genera el video directamente:

```bash
node packages/cli/dist/index.js generate -c mi-workflow.yml
```

---

### Modo CLI — desde lenguaje natural

Genera el video directamente desde una URL y un prompt:

```bash
node packages/cli/dist/index.js record \
  --url https://miapp.com \
  --script "inicia sesión y muestra el módulo de tripulantes"
```

En modo interactivo, KIRO actúa como el planner. Para ejecución autónoma (CI/CD), configura `LLM_API_KEY` en `.env`.

---

### Modo API

```typescript
import { Kiro } from '@video-engine/core'

const kiro = new Kiro()
await kiro.record({
  url: 'https://miapp.com',
  script: 'inicia sesión y muestra el módulo de tripulantes',
  output: './output/demo.mp4'
})
```

---

## Configuración

Crea un `.env` en la raíz (ver `.env.example`):

```env
# Override de ffmpeg (opcional, se auto-detecta)
FFMPEG_PATH=/ruta/a/ffmpeg

# Solo para ejecución autónoma sin KIRO (CI/CD)
# LLM_API_KEY=sk-ant-...
```

---

## Formato del YAML

```yaml
config:
  name: Mi Demo
  fps: 30
  width: 1280
  height: 720
  output: ./output/demo.mp4

browser:
  headless: true
  slowMo: 100
  highlightClicks: true
  showCursor: true

scenes:
  - id: inicio
    steps:
      - action: goto
        url: https://miapp.com

      - action: wait
        ms: 2000

      - action: click
        selector: role=button[name="Entrar"]

      - action: fill
        selector: role=textbox[name="Email"]
        value: usuario@ejemplo.com

      - action: press
        selector: role=textbox[name="Email"]
        key: Enter
```

---

## Acciones disponibles

| Acción      | Parámetros            | Descripción                    |
| ----------- | --------------------- | ------------------------------ |
| `goto`      | `url`                 | Navegar a una URL              |
| `click`     | `selector`            | Click en un elemento           |
| `fill`      | `selector`, `value`   | Llenar un campo de texto       |
| `wait`      | `ms`                  | Esperar N milisegundos         |
| `press`     | `selector`, `key`     | Presionar una tecla            |
| `hover`     | `selector`            | Hover sobre un elemento        |
| `scroll`    | `selector`, `delta`   | Scroll en la página            |
| `screenshot`| `path`                | Capturar pantalla              |

---

## Selectores soportados

```yaml
# Por rol (recomendado)
selector: role=button[name="Guardar"]
selector: role=textbox[name="Email"]
selector: role=link[name="Get started"]

# Por texto
selector: text=Iniciar sesión

# CSS
selector: "#login"
selector: ".submit-button"

# Atributos de testing
selector: data-testid=submit
```

---

## Roadmap

### Versión 0.1 ✅
* Engine Playwright
* Engine FFmpeg
* Workflows en YAML
* Cursor visible y resaltado de clics

### Versión 0.2 ✅
* Discovery automático de interfaces
* Inspección de cualquier página web
* Generación automática de workflows

### Versión 0.3 ✅
* LLM Planner — prompt a workflow
* Comando `record` end-to-end
* FFmpeg auto-instalado sin configuración
* Clase `Kiro` con API programática

### Versión 1.0
* Narración con AWS Polly
* `waitForNavigation` y `waitForSelector`
* Variables en YAML (`{{variable}}`)
* Modo dry-run
* Tests automatizados

### Versión 2.0
* Dashboard web con historial de videos
* Marketplace de plugins
* Plataforma completa de generación de tutoriales

---

## Contribuciones

Las contribuciones son bienvenidas mediante Pull Requests.

---

## Licencia

MIT

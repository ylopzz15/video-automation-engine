# Video Automation Engine

Framework para la generación automatizada de demos de producto, tutoriales y recorridos interactivos de software mediante flujos declarativos en YAML.

Construido sobre Playwright y FFmpeg, permite automatizar navegadores, capturar interacciones reales de usuario y producir videos reproducibles de alta calidad.

---

## Características

* Generación automatizada de videos
* Automatización de navegador mediante Playwright
* Flujos declarativos definidos en YAML
* Cursor visible durante la reproducción
* Resaltado visual de clics
* Scroll suave y configurable
* Compatibilidad con dispositivos desktop y móviles
* Soporte para locators nativos de Playwright
* Arquitectura modular basada en engines
* Diseñado para futuras integraciones con inteligencia artificial

---

## Arquitectura

```text
video-automation-engine/
│
├── packages/
│   ├── cli/
│   ├── config/
│   ├── core/
│   ├── engine-playwright/
│   └── engine-ffmpeg/
│
├── templates/
│
├── package.json
└── tsconfig.base.json
```

### Componentes

| Paquete           | Descripción                          |
| ----------------- | ------------------------------------ |
| cli               | Interfaz de línea de comandos        |
| config            | Carga y validación de configuración  |
| core              | Tipos, contratos y lógica compartida |
| engine-playwright | Automatización del navegador         |
| engine-ffmpeg     | Renderizado y composición de video   |

---

## Instalación

### Requisitos

* Node.js 20 o superior
* FFmpeg
* Playwright

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

## Inicio rápido

Ejemplo de workflow:

```yaml
title: "Demo"

output:
  width: 1920
  height: 1080
  fps: 30
  format: mp4
  path: ./output/demo.mp4

playwright:
  headless: true
  highlightClicks: true
  showCursor: true

scenes:
  - id: demo
    steps:
      - action: goto
        url: https://playwright.dev

      - action: wait
        duration: 2000

      - action: click
        selector: "text=Get started"
```

Generación del video:

```bash
node packages/cli/dist/index.js generate -c templates/demo.yml
```

---

## Acciones soportadas

* goto
* click
* fill
* hover
* scroll
* wait
* screenshot

---

## Selectores soportados

### CSS

```yaml
selector: "#login"
selector: ".submit-button"
```

### Playwright

```yaml
selector: "text=Iniciar sesión"
selector: "role=button"
selector: "data-testid=submit"
```

---

## Roadmap

### Versión 0.1

* Engine Playwright
* Engine FFmpeg
* Workflows en YAML
* Cursor visible
* Resaltado de clics
* Scroll suave
* Locators nativos de Playwright

### Versión 0.2

* DOM Discovery Engine
* Inspección automática de interfaces
* Generación automática de workflows

### Versión 0.3

* Prompt a workflow
* Integración con modelos de lenguaje
* Generación automática de demos

### Versión 1.0

* Marketplace de plugins
* Sistema de extensiones
* Plataforma completa de generación de tutoriales

---

## Contribuciones

Las contribuciones son bienvenidas mediante Pull Requests.

---

## Licencia

MIT

---

## Estado del proyecto

MVP funcional en desarrollo activo.

Actualmente utilizado para generar demos automatizadas de aplicaciones web mediante Playwright y FFmpeg.

# KIRO Framework — Steering de Arquitectura

## Qué es KIRO

KIRO es un framework para generar videos de demostración de aplicaciones web de forma automática.

El usuario únicamente proporciona:

* Una URL
* Un script en lenguaje natural

Ejemplo:

```bash
npx kiro record \
  --url https://miapp.com \
  --script "Inicia sesión y muestra cómo configurar los precios"
```

KIRO debe encargarse de:

```text
URL + Script
↓
Discovery
↓
Planificación
↓
Generación de Workflow
↓
Ejecución
↓
Grabación
↓
Narración
↓
MP4 Final
```

El framework debe funcionar con cualquier sitio web y nunca contener lógica específica de clientes.

---

# Principios Fundamentales

## Framework Genérico

Nunca hardcodear:

* URLs de clientes
* Credenciales de clientes
* Selectores específicos de clientes
* Flujos específicos de clientes
* Reglas de negocio de clientes

Todo debe generarse dinámicamente.

---

## Configuración sobre Código

El comportamiento debe configurarse mediante:

* `.env`
* `kiro.config.ts`
* Script en lenguaje natural
* Configuración del proyecto

Nunca mediante valores específicos de una máquina.

---

## Separación de Responsabilidades

Cada paquete tiene una única responsabilidad.

Ningún componente debe asumir responsabilidades de otro.

---

# Responsabilidades por Paquete

## discovery

Responsable de:

* Inspeccionar páginas
* Obtener estructura de la interfaz
* Generar PageMaps
* Proveer contexto reproducible

No genera workflows.

No ejecuta workflows.

---

## planner

Responsable de:

* Interpretar la intención del usuario
* Convertir scripts en PlanSteps
* Determinar qué quiere hacer el usuario

No inspecciona páginas.

No ejecuta workflows.

---

## workflow-generator

Responsable de:

* Convertir PlanSteps en YAML
* Aplicar convenciones del framework
* Generar workflows ejecutables

No ejecuta acciones.

---

## engine-playwright

Responsable de:

* Automatización del navegador
* Ejecución de acciones
* Grabación de video
* Captura de screenshots

No realiza planificación.

---

## engine-ffmpeg

Responsable de:

* Unir videos
* Aplicar frames
* Sincronizar audio
* Composición final del video

No interactúa con navegadores.

---

## engine-polly

Responsable de:

* Generar voz
* Sintetizar narración
* Producir audio

No modifica workflows.

---

## core

Responsable de:

* Orquestación del pipeline
* API pública
* Coordinación entre componentes
* Ciclo de vida de ejecución

No debe contener lógica de negocio.

---

## cli

Responsable de:

* Interacción con el usuario
* Comandos
* Entrada y salida

Debe mantenerse simple.

---

# Estrategia de Generación de Video

## Objetivo

Mantener el equilibrio entre:

* Escalabilidad
* Automatización
* Confiabilidad
* Velocidad de desarrollo

---

## Modo 1 — Autónomo (Predeterminado)

### Flujo Principal

```text
Discovery
↓
Análisis
↓
Evaluación de confianza
↓
Generación de YAML
↓
Generate
↓
Verificación de video
↓
Polly
↓
FFmpeg
```

---

### Cuándo usarlo

* Página pública
* Discovery obtuvo suficiente información
* Navegación conocida
* Selectores identificados
* No requiere autenticación
* El flujo es reproducible

---

### Motivo

Es el flujo que puede escalar a:

* APIs
* SaaS
* CI/CD
* Generación masiva
* Automatización programada
* Workflows completamente autónomos

Discovery es siempre la opción preferida.

---

## Modo 2 — Recuperación con MCP

### Flujo Alternativo

```text
Discovery
↓
Análisis
↓
Evaluación de confianza

Si la confianza es BAJA:

↓
Playwright MCP
↓
Navegación
↓
Login (si aplica)
↓
Snapshot
↓
Validar navegación
↓
Actualizar selectores
↓
Generar YAML
↓
Generate
↓
Verificar video
```

---

### Cuándo usarlo

* Se requiere login
* Discovery es insuficiente
* Faltan selectores críticos
* Hay múltiples candidatos
* La navegación es ambigua
* Hay contenido dinámico complejo
* Discovery no puede determinar el flujo correcto
* El destino de un click es desconocido
* Algún paso requiere adivinar información

---

### Motivo

MCP es la fuente de verdad para:

* Autenticación
* Verificación
* Recuperación
* Depuración
* Navegación compleja
* Aplicaciones dinámicas

---

# Evaluación de Confianza

## Confianza Alta (HIGH)

Solo cuando:

* Los elementos necesarios existen
* La navegación es conocida
* Los selectores son estables
* Discovery aporta suficiente contexto
* Los destinos son conocidos
* Las transiciones son conocidas
* No existen suposiciones

---

## Confianza Baja (LOW)

Cuando:

* Falta información crítica
* Hay navegación desconocida
* Existen varios candidatos
* El login bloquea Discovery
* El comportamiento dinámico es incierto
* Se desconoce el destino de un selector
* Discovery es parcial
* Alguna acción requiere asumir información

---

## Regla Obligatoria

Si algún paso requiere una suposición:

```text
Confianza = LOW
```

y debe utilizarse MCP.

---

# Reglas de Decisión

1. Siempre intentar Discovery primero.
2. Evaluar confianza después de Discovery.
3. Verificar que el workflow pueda construirse sin suposiciones.
4. Escalar a MCP únicamente cuando la confianza sea LOW.
5. MCP se convierte en la fuente de verdad.
6. Generar el workflow con la información más confiable disponible.
7. Verificar el video antes de reportar éxito.

---

# Regla Operativa 80/20

Objetivo:

* 80% Discovery
* 20% MCP

MCP es una herramienta de recuperación y validación.

No es el mecanismo principal.

---

# Verificación de Video

Un video no se considera exitoso hasta ser validado.

## Checklist

Después de cada ejecución:

* Verificar que el MP4 exista.
* Verificar tamaño razonable.
* Extraer al menos un frame.
* Verificar que exista contenido visible.
* Confirmar que el video no esté en blanco.

Solo entonces reportar éxito.

---

## Si la validación falla

* No reportar éxito.

* Diagnosticar el problema.

* Determinar si pertenece a:

  * Workflow
  * Engine Playwright
  * FFmpeg
  * Frame Overlay
  * Narración

* Resolver antes de continuar.

---

# Reglas de Generación YAML

## Acciones Permitidas

Las únicas acciones válidas son:

* goto
* click
* fill
* wait
* scroll
* hover
* press
* screenshot
* waitForUrl
* waitForSelector

No generar acciones fuera de esta lista.

---

## Prioridad de Selectores

Orden preferido:

1. role=button[name="Texto"]
2. role=textbox[name="Label"]
3. role=link[name="Texto"]
4. text=Texto visible
5. CSS

Nunca adivinar selectores.

Siempre verificar su existencia.

---

# Reglas de Frames

## Comportamiento Predeterminado

Por defecto:

* No aplicar frame.
* No modificar viewport.

Usar resolución estándar de escritorio.

---

## Cuando se Solicita un Frame

Agregar:

```yaml
frame: "nombre-frame"
```

y configurar el viewport correspondiente.

---

## plantilla-iphone

Viewport obligatorio:

```yaml
viewport:
  width: 393
  height: 852
```

Siempre que se utilice:

```yaml
frame: "plantilla-iphone"
```

Esto garantiza alineación correcta con el PNG.

---

## Otros Frames

Consultar:

```text
frames/frames.json
```

y utilizar las dimensiones correspondientes.

---

# Estrategia de Narración

## Objetivo

Mantener KIRO completamente autónomo.

El usuario nunca debería escribir:

* Narraciones
* Textos para Polly
* Guiones técnicos

El usuario solo proporciona:

* URL
* Script

---

## Dirección Actual

```text
Workflow
↓
Generador de Narración
↓
Polly
↓
Audio
↓
FFmpeg
↓
MP4 Final
```

---

## Reglas

Cuando la narración esté habilitada:

* Debe generarse automáticamente.
* Debe generarse por escenas.
* Polly recibe texto y devuelve audio.
* Polly debe permanecer desacoplado del resto del sistema.

---

## Evolución Futura

La narración podrá utilizar:

* Contexto del planner
* Información de Discovery
* Modelos LLM

sin cambiar la arquitectura base.

---

# Reglas de Ingeniería

## Nunca

* Hardcodear credenciales
* Hardcodear URLs de clientes
* Hardcodear selectores de clientes
* Guardar secretos en workflows
* Agregar lógica específica de clientes
* Refactorizar código no relacionado
* Agregar funcionalidades sin aprobación

---

## Siempre

* Mantener responsabilidades separadas
* Preferir configuración sobre código
* Validar suposiciones
* Mantener portabilidad
* Generar workflows reproducibles

---

# Estructura del Proyecto

```text
packages/
├── cli/
├── core/
├── config/
├── discovery/
├── planner/
├── workflow-generator/
├── engine-playwright/
├── engine-ffmpeg/
├── engine-polly/
└── plugin-api/

frames/
├── plantilla-iphone.png
└── frames.json

output/

.browser-profile/
```

---

# Roadmap

## Completado

* Discovery
* Planner
* Workflow Generator
* Playwright Engine
* FFmpeg Engine
* Frame Overlay
* Generate
* Record
* Generate From Prompt
* Persistent Context
* Smart Waits
* Verificación de Video

---

## Próximamente

* Integración Polly
* Narración Automática
* Detección Inteligente de Sesión
* Merge de Videos
* Variables YAML
* Dry Run
* Validaciones Avanzadas
* Plantillas de Workflow
* Generación Masiva

---

# Principio Rector

No reemplazar Discovery con Playwright MCP.

Discovery es el mecanismo principal y escalable.

Playwright MCP existe para recuperar, verificar y resolver escenarios donde Discovery no tiene suficiente confianza.

Nunca adivinar:

* Selectores
* URLs
* Destinos
* Navegaciones
* Acciones

La verificación es obligatoria antes de reportar éxito.

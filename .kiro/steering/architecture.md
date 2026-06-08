# KIRO Framework — Architecture Steering

## Qué es este proyecto

Un framework para developers que genera videos de demostración narrados de cualquier aplicación web.

El usuario da una URL y un script en lenguaje natural.
El framework graba un MP4 con las acciones ejecutadas + narración.

## Uso esperado (contrato público)

### CLI (uso principal)

```
npx kiro record \
  --url https://miapp.com \
  --script "Inicia sesión, luego muestra cómo llenar el módulo de tripulantes"
```

### API (uso avanzado)

```typescript
import { Kiro } from '@kiro/core'

const kiro = new Kiro({ apiKey: process.env.LLM_API_KEY })

await kiro.record({
  url: 'https://miapp.com',
  script: 'Inicia sesión, luego muestra el módulo de tripulantes',
  output: './demo.mp4'
})
```

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
- planner     → convierte script humano en PlanSteps (usa LLMPlanner)
- engine      → ejecuta acciones y graba video (no sabe de ninguna app)
- narration   → genera audio con Polly y lo mezcla al video (fase 2)
- core        → orquesta todo, expone la API pública
- cli         → interfaz de línea de comandos

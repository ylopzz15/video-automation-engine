# Cómo pedirle a KIRO que grabe videos

## 1. Estructura base del prompt

El formato recomendado:

```
Graba un video en [URL] [haciendo/mostrando qué]

Configuración:
- viewport: [desktop/mobile/tablet]
- slowMo: [velocidad]
- [opciones adicionales]

Pasos:
1. [acción]
2. [acción]
...
```

KIRO inspecciona la página automáticamente, encuentra los selectores correctos, genera el YAML y ejecuta el video.

---

## 2. Ejemplos por tipo de video

### Video de página pública (sin login)

```
Graba un video en https://playwright.dev mostrando la sección de Node.js.

1. Abre la página
2. Espera 2 segundos
3. Haz scroll hacia abajo
4. Click en "Get started"
5. Muestra la página de introducción (espera 3 segundos)
```

```
Graba un video en https://www.w3schools.com/ buscando la sección de Node.js.

1. Abre la página
2. Scroll suave para mostrar las categorías
3. Click en "NODEJS"
4. Espera 3 segundos mostrando la página
```

### Video con login

```
Graba un video en https://avia1.com/auth/login

1. Abre la página de login
2. Llena email con: usuario@ejemplo.com
3. Llena contraseña con: MiPassword123
4. Click en "Entrar"
5. Espera 8 segundos para que cargue el dashboard
6. Navega a "Documentos" (espera 2s)
7. Navega a "Ajustes" (espera 2s)

Configuración:
- persistentContext: true (necesario para mantener la sesión)
- slowMo: 300
```

### Video mobile con viewport iPhone

```
Graba un video en formato iPhone 15 en https://www.macstoreonline.com.mx/
buscando un AirTag.

Configuración:
- viewport: 393x852
- isMobile: true
- hasTouch: true
- slowMo: 400

Pasos:
1. Abre la página
2. Acepta cookies (click en "Aceptar")
3. Scroll para ver categorías
4. Click en "AirTag"
5. Espera 3 segundos
6. Scroll para mostrar productos
```

### Video mostrando un módulo específico

```
Graba un video en https://avia1.com/auth/login mostrando el módulo de Documentos.

1. Login con email: usuario@ejemplo.com, contraseña: Pass123
2. Espera a que cargue el dashboard (8 segundos)
3. Click en "Documentos"
4. Espera 3 segundos mostrando el módulo

Configuración:
- viewport mobile (393x852, iPhone 15)
- persistentContext: true
```

### Video con múltiples secciones

```
Graba un video en https://avia1.com/auth/login recorriendo toda la app.

1. Login con credenciales
2. Muestra el dashboard (espera 2s)
3. Navega a "Documentos" (espera 2s)
4. Navega a "FPL" (espera 2s)
5. Navega a "Ajustes" (espera 2s)

Configuración:
- viewport: 393x852 (iPhone 15)
- isMobile: true
- persistentContext: true
- slowMo: 300
```

---

## 3. Parámetros que puedes especificar

### Viewport

| Tipo | Valores |
|------|---------|
| Desktop (default) | 1920x1080 |
| iPhone 15 | 393x852, isMobile: true, hasTouch: true |
| iPad | 820x1180, isMobile: true |
| Tablet Android | 800x1280, isMobile: true |

### slowMo (velocidad de acciones)

| Valor | Efecto |
|-------|--------|
| 0 | Sin pausa entre acciones (rápido, difícil de seguir) |
| 200 | Velocidad normal para demos |
| 300 | Velocidad recomendada para videos de producto |
| 500 | Lento, bueno para tutoriales paso a paso |

### Frame / Plantilla

```
- frame: plantilla-iphone  (superpone mockup de dispositivo)
- Sin frame: video crudo del navegador
```

### Esperas entre pasos

```
- "Espera 2 segundos" → action: wait, duration: 2000
- "Espera a que cargue" → action: wait, duration: 5000-8000 (según la app)
```

Tip: para apps lentas (SPAs con mucha carga), usa 5000-8000ms después de login o navegación.

---

## 4. Errores comunes y cómo evitarlos

### Selectores que no se encuentran

**Síntoma:** `Timeout 30000ms exceeded. waiting for getByRole('button', { name: '...' })`

**Causa:** el elemento no existe en el viewport actual, o está oculto (menú hamburguesa en mobile).

**Solución:**
- Pide a KIRO que inspeccione la página primero
- Especifica si es desktop o mobile (los elementos visibles cambian)
- Si un botón no aparece en mobile, tal vez es un link o está en un menú

### Login que falla

**Síntoma:** después del click en "Entrar", la URL sigue en `/auth/login`

**Causas:**
- Credenciales incorrectas
- Wait insuficiente (la app necesita más tiempo para redirigir)
- El email tiene formato diferente (con +prueba, sin él)

**Solución:**
- Verifica las credenciales
- Aumenta el wait post-login a 8000ms
- Revisa el email exacto en tu .env

### Video que sale muy rápido

**Síntoma:** el video dura 2 segundos y no se ve nada

**Causa:** sin waits, las acciones se ejecutan instantáneamente.

**Solución:**
- Agrega `slowMo: 300` o más
- Agrega waits de 2000-3000ms después de cada navegación
- Pide explícitamente: "Espera 2 segundos después de cada paso"

---

## 5. Prompt completo de ejemplo (real, funciona)

Este es un prompt exacto que genera un video funcional:

```
Graba un video en formato iPhone 15 en https://www.macstoreonline.com.mx/
buscando un AirTag.

Configuración del viewport:
- width: 393
- height: 852
- deviceScaleFactor: 3
- isMobile: true
- hasTouch: true

1. Inspecciona la página con Playwright MCP
2. Razona qué acciones ejecutar para encontrar AirTag
3. Genera el YAML
4. Ejecuta: node packages/cli/dist/index.js generate -c output/macstore-airtag.yml
5. Dime el path del MP4 resultante
```

KIRO hará:
1. Inspeccionar la página → encontrar botones, links, inputs
2. Generar un YAML con: goto → aceptar cookies → scroll → click AirTag → wait
3. Ejecutar el engine → producir el MP4

El video resultante muestra la MacStore en formato mobile con scroll suave, cursor visible y highlight de clics.

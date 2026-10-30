# MCBE Texture Set Generator (web)

Port web de la aplicación de escritorio. Se ejecuta íntegramente en el
navegador (sin backend): la configuración se valida en cliente y el archivo
`{texture_name}.texture_set.json` se descarga directamente.

Construido con [Vite](https://vite.dev/) y TypeScript, sin frameworks de UI
(CSS vanilla con estilo OreUI).

## Requisitos

- Node.js 18 o superior (probado con Node 22)
- npm

## Instalación

Desde el directorio `web/`:

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

Levanta el servidor de desarrollo de Vite con recarga en caliente, por defecto
en <http://localhost:5173>. Para exponerlo en la red local:

```bash
npm run dev -- --host
```

## Build de producción

```bash
npm run build
```

Ejecuta primero la comprobación de tipos (`tsc --noEmit`) y después genera la
build optimizada en `dist/`. Si hay errores de tipos, la build se detiene.

## Previsualizar la build

```bash
npm run preview
```

Sirve el contenido de `dist/` localmente (por defecto en
<http://localhost:4173>) para comprobar la build antes de desplegarla.

## Despliegue

`dist/` contiene únicamente archivos estáticos, por lo que puede alojarse en
cualquier hosting estático (GitHub Pages, Netlify, Cloudflare Pages, un
servidor nginx, etc.).

La configuración usa `base: "./"`, así que las rutas de los assets son
relativas y la build funciona servida desde cualquier subruta.

## Estructura

```text
web/
├── index.html            Punto de entrada HTML
├── public/               Archivos copiados tal cual a dist/ (favicon)
├── src/
│   ├── main.ts           Arranque de la aplicación
│   ├── styles.css        Estilos globales
│   ├── assets/           Imágenes importadas desde el código
│   ├── models/           Estado y reglas estructurales del texture set
│   ├── validators/       Validación de configuraciones
│   ├── services/         Generación y descarga del JSON
│   └── ui/               Componentes de la interfaz
├── vite.config.ts
└── tsconfig.json
```

## Scripts disponibles

| Comando           | Descripción                                      |
| ----------------- | ------------------------------------------------ |
| `npm run dev`     | Servidor de desarrollo con recarga en caliente   |
| `npm run build`   | Comprobación de tipos y build de producción      |
| `npm run preview` | Sirve la build de `dist/` localmente             |

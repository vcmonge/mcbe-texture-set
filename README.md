# Texture Set Generator

## What is a Texture Set?

In Minecraft Bedrock, a traditional texture is simply a color image. The Vibrant Visuals and RTX graphics modes use a Physically Based Rendering (PBR) system that requires additional information to simulate how each material interacts with light, such as whether it is shiny, metallic, rough, or has surface detail.

A **texture set** is a small JSON file that accompanies a texture and tells the game which images (or fixed values) provide this additional information. It is named `{texture_name}.texture_set.json` and is placed in the same resource pack folder as the color texture.

Each additional property is defined as a layer:

| Layer | Purpose | Value |
| --- | --- | --- |
| `color` | The base texture image. It is the only required layer and the only one used by traditional graphics. | Texture name |
| `normal` | Normal map, simulates surface details and depth. | Image name |
| `heightmap` | Height map, adds depth using grayscale values. It is not supported for items. | Image name |
| `metalness_emissive_roughness` (MER) | Defines three material properties in a single image, red = metalness, green = emissiveness (glows in the dark), blue = roughness. Only valid with `format_version` 1.16.100. | Image or fixed RGB color |
| `metalness_emissive_roughness_subsurface` (MERS) | Same as MER, with an additional fourth channel (alpha) for *subsurface scattering*, which simulates light passing through materials such as leaves, wax, or skin. Only supported in Vibrant Visuals, and only valid with `format_version` 1.21.30. | Image or fixed RGBA color |

Instead of an image, MER and MERS also support a **uniform value**, a color (as an array `[r, g, b]` or `[r, g, b, a]` with values from 0 to 255, or in hexadecimal format) that works like an image filled entirely with that color.

Official reference:

[Texture Set JSON and Introduction to Texture Sets](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/texturesetsreference/texturesetsconcepts/texturesetsintroduction?view=minecraft-bedrock-stable) (Microsoft Learn).

## Requirements

- Node.js 18 or later (tested with Node 22)
- npm

## Installation

```bash
npm install
```

## Project Structure

```text
web/
├── index.html            HTML entry point
├── public/               Static files copied directly to dist/ (favicon)
├── src/
│   ├── main.ts           Application entry point
│   ├── styles.css        Global styles
│   ├── assets/           Images imported by the code
│   ├── models/           Texture set state and structural rules
│   ├── validators/       Configuration validation
│   ├── services/         JSON generation and download
│   └── ui/               UI components
├── vite.config.ts
└── tsconfig.json
```

## Project Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the development server with hot reload |
| `npm run build` | Runs type checking and creates a production build |
| `npm run preview` | Serves the production build from `dist/` locally |

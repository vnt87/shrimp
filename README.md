# SHRIMP (Simple Hi-Res Image Manipulation Program)

![SHRIMP Icon](/public/favicon.svg)

**SHRIMP** is a modern, web-based image editor inspired by GIMP. This is a project I've been working on and off since 2020 during Covid.

Background: I was a big fan of GIMP back in the days (think early 2000s). I used it for photo editing, graphic design, and web development. I wrote a couple of popular graphic tutorial for the GIMP that was trending on the GIMP forum and Good-Tutorials (high five if you're one of the OGs who still remember Good-Tutorials).
Anyway, one of my biggest gripe with GIMP is its user interface. Don't get me wrong, GIMP is an awesome pieceo of software and I appreciate decades of work poured into it from the developers who did it for free. But as a UI/UX designer, I just couldn't bare to use such a dated and unintuitive interface. 
Inpspirations:
- **GIMP** - the OG of course
- **Pixel Editor by Pavel Kanzelsberger**: I remember back then there was a project called Pixel Editor or someething along that line, created by a a solo developer from Slovakia. It had a great interface, it was everything GIMP user wished GIMP would be. But unfortunately it was proprietary, and that obviously doesn't pan out for the developer in the Linux community. It died after a few years.
- **PhotoPea by Ivan Kuckir**: an amazing piece of software. The first image editor that works fully inside your browser, and it even works entirely offline. It's not opensource, but the very fact that it is free in the first place was already amazing. One of the biggest inspiration to this project, I have nowhere near that level of technical know-how to make something like that but damn if I don't try

![SHRIMP App Screenshot](public/screenshot.png)

## Features

-   **Layer Management**: Create, delete, and organize layers.
-   **Tools**: Selection, Paint, Transform, Paths, and more.
-   **Adjustment Layers**: Non-destructive effects powered by [PixiJS Filters](https://github.com/pixijs/filters), including Glitch, Pixelate, Old Film, and more.
-   **Multi-Document Support**: Open and edit multiple images simultaneously in tabs.
-   **Auto-Save**: State is persistently saved via IndexedDB, allowing you to resume work after closing the browser.
-   **History**: Robust Undo/Redo functionality.
-   **Theme**: Dark mode interface optimized for creative work.

## Tech Stack

-   **Framework**: [React](https://react.dev/)
-   **Build Tool**: [Vite](https://vitejs.dev/)
-   **Language**: [TypeScript](https://www.typescriptlang.org/)
-   **Styling**: CSS (Custom Design System)
-   **Rendering Engine**: [PixiJS](https://pixijs.com/) (v8)
-   **State Persistence**: [idb-keyval](https://github.com/jakearchibald/idb-keyval) (IndexedDB)
-   **Icons**: [Lucide React](https://lucide.dev/)

## Folder Structure

```
webgimp/
├── public/              # Static assets (icons, etc.)
├── src/
│   ├── components/      # React components (Header, Canvas, etc.)
│   ├── App.tsx          # Main application component
│   ├── main.tsx         # Entry point
│   ├── index.css        # Global styles and design system variables
│   └── vite-env.d.ts    # Vite type definitions
├── index.html           # HTML entry point
├── package.json         # Project dependencies and scripts
└── vite.config.ts       # Vite configuration
```

## Getting Started

### Prerequisites

-   [Node.js](https://nodejs.org/) (v16 or higher)
-   [Bun](https://bun.sh/) (recommended) or npm/yarn/pnpm

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/shrimp.git
    cd shrimp
    ```

2.  Install dependencies:
    ```bash
    bun install
    # or
    npm install
    ```

### Running Locally

Start the development server:

```bash
bun run dev
# or
npm run dev
```

Open your browser and navigate to `http://localhost:5173`.

### Building for Production

Build the application for production:

```bash
bun run build
# or
npm run build
```

The output will be in the `dist/` directory.

### Docker Deployment

You can deploy the application using Docker.

1.  Build and run the container locally:
    ```bash
    docker compose up -d --build
    ```

2.  Or use the image from GitHub Container Registry (after the first successful GitHub Action run):
    ```bash
    docker compose up -d
    ```

The application will be available at `http://localhost:1337`.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Credits

-   **[PixiJS](https://pixijs.com/)**: For the powerful 2D rendering engine.
-   **[pixi-filters](https://github.com/pixijs/filters)**: For the amazing collection of visual effects.
-   **[Lucide](https://lucide.dev/)**: For the beautiful icon set.

## License

[MIT](LICENSE)

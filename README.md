# Portfolio Project

This project allows you to create and manage different variations (themes) of a personal portfolio website. It includes a Web UI for easier management and configuration.

## Getting Started

The project consists of multiple standalone variations and a management interface.

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js
- Python (optional, for simple file serving)

## Variations

Each `variation` folder (e.g., `variation1`, `variation2`) is a standalone static site.

- **variation1**: Matrix/Modern theme.
- **variation2**: Interactive Terminal theme.
- **variation3**: Liquid Glass theme.

### Creating a New Variation

1.  Copy an existing variation folder (e.g., `variation1`).
2.  Rename it to your desired name (e.g., `variation4`).
3.  Modify the `index.html`, CSS, and JS files as needed.
4.  Ensure `data/config.json` exists for configuration.

## Using the WebUI

The Web UI allows you to preview variations, edit their configuration (`config.json`) visually, and download bundled versions.

1.  Navigate to the `webUI` directory:
    ```bash
    cd webUI
    ```

2.  Install dependencies:
    ```bash
    bun install
    # or
    npm install
    ```

3.  Start the server:
    ```bash
    bun run dev
    # or
    npm run dev
    ```

4.  Open your browser at `http://localhost:3000`.

## Live Example

Check out a live example of one of the variations here:
[plainprince.github.io](https://plainprince.github.io)

## Project Structure

- `variationX/`: Individual portfolio themes (standalone).
- `webUI/`: Management tool for the variations.
- `ideas.md`: List of future ideas and concepts.


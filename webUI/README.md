# Portfolio WebUI

This is a management interface for the portfolio variations. It allows for live-previewing different variations, editing their configurations dynamically, and downloading them as bundled ZIP files.

## Project Structure

- `server.js`: Express server that handles the API for variations and configuration management.
- `public/`: Frontend assets for the WebUI.
  - `index.html`: The main dashboard.
  - `app.js`: Client-side logic for the dashboard.
  - `styles.css`: Dashboard styling.
- `package.json`: Project dependencies and scripts.
- `test_zip/`: A sample variation structure used for testing/development.

## Variations

Variations are expected to be located in the parent directory of this folder, following the naming convention `variationX`. Each variation should contain:
- `index.html`: Entry point.
- `data/config.json`: Configuration data.

## Usage

To start the server:
```bash
bun run dev
```
The interface will be available at `http://localhost:3000`.

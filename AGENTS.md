# Repository Guidelines

## Project Structure & Module Organization
This repository is a small static web app with no backend or package manager. Main source files live at the repo root: `index.html` for markup, `app.js` for browser logic, `style.css` for styling, and `favicon.svg` for the app icon. Generated assets `app.min.js` and `style.min.css` are build outputs. The `dist/` directory contains the distributable site copied from root files during the build.

## Build, Test, and Development Commands
- `open index.html` or double-click `index.html`: run the app directly in a browser for quick checks.
- `./build.sh`: regenerate `app.min.js`, `style.min.css`, and refresh `dist/`.

Edit source files first, then run `./build.sh`; do not hand-edit minified files unless you are intentionally changing the build output format.

## Coding Style & Naming Conventions
Use 2-space indentation in HTML, CSS, and JavaScript to match the existing files. Prefer plain ES2015+ browser JavaScript with `const`/`let`, small focused functions, and uppercase names for configuration objects such as `CONFIG`. Keep DOM IDs and CSS classes kebab-case (`theme-toggle`, `upload-zone`), and use descriptive function names like `renderCanvas()` or `fitCanvasToArea()`.

## Testing Guidelines
There is no automated test suite yet. Every change should include manual verification in a browser:
- load PNG, JPEG, and WebP images
- adjust watermark controls and theme toggle
- download the processed image
- rerun `./build.sh` and confirm `dist/` updates cleanly

## Commit & Pull Request Guidelines
Recent history uses short imperative commit subjects, for example: `Add meta tags for improved SEO and social media sharing` and `Remove GitHub Actions workflow for deploying static content to GitHub Pages`. Follow that style: start with a verb, keep it specific, and avoid vague summaries.

For pull requests, include a brief description of the user-visible change, link any related issue, and add screenshots or short recordings for UI updates. Note whether `./build.sh` was run and what manual browser checks were performed.

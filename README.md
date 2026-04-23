# Watermark

Watermark is a local-only browser tool for applying a repeated text watermark to an image.

The project is built as a small static web app. You open it in a browser, choose an image, adjust the watermark settings, preview the result, and download the processed file. The full workflow stays on the device in the browser. No backend, upload service, or cloud storage is involved.

## What It Does

- Loads PNG, JPEG, and WebP images in the browser
- Applies a repeated text watermark using the HTML canvas API
- Lets you adjust text, color, size, opacity, angle, and pattern density
- Exports the final image as PNG, JPEG, or WebP
- Supports drag and drop image selection for a faster workflow

## Privacy Model

This project is intended to run entirely in the browser.

- Images are processed locally on the client
- No server is required
- No image data is sent anywhere by the app itself

## Project Files

- `index.html` contains the app markup
- `app.js` contains the watermarking logic and UI behavior
- `style.css` contains the app styling
- `app.min.js` and `style.min.css` are minified assets
- `build.sh` generates the minified assets and copies distributable files into `dist/`

## Run Locally

Because this is a static browser app, you can run it in simple ways:

1. Open `index.html` directly in a browser.
2. Or serve the folder with any static file server if you prefer a local dev server.

## Use Case

This project is useful when you need a lightweight watermark tool that works locally in the browser for quick image marking without relying on external services.

## LICENSE

This project is licensed under the MIT License.

See [LICENSE](LICENSE) for the full text.

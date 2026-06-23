# Watermark

Watermark is a local-only browser tool for applying a repeated text watermark to images and PDFs.

The project is built as a static web app. You open it in a browser, choose an image or PDF, adjust the watermark settings, preview the result, and download the processed file. The full workflow stays on the device in the browser. No backend, upload service, or cloud storage is involved.

## What It Does

- Loads PNG, JPEG, and WebP images in the browser
- Loads unencrypted PDFs up to 50 MB and 100 pages
- Applies a repeated text watermark using the HTML canvas API
- Adds vector watermark text to every page when exporting PDFs
- Lets you adjust text, color, size, opacity, angle, and pattern density
- Exports images as PNG and PDFs as PDF
- Supports drag and drop file selection and image paste

## Privacy Model

This project is intended to run entirely in the browser.

- Documents are processed locally on the client
- No processing server or backend is required
- No document data is sent anywhere by the app itself

## Project Files

- `index.html` contains the app markup
- `app.js` contains the watermarking logic and UI behavior
- `style.css` contains the app styling
- `app.min.js` and `style.min.css` are minified assets
- `vendor/` contains bundled PDF libraries, PDF support assets, the watermark font, and licenses
- `build.sh` generates the minified assets and copies distributable files into `dist/`

## Run Locally

Because this is a static browser app, it can be hosted by any static file server:

1. Run `python3 -m http.server` from the repository root.
2. Open `http://localhost:8000`.

PDF support requires HTTP or HTTPS because its worker is loaded as a module.
The PDF libraries and support assets are bundled locally in `vendor/`.

## Updating Vendored Dependencies

PDF.js, pdf-lib, and fontkit are vendored so the app does not load PDF code from
a third-party CDN at runtime. To refresh them to the latest npm releases:

```bash
./update-vendor.sh
./build.sh
```

To update to specific versions instead:

```bash
PDFJS_VERSION=6.0.227 PDF_LIB_VERSION=1.17.1 FONTKIT_VERSION=1.1.1 ./update-vendor.sh
./build.sh
```

After updating, test PDF preview and PDF export before committing the vendor
changes.

## PDF Notes

- Password-protected PDFs are not supported.
- Exporting a PDF invalidates any existing digital signatures.
- PDF bytes are held in memory only and are not stored in `localStorage`.
- PDF preview uses vendored PDF.js; PDF export uses vendored pdf-lib, fontkit,
  and a bundled Noto Sans font.
- PDF libraries and support assets load from local `vendor/` files. Uploaded
  document bytes are not sent to a third-party CDN.

## Use Case

This project is useful when you need a lightweight watermark tool that works locally in the browser without relying on external document-processing services.

## LICENSE

This project is licensed under the MIT License.

See [LICENSE](LICENSE) for the full text.

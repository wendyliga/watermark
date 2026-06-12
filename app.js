/* ===== Config ===== */
const CONFIG = {
  STORAGE_KEY: 'watermark_app_state',
  THEME_KEY: 'watermark_theme',
  TTL_MS: 24 * 60 * 60 * 1000,
  MAX_DIM: 4096,
  MAX_PDF_BYTES: 50 * 1024 * 1024,
  MAX_PDF_PAGES: 100,
  PDF_JS_PATH: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/build/pdf.mjs',
  PDF_WORKER_PATH: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/build/pdf.worker.mjs',
  PDF_CMAP_PATH: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/cmaps/',
  PDF_ICC_PATH: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/iccs/',
  PDF_STANDARD_FONT_PATH: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/standard_fonts/',
  PDF_WASM_PATH: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/wasm/',
  PDF_LIB_PATH: 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  FONTKIT_PATH: 'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js',
  WATERMARK_FONT_PATH: 'vendor/fonts/NotoSans-Bold.ttf',
  WATERMARK_FONT_FAMILY: 'Noto Sans Watermark',
  DEFAULTS: {
    text: 'CONFIDENTIAL',
    color: '#ffffff',
    opacity: 0.15,
    density: 13,
    rotation: -30,
    fontSize: 30,
  },
};

const SUN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591 1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"/></svg>';
const MOON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"/></svg>';

/* ===== DOM ===== */
const $ = (s) => document.querySelector(s);
const els = {};

function cacheDom() {
  const ids = [
    'theme-toggle', 'upload-zone', 'file-input', 'preview-container',
    'preview-canvas', 'clear-document', 'wm-text', 'wm-color',
    'wm-color-hex', 'wm-opacity', 'wm-opacity-value', 'wm-density',
    'wm-density-value', 'wm-rotation', 'wm-rotation-value', 'wm-fontsize',
    'wm-fontsize-value', 'download-btn', 'download-label', 'reset-btn',
    'pdf-navigation', 'previous-page', 'next-page', 'page-indicator',
    'document-status', 'pdf-notice',
  ];
  ids.forEach((id) => {
    els[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = $('#' + id);
  });
  els.canvas = els.previewCanvas;
}

/* ===== State ===== */
const state = {
  documentType: null,
  sourceName: null,
  imageDataURL: null,
  imageElement: null,
  pdfBytes: null,
  pdfDocument: null,
  pdfPageCanvas: null,
  pdfPageNumber: 1,
  pdfPageCount: 0,
  pdfRenderToken: 0,
  documentLoadToken: 0,
  busy: false,
  settings: { ...CONFIG.DEFAULTS },
};

let pdfJsPromise = null;
let pdfExportLibsPromise = null;
let watermarkFontBytesPromise = null;
let rafPending = false;
let saveTimer = null;

/* ===== Theme ===== */
function initTheme() {
  const saved = localStorage.getItem(CONFIG.THEME_KEY);
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
  } else {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }
  updateThemeIcon();
}

function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(CONFIG.THEME_KEY, next);
  updateThemeIcon();
}

function updateThemeIcon() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  els.themeToggle.innerHTML = isDark ? SUN_SVG : MOON_SVG;
  els.themeToggle.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
}

/* ===== Dependencies ===== */
function assetUrl(path) {
  return new URL(path, document.baseURI).href;
}

function loadScript(path, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = path;
    script.onload = () => resolve(window[globalName]);
    script.onerror = () => reject(new Error(`Could not load ${path}.`));
    document.head.appendChild(script);
  });
}

async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import(assetUrl(CONFIG.PDF_JS_PATH)).then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = assetUrl(CONFIG.PDF_WORKER_PATH);
      return pdfjs;
    }).catch(() => {
      pdfJsPromise = null;
      throw new Error('Could not load PDF preview libraries. Check your internet connection and try again.');
    });
  }
  return pdfJsPromise;
}

async function loadPdfExportLibs() {
  if (!pdfExportLibsPromise) {
    pdfExportLibsPromise = Promise.all([
      loadScript(CONFIG.PDF_LIB_PATH, 'PDFLib'),
      loadScript(CONFIG.FONTKIT_PATH, 'fontkit'),
      loadWatermarkFontBytes(),
    ]).then(([pdfLib, fontkit, fontBytes]) => ({ pdfLib, fontkit, fontBytes }))
      .catch(() => {
        pdfExportLibsPromise = null;
        throw new Error('Could not load PDF export libraries. Check your internet connection and try again.');
      });
  }
  return pdfExportLibsPromise;
}

async function loadWatermarkFontBytes() {
  if (!watermarkFontBytesPromise) {
    watermarkFontBytesPromise = fetch(CONFIG.WATERMARK_FONT_PATH).then((response) => {
      if (!response.ok) throw new Error('Could not load the bundled watermark font.');
      return response.arrayBuffer();
    });
  }
  return watermarkFontBytesPromise;
}

async function ensureCanvasFont() {
  if (document.fonts?.load) {
    await document.fonts.load(`700 16px "${CONFIG.WATERMARK_FONT_FAMILY}"`);
  }
}

/* ===== Upload ===== */
function initUpload() {
  els.uploadZone.addEventListener('click', () => els.fileInput.click());
  els.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });

  const canvasArea = $('.canvas-area');
  canvasArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    els.uploadZone.classList.add('dragover');
  });
  canvasArea.addEventListener('dragleave', (e) => {
    if (!canvasArea.contains(e.relatedTarget)) {
      els.uploadZone.classList.remove('dragover');
    }
  });
  canvasArea.addEventListener('drop', (e) => {
    e.preventDefault();
    els.uploadZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  document.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) handleFile(file);
        break;
      }
    }
  });

  els.clearDocument.addEventListener('click', clearDocument);
}

function isPdfFile(file) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function isImageFile(file) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return ['image/png', 'image/jpeg', 'image/webp'].includes(type)
    || /\.(png|jpe?g|webp)$/.test(name);
}

function handleFile(file) {
  const token = ++state.documentLoadToken;
  clearStatus();
  if (isPdfFile(file)) {
    loadPdf(file, token);
  } else if (isImageFile(file)) {
    loadImage(file, token);
  } else {
    setBusy(false);
    showStatus('Choose a PNG, JPEG, WebP, or PDF file.', 'error');
  }
}

function loadImage(file, token) {
  const reader = new FileReader();
  setBusy(true, 'Loading image...');
  reader.onerror = () => {
    if (token !== state.documentLoadToken) return;
    setBusy(false);
    showStatus('Could not read that image.', 'error');
  };
  reader.onload = (e) => {
    if (token !== state.documentLoadToken) return;
    createImageElement(e.target.result, token, file.name || 'document');
  };
  reader.readAsDataURL(file);
}

function createImageElement(dataURL, token = state.documentLoadToken, sourceName = 'document') {
  const img = new Image();
  img.onerror = () => {
    if (token !== state.documentLoadToken) return;
    setBusy(false);
    showStatus('That image format could not be decoded.', 'error');
  };
  img.onload = async () => {
    if (token !== state.documentLoadToken) return;
    await clearPdfState();
    if (token !== state.documentLoadToken) return;
    state.documentType = 'image';
    state.sourceName = sourceName;
    state.imageDataURL = dataURL;
    state.imageElement = img;
    await ensureCanvasFont();
    if (token !== state.documentLoadToken) return;
    showPreview();
    renderCanvas();
    fitCanvasToArea();
    setBusy(false);
    saveState();
  };
  img.src = dataURL;
}

async function loadPdf(file, token) {
  if (file.size > CONFIG.MAX_PDF_BYTES) {
    setBusy(false);
    showStatus('PDFs must be 50 MB or smaller.', 'error');
    return;
  }

  setBusy(true, 'Loading PDF...');
  try {
    const [pdfjs, bytes] = await Promise.all([loadPdfJs(), file.arrayBuffer()]);
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(bytes.slice(0)),
      cMapUrl: assetUrl(CONFIG.PDF_CMAP_PATH),
      cMapPacked: true,
      iccUrl: assetUrl(CONFIG.PDF_ICC_PATH),
      standardFontDataUrl: assetUrl(CONFIG.PDF_STANDARD_FONT_PATH),
      wasmUrl: assetUrl(CONFIG.PDF_WASM_PATH),
    });
    const pdfDocument = await loadingTask.promise;
    if (token !== state.documentLoadToken) {
      await pdfDocument.destroy();
      return;
    }

    if (pdfDocument.numPages > CONFIG.MAX_PDF_PAGES) {
      await pdfDocument.destroy();
      throw new Error('PDFs must have 100 pages or fewer.');
    }

    await clearPdfState();
    if (token !== state.documentLoadToken) {
      await pdfDocument.destroy();
      return;
    }
    state.documentType = 'pdf';
    state.sourceName = file.name || 'document.pdf';
    state.imageDataURL = null;
    state.imageElement = null;
    state.pdfBytes = new Uint8Array(bytes);
    state.pdfDocument = pdfDocument;
    state.pdfPageNumber = 1;
    state.pdfPageCount = pdfDocument.numPages;
    showPreview();
    updatePdfUi();
    saveState();
    await renderPdfPage();
    if (token === state.documentLoadToken) setBusy(false);
  } catch (error) {
    if (token !== state.documentLoadToken) return;
    setBusy(false);
    showStatus(formatPdfError(error), 'error');
  }
}

function formatPdfError(error) {
  if (error?.name === 'PasswordException') {
    return 'Password-protected PDFs are not supported.';
  }
  if (error?.name === 'InvalidPDFException') {
    return 'That PDF is corrupt or invalid.';
  }
  return error?.message || 'Could not load that PDF.';
}

function clearPdfState() {
  state.pdfRenderToken += 1;
  const pdfDocument = state.pdfDocument;
  state.pdfBytes = null;
  state.pdfDocument = null;
  state.pdfPageCanvas = null;
  state.pdfPageNumber = 1;
  state.pdfPageCount = 0;
  return pdfDocument?.destroy().catch(() => {});
}

async function clearDocument() {
  state.documentLoadToken += 1;
  const cleanup = clearPdfState();
  state.busy = false;
  state.documentType = null;
  state.sourceName = null;
  state.imageDataURL = null;
  state.imageElement = null;
  els.uploadZone.hidden = false;
  els.previewContainer.hidden = true;
  els.downloadBtn.disabled = true;
  els.fileInput.value = '';
  clearStatus();
  updatePdfUi();
  saveState();
  await cleanup;
}

function showPreview() {
  els.uploadZone.hidden = true;
  els.previewContainer.hidden = false;
  els.downloadBtn.disabled = state.busy;
  els.canvas.style.width = '';
  els.canvas.style.height = '';
  els.canvas.style.maxWidth = '';
  els.canvas.style.maxHeight = '';
  updatePdfUi();
}

/* ===== Preview Rendering ===== */
function fitCanvasToArea() {
  if (!els.canvas.width || !els.canvas.height) return;
  const area = $('.canvas-area');
  const availW = (area.clientWidth - 64) * 0.75;
  const availH = (area.clientHeight - 120) * 0.75;
  const aspect = els.canvas.width / els.canvas.height;
  let displayW;
  let displayH;

  if (availW / availH > aspect) {
    displayH = availH;
    displayW = displayH * aspect;
  } else {
    displayW = availW;
    displayH = displayW / aspect;
  }

  els.canvas.style.maxWidth = 'none';
  els.canvas.style.maxHeight = 'none';
  els.canvas.style.width = Math.round(Math.max(displayW, 100)) + 'px';
  els.canvas.style.height = Math.round(Math.max(displayH, 80)) + 'px';
}

function scheduleRender() {
  if (!rafPending) {
    rafPending = true;
    requestAnimationFrame(() => {
      renderCanvas();
      rafPending = false;
    });
  }
}

function renderCanvas() {
  if (state.documentType === 'image' && state.imageElement) {
    renderWatermarkedImage(els.canvas, state.imageElement, state.settings, CONFIG.MAX_DIM);
  } else if (state.documentType === 'pdf' && state.pdfPageCanvas) {
    const ctx = els.canvas.getContext('2d');
    els.canvas.width = state.pdfPageCanvas.width;
    els.canvas.height = state.pdfPageCanvas.height;
    ctx.drawImage(state.pdfPageCanvas, 0, 0);
    renderCanvasWatermark(ctx, els.canvas.width, els.canvas.height, state.settings);
  }
}

function renderWatermarkedImage(canvas, img, settings, maxDim) {
  const ctx = canvas.getContext('2d');
  let width = img.naturalWidth;
  let height = img.naturalHeight;

  if (maxDim && (width > maxDim || height > maxDim)) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  renderCanvasWatermark(ctx, width, height, settings);
}

function getWatermarkLayout(width, height, settings, measureText) {
  const text = settings.text || CONFIG.DEFAULTS.text;
  const fontSize = Math.max(8, settings.fontSize * (Math.max(width, height) / 1000));
  const textWidth = measureText(text, fontSize);
  const textHeight = fontSize * 1.2;
  const spacingMul = 1.05 + (6 - 1.05) * Math.pow((15 - settings.density) / 14, 1.5);
  const stepX = Math.max(textWidth * spacingMul, textWidth + 10);
  const stepY = Math.max(textHeight * spacingMul, textHeight + 10);
  const diagonal = Math.sqrt(width * width + height * height);

  return {
    text,
    fontSize,
    textWidth,
    stepX,
    stepY,
    startX: -diagonal / 2,
    startY: -diagonal / 2,
    endX: width + diagonal / 2,
    endY: height + diagonal / 2,
  };
}

function renderCanvasWatermark(ctx, width, height, settings) {
  ctx.save();
  ctx.font = `700 ${Math.max(8, settings.fontSize * (Math.max(width, height) / 1000))}px "${CONFIG.WATERMARK_FONT_FAMILY}", sans-serif`;
  const layout = getWatermarkLayout(width, height, settings, (text) => ctx.measureText(text).width);
  ctx.font = `700 ${layout.fontSize}px "${CONFIG.WATERMARK_FONT_FAMILY}", sans-serif`;
  ctx.fillStyle = settings.color;
  ctx.globalAlpha = settings.opacity;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const angle = (settings.rotation * Math.PI) / 180;

  for (let y = layout.startY; y < layout.endY; y += layout.stepY) {
    for (let x = layout.startX; x < layout.endX; x += layout.stepX) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillText(layout.text, 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}

async function renderPdfPage() {
  if (!state.pdfDocument) return;
  const token = ++state.pdfRenderToken;
  const documentToken = state.documentLoadToken;
  setBusy(true, `Rendering page ${state.pdfPageNumber}...`);

  try {
    const page = await state.pdfDocument.getPage(state.pdfPageNumber);
    const initialViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2, CONFIG.MAX_DIM / Math.max(initialViewport.width, initialViewport.height));
    const viewport = page.getViewport({ scale });
    const pageCanvas = document.createElement('canvas');
    const ctx = pageCanvas.getContext('2d');
    pageCanvas.width = Math.ceil(viewport.width);
    pageCanvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    if (token !== state.pdfRenderToken || documentToken !== state.documentLoadToken) return;

    state.pdfPageCanvas = pageCanvas;
    renderCanvas();
    fitCanvasToArea();
    setBusy(false);
  } catch (error) {
    if (token !== state.pdfRenderToken || documentToken !== state.documentLoadToken) return;
    setBusy(false);
    showStatus(error?.message || 'Could not render that PDF page.', 'error');
  }
}

/* ===== PDF Navigation ===== */
function initPdfNavigation() {
  els.previousPage.addEventListener('click', () => changePdfPage(-1));
  els.nextPage.addEventListener('click', () => changePdfPage(1));
}

function changePdfPage(delta) {
  if (state.busy || state.documentType !== 'pdf') return;
  const next = Math.min(state.pdfPageCount, Math.max(1, state.pdfPageNumber + delta));
  if (next === state.pdfPageNumber) return;
  state.pdfPageNumber = next;
  updatePdfUi();
  renderPdfPage();
}

function updatePdfUi() {
  const isPdf = state.documentType === 'pdf';
  els.pdfNavigation.hidden = !isPdf;
  els.pdfNotice.hidden = !isPdf;
  els.downloadLabel.textContent = isPdf
    ? 'Download PDF'
    : state.documentType === 'image' ? 'Download PNG' : 'Download';

  if (isPdf) {
    els.pageIndicator.textContent = `Page ${state.pdfPageNumber} of ${state.pdfPageCount}`;
    els.previousPage.disabled = state.busy || state.pdfPageNumber <= 1;
    els.nextPage.disabled = state.busy || state.pdfPageNumber >= state.pdfPageCount;
  }
}

/* ===== Controls ===== */
function initControls() {
  els.wmText.addEventListener('input', () => {
    state.settings.text = els.wmText.value;
    scheduleRender();
    debouncedSave();
  });

  els.wmColor.addEventListener('input', () => {
    state.settings.color = els.wmColor.value;
    els.wmColorHex.value = els.wmColor.value;
    scheduleRender();
    debouncedSave();
  });

  els.wmColorHex.addEventListener('change', () => {
    let value = els.wmColorHex.value.trim();
    if (/^#?[0-9a-fA-F]{6}$/.test(value)) {
      if (!value.startsWith('#')) value = '#' + value;
      state.settings.color = value;
      els.wmColor.value = value;
      els.wmColorHex.value = value;
      scheduleRender();
      debouncedSave();
    } else {
      els.wmColorHex.value = state.settings.color;
    }
  });

  const rangeControls = [
    { el: els.wmOpacity, key: 'opacity', display: els.wmOpacityValue, parse: parseFloat },
    { el: els.wmDensity, key: 'density', display: els.wmDensityValue, parse: parseInt },
    { el: els.wmRotation, key: 'rotation', display: els.wmRotationValue, parse: parseInt },
    { el: els.wmFontsize, key: 'fontSize', display: els.wmFontsizeValue, parse: parseInt },
  ];

  rangeControls.forEach(({ el, key, display, parse }) => {
    el.addEventListener('input', () => {
      const value = parse(el.value);
      state.settings[key] = value;
      display.textContent = key === 'rotation' ? value + '\u00B0' : value;
      scheduleRender();
      debouncedSave();
    });
  });

  els.resetBtn.addEventListener('click', () => {
    state.settings = { ...CONFIG.DEFAULTS };
    syncControlsFromState();
    scheduleRender();
    saveState();
  });
}

function syncControlsFromState() {
  const settings = state.settings;
  els.wmText.value = settings.text === CONFIG.DEFAULTS.text ? '' : settings.text;
  els.wmColor.value = settings.color;
  els.wmColorHex.value = settings.color;
  els.wmOpacity.value = settings.opacity;
  els.wmOpacityValue.textContent = settings.opacity;
  els.wmDensity.value = settings.density;
  els.wmDensityValue.textContent = settings.density;
  els.wmRotation.value = settings.rotation;
  els.wmRotationValue.textContent = settings.rotation + '\u00B0';
  els.wmFontsize.value = settings.fontSize;
  els.wmFontsizeValue.textContent = settings.fontSize;
}

/* ===== Download ===== */
function initDownload() {
  els.downloadBtn.addEventListener('click', async () => {
    clearStatus();
    if (state.documentType === 'pdf') {
      await downloadPdf();
    } else if (state.documentType === 'image' && state.imageElement) {
      await downloadImage();
    }
  });
}

async function downloadImage() {
  const token = state.documentLoadToken;
  const image = state.imageElement;
  const settings = { ...state.settings };
  const sourceName = state.sourceName;
  setBusy(true, 'Preparing PNG...');
  try {
    await ensureCanvasFont();
    if (token !== state.documentLoadToken) return;
    const tempCanvas = document.createElement('canvas');
    renderWatermarkedImage(tempCanvas, image, settings, null);
    tempCanvas.toBlob((blob) => {
      if (token !== state.documentLoadToken) return;
      if (blob) {
        downloadBlob(blob, watermarkedName(sourceName, 'png'));
        setBusy(false);
      } else {
        setBusy(false);
        showStatus('Could not prepare the PNG download.', 'error');
      }
    }, 'image/png');
  } catch (error) {
    if (token !== state.documentLoadToken) return;
    setBusy(false);
    showStatus(error?.message || 'Could not prepare the PNG download.', 'error');
  }
}

async function downloadPdf() {
  if (!state.pdfBytes) return;
  const token = state.documentLoadToken;
  const sourceBytes = state.pdfBytes.slice();
  const sourceName = state.sourceName;
  const settings = { ...state.settings };
  setBusy(true, 'Watermarking PDF...');

  try {
    const { pdfLib, fontkit, fontBytes } = await loadPdfExportLibs();
    const pdfDocument = await pdfLib.PDFDocument.load(sourceBytes, {
      updateMetadata: false,
    });
    pdfDocument.registerFontkit(fontkit);
    const font = await pdfDocument.embedFont(fontBytes, { subset: true });
    const color = hexToPdfColor(settings.color, pdfLib.rgb);

    for (const page of pdfDocument.getPages()) {
      drawPdfWatermark(page, font, color, settings, pdfLib.degrees);
    }

    const bytes = await pdfDocument.save();
    if (token !== state.documentLoadToken) return;
    downloadBlob(new Blob([bytes], { type: 'application/pdf' }), watermarkedName(sourceName, 'pdf'));
    setBusy(false);
  } catch (error) {
    if (token !== state.documentLoadToken) return;
    setBusy(false);
    showStatus(formatPdfError(error), 'error');
  }
}

function drawPdfWatermark(page, font, color, settings, degrees) {
  const crop = page.getCropBox();
  const pageRotation = ((page.getRotation().angle % 360) + 360) % 360;
  const visibleWidth = pageRotation % 180 === 0 ? crop.width : crop.height;
  const visibleHeight = pageRotation % 180 === 0 ? crop.height : crop.width;
  const layout = getWatermarkLayout(visibleWidth, visibleHeight, settings, (text, size) => {
    return font.widthOfTextAtSize(text, size);
  });
  const pdfRotation = pageRotation - settings.rotation;
  const angle = (pdfRotation * Math.PI) / 180;
  const baselineOffset = layout.fontSize * 0.35;

  for (let y = layout.startY; y < layout.endY; y += layout.stepY) {
    for (let x = layout.startX; x < layout.endX; x += layout.stepX) {
      const point = visibleToPdfPoint(x, y, crop, pageRotation);
      page.drawText(layout.text, {
        x: point.x - (layout.textWidth / 2) * Math.cos(angle) + baselineOffset * Math.sin(angle),
        y: point.y - (layout.textWidth / 2) * Math.sin(angle) - baselineOffset * Math.cos(angle),
        size: layout.fontSize,
        font,
        color,
        opacity: settings.opacity,
        rotate: degrees(pdfRotation),
      });
    }
  }
}

function visibleToPdfPoint(x, y, crop, rotation) {
  if (rotation === 90) {
    return { x: crop.x + y, y: crop.y + x };
  }
  if (rotation === 180) {
    return { x: crop.x + crop.width - x, y: crop.y + y };
  }
  if (rotation === 270) {
    return { x: crop.x + crop.width - y, y: crop.y + crop.height - x };
  }
  return { x: crop.x + x, y: crop.y + crop.height - y };
}

function hexToPdfColor(hex, rgb) {
  const value = hex.replace('#', '');
  return rgb(
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  );
}

function watermarkedName(sourceName, extension) {
  const base = (sourceName || 'document').replace(/\.[^.]+$/, '');
  return `${base}-watermarked.${extension}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ===== Status ===== */
function setBusy(busy, message = '') {
  state.busy = busy;
  els.downloadBtn.disabled = busy || !state.documentType;
  if (message) showStatus(message, 'loading');
  else if (els.documentStatus.dataset.type === 'loading') clearStatus();
  updatePdfUi();
}

function showStatus(message, type) {
  els.documentStatus.textContent = message;
  els.documentStatus.dataset.type = type;
  els.documentStatus.hidden = false;
}

function clearStatus() {
  els.documentStatus.textContent = '';
  els.documentStatus.dataset.type = '';
  els.documentStatus.hidden = true;
}

/* ===== Persistence ===== */
function debouncedSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveState, 300);
}

function saveState() {
  try {
    const payload = {
      timestamp: Date.now(),
      settings: state.settings,
      imageDataURL: state.documentType === 'image' ? state.imageDataURL : null,
    };
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({
        timestamp: Date.now(),
        settings: state.settings,
        imageDataURL: null,
      }));
    } catch (_) {}
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (!raw) return;
    const payload = JSON.parse(raw);
    if (Date.now() - payload.timestamp > CONFIG.TTL_MS) {
      localStorage.removeItem(CONFIG.STORAGE_KEY);
      return;
    }

    if (payload.settings) state.settings = { ...CONFIG.DEFAULTS, ...payload.settings };
    syncControlsFromState();

    if (payload.imageDataURL) {
      const token = ++state.documentLoadToken;
      state.documentType = 'image';
      state.sourceName = 'document';
      state.imageDataURL = payload.imageDataURL;
      createImageElement(state.imageDataURL, token);
    }
  } catch (error) {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
  }
}

/* ===== Resizable Preview ===== */
function initResize() {
  const canvas = els.canvas;
  let isResizing = false;
  let startX;
  let startY;
  let startW;
  let startH;
  const edgeSize = 12;

  function getEdge(e, rect) {
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    const right = x > rect.width - edgeSize;
    const bottom = y > rect.height - edgeSize;
    if (right && bottom) return 'se';
    if (right) return 'e';
    if (bottom) return 's';
    return null;
  }

  canvas.addEventListener('mousemove', (e) => {
    if (isResizing) return;
    const edge = getEdge(e, canvas.getBoundingClientRect());
    canvas.style.cursor = edge === 'se' ? 'nwse-resize' : edge === 'e' ? 'ew-resize' : edge === 's' ? 'ns-resize' : 'default';
  });

  function onPointerDown(e) {
    const edge = getEdge(e, canvas.getBoundingClientRect());
    if (!edge) return;
    e.preventDefault();
    isResizing = true;
    startX = e.touches ? e.touches[0].clientX : e.clientX;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startW = canvas.getBoundingClientRect().width;
    startH = canvas.getBoundingClientRect().height;
    const aspect = startW / startH;

    function onMove(event) {
      event.preventDefault();
      const x = event.touches ? event.touches[0].clientX : event.clientX;
      const y = event.touches ? event.touches[0].clientY : event.clientY;
      let width = startW;
      let height = startH;

      if (edge === 'se' || edge === 'e') {
        width = Math.max(100, startW + (x - startX));
        height = width / aspect;
      } else {
        height = Math.max(80, startH + (y - startY));
        width = height * aspect;
      }

      canvas.style.maxWidth = 'none';
      canvas.style.maxHeight = 'none';
      canvas.style.width = Math.round(width) + 'px';
      canvas.style.height = Math.round(height) + 'px';
    }

    function onUp() {
      isResizing = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }

  canvas.addEventListener('mousedown', onPointerDown);
  canvas.addEventListener('touchstart', onPointerDown, { passive: false });
}

/* ===== Init ===== */
function init() {
  cacheDom();
  initTheme();
  initUpload();
  initControls();
  initDownload();
  initPdfNavigation();
  initResize();
  els.themeToggle.addEventListener('click', toggleTheme);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(CONFIG.THEME_KEY)) {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      updateThemeIcon();
    }
  });

  loadState();
}

document.addEventListener('DOMContentLoaded', init);

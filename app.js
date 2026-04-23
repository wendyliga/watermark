/* ===== Config ===== */
const CONFIG = {
  STORAGE_KEY: 'watermark_app_state',
  THEME_KEY: 'watermark_theme',
  TTL_MS: 24 * 60 * 60 * 1000,
  MAX_DIM: 4096,
  DEFAULTS: {
    text: 'CONFIDENTIAL',
    color: '#ffffff',
    opacity: 0.15,
    density: 13,
    rotation: -30,
    fontSize: 30,
  },
};

const SUN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"/></svg>';
const MOON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"/></svg>';

/* ===== DOM ===== */
const $ = (s) => document.querySelector(s);
const els = {
  themeToggle: null,
  uploadZone: null,
  fileInput: null,
  previewContainer: null,
  canvas: null,
  clearBtn: null,
  text: null,
  color: null,
  colorHex: null,
  opacity: null,
  opacityValue: null,
  density: null,
  densityValue: null,
  rotation: null,
  rotationValue: null,
  fontSize: null,
  fontSizeValue: null,
  downloadBtn: null,
  resetBtn: null,
};

function cacheDom() {
  els.themeToggle = $('#theme-toggle');
  els.uploadZone = $('#upload-zone');
  els.fileInput = $('#file-input');
  els.previewContainer = $('#preview-container');
  els.canvas = $('#preview-canvas');
  els.clearBtn = $('#clear-image');
  els.text = $('#wm-text');
  els.color = $('#wm-color');
  els.colorHex = $('#wm-color-hex');
  els.opacity = $('#wm-opacity');
  els.opacityValue = $('#wm-opacity-value');
  els.density = $('#wm-density');
  els.densityValue = $('#wm-density-value');
  els.rotation = $('#wm-rotation');
  els.rotationValue = $('#wm-rotation-value');
  els.fontSize = $('#wm-fontsize');
  els.fontSizeValue = $('#wm-fontsize-value');
  els.downloadBtn = $('#download-btn');
  els.resetBtn = $('#reset-btn');
}

/* ===== State ===== */
const state = {
  imageDataURL: null,
  imageElement: null,
  settings: { ...CONFIG.DEFAULTS },
  previewScale: 1.0,
};

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

/* ===== Upload ===== */
function initUpload() {
  els.uploadZone.addEventListener('click', () => els.fileInput.click());
  els.fileInput.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f && f.type.startsWith('image/')) loadImage(f);
  });

  // Drag & drop on the entire canvas area
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
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) loadImage(f);
  });

  // Paste from clipboard
  document.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) loadImage(f);
        break;
      }
    }
  });

  els.clearBtn.addEventListener('click', clearImage);
}

function loadImage(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    state.imageDataURL = e.target.result;
    createImageElement(state.imageDataURL);
  };
  reader.readAsDataURL(file);
}

function createImageElement(dataURL) {
  const img = new Image();
  img.onload = () => {
    state.imageElement = img;
    showPreview();
    renderCanvas();
    fitCanvasToArea();
    saveState();
  };
  img.src = dataURL;
}

function showPreview() {
  els.uploadZone.hidden = true;
  els.previewContainer.hidden = false;
  els.downloadBtn.disabled = false;
  // Reset any manual resize — fitCanvasToArea will set the right size
  els.canvas.style.width = '';
  els.canvas.style.height = '';
  els.canvas.style.maxWidth = '';
  els.canvas.style.maxHeight = '';
}

/* Scale canvas CSS size to fill available space */
function fitCanvasToArea() {
  if (!state.imageElement) return;
  const area = document.querySelector('.canvas-area');
  const availW = (area.clientWidth - 64) * 0.75;  // 75% of area width
  const availH = (area.clientHeight - 80) * 0.75; // 75% of area height
  const imgW = state.imageElement.naturalWidth;
  const imgH = state.imageElement.naturalHeight;
  const aspect = imgW / imgH;

  // Scale to fill as much of the available area as possible
  let displayW, displayH;
  if (availW / availH > aspect) {
    // Area is wider than image — fit by height
    displayH = availH;
    displayW = displayH * aspect;
  } else {
    // Area is taller than image — fit by width
    displayW = availW;
    displayH = displayW / aspect;
  }

  displayW = Math.round(Math.max(displayW, 100));
  displayH = Math.round(Math.max(displayH, 80));

  els.canvas.style.maxWidth = 'none';
  els.canvas.style.maxHeight = 'none';
  els.canvas.style.width = displayW + 'px';
  els.canvas.style.height = displayH + 'px';
}

function clearImage() {
  state.imageDataURL = null;
  state.imageElement = null;
  els.uploadZone.hidden = false;
  els.previewContainer.hidden = true;
  els.downloadBtn.disabled = true;
  els.fileInput.value = '';
  saveState();
}

/* ===== Canvas Rendering ===== */
let rafPending = false;

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
  if (!state.imageElement) return;
  renderWatermark(els.canvas, state.imageElement, state.settings, CONFIG.MAX_DIM);
}

function renderWatermark(canvas, img, s, maxDim) {
  const ctx = canvas.getContext('2d');
  let w = img.naturalWidth;
  let h = img.naturalHeight;

  if (maxDim && (w > maxDim || h > maxDim)) {
    const scale = maxDim / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  canvas.width = w;
  canvas.height = h;

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const text = s.text || CONFIG.DEFAULTS.text;
  // Scale font size proportionally to image, with a base that ensures
  // small fontSize values (10-34) still produce visible differences.
  const baseScale = Math.max(w, h) / 1000;
  const scaledFontSize = Math.max(8, Math.round(s.fontSize * baseScale));
  ctx.font = `bold ${scaledFontSize}px sans-serif`;
  ctx.fillStyle = s.color;
  ctx.globalAlpha = s.opacity;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const textWidth = ctx.measureText(text).width;
  const textHeight = scaledFontSize * 1.2;
  // Density 1 = very sparse (6x spacing), density 15 = extremely tight (1.05x spacing)
  // Uses an exponential curve so higher densities pack much tighter
  const spacingMul = 1.05 + (6 - 1.05) * Math.pow((15 - s.density) / 14, 1.5);
  const stepX = Math.max(textWidth * spacingMul, textWidth + 10);
  const stepY = Math.max(textHeight * spacingMul, textHeight + 10);

  const angleRad = (s.rotation * Math.PI) / 180;
  const diag = Math.sqrt(w * w + h * h);
  const startX = -diag / 2;
  const startY = -diag / 2;
  const endX = w + diag / 2;
  const endY = h + diag / 2;

  for (let y = startY; y < endY; y += stepY) {
    for (let x = startX; x < endX; x += stepX) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angleRad);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
  }

  ctx.globalAlpha = 1.0;
}

/* ===== Controls ===== */
function initControls() {
  els.text.addEventListener('input', () => {
    state.settings.text = els.text.value;
    scheduleRender();
    debouncedSave();
  });

  els.color.addEventListener('input', () => {
    state.settings.color = els.color.value;
    els.colorHex.value = els.color.value;
    scheduleRender();
    debouncedSave();
  });

  els.colorHex.addEventListener('change', () => {
    let val = els.colorHex.value.trim();
    if (/^#?[0-9a-fA-F]{6}$/.test(val)) {
      if (!val.startsWith('#')) val = '#' + val;
      state.settings.color = val;
      els.color.value = val;
      els.colorHex.value = val;
      scheduleRender();
      debouncedSave();
    } else {
      els.colorHex.value = state.settings.color;
    }
  });

  const rangeControls = [
    { el: els.opacity, key: 'opacity', display: els.opacityValue, parse: parseFloat },
    { el: els.density, key: 'density', display: els.densityValue, parse: parseInt },
    { el: els.rotation, key: 'rotation', display: els.rotationValue, parse: parseInt },
    { el: els.fontSize, key: 'fontSize', display: els.fontSizeValue, parse: parseInt },
  ];

  rangeControls.forEach(({ el, key, display, parse }) => {
    el.addEventListener('input', () => {
      const val = parse(el.value);
      state.settings[key] = val;
      display.textContent = key === 'rotation' ? val + '\u00B0' : val;
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
  const s = state.settings;
  els.text.value = s.text === CONFIG.DEFAULTS.text ? '' : s.text;
  els.color.value = s.color;
  els.colorHex.value = s.color;
  els.opacity.value = s.opacity;
  els.opacityValue.textContent = s.opacity;
  els.density.value = s.density;
  els.densityValue.textContent = s.density;
  els.rotation.value = s.rotation;
  els.rotationValue.textContent = s.rotation + '\u00B0';
  els.fontSize.value = s.fontSize;
  els.fontSizeValue.textContent = s.fontSize;
}

/* ===== Download ===== */
function initDownload() {
  els.downloadBtn.addEventListener('click', () => {
    if (!state.imageElement) return;
    const tempCanvas = document.createElement('canvas');
    renderWatermark(tempCanvas, state.imageElement, state.settings, null);
    const link = document.createElement('a');
    link.download = 'watermarked-document.png';
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
  });
}

/* ===== Persistence ===== */
let saveTimer = null;
function debouncedSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveState, 300);
}

function saveState() {
  try {
    const payload = {
      timestamp: Date.now(),
      settings: state.settings,
      imageDataURL: state.imageDataURL,
    };
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    try {
      const payload = {
        timestamp: Date.now(),
        settings: state.settings,
        imageDataURL: null,
      };
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(payload));
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

    if (payload.settings) {
      state.settings = { ...CONFIG.DEFAULTS, ...payload.settings };
    }
    syncControlsFromState();

    if (payload.imageDataURL) {
      state.imageDataURL = payload.imageDataURL;
      createImageElement(state.imageDataURL);
    }
  } catch (e) {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
  }
}

/* ===== Resizable Preview ===== */
function initResize() {
  const container = els.previewContainer;
  const canvas = els.canvas;
  let isResizing = false;
  let startX, startY, startW, startH;
  const EDGE = 12; // px from edge to trigger resize cursor

  function getEdge(e, rect) {
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    const r = x > rect.width - EDGE;
    const b = y > rect.height - EDGE;
    if (r && b) return 'se';
    if (r) return 'e';
    if (b) return 's';
    return null;
  }

  function onPointerMove(e) {
    if (isResizing) return;
    const rect = canvas.getBoundingClientRect();
    const edge = getEdge(e, rect);
    if (edge === 'se') canvas.style.cursor = 'nwse-resize';
    else if (edge === 'e') canvas.style.cursor = 'ew-resize';
    else if (edge === 's') canvas.style.cursor = 'ns-resize';
    else canvas.style.cursor = 'default';
  }

  function onPointerDown(e) {
    const rect = canvas.getBoundingClientRect();
    const edge = getEdge(e, rect);
    if (!edge) return;
    e.preventDefault();
    isResizing = true;
    startX = e.touches ? e.touches[0].clientX : e.clientX;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startW = rect.width;
    startH = rect.height;
    const aspect = startW / startH;

    function onMove(ev) {
      ev.preventDefault();
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
      let newW = startW, newH = startH;

      if (edge === 'se' || edge === 'e') {
        newW = Math.max(100, startW + (cx - startX));
        newH = newW / aspect;
      } else if (edge === 's') {
        newH = Math.max(80, startH + (cy - startY));
        newW = newH * aspect;
      }

      canvas.style.maxWidth = 'none';
      canvas.style.maxHeight = 'none';
      canvas.style.width = Math.round(newW) + 'px';
      canvas.style.height = Math.round(newH) + 'px';
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

  canvas.addEventListener('mousemove', onPointerMove);
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

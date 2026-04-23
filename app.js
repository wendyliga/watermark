const defaults = {
  text: "CONFIDENTIAL",
  color: "#ffffff",
  fontSize: 36,
  opacity: 0.18,
  angle: -32,
  density: 55,
  format: "image/png",
};

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

const state = {
  image: null,
  objectUrl: null,
  exportCanvas: null,
  resizeFrame: 0,
};

const elements = {};

window.addEventListener("DOMContentLoaded", () => {
  bindElements();
  bindEvents();
  syncOutputs();
});

function bindElements() {
  elements.form = document.getElementById("watermark-form");
  elements.upload = document.getElementById("image-upload");
  elements.text = document.getElementById("watermark-text");
  elements.color = document.getElementById("watermark-color");
  elements.fontSize = document.getElementById("font-size");
  elements.opacity = document.getElementById("opacity");
  elements.opacityOutput = document.getElementById("opacity-output");
  elements.angle = document.getElementById("angle");
  elements.angleOutput = document.getElementById("angle-output");
  elements.density = document.getElementById("density");
  elements.densityOutput = document.getElementById("density-output");
  elements.format = document.getElementById("download-format");
  elements.download = document.getElementById("download-button");
  elements.reset = document.getElementById("reset-button");
  elements.canvas = document.getElementById("preview-canvas");
  elements.previewFrame = document.getElementById("preview-frame");
  elements.placeholder = document.getElementById("preview-placeholder");
  elements.clearImage = document.getElementById("clear-image-button");
  elements.error = document.getElementById("error-message");
  elements.meta = document.getElementById("image-meta");

  state.exportCanvas = document.createElement("canvas");
}

function bindEvents() {
  elements.upload.addEventListener("change", handleUpload);
  elements.download.addEventListener("click", downloadImage);
  elements.reset.addEventListener("click", resetControls);
  elements.clearImage.addEventListener("click", clearImage);
  elements.previewFrame.addEventListener("click", handlePreviewFrameClick);
  elements.previewFrame.addEventListener("keydown", handlePreviewFrameKeydown);
  elements.previewFrame.addEventListener("dragenter", handleDragEnter);
  elements.previewFrame.addEventListener("dragover", handleDragOver);
  elements.previewFrame.addEventListener("dragleave", handleDragLeave);
  elements.previewFrame.addEventListener("drop", handleDrop);

  const liveControls = [
    elements.text,
    elements.color,
    elements.fontSize,
    elements.opacity,
    elements.angle,
    elements.density,
    elements.format,
  ];

  liveControls.forEach((control) => {
    control.addEventListener("input", handleControlChange);
    control.addEventListener("change", handleControlChange);
  });

  window.addEventListener("resize", handleResize);
}

function handlePreviewFrameClick(event) {
  if (event.target === elements.clearImage) {
    return;
  }

  elements.upload.click();
}

function handlePreviewFrameKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();
  elements.upload.click();
}

function handleDragEnter(event) {
  event.preventDefault();
  if (state.image) {
    return;
  }
  elements.previewFrame.classList.add("is-dragging");
}

function handleDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
  if (state.image) {
    return;
  }
  elements.previewFrame.classList.add("is-dragging");
}

function handleDragLeave(event) {
  if (elements.previewFrame.contains(event.relatedTarget)) {
    return;
  }

  elements.previewFrame.classList.remove("is-dragging");
}

function handleDrop(event) {
  event.preventDefault();
  elements.previewFrame.classList.remove("is-dragging");
  const file = event.dataTransfer?.files?.[0];

  if (!file) {
    return;
  }

  loadSelectedFile(file);
}

function handleControlChange() {
  syncOutputs();
  if (state.image) {
    render();
  }
}

function syncOutputs() {
  elements.opacityOutput.value = Number(elements.opacity.value).toFixed(2);
  elements.opacityOutput.textContent = Number(elements.opacity.value).toFixed(2);
  elements.angleOutput.value = `${elements.angle.value} deg`;
  elements.angleOutput.textContent = `${elements.angle.value} deg`;
  elements.densityOutput.value = `${elements.density.value}%`;
  elements.densityOutput.textContent = `${elements.density.value}%`;
}

function handleResize() {
  if (!state.image) {
    return;
  }

  cancelAnimationFrame(state.resizeFrame);
  state.resizeFrame = requestAnimationFrame(() => {
    renderPreview();
  });
}

async function handleUpload(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  await loadSelectedFile(file);
}

async function loadSelectedFile(file) {
  clearError();

  if (!allowedTypes.has(file.type)) {
    showError("Choose a PNG, JPEG, or WebP image.");
    elements.upload.value = "";
    return;
  }

  try {
    if (state.objectUrl) {
      URL.revokeObjectURL(state.objectUrl);
    }

    state.objectUrl = URL.createObjectURL(file);
    state.image = await loadImage(state.objectUrl);
    elements.previewFrame.style.setProperty("--frame-ratio", `${state.image.naturalWidth} / ${state.image.naturalHeight}`);
    elements.placeholder.hidden = true;
    elements.canvas.hidden = false;
    elements.download.disabled = false;
    elements.clearImage.hidden = false;
    elements.previewFrame.classList.add("has-image");
    elements.meta.textContent = `${file.name} | ${state.image.naturalWidth} x ${state.image.naturalHeight}`;
    render();
  } catch (error) {
    console.error(error);
    clearImage();
    showError("The selected image could not be loaded.");
  }
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image failed to load."));
    image.src = source;
  });
}

function readSettings() {
  return {
    text: elements.text.value.trim() || defaults.text,
    color: elements.color.value,
    fontSize: clampNumber(elements.fontSize.value, 10, 160, defaults.fontSize),
    opacity: clampNumber(elements.opacity.value, 0.04, 0.9, defaults.opacity),
    angle: clampNumber(elements.angle.value, -180, 180, defaults.angle),
    density: clampNumber(elements.density.value, 10, 100, defaults.density),
    format: elements.format.value,
  };
}

function render() {
  if (!state.image) {
    return;
  }

  const settings = readSettings();
  const canvas = state.exportCanvas;
  const context = canvas.getContext("2d");

  canvas.width = state.image.naturalWidth;
  canvas.height = state.image.naturalHeight;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(state.image, 0, 0);

  const tile = buildPatternTile(settings, canvas.width, canvas.height);
  const pattern = context.createPattern(tile, "repeat");

  if (!pattern) {
    showError("The watermark pattern could not be created in this browser.");
    return;
  }

  context.fillStyle = pattern;
  context.fillRect(0, 0, canvas.width, canvas.height);
  renderPreview();
}

function renderPreview() {
  if (!state.image) {
    return;
  }

  const sourceCanvas = state.exportCanvas;
  const previewCanvas = elements.canvas;
  const previewContext = previewCanvas.getContext("2d");
  const bounds = elements.previewFrame.getBoundingClientRect();
  const maxWidth = Math.max(bounds.width - 36, 120);
  const maxHeight = Math.max(bounds.height - 36, 120);
  const scale = Math.min(maxWidth / sourceCanvas.width, maxHeight / sourceCanvas.height, 1);
  const targetWidth = Math.max(Math.round(sourceCanvas.width * scale), 1);
  const targetHeight = Math.max(Math.round(sourceCanvas.height * scale), 1);

  previewCanvas.width = targetWidth;
  previewCanvas.height = targetHeight;
  previewCanvas.style.width = `${targetWidth}px`;
  previewCanvas.style.height = `${targetHeight}px`;

  previewContext.clearRect(0, 0, targetWidth, targetHeight);
  previewContext.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
}

function buildPatternTile(settings, imageWidth, imageHeight) {
  const spacing = getPatternSpacing(settings, imageWidth, imageHeight);
  const tileCanvas = document.createElement("canvas");
  tileCanvas.width = spacing.x;
  tileCanvas.height = spacing.y;

  const tileContext = tileCanvas.getContext("2d");
  tileContext.clearRect(0, 0, tileCanvas.width, tileCanvas.height);
  tileContext.translate(tileCanvas.width / 2, tileCanvas.height / 2);
  tileContext.rotate(toRadians(settings.angle));
  tileContext.font = `700 ${settings.fontSize}px Georgia, Times New Roman, serif`;
  tileContext.textAlign = "center";
  tileContext.textBaseline = "middle";
  tileContext.fillStyle = hexToRgba(settings.color, settings.opacity);

  const maxTextWidth = Math.max(tileCanvas.width * 0.78, settings.fontSize * 2.4);
  const text = constrainText(tileContext, settings.text, maxTextWidth);
  tileContext.fillText(text, 0, 0, maxTextWidth);

  return tileCanvas;
}

function getPatternSpacing(settings, imageWidth, imageHeight) {
  const densityRatio = settings.density / 100;
  const widthBase = Math.max(settings.fontSize * 3.4, imageWidth * 0.18);
  const widthRange = Math.max(settings.fontSize * 4.8, imageWidth * 0.34);
  const heightBase = Math.max(settings.fontSize * 2.2, imageHeight * 0.12);
  const heightRange = Math.max(settings.fontSize * 3.4, imageHeight * 0.2);

  return {
    x: Math.round(widthBase + (1 - densityRatio) * widthRange),
    y: Math.round(heightBase + (1 - densityRatio) * heightRange),
  };
}

function constrainText(context, value, maxWidth) {
  if (maxWidth <= 16) {
    return value.slice(0, 1);
  }

  if (context.measureText(value).width <= maxWidth) {
    return value;
  }

  let nextValue = value;
  while (nextValue.length > 1 && context.measureText(`${nextValue}...`).width > maxWidth) {
    nextValue = nextValue.slice(0, -1);
  }

  return `${nextValue}...`;
}

function downloadImage() {
  if (!state.image) {
    return;
  }

  clearError();

  const format = elements.format.value;
  const extension = format === "image/jpeg" ? "jpg" : format === "image/webp" ? "webp" : "png";

  state.exportCanvas.toBlob(
    (blob) => {
      if (!blob) {
        showError("Export failed in this browser. Try PNG format.");
        return;
      }

      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `watermarked-image.${extension}`;
      anchor.click();
      URL.revokeObjectURL(downloadUrl);
    },
    format,
    0.92
  );
}

function clearImage() {
  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }

  state.image = null;
  elements.upload.value = "";
  elements.canvas.hidden = true;
  elements.placeholder.hidden = false;
  elements.clearImage.hidden = true;
  elements.download.disabled = true;
  elements.meta.textContent = "No image loaded";
  elements.previewFrame.style.removeProperty("--frame-ratio");
  elements.previewFrame.classList.remove("has-image");
  elements.previewFrame.classList.remove("is-dragging");
  clearError();
}

function resetControls() {
  elements.text.value = defaults.text;
  elements.color.value = defaults.color;
  elements.fontSize.value = String(defaults.fontSize);
  elements.opacity.value = String(defaults.opacity);
  elements.angle.value = String(defaults.angle);
  elements.density.value = String(defaults.density);
  elements.format.value = defaults.format;
  syncOutputs();
  clearError();
  if (state.image) {
    render();
  }
}

function showError(message) {
  elements.error.hidden = false;
  elements.error.textContent = message;
}

function clearError() {
  elements.error.hidden = true;
  elements.error.textContent = "";
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numeric));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function hexToRgba(hex, alpha) {
  const sanitized = hex.replace("#", "");
  const value = sanitized.length === 3
    ? sanitized.split("").map((digit) => `${digit}${digit}`).join("")
    : sanitized;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

window.addEventListener("beforeunload", () => {
  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
  }
});

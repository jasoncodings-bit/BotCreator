"use strict";
/* ============================================================
   Square image cropper modal: drag to pan, zoom slider/wheel,
   used by the bot editor's avatar upload before saving.
   openImageCropper(file, onDone) -> onDone(dataURL) or nothing if cancelled.
   ============================================================ */

const CROP_OUTPUT_SIZE = 640;

let cropImg = null;       // loaded Image
let cropObjectUrl = null;
let cropOnDone = null;
let cropZoom = 1;
let cropMinZoom = 1;
let cropOffsetX = 0;      // pan offset in canvas px, image-space center offset
let cropOffsetY = 0;
let cropDragging = false;
let cropDragStartX = 0, cropDragStartY = 0;
let cropDragStartOffX = 0, cropDragStartOffY = 0;

function cropCanvas() { return $("crop-canvas"); }

function drawCrop() {
  const canvas = cropCanvas();
  const ctx = canvas.getContext("2d");
  const size = canvas.width; // square, css-matched
  ctx.clearRect(0, 0, size, size);
  if (!cropImg) return;

  const scale = cropMinZoom * cropZoom;
  const dw = cropImg.width * scale;
  const dh = cropImg.height * scale;
  const dx = (size - dw) / 2 + cropOffsetX;
  const dy = (size - dh) / 2 + cropOffsetY;

  ctx.fillStyle = "#1a1e29";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(cropImg, dx, dy, dw, dh);
}

function clampCropOffset() {
  const size = cropCanvas().width;
  const scale = cropMinZoom * cropZoom;
  const dw = cropImg.width * scale;
  const dh = cropImg.height * scale;
  const maxOffX = Math.max(0, (dw - size) / 2);
  const maxOffY = Math.max(0, (dh - size) / 2);
  cropOffsetX = Math.min(maxOffX, Math.max(-maxOffX, cropOffsetX));
  cropOffsetY = Math.min(maxOffY, Math.max(-maxOffY, cropOffsetY));
}

function openImageCropper(file, onDone) {
  if (!file || !file.type.startsWith("image/")) return;
  cropOnDone = onDone;
  const img = new Image();
  const url = URL.createObjectURL(file);
  cropObjectUrl = url;
  img.onload = () => {
    cropImg = img;
    const size = cropCanvas().width;
    cropMinZoom = size / Math.min(img.width, img.height);
    cropZoom = 1;
    cropOffsetX = 0;
    cropOffsetY = 0;
    $("crop-zoom").value = 1;
    drawCrop();
    $("crop-modal").classList.add("open");
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast("Couldn't read that image"); };
  img.src = url;
}

function closeImageCropper() {
  $("crop-modal").classList.remove("open");
  if (cropObjectUrl) { URL.revokeObjectURL(cropObjectUrl); cropObjectUrl = null; }
  cropImg = null;
  cropOnDone = null;
}

function confirmImageCrop() {
  const size = cropCanvas().width;
  const scale = cropMinZoom * cropZoom;
  const dw = cropImg.width * scale;
  const dh = cropImg.height * scale;
  const dx = (size - dw) / 2 + cropOffsetX;
  const dy = (size - dh) / 2 + cropOffsetY;

  const out = document.createElement("canvas");
  out.width = CROP_OUTPUT_SIZE;
  out.height = CROP_OUTPUT_SIZE;
  const ctx = out.getContext("2d");
  const outScale = CROP_OUTPUT_SIZE / size;
  ctx.fillStyle = "#1a1e29";
  ctx.fillRect(0, 0, CROP_OUTPUT_SIZE, CROP_OUTPUT_SIZE);
  ctx.drawImage(cropImg, dx * outScale, dy * outScale, dw * outScale, dh * outScale);

  const dataUrl = out.toDataURL("image/jpeg", 0.85);
  const cb = cropOnDone;
  closeImageCropper();
  if (cb) cb(dataUrl);
}

function wireImageCropper() {
  const canvas = cropCanvas();

  canvas.addEventListener("pointerdown", e => {
    if (!cropImg) return;
    cropDragging = true;
    cropDragStartX = e.clientX;
    cropDragStartY = e.clientY;
    cropDragStartOffX = cropOffsetX;
    cropDragStartOffY = cropOffsetY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", e => {
    if (!cropDragging) return;
    const ratio = canvas.width / canvas.clientWidth;
    cropOffsetX = cropDragStartOffX + (e.clientX - cropDragStartX) * ratio;
    cropOffsetY = cropDragStartOffY + (e.clientY - cropDragStartY) * ratio;
    clampCropOffset();
    drawCrop();
  });
  const endDrag = () => { cropDragging = false; };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointerleave", endDrag);

  canvas.addEventListener("wheel", e => {
    if (!cropImg) return;
    e.preventDefault();
    const zoom = $("crop-zoom");
    const step = parseFloat(zoom.step) || 0.01;
    let next = cropZoom + (e.deltaY < 0 ? step * 8 : -step * 8);
    next = Math.min(parseFloat(zoom.max), Math.max(parseFloat(zoom.min), next));
    cropZoom = next;
    zoom.value = next;
    clampCropOffset();
    drawCrop();
  }, { passive: false });

  $("crop-zoom").addEventListener("input", e => {
    cropZoom = parseFloat(e.target.value);
    clampCropOffset();
    drawCrop();
  });

  $("crop-cancel-btn").onclick = closeImageCropper;
  $("crop-use-btn").onclick = confirmImageCrop;
}

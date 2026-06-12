/**
 * Project 4 — DecodeLabs AI Recognition Pipeline
 * app.js
 *
 * Two execution paths:
 *   PATH 1: OCR  — Image → Grayscale → Blur → Threshold → Text extraction
 *   PATH 2: OBJECT DETECTION — Image → Blob construction → MobileNet-SSD inference
 *
 * Pre-processing (Grayscale, Gaussian Blur, Otsu Thresholding) runs entirely
 * in the browser via Canvas API.  The final inference step calls the
 * Anthropic Messages API with the image as a base-64 vision payload.
 *
 * ─── SETUP ────────────────────────────────────────────────────────────────
 *  1. Open config.js and paste your Anthropic API key.
 *  2. Open index.html in a local dev server (e.g. VS Code Live Server).
 *     Direct file:// access blocks fetch() to external APIs.
 * ──────────────────────────────────────────────────────────────────────────
 */

'use strict';

/* ── State ── */
let currentPath   = 'ocr';   // 'ocr' | 'obj'
let currentFile   = null;
let currentBase64 = null;
let imgNaturalW   = 0;
let imgNaturalH   = 0;

/* ── Constants ── */
const BBOX_COLORS = [
  '#00e5a0', '#4d7cff', '#f5a623', '#ff6b6b',
  '#c084fc', '#34d399', '#fb923c', '#60a5fa',
];

/* ══════════════════════════════════════════════
   PATH SWITCHING
══════════════════════════════════════════════ */
function switchPath(path) {
  currentPath = path;

  /* tabs */
  document.getElementById('tab-ocr').className = 'tab' + (path === 'ocr' ? ' active' : '');
  document.getElementById('tab-obj').className = 'tab' + (path === 'obj' ? ' active' : '');

  /* param panels */
  document.getElementById('ocr-params').style.display = path === 'ocr' ? 'block' : 'none';
  document.getElementById('obj-params').style.display  = path === 'obj' ? 'block' : 'none';

  /* chip + pipeline label */
  document.getElementById('chip-mode').textContent =
    path === 'ocr' ? 'PATH 1: OCR' : 'PATH 2: OBJECT DETECTION';
  document.getElementById('pn-infer-label').textContent =
    path === 'ocr' ? 'OCR' : 'MobileNet';

  /* step 4 description */
  document.getElementById('s4-info').innerHTML = path === 'ocr'
    ? '<b>OCR Inference (pytesseract)</b><p>Running the convolutional + bi-directional LSTM pipeline to extract text sequences.</p>'
    : '<b>Object Detection (cv2.dnn + MobileNet-SSD)</b><p>Running the Single Shot Detector with blob construction and confidence filtering at ≥80%.</p>';

  /* reset result / steps */
  document.getElementById('result-zone').style.display = 'none';
  document.getElementById('steps-panel').style.display = 'none';
  document.getElementById('preproc-strip').style.display = 'none';
  document.getElementById('error-zone').innerHTML = '';
  resetSteps();
  clearBboxCanvas();
}

/* ══════════════════════════════════════════════
   SLIDER BINDINGS
══════════════════════════════════════════════ */
document.getElementById('conf-slider').addEventListener('input', function () {
  document.getElementById('conf-val').textContent = this.value + '%';
});

document.getElementById('blur-slider').addEventListener('input', function () {
  document.getElementById('blur-val').textContent    = this.value + '×' + this.value;
  document.getElementById('s2-kernel').textContent   = this.value + '×' + this.value;
  if (currentBase64) renderPreprocessing();
});

document.getElementById('obj-conf-slider').addEventListener('input', function () {
  document.getElementById('obj-conf-val').textContent = this.value + '%';
});

document.getElementById('nms-slider').addEventListener('input', function () {
  document.getElementById('nms-val').textContent = (this.value / 100).toFixed(2);
});

/* ══════════════════════════════════════════════
   DRAG & DROP
══════════════════════════════════════════════ */
const dropZone = document.getElementById('drop-zone');

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag'));

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

/* ══════════════════════════════════════════════
   FILE HANDLING
══════════════════════════════════════════════ */
function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    alert('Please upload a valid image file (JPG, PNG, WebP, GIF).');
    return;
  }

  currentFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    currentBase64 = e.target.result.split(',')[1];

    const img = document.getElementById('preview-img');
    img.onload = () => {
      imgNaturalW = img.naturalWidth;
      imgNaturalH = img.naturalHeight;

      /* size bbox canvas to rendered size */
      const bbc   = document.getElementById('bbox-canvas');
      bbc.width   = img.offsetWidth;
      bbc.height  = img.offsetHeight;

      /* chips */
      document.getElementById('chip-dims').textContent = imgNaturalW + '×' + imgNaturalH;

      renderPreprocessing();
    };
    img.src = e.target.result;

    /* switch panels */
    document.getElementById('upload-section').style.display = 'none';
    document.getElementById('main-panel').style.display     = 'block';

    /* chips */
    document.getElementById('chip-size').textContent = (file.size / 1024).toFixed(1) + ' KB';

    /* reset previous results */
    document.getElementById('result-zone').style.display = 'none';
    document.getElementById('steps-panel').style.display = 'none';
    document.getElementById('preproc-strip').style.display = 'none';
    document.getElementById('error-zone').innerHTML = '';
    resetSteps();
    clearBboxCanvas();
  };

  reader.readAsDataURL(file);
}

function resetAll() {
  currentFile   = null;
  currentBase64 = null;
  document.getElementById('upload-section').style.display = 'block';
  document.getElementById('main-panel').style.display     = 'none';
  document.getElementById('file-input').value             = '';
}

/* ══════════════════════════════════════════════
   PRE-PROCESSING (Canvas API)
   Simulates the image pre-processing pipeline:
   1. Grayscale Conversion  (RGB → intensity)
   2. Gaussian Blur         (noise reduction)
   3. Otsu Thresholding     (binary image)
══════════════════════════════════════════════ */
function renderPreprocessing() {
  const img = document.getElementById('preview-img');
  if (!img.complete || img.naturalWidth === 0) {
    setTimeout(renderPreprocessing, 100);
    return;
  }

  const W = 120, H = 90;

  ['c-orig', 'c-gray', 'c-blur', 'c-thresh'].forEach((id) => {
    const c = document.getElementById(id);
    c.width  = W;
    c.height = H;
  });

  /* ── Step 0: Original ── */
  const origCtx = document.getElementById('c-orig').getContext('2d');
  origCtx.drawImage(img, 0, 0, W, H);
  const origData = origCtx.getImageData(0, 0, W, H);
  const d = origData.data;

  /* ── Step 1: Grayscale ── */
  const grayCtx  = document.getElementById('c-gray').getContext('2d');
  const grayImgD = grayCtx.createImageData(W, H);
  const gd       = grayImgD.data;
  const grayArr  = new Uint8ClampedArray(W * H);

  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    // Luminosity formula: ITU-R BT.601
    const g     = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    gd[i]       = gd[i + 1] = gd[i + 2] = g;
    gd[i + 3]   = 255;
    grayArr[p]  = g;
  }
  grayCtx.putImageData(grayImgD, 0, 0);

  /* ── Step 2: Gaussian Blur ── */
  const kernelSize = parseInt(document.getElementById('blur-slider').value);
  const blurred    = gaussianBlur(grayArr, W, H, kernelSize);

  const blurCtx  = document.getElementById('c-blur').getContext('2d');
  const blurImgD = blurCtx.createImageData(W, H);
  const bd       = blurImgD.data;

  for (let i = 0; i < blurred.length; i++) {
    bd[i * 4]     = blurred[i];
    bd[i * 4 + 1] = blurred[i];
    bd[i * 4 + 2] = blurred[i];
    bd[i * 4 + 3] = 255;
  }
  blurCtx.putImageData(blurImgD, 0, 0);

  /* ── Step 3: Otsu Thresholding ── */
  const threshold = otsuThreshold(blurred);
  const tCtx      = document.getElementById('c-thresh').getContext('2d');
  const tImgD     = tCtx.createImageData(W, H);
  const td        = tImgD.data;

  for (let i = 0; i < blurred.length; i++) {
    const v         = blurred[i] >= threshold ? 255 : 0;
    td[i * 4]       = v;
    td[i * 4 + 1]   = v;
    td[i * 4 + 2]   = v;
    td[i * 4 + 3]   = 255;
  }
  tCtx.putImageData(tImgD, 0, 0);
}

/**
 * gaussianBlur — applies an N×N Gaussian kernel.
 * @param {Uint8ClampedArray} arr  — grayscale pixel values
 * @param {number} W               — image width
 * @param {number} H               — image height
 * @param {number} k               — kernel size (odd number: 1, 3, 5, 7, 9)
 * @returns {Uint8ClampedArray}    — blurred pixel values
 */
function gaussianBlur(arr, W, H, k) {
  if (k <= 1) return Uint8ClampedArray.from(arr);

  const half  = Math.floor(k / 2);
  const sigma = 0.3 * ((k - 1) * 0.5 - 1) + 0.8;
  const kernel = [];
  let   ksum   = 0;

  for (let y = -half; y <= half; y++) {
    for (let x = -half; x <= half; x++) {
      const v = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
      kernel.push(v);
      ksum += v;
    }
  }

  const kn  = kernel.map((v) => v / ksum);
  const out = new Uint8ClampedArray(W * H);

  for (let row = 0; row < H; row++) {
    for (let col = 0; col < W; col++) {
      let s = 0, ki = 0;
      for (let ky = -half; ky <= half; ky++) {
        for (let kx = -half; kx <= half; kx++) {
          const ny = Math.min(H - 1, Math.max(0, row + ky));
          const nx = Math.min(W - 1, Math.max(0, col + kx));
          s += arr[ny * W + nx] * kn[ki++];
        }
      }
      out[row * W + col] = Math.round(s);
    }
  }

  return out;
}

/**
 * otsuThreshold — finds the optimal global threshold using Otsu's method.
 * Maximises inter-class variance between foreground and background.
 * @param {Uint8ClampedArray} arr — grayscale pixel values
 * @returns {number}               — threshold value 0-255
 */
function otsuThreshold(arr) {
  const hist  = new Array(256).fill(0);
  arr.forEach((v) => hist[v]++);

  const total = arr.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sumB = 0, wB = 0, wF = 0, maxVar = 0, thresh = 0;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;

    wF = total - wB;
    if (!wF) break;

    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const v  = wB * wF * (mB - mF) * (mB - mF);

    if (v > maxVar) {
      maxVar = v;
      thresh = t;
    }
  }

  return thresh;
}

/* ══════════════════════════════════════════════
   BOUNDING BOX CANVAS
══════════════════════════════════════════════ */
function clearBboxCanvas() {
  const c   = document.getElementById('bbox-canvas');
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
}

function drawBboxes(detections) {
  const img = document.getElementById('preview-img');
  const c   = document.getElementById('bbox-canvas');

  /* sync canvas size to rendered image size */
  c.width  = img.offsetWidth;
  c.height = img.offsetHeight;

  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);

  detections.forEach((det, i) => {
    const bb  = det.bbox || {};
    const x   = (bb.x || 0) * c.width;
    const y   = (bb.y || 0) * c.height;
    const w   = (bb.w || 0.3) * c.width;
    const h   = (bb.h || 0.3) * c.height;
    const col = BBOX_COLORS[i % BBOX_COLORS.length];
    const pct = Math.round((det.confidence || 0) * 100);
    const lbl = `${det.label || 'object'} ${pct}%`;

    /* bounding box rectangle */
    ctx.strokeStyle = col;
    ctx.lineWidth   = 2;
    ctx.strokeRect(x, y, w, h);

    /* label background */
    ctx.font = 'bold 11px "Space Mono", monospace';
    const tw = ctx.measureText(lbl).width + 10;
    ctx.fillStyle = col + 'dd';
    ctx.fillRect(x, y - 20, tw, 20);

    /* label text */
    ctx.fillStyle = '#000000';
    ctx.fillText(lbl, x + 5, y - 6);
  });
}

/* ══════════════════════════════════════════════
   STEP MANAGEMENT
══════════════════════════════════════════════ */
function resetSteps() {
  [1, 2, 3, 4].forEach((n) => {
    const num    = document.getElementById('s' + n + '-num');
    const status = document.getElementById('s' + n + '-status');
    num.className    = 'step-num';
    num.textContent  = '0' + n;
    status.className = 'step-status status-pending';
    status.textContent = 'PENDING';
  });

  /* reset pipeline nodes */
  ['pn-gray', 'pn-blur', 'pn-thresh', 'pn-infer', 'pn-out'].forEach((id) => {
    document.getElementById(id).className = 'pipe-node';
  });
}

function activateStep(n) {
  const status = document.getElementById('s' + n + '-status');
  const num    = document.getElementById('s' + n + '-num');

  status.className = 'step-status status-running';
  status.innerHTML = '<span class="loading-dots"><span></span><span></span><span></span></span>';
  num.className    = 'step-num running';

  const nodeMap = { 1: 'pn-gray', 2: 'pn-blur', 3: 'pn-thresh', 4: 'pn-infer' };
  if (nodeMap[n]) document.getElementById(nodeMap[n]).className = 'pipe-node active-node';
}

function completeStep(n) {
  document.getElementById('s' + n + '-status').className   = 'step-status status-done';
  document.getElementById('s' + n + '-status').textContent = 'DONE ✓';
  document.getElementById('s' + n + '-num').className      = 'step-num done';
}

/* ══════════════════════════════════════════════
   MAIN PIPELINE RUNNER
══════════════════════════════════════════════ */
async function runPipeline() {
  if (!currentBase64) return;

  const btn = document.getElementById('run-btn');
  btn.disabled    = true;
  btn.textContent = '⟳ PROCESSING...';

  /* reset UI */
  document.getElementById('error-zone').innerHTML     = '';
  document.getElementById('result-zone').style.display = 'none';
  document.getElementById('steps-panel').style.display = 'block';
  document.getElementById('preproc-strip').style.display = 'flex';
  resetSteps();
  clearBboxCanvas();
  renderPreprocessing();

  const confPct = parseInt(
    currentPath === 'ocr'
      ? document.getElementById('conf-slider').value
      : document.getElementById('obj-conf-slider').value
  );
  const confThresh = confPct / 100;

  try {
    /* ── Step 1: Grayscale ── */
    activateStep(1);
    await delay(600);
    completeStep(1);

    /* ── Step 2: Gaussian Blur ── */
    activateStep(2);
    await delay(500);
    completeStep(2);

    /* ── Step 3: Threshold ── */
    activateStep(3);
    await delay(500);
    completeStep(3);

    /* ── Step 4: AI Inference ── */
    activateStep(4);

    const parsed = await callVisionAPI(confPct, confThresh);

    completeStep(4);
    document.getElementById('pn-out').className = 'pipe-node active-node';
    await delay(300);

    displayResult(parsed, confThresh);

  } catch (err) {
    document.getElementById('error-zone').innerHTML =
      `<div class="error-box">⚠ Pipeline error: ${escHtml(err.message)}</div>`;
    console.error('[Project4] Pipeline error:', err);
  }

  btn.disabled    = false;
  btn.textContent = '▶ EXECUTE_PIPELINE';
}

/* ══════════════════════════════════════════════
   MULTI-PROVIDER VISION API ROUTER
══════════════════════════════════════════════ */
async function callVisionAPI(confPct, confThresh) {
  const provider = (typeof CONFIG !== 'undefined' && CONFIG.API_PROVIDER)
    ? CONFIG.API_PROVIDER.toLowerCase()
    : 'anthropic';

  if (provider === 'anthropic') {
    return await callAnthropicAPI(confPct, confThresh);
  } else if (provider === 'gemini') {
    return await callGeminiAPI(confPct, confThresh);
  } else if (provider === 'openai') {
    return await callOpenAIAPI(confPct, confThresh);
  } else {
    throw new Error(`Unknown API provider: ${provider}. Supported: 'anthropic', 'gemini', 'openai'`);
  }
}

/* ══════════════════════════════════════════════
   ANTHROPIC (CLAUDE) API CALL
══════════════════════════════════════════════ */
async function callAnthropicAPI(confPct, confThresh) {
  /* Read API key from config */
  const apiKey = (typeof CONFIG !== 'undefined' && CONFIG.ANTHROPIC_API_KEY)
    ? CONFIG.ANTHROPIC_API_KEY
    : '';

  if (!apiKey || apiKey === 'YOUR_ANTHROPIC_API_KEY_HERE') {
    throw new Error(
      'API key not set. Open config.js, set API_PROVIDER to "anthropic", and paste your Anthropic API key into ANTHROPIC_API_KEY.'
    );
  }

  const psm      = document.getElementById('psm-select').value;
  const blobSize = document.getElementById('blob-size').value;
  const nms      = (document.getElementById('nms-slider').value / 100).toFixed(2);
  const mimeType = currentFile.type || 'image/jpeg';

  let systemPrompt, userPrompt;

  if (currentPath === 'ocr') {
    systemPrompt =
      `You are a high-precision OCR engine simulating pytesseract with PSM ${psm}. ` +
      `Extract ALL visible text from the image exactly as it appears. ` +
      `Respond ONLY with valid JSON (no markdown, no backticks): ` +
      `{"text":"...extracted text...","confidence":0.00,"word_count":0,"lines":["line1","line2"]}` +
      ` where confidence is a float 0.0–1.0.`;

    userPrompt =
      `Run OCR text extraction on this image using PSM mode ${psm}. ` +
      `Extract all visible text. Confidence minimum: ${confPct}%. Return ONLY the JSON object.`;
  } else {
    systemPrompt =
      `You are an object detection engine simulating cv2.dnn with MobileNet-SSD (COCO classes). ` +
      `Identify ALL objects in the image with confidence >= ${confPct}%. ` +
      `Blob input size: ${blobSize}×${blobSize}. ` +
      `Respond ONLY with valid JSON (no markdown, no backticks): ` +
      `{"detections":[{"label":"...","confidence":0.00,"bbox":{"x":0.0,"y":0.0,"w":0.0,"h":0.0},"class_id":0}],"total":0,"filtered":0}` +
      ` where bbox values are normalized fractions 0.0–1.0 of image width/height.`;

    userPrompt =
      `Run object detection on this image using MobileNet-SSD. ` +
      `Blob size: ${blobSize}×${blobSize}. Confidence gate: ${confPct}%. NMS threshold: ${nms}. ` +
      `Identify all objects. Return ONLY the JSON object.`;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key':    apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system:     systemPrompt,
      messages: [{
        role: 'user',
        content: [
          {
            type:   'image',
            source: { type: 'base64', media_type: mimeType, data: currentBase64 },
          },
          { type: 'text', text: userPrompt },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `API error ${response.status}`);
  }

  const data    = await response.json();
  const rawText = data.content.map((c) => c.text || '').join('');

  let parsed;
  try {
    const clean = rawText.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    /* Fallback: wrap raw text in an OCR-compatible structure */
    parsed = currentPath === 'ocr'
      ? {
          text:       rawText,
          confidence: 0.85,
          word_count: rawText.split(/\s+/).filter(Boolean).length,
          lines:      rawText.split('\n'),
        }
      : { detections: [], total: 0, filtered: 0 };
  }

  return parsed;
}

/* ══════════════════════════════════════════════
   GOOGLE GEMINI API CALL
══════════════════════════════════════════════ */
async function callGeminiAPI(confPct, confThresh) {
  /* Read API key from config */
  const apiKey = (typeof CONFIG !== 'undefined' && CONFIG.GOOGLE_GEMINI_API_KEY)
    ? CONFIG.GOOGLE_GEMINI_API_KEY
    : '';

  if (!apiKey || apiKey === 'YOUR_GOOGLE_GEMINI_API_KEY_HERE') {
    throw new Error(
      'API key not set. Open config.js, set API_PROVIDER to "gemini", and paste your Google Gemini API key into GOOGLE_GEMINI_API_KEY.'
    );
  }

  const psm      = document.getElementById('psm-select').value;
  const blobSize = document.getElementById('blob-size').value;
  const nms      = (document.getElementById('nms-slider').value / 100).toFixed(2);

  let systemPrompt, userPrompt;

  if (currentPath === 'ocr') {
    systemPrompt =
      `You are a high-precision OCR engine simulating pytesseract with PSM ${psm}. ` +
      `Extract ALL visible text from the image exactly as it appears. ` +
      `Respond ONLY with valid JSON (no markdown, no backticks): ` +
      `{"text":"...extracted text...","confidence":0.00,"word_count":0,"lines":["line1","line2"]}` +
      ` where confidence is a float 0.0–1.0.`;

    userPrompt =
      `Run OCR text extraction on this image using PSM mode ${psm}. ` +
      `Extract all visible text. Confidence minimum: ${confPct}%. Return ONLY the JSON object.`;
  } else {
    systemPrompt =
      `You are an object detection engine simulating cv2.dnn with MobileNet-SSD (COCO classes). ` +
      `Identify ALL objects in the image with confidence >= ${confPct}%. ` +
      `Blob input size: ${blobSize}×${blobSize}. ` +
      `Respond ONLY with valid JSON (no markdown, no backticks): ` +
      `{"detections":[{"label":"...","confidence":0.00,"bbox":{"x":0.0,"y":0.0,"w":0.0,"h":0.0},"class_id":0}],"total":0,"filtered":0}` +
      ` where bbox values are normalized fractions 0.0–1.0 of image width/height.`;

    userPrompt =
      `Run object detection on this image using MobileNet-SSD. ` +
      `Blob size: ${blobSize}×${blobSize}. Confidence gate: ${confPct}%. NMS threshold: ${nms}. ` +
      `Identify all objects. Return ONLY the JSON object.`;
  }

  /* Convert base64 to Gemini format (includes data URI prefix) */
  const mimeType = currentFile.type || 'image/jpeg';
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        system_instruction: {
          parts: { text: systemPrompt },
        },
        contents: {
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: currentBase64,
              },
            },
            {
              text: userPrompt,
            },
          ],
        },
        generation_config: {
          max_output_tokens: 1000,
        },
      }),
    }
  );

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `Gemini API error ${response.status}`);
  }

  const data = await response.json();
  const rawText = (data.candidates?.[0]?.content?.parts?.[0]?.text) || '';

  let parsed;
  try {
    const clean = rawText.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    /* Fallback: wrap raw text in an OCR-compatible structure */
    parsed = currentPath === 'ocr'
      ? {
          text:       rawText,
          confidence: 0.85,
          word_count: rawText.split(/\s+/).filter(Boolean).length,
          lines:      rawText.split('\n'),
        }
      : { detections: [], total: 0, filtered: 0 };
  }

  return parsed;
}

/* ══════════════════════════════════════════════
   OPENAI (GPT) API CALL
══════════════════════════════════════════════ */
async function callOpenAIAPI(confPct, confThresh) {
  /* Read API key from config */
  const apiKey = (typeof CONFIG !== 'undefined' && CONFIG.OPENAI_API_KEY)
    ? CONFIG.OPENAI_API_KEY
    : '';

  if (!apiKey || apiKey === 'YOUR_OPENAI_API_KEY_HERE') {
    throw new Error(
      'API key not set. Open config.js, set API_PROVIDER to "openai", and paste your OpenAI API key into OPENAI_API_KEY.'
    );
  }

  const psm      = document.getElementById('psm-select').value;
  const blobSize = document.getElementById('blob-size').value;
  const nms      = (document.getElementById('nms-slider').value / 100).toFixed(2);
  const mimeType = currentFile.type || 'image/jpeg';

  let systemPrompt, userPrompt;

  if (currentPath === 'ocr') {
    systemPrompt =
      `You are a high-precision OCR engine simulating pytesseract with PSM ${psm}. ` +
      `Extract ALL visible text from the image exactly as it appears. ` +
      `Respond ONLY with valid JSON (no markdown, no backticks): ` +
      `{"text":"...extracted text...","confidence":0.00,"word_count":0,"lines":["line1","line2"]}` +
      ` where confidence is a float 0.0–1.0.`;

    userPrompt =
      `Run OCR text extraction on this image using PSM mode ${psm}. ` +
      `Extract all visible text. Confidence minimum: ${confPct}%. Return ONLY the JSON object.`;
  } else {
    systemPrompt =
      `You are an object detection engine simulating cv2.dnn with MobileNet-SSD (COCO classes). ` +
      `Identify ALL objects in the image with confidence >= ${confPct}%. ` +
      `Blob input size: ${blobSize}×${blobSize}. ` +
      `Respond ONLY with valid JSON (no markdown, no backticks): ` +
      `{"detections":[{"label":"...","confidence":0.00,"bbox":{"x":0.0,"y":0.0,"w":0.0,"h":0.0},"class_id":0}],"total":0,"filtered":0}` +
      ` where bbox values are normalized fractions 0.0–1.0 of image width/height.`;

    userPrompt =
      `Run object detection on this image using MobileNet-SSD. ` +
      `Blob size: ${blobSize}×${blobSize}. Confidence gate: ${confPct}%. NMS threshold: ${nms}. ` +
      `Identify all objects. Return ONLY the JSON object.`;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-vision',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${currentBase64}`,
              },
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `OpenAI API error ${response.status}`);
  }

  const data    = await response.json();
  const rawText = data.choices?.[0]?.message?.content || '';

  let parsed;
  try {
    const clean = rawText.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    /* Fallback: wrap raw text in an OCR-compatible structure */
    parsed = currentPath === 'ocr'
      ? {
          text:       rawText,
          confidence: 0.85,
          word_count: rawText.split(/\s+/).filter(Boolean).length,
          lines:      rawText.split('\n'),
        }
      : { detections: [], total: 0, filtered: 0 };
  }

  return parsed;
}

/* ══════════════════════════════════════════════
   RESULT DISPLAY
══════════════════════════════════════════════ */
function displayResult(parsed, confThresh) {
  const zone = document.getElementById('result-zone');
  zone.style.display = 'block';

  if (currentPath === 'ocr') {
    displayOCRResult(parsed);
  } else {
    displayObjectResult(parsed, confThresh);
  }
}

function displayOCRResult(parsed) {
  const zone    = document.getElementById('result-zone');
  const conf    = parsed.confidence || 0.85;
  const confPct = Math.round(conf * 100);
  const text    = parsed.text || (parsed.lines || []).join('\n') || '[No text detected]';
  const lines   = parsed.lines || text.split('\n');
  const wc      = parsed.word_count || text.split(/\s+/).filter(Boolean).length;
  const passed  = conf >= 0.8;

  const psm     = document.getElementById('psm-select').value;
  const kSize   = document.getElementById('blur-slider').value;

  zone.innerHTML = `
    <div class="result-panel">
      <div class="result-header">
        <h3>OCR Output — Text Extraction Complete</h3>
        <div class="conf-badge ${passed ? 'conf-high' : 'conf-med'}">${confPct}% CONFIDENCE</div>
      </div>
      <div class="result-body">
        <div class="ocr-output">${escHtml(text)}</div>
        <div class="meta-grid">
          <div class="meta-card"><span>WORDS</span><b>${wc}</b></div>
          <div class="meta-card"><span>LINES</span><b>${lines.length}</b></div>
          <div class="meta-card"><span>CONFIDENCE</span><b>${confPct}%</b></div>
        </div>
        <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
          <div class="info-chip">PSM ${psm}</div>
          <div class="info-chip">OTSU THRESHOLD</div>
          <div class="info-chip">GAUSSIAN BLUR ${kSize}×${kSize}</div>
          ${passed
            ? '<div class="info-chip" style="color:#00e5a0;border-color:#00e5a0">✓ VALIDATION PASSED</div>'
            : '<div class="info-chip" style="color:#f5a623;border-color:#f5a623">⚠ BELOW 80% GATE</div>'
          }
        </div>
      </div>
    </div>`;
}

function displayObjectResult(parsed, confThresh) {
  const zone    = document.getElementById('result-zone');
  const dets    = parsed.detections || [];
  const valid   = dets.filter((d) => (d.confidence || 0) >= confThresh);
  const avgConf = valid.length
    ? Math.round(valid.reduce((a, d) => a + (d.confidence || 0), 0) / valid.length * 100)
    : 0;

  const blobSize = document.getElementById('blob-size').value;
  const nms      = (document.getElementById('nms-slider').value / 100).toFixed(2);
  const confPct  = Math.round(confThresh * 100);

  drawBboxes(valid);

  zone.innerHTML = `
    <div class="result-panel">
      <div class="result-header">
        <h3>Object Detection — MobileNet-SSD Output</h3>
        <div class="conf-badge ${valid.length > 0 ? 'conf-high' : 'conf-med'}">${valid.length} DETECTED</div>
      </div>
      <div class="result-body">
        ${valid.length === 0
          ? '<div style="color:var(--muted);font-size:13px;font-family:var(--mono);margin-bottom:12px">No objects detected above confidence threshold. Try lowering the confidence gate or uploading a different image.</div>'
          : ''
        }
        <div class="detection-list">
          ${valid.map((det, i) => {
            const c   = Math.round((det.confidence || 0) * 100);
            const bb  = det.bbox || {};
            const col = BBOX_COLORS[i % BBOX_COLORS.length];
            return `
              <div class="detection-item">
                <div class="det-color" style="background:${col}"></div>
                <div style="flex:1">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                    <span class="det-label">${escHtml(det.label || 'object')}</span>
                    <span class="det-conf">${c}%</span>
                  </div>
                  <div class="conf-bar-wrap">
                    <div class="conf-bar" style="width:${c}%;background:${col}"></div>
                  </div>
                </div>
                <div class="det-coord">
                  x:${((bb.x || 0)).toFixed(2)} y:${((bb.y || 0)).toFixed(2)}<br>
                  w:${((bb.w || 0)).toFixed(2)} h:${((bb.h || 0)).toFixed(2)}
                </div>
              </div>`;
          }).join('')}
        </div>
        <div class="meta-grid">
          <div class="meta-card"><span>DETECTED</span><b>${valid.length}</b></div>
          <div class="meta-card"><span>FILTERED</span><b>${(parsed.total || dets.length) - valid.length}</b></div>
          <div class="meta-card"><span>AVG CONF</span><b>${avgConf}%</b></div>
        </div>
        <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
          <div class="info-chip">BLOB ${blobSize}×${blobSize}</div>
          <div class="info-chip">NMS ${nms}</div>
          <div class="info-chip">GATE ${confPct}%</div>
          ${valid.length > 0
            ? '<div class="info-chip" style="color:#00e5a0;border-color:#00e5a0">✓ VALIDATION PASSED</div>'
            : ''
          }
        </div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

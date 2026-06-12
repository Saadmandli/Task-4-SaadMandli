# Project 4 — AI Recognition Pipeline

<div align="center">

### Building the Machine's **Optic Nerve**

*A fully-functioning AI recognition pipeline with two execution paths: OCR (text extraction) and Object Detection (object localization). Supports multiple AI providers — Claude, Gemini, GPT — with 100% browser-native image preprocessing.*

![Status](https://img.shields.io/badge/status-production%20ready-brightgreen)
![Providers](https://img.shields.io/badge/providers-Claude%20|%20Gemini%20|%20GPT-blue)
![License](https://img.shields.io/badge/license-MIT-blue)
![Frontend](https://img.shields.io/badge/frontend-Vanilla%20JS-yellow)
![Processing](https://img.shields.io/badge/processing-Canvas%20API-orange)

</div>

---

## 📸 Screenshots

### Landing — Choose Your Path
![Landing screen showing path selection between OCR and Object Detection](proj_4.png)
> Choose between **Path 1: OCR — Text Recognition** and **Path 2: Object Detection**, then upload any image to begin.

---

### Path 1 — OCR Text Recognition in Action
![OCR path showing a portrait photo being processed with grayscale, blur, and threshold pipeline stages](proje4.png)
> Upload any image and watch it flow through **Grayscale → Gaussian Blur → Otsu Threshold → AI OCR**. Live canvas previews update in real time as you adjust the PSM mode, confidence threshold, and blur kernel.

---

### Path 2 — Object Detection in Action
![Object detection path showing a map image with preprocessing stages and MobileNet-SSD bounding box parameters](Project_4-1.png)
> Switch to Object Detection mode to identify and localize objects. Tune confidence gate, blob size (224×224 or 300×300), and NMS threshold before firing the pipeline.

---

## 🎯 What It Does

| Feature | Details |
|---|---|
| **🔤 OCR Path** | Extracts text from images using your chosen AI provider |
| **📦 Detection Path** | Identifies and localizes objects with bounding boxes |
| **⚡ Browser Preprocessing** | Grayscale, Gaussian Blur, and Otsu Thresholding — all in-browser via Canvas API |
| **🎛️ Interactive Controls** | Adjust PSM mode, confidence, blur kernel, NMS threshold in real time |
| **📊 Visual Pipeline** | Live 4-stage canvas previews (Original → Grayscale → Blur → Threshold) |
| **🔄 Multi-Provider** | Switch between Claude, Gemini, or GPT without touching core logic |

---

## 🚀 Quick Start

### Prerequisites
- **Python 3** or **Node.js** (for a local HTTP server)
- An API key from **at least one** provider:
  - [Anthropic Claude](https://console.anthropic.com/) — recommended
  - [Google Gemini](https://aistudio.google.com/app/apikey)
  - [OpenAI GPT](https://platform.openai.com/api-keys)

### 1. Clone the Repository

```bash
git clone https://github.com/saadmandli/project4.git
cd project4
```

### 2. Configure Your API Key

```bash
cp config.example.js config.js
```

Edit `config.js` and pick your provider:

```javascript
const CONFIG = {
  API_PROVIDER: 'anthropic',          // 'anthropic' | 'gemini' | 'openai'

  ANTHROPIC_API_KEY:       'sk-ant-your-key-here',
  GOOGLE_GEMINI_API_KEY:   'AIzaSy_your-key-here',
  OPENAI_API_KEY:          'sk-proj-your-key-here',
};
```

### 3. Start a Local Server

**Python (recommended)**
```bash
python -m http.server 5500
# Open http://localhost:5500
```

**Node.js**
```bash
npx serve .
```

**VS Code**  
Install the *Live Server* extension → right-click `index.html` → **Open with Live Server**

### 4. Run the Pipeline

1. **Choose a path** — OCR or Object Detection
2. **Upload an image** — drag-and-drop or click the upload zone
3. **Tune parameters** — adjust sliders and dropdowns
4. **Execute** — click **▶ EXECUTE_PIPELINE**
5. **Inspect results** — view preprocessing stages + AI inference output

---

## 🏗️ Project Structure

```
project4/
├── index.html           ← App shell and UI structure
├── style.css            ← Dark theme, responsive layout
├── app.js               ← Pipeline logic and preprocessing algorithms
├── config.js            ← ⚠️ Your API key (git-ignored)
├── config.example.js    ← Safe template to commit
├── .gitignore
└── README.md
```

---

## 🔄 How the Pipeline Works

```
┌────────────────────────────────────────────────────────┐
│             FRONTEND  (HTML / CSS / JS)                │
│   Interactive UI · drag-and-drop · parameter controls  │
└────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────┐
│       IMAGE PREPROCESSING  (Canvas API — browser)      │
│  Step 1 › Grayscale     ITU-R BT.601 luminosity        │
│  Step 2 › Gaussian Blur configurable N×N kernel        │
│  Step 3 › Otsu Threshold adaptive binarization         │
└────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────┐
│            AI INFERENCE  (Vision API)                  │
│  Path 1 › OCR            → extracted text strings      │
│  Path 2 › Object Detect  → bounding box coordinates    │
└────────────────────────────────────────────────────────┘
```

### Path 1 — OCR (Text Recognition)

| Stage | Detail |
|---|---|
| Input | Raw image |
| Step 1 | Grayscale conversion |
| Step 2 | Gaussian blur (configurable kernel) |
| Step 3 | Otsu thresholding |
| Step 4 | Vision API text extraction |
| Output | Extracted text + confidence scores |

**Parameters**

| Parameter | Options |
|---|---|
| PSM Mode | 3 (Auto), 6 (Uniform block), 7 (Single line), 11 (Sparse text) |
| Confidence min | 0 – 100% |
| Blur kernel | 1 – 9 (odd values) |

### Path 2 — Object Detection

| Stage | Detail |
|---|---|
| Input | Raw image |
| Steps 1–3 | Same grayscale → blur → threshold preprocessing |
| Step 4 | Vision API object detection (MobileNet-SSD) |
| Output | Bounding box coordinates (X, Y, Width, Height) |

**Parameters**

| Parameter | Options |
|---|---|
| Confidence gate | 0 – 100% |
| Blob size | 224×224 or 300×300 (MobileNet-SSD) |
| NMS threshold | 0.00 – 1.00 |

---

## 🔑 Getting Your API Key

### Option 1 — Anthropic Claude ⭐ Recommended

1. Visit [console.anthropic.com](https://console.anthropic.com/)
2. Navigate to **API Keys** → **Create Key**
3. Copy the key (starts with `sk-ant-`)
4. Set `API_PROVIDER: 'anthropic'` in `config.js`

### Option 2 — Google Gemini

1. Visit [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click **Create API key**
3. Copy the key (starts with `AIzaSy`)
4. Set `API_PROVIDER: 'gemini'` in `config.js`

### Option 3 — OpenAI GPT

1. Visit [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click **Create new secret key**
3. Copy the key (starts with `sk-proj-`)
4. Set `API_PROVIDER: 'openai'` in `config.js`

> 💡 All providers offer free trial credits. You can switch providers at any time by editing only `config.js` — no code changes needed.

---

## 📊 Feature Matrix

### Image Processing (100% Browser-Based)

| Feature | Algorithm | Status |
|---|---|---|
| Grayscale | ITU-R BT.601 luminosity | ✅ |
| Gaussian Blur | Configurable N×N kernel | ✅ |
| Otsu Threshold | Adaptive binarization | ✅ |
| Pipeline Visualization | 4-stage live canvas preview | ✅ |

### AI Integration

| Feature | Status | Notes |
|---|---|---|
| OCR | ✅ Functional | Claude · Gemini · GPT |
| Object Detection | ✅ Functional | Claude · Gemini · GPT |
| Provider Switching | ✅ Dynamic | Config-only change |
| Error Handling | ✅ Graceful | User-friendly messages |

### UX

| Feature | Status |
|---|---|
| Dark Theme | ✅ |
| Responsive / Mobile-friendly | ✅ |
| Drag-and-Drop Upload | ✅ |
| Real-time Parameter Controls | ✅ |

---

## 🔧 Key Functions (app.js)

```javascript
callVisionAPI(confPct, confThresh)      // Routes to the selected provider
callAnthropicAPI(confPct, confThresh)   // Anthropic Claude integration
callGeminiAPI(confPct, confThresh)      // Google Gemini integration
callOpenAIAPI(confPct, confThresh)      // OpenAI GPT integration
switchPath(path)                        // Toggle OCR ↔ Object Detection
handleFile(file)                        // Validate and load uploaded image
renderPreprocessing()                   // Run Steps 1–3 and update canvases
gaussianBlur(arr, W, H, k)             // Gaussian blur implementation
otsuThreshold(arr)                      // Otsu's thresholding method
```

---

## 📈 Performance

| Metric | Typical Value |
|---|---|
| Page load | ~200 ms |
| Image upload | ~50 ms |
| Preprocessing (Steps 1–3) | ~100–200 ms |
| Canvas render | < 50 ms |

---

## 🛡️ Security

- `config.js` is in `.gitignore` — your API key is never committed
- `config.example.js` is the only config file tracked by git
- No server-side component; all processing runs in the browser

**Before pushing to GitHub:**
- [ ] Confirm `config.js` is listed in `.gitignore`
- [ ] Verify `git status` does not show `config.js`
- [ ] Use `config.example.js` as the documented template

---

## 🚨 Troubleshooting

**"Failed to fetch" error**  
API requests are blocked by CORS when running from `file://`. Always use a local HTTP server (`python -m http.server 5500`).

**Image won't upload**  
Only JPG, PNG, WebP, and GIF are supported. Check the file size.

**Parameters not updating**  
Hard-refresh the page: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (macOS).

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

**Guidelines:** keep API keys out of commits · test preprocessing independently · document new parameters · update this README.

---

## 📝 License

MIT — see the `LICENSE` file for details.

---

## 🙏 Acknowledgments

- **Anthropic** — Vision API for AI inference
- **Canvas API** — Browser-native image processing
- **DecodeLabs** — Project framework and training kit

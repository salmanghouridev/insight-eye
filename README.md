# InsightEye: Web-Based Eye Health Screening System

InsightEye is an advanced, low-cost eye health screening web application designed for clinics, schools, and underserved regions. It integrates a **digital Snellen-style visual acuity test** with **real-time webcam biometrics** and an **NLP clinical report synthesis engine** to evaluate and document vision acuity and eye-motor behaviors.

---

## 🚀 Key Features

1. **Digital Snellen Test**:
   - Calibrated Snellen optotypes scaled to subtend exactly 5 arcminutes at a test distance of $1.5\text{m}$.
   - Tests each eye separately (Right $\rightarrow$ Left) and both eyes together.
   - Computes standard visual acuity scores (`6/6`, `6/9`, `6/12`, `6/18`, `6/24`, `6/60`).

2. **Webcam Biometrics Tracking**:
   - **Postural Distance Guide**: Estimating physical eye-to-screen distance ($D_{\text{cm}} = \frac{4095}{\text{irisDistancePx}}$) via pupil centers and interpupillary distance ($IPD$). Displays a real-time warning and locks test input if the user drifts outside the safe $150\text{cm} \pm 15\text{cm}$ testing window.
   - **Eyelid Aperture (EAR)**: Computes Eye Aspect Ratio for real-time blink frequency and blink duration.
   - **Gaze Stability & Fixations**: Monitors stable fixation windows vs rapid saccadic shifts.

3. **SVG Optotype Distortion Lab (Experimental Acuity Testing)**:
   - A vector-geometry Sloan optotype generator (`C, D, H, K, N, O, R, S, V, Z`) rendered inside a normalized 5x5 grid.
   - Controlled legibility distortion pipeline including:
     - **Low Contrast**: Adjusts black-to-white text contrast for sensitivity checks.
     - **Crowding**: Compresses character gap spacing to test lateral masking effects.
     - **Stroke Erosion**: Shaves stroke width thickness.
     - **Micro-warp**: Gently bends vertical and curved segments using low-frequency fractal noise.
     - **Edge Jitter**: Adds irregular border wobbly roughness.
     - **Segment Dropout**: Subtracts random segments using opacity masks (maintains transparent backgrounds).
     - **Gaussian Blur**: Simulates mild optical blur.
     - **Visual Noise**: Overlays faint background grain matrices.
     - **Temporal Flashing**: Strobes character opacity at a custom frequency (Hz).

4. **NLP Clinical Synthesizer**:
   - Uses **LangChain** and a local **Ollama** model (`llama3`) to compile acuity scores, squints, blink fatigue, and fixations into structured JSON clinical reports.
   - **Heuristics Fallback**: Instantly falls back to a deterministic rule-based generator if Ollama is offline (checked via a fast $0.8$s TCP port handshake), preventing hangs.

---

## 🛠️ Technology Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + MediaPipe Tasks Vision WebAssembly.
- **Backend**: FastAPI + SQLite (`sqlite+aiosqlite` async driver) + SQLAlchemy async models.
- **NLP Engine**: LangChain + Ollama (`llama3`).
- **Transport**: WebSockets (real-time coordinate/telemetry streaming) & REST APIs (lifecycle and reports).

---

## 📂 Project Structure

```text
insighteye/
├── README.md                    # Core project documentation
├── requirements.txt             # Root requirements
├── main.py                      # Original CLI tracking entrypoint
├── backend/                     # FastAPI backend application
│   ├── app/
│   │   ├── core/
│   │   │   └── config.py        # Host resolution & DB connection settings
│   │   ├── db/
│   │   │   ├── session.py       # Async SQLite engine with thread lock bypasses
│   │   │   └── models.py        # SQLAlchemy schema (sessions, test_results, frame_metrics, reports)
│   │   ├── routers/
│   │   │   ├── session.py       # REST API endpoints (start, stop, test-results, reports)
│   │   │   └── websocket.py     # Gaze metrics WebSocket streaming channel
│   │   └── services/
│   │       ├── report_engine.py # Ollama clinical compiler with connection health checks
│   │       └── session_service.py # Persistence manager and statistics aggregator
│   └── requirements.txt         # Backend dependencies list
└── frontend/                    # Next.js frontend client application
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx         # Welcome portal & session start dashboard
    │   │   ├── tracker/
    │   │   │   └── page.tsx     # Binds camera guides with the Snellen workspace
    │   │   ├── optotypes/
    │   │   │   └── page.tsx     # Interactive distortion lab playground
    │   │   └── reports/[id]/
    │   │       └── page.tsx     # Acuity metrics dashboard & AI diagnostics
    │   ├── components/
    │   │   ├── SnellenTest.tsx  # Dynamic Snellen calibration & keyboard input
    │   │   ├── GazeTracker.tsx  # MediaPipe pupil tracking & safe-distance guide
    │   │   └── MetricsDashboard.tsx # Real-time metric cards (blinks, gaze stability, saccades)
    │   └── utils/
    │       └── optotypeGenerator.ts # Sloan letter vector logic & distortion pipeline
```

---

## ⚙️ Setup and Installation

### 1. Prerequisite: Ollama Setup (Optional but recommended for AI reports)
1. Install [Ollama](https://ollama.com).
2. Start Ollama and pull the default model:
   ```bash
   ollama pull llama3
   ```
*(If Ollama is not running, the backend will auto-detect this and immediately fall back to a rule-based diagnostic compiler with zero latency).*

### 2. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the FastAPI application:
   ```bash
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
   *The database schema will automatically initialize a local SQLite file named `insighteye.db`.*

### 3. Frontend Setup
1. Open a new terminal window and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to **`http://localhost:3000`**.

---

## 📖 How to Perform a Test

1. **Launch Session**: From the homepage, enter a client device name and click **Launch Camera Pipeline**.
2. **Calibrate Screen**:
   - Align a physical card on your screen.
   - Adjust the card slider until the on-screen card image matches your physical card width. This calibrates the pixels-per-millimeter ($PPM$) ratio.
3. **Align Posture**:
   - Stand back at a distance of **`150cm`**.
   - Ensure the live webcam guide box outlines your face in **green** (stating `CALIB DISTANCE: 150cm (Safe)`). If you drift too close or too far, the workspace turns red and inputs will lock.
4. **Acidity Testing**:
   - Test sequence: **Right Eye** $\rightarrow$ **Left Eye** $\rightarrow$ **Both Eyes**.
   - Input the letters presented on the screen using your keyboard. Click **Correct** or **Incorrect** based on feedback.
   - Upon finishing, the page will redirect to compile your diagnostics.
5. **View Report**: Check your visual acuity scores, behavioral risks (squint strain, blink rates, saccades), and read the clinical diagnostic assessment.

To experiment with custom letters, blur, erosion, noise, warp, and temporal flashing speeds, navigate to the **Optotype Distortion Lab** at the bottom of the home screen.

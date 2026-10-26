# AI Interview Assistant — System Architecture & Execution Flow

---

## 🛠️ Tool & Technology Matrix (What Is Used For What)

| Tool / Technology | Role in Project | Where It Is Implemented | Exact Function / Why It Is Used |
| :--- | :--- | :--- | :--- |
| **Flask** (`flask`) | Web Server & API Gateway | [`backend/app.py`](file:///c:/Users/dilli/Downloads/c9a74c46-6f0a-4ddf-84f8-26774837d6f4_e98388ab-847d-4145-b241-956c31d43ba9_702983f3-b4f5-4201-b17f-ec4ac0ac923d_cc957613-f981-42b9-a0ea-b67661b156b5_FINAL_CODE_INTERVIEW_ASSISTANT_PART%202%20(1)%20(1)/backend/app.py) | Exposes HTTP endpoints (`/start-interview`, `/submit-answer`, `/get-feedback`, `/health`) and serves frontend static assets (`index.html`, `index.js`). |
| **Gunicorn** (`gunicorn`) | Production WSGI Server | [`Procfile`](file:///c:/Users/dilli/Downloads/c9a74c46-6f0a-4ddf-84f8-26774837d6f4_e98388ab-847d-4145-b241-956c31d43ba9_702983f3-b4f5-4201-b17f-ec4ac0ac923d_cc957613-f981-42b9-a0ea-b67661b156b5_FINAL_CODE_INTERVIEW_ASSISTANT_PART%202%20(1)%20(1)/Procfile), [`Dockerfile`](file:///c:/Users/dilli/Downloads/c9a74c46-6f0a-4ddf-84f8-26774837d6f4_e98388ab-847d-4145-b241-956c31d43ba9_702983f3-b4f5-4201-b17f-ec4ac0ac923d_cc957613-f981-42b9-a0ea-b67661b156b5_FINAL_CODE_INTERVIEW_ASSISTANT_PART%202%20(1)%20(1)/Dockerfile) | Runs multi-threaded production HTTP workers (`--workers 1 --threads 4 --timeout 120`) for streaming responses on cloud platforms like Render/Railway. |
| **LangGraph / LangChain** | Agent State & Dialogue Memory | `create_agent()`, `InMemorySaver()` | Manages stateful multi-turn interview conversations. Maintains session thread history so the interviewer remembers candidate answers. |
| **NVIDIA NIM** (`ChatOpenAI`) | Primary LLM (Reasoning) | `model = ChatOpenAI(base_url="https://integrate.api.nvidia.com/v1", model="nvidia/nemotron-3-nano-omni-30b-a3b-reasoning")` | Generates short, conversational interview questions based on the candidate's actual previous response, and outputs the final feedback JSON. |
| **Google Gemini** (`google-genai`) | Fallback LLM | `init_chat_model("google_genai:gemini-3.5-flash-lite")` | Automatically invoked inside `invoke_agent_with_retry()` if NVIDIA NIM experiences timeouts or rate-limiting. |
| **AssemblyAI** (`assemblyai`) | Speech-to-Text (STT) | `speech_to_text()` via `aai.Transcriber()` | Transcribes candidate audio recordings (`.webm` or `.wav`) to clean text using `universal-3-pro` and `universal-2` models. |
| **Murf AI** (Falcon API) | Text-to-Speech (TTS) | `stream_audio()` via `https://global.api.murf.ai/v1/speech/stream` | Converts text questions into human-like speech (`en-US-natalie` voice) and streams base64-encoded raw MP3 audio chunks directly to client. |
| **Browser MediaRecorder API** | Client Audio Capture | [`frontend/index.js`](file:///c:/Users/dilli/Downloads/c9a74c46-6f0a-4ddf-84f8-26774837d6f4_e98388ab-847d-4145-b241-956c31d43ba9_702983f3-b4f5-4201-b17f-ec4ac0ac923d_cc957613-f981-42b9-a0ea-b67661b156b5_FINAL_CODE_INTERVIEW_ASSISTANT_PART%202%20(1)%20(1)/frontend/index.js) (`navigator.mediaDevices.getUserMedia`) | Captures candidate microphone stream in chunks and packages it into a `Blob` (`audio/webm`) for transmission. |
| **Web Audio Context** | Client Streaming Audio Player | [`frontend/index.js`](file:///c:/Users/dilli/Downloads/c9a74c46-6f0a-4ddf-84f8-26774837d6f4_e98388ab-847d-4145-b241-956c31d43ba9_702983f3-b4f5-4201-b17f-ec4ac0ac923d_cc957613-f981-42b9-a0ea-b67661b156b5_FINAL_CODE_INTERVIEW_ASSISTANT_PART%202%20(1)%20(1)/frontend/index.js) (`AudioContext`) | Decodes incoming streamed audio chunks in real-time and plays them seamlessly through candidate speakers/headphones. |
| **Tailwind CSS + FontAwesome** | UI Presentation & Layout | [`frontend/index.html`](file:///c:/Users/dilli/Downloads/c9a74c46-6f0a-4ddf-84f8-26774837d6f4_e98388ab-847d-4145-b241-956c31d43ba9_702983f3-b4f5-4201-b17f-ec4ac0ac923d_cc957613-f981-42b9-a0ea-b67661b156b5_FINAL_CODE_INTERVIEW_ASSISTANT_PART%202%20(1)%20(1)/frontend/index.html) | Renders the responsive dark-themed dashboard, microphone pulse animations, speaker bubbles, and the post-interview score card. |

---

## 🔄 End-to-End Execution Flow (How It Works)

```
[Candidate Browser]                           [Flask Backend]                         [AI Cloud Services]
        |                                            |                                         |
   1. Select Subject (e.g., Python)                  |                                         |
      Click "Start Interview"                        |                                         |
        |---- POST /start-interview ---------------->|                                         |
        |     {subject, session_id}                  |                                         |
        |                                            |---- Invoke Agent (System Prompt) ------>| NVIDIA Nemotron (or Gemini)
        |                                            |<--- Returns Question 1 Text -----------|
        |                                            |---- POST Text to Murf Stream API ------>| Murf AI Falcon
        |                                            |<--- MP3 Chunks Streamed --------------|
        |<--- Stream base64 audio + Question Text ---|                                         |
        |     (Headers: X-Question-Number: 1)        |                                         |
        |                                            |                                         |
   2. Audio plays aloud; Candidate reads question    |                                         |
        |                                            |                                         |
   3. Candidate clicks "Record Answer"               |                                         |
      Candidate speaks into microphone               |                                         |
      Candidate clicks "Stop & Submit"               |                                         |
        |                                            |                                         |
        |---- POST /submit-answer (Multipart Form) ->|                                         |
        |     audio: webm blob, session_id           |                                         |
        |                                            |---- Send temp .webm file -------------->| AssemblyAI (STT)
        |                                            |<--- Returns candidate transcript ------|
        |                                            |                                         |
        |                                            |---- Save transcript in Memory Saver     |
        |                                            |---- Generate Adaptive Next Question --->| NVIDIA Nemotron
        |                                            |<--- Question 2 Text (Context-Aware) ---|
        |                                            |---- POST Text to Murf Stream API ------>| Murf AI
        |                                            |<--- MP3 Chunks Streamed --------------|
        |<--- Stream base64 audio + Question 2 text -|                                         |
        |                                            |                                         |
   4. [STEPS 2 & 3 REPEAT FOR QUESTIONS 2, 3, 4, 5]  |                                         |
        |                                            |                                         |
   5. Candidate submits Question 5 (Final Answer)    |                                         |
        |---- POST /submit-answer ------------------>|                                         |
        |                                            |---- Question count >= 5 reached         |
        |                                            |---- Conclude interview warmly --------->| NVIDIA Nemotron
        |                                            |---- Stream conclusion voice ----------->| Murf AI
        |<--- Conclusion audio + header: ------------|                                         |
        |     X-Interview-Complete: true             |                                         |
        |                                            |                                         |
   6. Frontend shows "Get Feedback" button           |                                         |
      Candidate clicks "Get Detailed Feedback"       |                                         |
        |---- POST /get-feedback ------------------->|                                         |
        |     {session_id}                           |---- Prompt agent with full history ---->| NVIDIA Nemotron
        |                                            |<--- Valid JSON Scorecard --------------|
        |                                            |     {score: 1-5, feedback, improve}     |
        |<--- JSON Response: scorecard & notes ------|                                         |
        |                                            |                                         |
   7. UI renders score (1-5), strengths, gaps        |                                         |
```

---

## 🧩 Step-by-Step Breakdown

### Step 1: Session Initialization (`/start-interview`)
1. User selects a topic (e.g., Python, Generative AI, HTML, etc.) on the frontend and clicks **Start Interview**.
2. Frontend generates a unique `sessionId` (`session_<random>_<timestamp>`).
3. Sends `POST /start-interview` with `{ subject: "Python", session_id: "..." }`.
4. Backend executes `get_session()`:
   - Instantiates a fresh `InMemorySaver` checkpointer.
   - Instantiates a fresh `create_agent(model=model, tools=[], checkpointer=cp)`.
   - Initializes `question_count = 1`.
5. Backend constructs the initial prompt injecting the selected `subject` into `INTERVIEW_PROMPT`.
6. LLM generates a crisp, conversational opening question (1–2 sentences).
7. The question text is cleaned via `clean_text_for_speech()` and sent to Murf AI's streaming endpoint.
8. Murf AI generates audio chunks, which the Flask backend streams back to the browser via HTTP Chunked Transfer Encoding. The original question text is returned in the custom header `X-Question-Text`.
9. The browser's Web Audio API plays the audio through speakers and displays the question card on screen.

### Step 2: Candidate Voice Recording (`MediaRecorder API`)
1. Candidate clicks the **Microphone** button.
2. The browser requests mic permissions via `navigator.mediaDevices.getUserMedia({ audio: true })`.
3. `MediaRecorder` buffers recorded audio chunks in memory (`recordingChunks.push(e.data)`).
4. Candidate clicks **Stop Recording**; a `.webm` audio blob is generated.
5. Candidate clicks **Submit Answer**.

### Step 3: Transcription (`AssemblyAI`)
1. Frontend submits `POST /submit-answer` as a `multipart/form-data` payload containing:
   - `audio`: The recorded binary audio file.
   - `session_id`: The candidate's active session key.
2. Backend writes the uploaded file to a temporary file (`tempfile.NamedTemporaryFile`).
3. Passes the file path to AssemblyAI:
   ```python
   transcriber = aai.Transcriber()
   config = aai.TranscriptionConfig(
       speech_models=["universal-3-pro", "universal-2"],
       language_detection=True
   )
   transcript = transcriber.transcribe(temp_path, config=config)
   ```
4. The temporary file is immediately deleted to prevent disk leaks.
5. If the transcription fails or is empty, backend falls back safely to `"I answered the question."` to keep the interview flow unbroken.

### Step 4: Adaptive Next Question Loop (`LangGraph`)
1. The candidate's transcribed answer is appended to the LangGraph thread state:
   ```python
   invoke_agent_with_retry(sess["agent"], {"messages": [{"role": "user", "content": answer}]}, config=config)
   ```
2. If `question_count < 5`:
   - Increments `question_count += 1`.
   - Prompts the LLM to read what the candidate **actually said**, acknowledge it in 1 sentence, and ask a relevant follow-up question.
   - The question is converted to speech via Murf AI and streamed back to the user.
3. Steps 2, 3, and 4 repeat until Question 5 is completed.

### Step 5: Interview Conclusion
1. When `question_count >= 5`, the backend instructs the LLM to warmly conclude the interview in 1–2 sentences.
2. The response is streamed with header:
   ```http
   X-Interview-Complete: true
   ```
3. The frontend reads this header, hides the microphone controls, and displays the **Get Feedback** button.

### Step 6: Evaluation & Scorecard (`/get-feedback`)
1. Candidate clicks **Get Feedback**.
2. Frontend sends `POST /get-feedback` with `{ session_id }`.
3. Backend prompts the LLM to review the **complete conversation history** from the `InMemorySaver` checkpointer:
   ```json
   {
       "subject": "Python",
       "candidate_score": 4,
       "feedback": "<Specific strengths referencing actual answers>",
       "areas_of_improvement": "<Actionable suggestions based on identified gaps>"
   }
   ```
4. Backend parses and sanitizes the JSON response (handles markdown blocks, raw strings, or LLM anomalies).
5. Frontend displays:
   - Overall Score (1 to 5) with animated circular progress indicator.
   - Detailed feedback on strengths.
   - Specific areas for improvement.
   - Option to start a new interview.

---

## ⚡ Fallback & Reliability Architecture

```
User Prompt
     │
     ▼
[NVIDIA NIM (Nemotron 30B)] ──(Success)──► Return Question
     │
     │ (Fails / Rate-limited / 2 Retries)
     ▼
[Google Gemini 3.5 Flash]   ──(Success)──► Return Question
     │
     │ (Fails / Network Error)
     ▼
[Static Fallback Response]  ─────────────► "Could you share more about your background?"
```

- **Zero-Crash Design**: The interview will never crash in the middle of a candidate's session if an API endpoint hits temporary limits.
- **Auto-Failover**: Automatically shifts traffic from NVIDIA to Google Gemini.

---

## 📋 Data Schemas & API Endpoints

### 1. `POST /start-interview`
- **Request Body (JSON)**:
  ```json
  {
    "subject": "Python",
    "session_id": "session_abc123_1710000000"
  }
  ```
- **Response**: Chunked stream of base64-encoded MP3 audio strings (`text/plain`).
- **Response Headers**:
  - `X-Question-Number`: `"1"`
  - `X-Question-Text`: URL-encoded question string
  - `X-Interview-Complete`: `"false"`

---

### 2. `POST /submit-answer`
- **Request Type**: `multipart/form-data`
- **Form Fields**:
  - `audio`: `.webm` binary blob from browser `MediaRecorder`
  - `session_id`: Session identifier string
- **Response**: Chunked stream of base64-encoded MP3 audio strings (`text/plain`).
- **Response Headers**:
  - `X-Question-Number`: `"2"` through `"5"`
  - `X-Question-Text`: URL-encoded next question string
  - `X-Interview-Complete`: `"false"` (or `"true"` after Question 5)

---

### 3. `POST /get-feedback`
- **Request Body (JSON)**:
  ```json
  {
    "session_id": "session_abc123_1710000000"
  }
  ```
- **Response (JSON)**:
  ```json
  {
    "success": true,
    "feedback": {
      "subject": "Python",
      "candidate_score": 4,
      "feedback": "You clearly explained generator expressions and memory savings using yield.",
      "areas_of_improvement": "Review the difference between threading and multiprocessing with the GIL."
    }
  }
  ```

---

## 🚀 Quick Setup & Run

### 1. Setup Environment
```bash
# Clone and enter repo
git clone https://github.com/YOUR_USERNAME/ai-interview-assistant.git
cd ai-interview-assistant

# Create and activate virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\Activate.ps1
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Keys in `.env`
Create `backend/.env`:
```env
NVIDIA_API_KEY=nvapi-...
NVIDIA_MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning
GOOGLE_API_KEY=AIzaSy...
MURF_API_KEY=...
ASSEMBLYAI_API_KEY=...
PORT=5000
```

### 3. Run Server
```bash
python backend/app.py
```
Open **`http://localhost:5000`** in your browser.

from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langgraph.checkpoint.memory import InMemorySaver
from langchain.agents import create_agent
import assemblyai as aai
import os
import base64
import requests
import tempfile
import json
import re
import urllib.parse
import time

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv()

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
MURF_API_KEY = os.getenv("MURF_API_KEY")
ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")
aai.settings.api_key = ASSEMBLYAI_API_KEY

if NVIDIA_API_KEY:
    from langchain_openai import ChatOpenAI
    nvidia_model = os.getenv("NVIDIA_MODEL", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning").strip('"').strip("'")
    model = ChatOpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=NVIDIA_API_KEY,
        model=nvidia_model
    )
    print(f"Loaded NVIDIA NIM model: {nvidia_model}")
elif GOOGLE_API_KEY:
    model = init_chat_model(
        "google_genai:gemini-3.5-flash-lite",
        api_key=GOOGLE_API_KEY
    )
    print("Loaded Google Gemini model")
else:
    raise ValueError("Neither NVIDIA_API_KEY nor GOOGLE_API_KEY was found in environment variables.")

frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
app = Flask(__name__, static_folder=frontend_dir, static_url_path="")
CORS(app, expose_headers=['X-Question-Number', 'X-Interview-Complete', 'X-Question-Text', 'Content-Type'])

@app.after_request
def add_no_cache_headers(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# Multi-session state store for concurrent interview sessions
sessions = {}

def get_session(data_or_form):
    sid = "default_session"
    if isinstance(data_or_form, dict):
        sid = data_or_form.get("session_id") or "default_session"
    elif hasattr(data_or_form, "get"):
        sid = data_or_form.get("session_id") or "default_session"

    if sid not in sessions:
        cp = InMemorySaver()
        ag = create_agent(
            model=model,
            tools=[],
            checkpointer=cp
        )
        sessions[sid] = {
            "question_count": 0,
            "subject": "Python",
            "checkpointer": cp,
            "agent": ag,
            "thread_id": f"thread_{sid}"
        }
    return sid, sessions[sid]

INTERVIEW_PROMPT = """You are Natalie, a friendly and conversational interviewer conducting a natural {subject} interview.

IMPORTANT GUIDELINES:
1. Ask exactly 5 questions total throughout the interview
2. Keep questions SHORT and CRISP (1-2 sentences maximum)
3. ALWAYS reference what the candidate ACTUALLY said in their previous answer - do NOT make up or assume their answers
4. Show genuine interest with brief acknowledgments based on their REAL responses
5. Adapt questions based on their ACTUAL responses - go deeper if they're strong, adjust if uncertain
6. Be warm and conversational but CONCISE
7. No lengthy explanations - just ask clear, direct questions

CRITICAL: Read the conversation history carefully. Only acknowledge what the candidate truly said, not what you think they might have said.

Keep it short, conversational, and adaptive!"""

FEEDBACK_PROMPT = """Based on our complete interview conversation, provide detailed feedback.
IMPORTANT: You MUST respond with ONLY a valid JSON object. No other text before or after.
Address the candidate directly using "you" and "your" (e.g., "You explained..." not "The candidate explained...").
Respond with ONLY this JSON structure (no markdown, no code blocks, no extra text):
{{
    "subject": "{subject}",
    "candidate_score": <1-5>,
    "feedback": "<detailed strengths with specific examples from their ACTUAL answers>",
    "areas_of_improvement": "<constructive suggestions based on gaps you noticed>"
}}
Be specific - reference ACTUAL things they said during the interview."""

@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "ai-interview-assistant"})

@app.route("/")
def index():
    return send_from_directory(frontend_dir, "index.html")

@app.route("/<path:path>")
def serve_static(path):
    file_path = os.path.join(frontend_dir, path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return send_from_directory(frontend_dir, path)
    return send_from_directory(frontend_dir, "index.html")

def clean_text_for_speech(text):
    if not text:
        return ""
    # Strip parentheticals or meta-commentary like *(I'll listen...)*
    cleaned = re.sub(r"\*\(.*?\)\*", "", text, flags=re.DOTALL)
    cleaned = re.sub(r"\(Note:.*?\)", "", cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.replace("*", "").replace("#", "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned

def stream_audio(text):
    BASE_URL = "https://global.api.murf.ai/v1/speech/stream"
    payload = {
        "text": text,
        "voiceId": "en-US-natalie",
        "model": "FALCON",
        "locale": "en-US",
        "sampleRate": 24000,
        "format": "MP3",
    }

    headers = {
        "Content-Type": "application/json",
        "api-key": MURF_API_KEY
    }
    try:
        response = requests.post(
            BASE_URL,
            headers=headers,
            data=json.dumps(payload),
            stream=True,
            timeout=25
        )
        if response.status_code != 200:
            print(f"Murf API returned status {response.status_code}: {response.text[:200]}")
            return
        for chunk in response.iter_content(chunk_size=4096):
            if chunk:
                yield base64.b64encode(chunk).decode("utf-8") + "\n"
    except Exception as e:
        print(f"Error streaming audio from Murf: {e}")
        return

def get_msg_text(msg):
    if hasattr(msg, "content") and msg.content:
        return msg.content
    if hasattr(msg, "text") and msg.text:
        return msg.text
    return str(msg)

def invoke_agent_with_retry(agent, payload, config, max_retries=2):
    """Invoke agent with retry and fallback to Gemini if NVIDIA NIM has temporary capacity limit"""
    last_err = None
    for attempt in range(max_retries):
        try:
            return agent.invoke(payload, config=config)
        except Exception as e:
            last_err = e
            print(f"Agent invocation attempt {attempt+1} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(1.5)

    if GOOGLE_API_KEY:
        try:
            print("NVIDIA model unavailable; falling back to Google Gemini...")
            fallback_model = init_chat_model("google_genai:gemini-3.5-flash-lite", api_key=GOOGLE_API_KEY)
            fallback_agent = create_agent(model=fallback_model, tools=[])
            return fallback_agent.invoke(payload, config=config)
        except Exception as fb_err:
            print(f"Fallback model also failed: {fb_err}")

    print(f"All LLM providers unavailable. Using emergency fallback response. Error: {last_err}")
    from langchain_core.messages import AIMessage
    
    messages = payload.get("messages", [])
    last_user_content = str(messages[-1].get("content", "")) if messages else ""
    
    if "feedback" in last_user_content.lower() or "candidate_score" in last_user_content.lower():
        fallback_text = json.dumps({
            "subject": "Interview",
            "candidate_score": 4,
            "feedback": "You answered the interview questions thoughtfully and demonstrated solid conceptual knowledge.",
            "areas_of_improvement": "Continue practicing with specific real-world technical implementation details."
        })
    else:
        fallback_text = "Could you share more about your background and a recent project you worked on?"

    return {"messages": [AIMessage(content=fallback_text)]}

@app.route("/start-interview", methods=["POST"])
def start_interview():
    data = request.json or {}
    sid, sess = get_session(data)
    sess["subject"] = data.get("subject", "Python")
    sess["question_count"] = 1
    # Create fresh agent / checkpointer for this new interview session
    sess["checkpointer"] = InMemorySaver()
    sess["agent"] = create_agent(
        model=model,
        tools=[],
        checkpointer=sess["checkpointer"]
    )
    config = {"configurable": {"thread_id": sess["thread_id"]}}
    formatted_prompt = INTERVIEW_PROMPT.format(subject=sess["subject"])
    response = invoke_agent_with_retry(
        sess["agent"],
        {
            "messages": [
                {"role": "system", "content": formatted_prompt},
                {"role": "user", "content": f"Start the interview with a warm greeting and ask the first question about {sess['subject']}. Keep it SHORT (1-2 sentences). Do not include parenthetical remarks."}
            ]
        },
        config=config
    )
    question = get_msg_text(response["messages"][-1])
    clean_question = clean_text_for_speech(question)
    print(f"\n[{sid}] [Question 1] {question}", flush=True)

    headers = {
        "Content-Type": "text/plain",
        "X-Question-Number": "1",
        "X-Question-Text": urllib.parse.quote(question),
        "X-Interview-Complete": "false"
    }
    return Response(stream_audio(clean_question), mimetype="text/plain", headers=headers)

def speech_to_text(audio_path):
    """Convert audio file to text using AssemblyAI"""
    try:
        transcriber = aai.Transcriber()
        config = aai.TranscriptionConfig(
            speech_models=["universal-3-pro", "universal-2"],
            language_detection=True,
            speaker_labels=True,
        )
        transcript = transcriber.transcribe(audio_path, config=config)
        if transcript.status == aai.TranscriptStatus.error:
            print(f"AssemblyAI transcription error: {transcript.error}")
            return ""
        return transcript.text if transcript.text else ""
    except Exception as e:
        print(f"Transcription error: {e}")
        return ""

@app.route("/submit-answer", methods=["POST"])
def submit_answer():
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    sid, sess = get_session(request.form)
    audio_file = request.files["audio"]
    temp_path = (
        tempfile.NamedTemporaryFile(
            delete=False,
            suffix=".webm"
        ).name
    )
    try:
        audio_file.save(temp_path)
        answer = speech_to_text(temp_path)
    finally:
        if os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except Exception:
                pass

    if not answer:
        answer = "I answered the question."
    print(f"[{sid}] [Answer {sess['question_count']}] {answer}", flush=True)
    config = {"configurable": {"thread_id": sess["thread_id"]}}
   
    invoke_agent_with_retry(sess["agent"], {"messages": [{"role": "user", "content": answer}]}, config=config)

    # If question 5 was just answered, conclude the interview
    if sess["question_count"] >= 5:
        print(f"\n[{sid}] [Interview Complete - All 5 questions answered]", flush=True)
        prompt = """The candidate has just answered question 5, which is the final question of the interview.
Acknowledge their final answer briefly and warmly conclude the interview in 1-2 sentences.
Let them know that the interview is complete and they can now review their feedback."""
        response = invoke_agent_with_retry(sess["agent"], {"messages": [{"role": "user", "content": prompt}]}, config=config)
        conclusion = get_msg_text(response["messages"][-1])
        clean_conclusion = clean_text_for_speech(conclusion)
        print(f"\n[{sid}] [Conclusion] {conclusion}", flush=True)
        headers = {
            'Content-Type': 'text/plain',
            'X-Question-Number': '5',
            'X-Question-Text': urllib.parse.quote(conclusion),
            'X-Interview-Complete': 'true'
        }
        return Response(stream_audio(clean_conclusion), mimetype='text/plain', headers=headers)

    sess["question_count"] += 1
    prompt = f"""The candidate just answered question {sess['question_count'] - 1}.
 
    Look at their ACTUAL answer above. Do NOT assume or make up what they said.
    
    Now ask question {sess['question_count']} of 5:
    1. Briefly acknowledge what they ACTUALLY said (1 sentence) - quote their exact words if needed
    2. Ask your next question that builds on their REAL response (1-2 sentences)
    3. If they said "I don't know" or gave a wrong answer, acknowledge that and ask something simpler
    4. Keep the TOTAL response under 3 sentences
    
    Be conversational but CONCISE. Only reference what they truly said."""
    response = invoke_agent_with_retry(sess["agent"], {"messages": [{"role": "user", "content": prompt}]}, config=config)
    question = get_msg_text(response["messages"][-1])
    clean_question = clean_text_for_speech(question)
    print(f"\n[{sid}] [Question {sess['question_count']}] {question}", flush=True)

    headers = {
        'Content-Type': 'text/plain',
        'X-Question-Number': str(sess["question_count"]),
        'X-Question-Text': urllib.parse.quote(question),
        'X-Interview-Complete': 'false'
    }
    return Response(stream_audio(clean_question), mimetype='text/plain', headers=headers)

@app.route("/get-feedback", methods=["POST"])
def get_feedback():
    """Generate detailed interview feedback"""
    data = request.json or {}
    sid, sess = get_session(data)
    config = {"configurable": {"thread_id": sess["thread_id"]}}
    response = invoke_agent_with_retry(
        sess["agent"],
        {
            "messages": [
                {
                    "role": "user", 
                    "content": f"{FEEDBACK_PROMPT}\n\nReview our complete {sess['subject']} interview conversation and provide detailed feedback."
                }
            ]
        },
        config=config
    )
    text = get_msg_text(response["messages"][-1])
    print(f"\n[{sid}] [Feedback Generated]\n{text}\n", flush=True)
    cleaned = text.strip()
    if "```" in cleaned:
        parts = cleaned.split("```")
        if len(parts) >= 2:
            cleaned = parts[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.strip()

    try:
        start_idx = cleaned.find("{")
        end_idx = cleaned.rfind("}")
        if start_idx != -1 and end_idx != -1:
            feedback = json.loads(cleaned[start_idx:end_idx + 1])
        else:
            feedback = json.loads(cleaned)
    except Exception as e:
        print(f"Error parsing feedback JSON: {e}")
        feedback = {
            "subject": sess["subject"],
            "candidate_score": 4,
            "feedback": cleaned,
            "areas_of_improvement": "Continue practicing technical fundamentals and problem explanations."
        }

    return jsonify({"success": True, "feedback": feedback})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug_mode = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    print(f"Starting server on http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=debug_mode)
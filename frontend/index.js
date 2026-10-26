

// Global State
let mediaRecorder = null;
let recordingChunks = [];
let recordedBlob = null;
let currentSubject = null;
let isSpeaking = false;
let currentAudio = null;
let currentAudioBlob = null;
let audioCtx = null;
let sessionId = "session_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now();

// DOM Elements
const welcomeState = document.getElementById("welcomeState");
const interviewState = document.getElementById("interviewState");
const subjectBtns = document.querySelectorAll(".subject-btn");
const subjectBadge = document.getElementById("subjectBadge");
const subjectIcon = document.getElementById("subjectIcon");
const questionNum = document.getElementById("questionNum");
const speakingBubble = document.getElementById("speakingBubble");
const speakingStatusText = document.getElementById("speakingStatusText");
const replayAudioBtn = document.getElementById("replayAudioBtn");
const questionCard = document.getElementById("questionCard");
const questionTextDisplay = document.getElementById("questionTextDisplay");
const startInterviewBtn = document.getElementById("startInterviewBtn");
const recordBtn = document.getElementById("recordBtn");
const micIcon = document.getElementById("micIcon");
const stopIcon = document.getElementById("stopIcon");
const recordingStatus = document.getElementById("recordingStatus");
const submitBtn = document.getElementById("submitBtn");
const endInterviewBtn = document.getElementById("endInterviewBtn");
const feedbackSection = document.getElementById("feedbackSection");
const getFeedbackArea = document.getElementById("getFeedbackArea");
const getFeedbackBtn = document.getElementById("getFeedbackBtn");
const feedbackContent = document.getElementById("feedbackContent");
const feedbackSubject = document.getElementById("feedbackSubject");
const scoreCircle = document.getElementById("scoreCircle");
const scoreValue = document.getElementById("scoreValue");
const feedbackText = document.getElementById("feedbackText");
const improvementText = document.getElementById("improvementText");
const newInterviewBtn = document.getElementById("newInterviewBtn");

// Subject Icons Map
const iconMap = {
    "Self Introduction": "fas fa-user text-blue-400",
    "Generative AI": "fas fa-brain text-purple-400",
    "Python": "fab fa-python text-yellow-400",
    "English": "fas fa-language text-green-400",
    "HTML": "fab fa-html5 text-orange-400",
    "CSS": "fab fa-css3-alt text-blue-400"
};


// ========== UI STATE FUNCTIONS ==========

function primeAudio() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === "suspended") {
            audioCtx.resume();
        }
    } catch (_) {}
}

function displayQuestionText(text) {
    if (!text || !questionCard || !questionTextDisplay) return;
    questionTextDisplay.textContent = text;
    questionCard.classList.remove("hidden");
}

function showInterviewPanel(subject) {
    currentSubject = subject;

    subjectBtns.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.subject === subject);
    });

    welcomeState.classList.add("hidden");
    interviewState.classList.remove("hidden");
    feedbackSection.classList.add("hidden");

    subjectBadge.textContent = subject;
    subjectIcon.className = iconMap[subject] + " text-2xl";
    questionNum.textContent = "1";

    if (speakingBubble) speakingBubble.classList.add("hidden");
    if (questionCard) questionCard.classList.add("hidden");
    if (questionTextDisplay) questionTextDisplay.textContent = "";
    if (replayAudioBtn) replayAudioBtn.classList.add("hidden");

    startInterviewBtn.classList.remove("hidden");
    recordBtn.classList.add("hidden");
    recordBtn.disabled = true;
    submitBtn.disabled = true;
    endInterviewBtn.disabled = true;
    recordingStatus.textContent = "Click Start Interview to begin";
}

function updateQuestionNumber(number) {
    questionNum.textContent = number;
}

function showSpeakingBubble(text = "Natalie is speaking...") {
    if (speakingStatusText) speakingStatusText.textContent = text;
    if (speakingBubble) speakingBubble.classList.remove("hidden");
}

function hideSpeakingBubble() {
    if (speakingBubble) speakingBubble.classList.add("hidden");
}

function enableRecording() {
    recordBtn.disabled = false;
    endInterviewBtn.disabled = false;
    recordingStatus.textContent = "Click to record";
}

function disableRecording() {
    recordBtn.disabled = true;
    submitBtn.disabled = true;
    submitBtn.classList.add("hidden");
}

function showFeedbackSection() {
    feedbackSection.classList.remove("hidden");
    getFeedbackArea.classList.remove("hidden");
    feedbackContent.classList.add("hidden");
    endInterviewBtn.disabled = true;
    disableRecording();
    recordingStatus.textContent = "Interview ended";
    hideSpeakingBubble();
}

function displayFeedback(data) {
    feedbackSubject.textContent = data.subject || currentSubject;
    const score = Math.max(0, Math.min(5, Number(data.candidate_score) || 0));
    scoreValue.textContent = score;

    const maxOffset = 251.2;
    const offset = maxOffset - (score / 5) * maxOffset;
    scoreCircle.style.strokeDashoffset = offset;

    feedbackText.textContent = data.feedback || "No feedback available";
    improvementText.textContent = data.areas_of_improvement || "No suggestions available";

    getFeedbackArea.classList.add("hidden");
    feedbackContent.classList.remove("hidden");
}

function resetToWelcome() {
    currentSubject = null;
    isSpeaking = false;
    mediaRecorder = null;
    recordingChunks = [];
    recordedBlob = null;
    currentAudioBlob = null;

    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    subjectBtns.forEach((btn) => {
        btn.classList.remove("active");
    });

    welcomeState.classList.remove("hidden");
    interviewState.classList.add("hidden");

    recordBtn.classList.remove("bg-red-500", "text-white", "recording-active");
    recordBtn.classList.add("bg-zinc-800/80", "text-gray-400");
    micIcon.classList.remove("hidden");
    stopIcon.classList.add("hidden");
    submitBtn.classList.add("hidden");

    if (speakingBubble) speakingBubble.classList.add("hidden");
    if (questionCard) questionCard.classList.add("hidden");
    if (questionTextDisplay) questionTextDisplay.textContent = "";
    if (replayAudioBtn) replayAudioBtn.classList.add("hidden");

    scoreCircle.style.strokeDashoffset = 251.2;
    getFeedbackBtn.textContent = "Get Feedback";
    getFeedbackBtn.disabled = false;
    sessionId = "session_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now();
}


// ========== AUDIO FUNCTIONS ==========

function replayCurrentAudio() {
    if (!currentAudioBlob) return;
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    const audioUrl = URL.createObjectURL(currentAudioBlob);
    currentAudio = new Audio(audioUrl);
    showSpeakingBubble("Replaying Natalie's audio...");
    isSpeaking = true;

    currentAudio.onended = () => {
        isSpeaking = false;
        hideSpeakingBubble();
        try { URL.revokeObjectURL(audioUrl); } catch (_) {}
    };

    currentAudio.onerror = (e) => {
        console.error("Replay error:", e);
        isSpeaking = false;
        hideSpeakingBubble();
    };

    currentAudio.play().catch((err) => {
        console.warn("Replay failed:", err);
        isSpeaking = false;
        hideSpeakingBubble();
    });
}

async function handleAudioStream(response, onComplete) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let audioChunks = [];
    let buffer = "";

    // Show speaking bubble when audio is incoming
    showSpeakingBubble("Natalie is speaking...");
    isSpeaking = true;
    recordBtn.disabled = true;
    recordingStatus.textContent = "Natalie is speaking...";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (value) {
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                // The last element is either empty (if ended with \n) or an incomplete line
                buffer = lines.pop();
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed) {
                        try {
                            const binaryString = atob(trimmed);
                            const bytes = new Uint8Array(binaryString.length);
                            for (let i = 0; i < binaryString.length; i++) {
                                bytes[i] = binaryString.charCodeAt(i);
                            }
                            audioChunks.push(bytes);
                        } catch (e) {
                            console.error("Base64 decode error:", e);
                        }
                    }
                }
            }
            if (done) {
                const trimmed = buffer.trim();
                if (trimmed) {
                    try {
                        const binaryString = atob(trimmed);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        audioChunks.push(bytes);
                    } catch (e) {
                        console.error("Base64 decode error on remainder:", e);
                    }
                }
                break;
            }
        }
    } catch (err) {
        console.error("Stream reading error:", err);
    }

    if (audioChunks.length === 0) {
        isSpeaking = false;
        hideSpeakingBubble();
        if (onComplete) onComplete();
        else enableRecording();
        return;
    }

    const audioBlob = new Blob(audioChunks, { type: "audio/mpeg" });
    currentAudioBlob = audioBlob;
    if (replayAudioBtn) replayAudioBtn.classList.remove("hidden");

    const audioUrl = URL.createObjectURL(audioBlob);

    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    currentAudio = new Audio(audioUrl);

    let finished = false;
    const finishPlayback = () => {
        if (finished) return;
        finished = true;
        isSpeaking = false;
        hideSpeakingBubble();
        try {
            URL.revokeObjectURL(audioUrl);
        } catch (_) {}

        if (onComplete) {
            onComplete();
        } else {
            enableRecording();
        }
    };

    currentAudio.onended = finishPlayback;
    currentAudio.onerror = (e) => {
        console.error("Audio playback error:", e);
        finishPlayback();
    };

    // Safety fallback: trigger if playback has reached the end
    currentAudio.ontimeupdate = () => {
        if (currentAudio.duration && currentAudio.duration > 1.0 && currentAudio.currentTime >= currentAudio.duration - 0.05) {
            finishPlayback();
        }
    };

    try {
        await currentAudio.play();
    } catch (playErr) {
        console.warn("Audio autoplay blocked by browser policy:", playErr);
        if (speakingStatusText) speakingStatusText.textContent = "Click 'Replay Audio' to hear Natalie";
        if (replayAudioBtn) replayAudioBtn.classList.remove("hidden");
        // Enable recording so the candidate can answer even if they prefer reading
        if (onComplete) {
            onComplete();
        } else {
            enableRecording();
        }
    }
}


// ========== RECORDING FUNCTIONS ==========

function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        const options = { mimeType: "audio/webm;codecs=opus" };

        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = "audio/webm";
        }

        mediaRecorder = new MediaRecorder(stream, options);
        recordingChunks = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                recordingChunks.push(e.data);
            }
        };

        mediaRecorder.onstop = () => {
            recordedBlob = new Blob(recordingChunks, { type: "audio/webm" });
            stream.getTracks().forEach((track) => track.stop());
        };

        mediaRecorder.start();

        recordBtn.classList.remove("bg-zinc-800/80", "text-gray-400");
        recordBtn.classList.add("bg-red-500", "text-white", "recording-active");
        micIcon.classList.add("hidden");
        stopIcon.classList.remove("hidden");
        recordingStatus.textContent = "Recording...";
        submitBtn.classList.add("hidden");
        endInterviewBtn.disabled = true;
    }).catch((err) => {
        console.error("Microphone access error:", err);
        recordingStatus.textContent = "Microphone access denied or unavailable";
        enableRecording();
    });
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();

        recordBtn.classList.remove("bg-red-500", "text-white", "recording-active");
        recordBtn.classList.add("bg-zinc-800/80", "text-gray-400");
        micIcon.classList.remove("hidden");
        stopIcon.classList.add("hidden");
        recordingStatus.textContent = "Recording complete";
        submitBtn.classList.remove("hidden");
        submitBtn.disabled = false;
    }
}


// ========== API FUNCTIONS ==========

// Automatically resolve base URL:
// - Uses "http://127.0.0.1:5000" if running via file:// or a local separate dev server (port 5500/5501)
// - Uses "" (relative paths) when deployed on any server (Render, Railway, Docker, etc.)
const API_BASE = (window.location.protocol === "file:" || window.location.port === "5500" || window.location.port === "5501")
    ? "http://127.0.0.1:5000"
    : "";

const startInterviewApiUrl = `${API_BASE}/start-interview`;
const submitAnswerApiUrl = `${API_BASE}/submit-answer`;
const getFeedbackApiUrl = `${API_BASE}/get-feedback`;


async function startInterview() {
    primeAudio();
    startInterviewBtn.classList.add("hidden");
    recordBtn.classList.remove("hidden");
    recordingStatus.textContent = "Connecting to Natalie...";
    showSpeakingBubble("Natalie is preparing question 1...");

    try {
        const response = await fetch(startInterviewApiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subject: currentSubject, session_id: sessionId })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            recordingStatus.textContent = errData.error || `Server error (${response.status})`;
            hideSpeakingBubble();
            startInterviewBtn.classList.remove("hidden");
            recordBtn.classList.add("hidden");
            return;
        }

        // Extract Question Text from header and display on screen immediately
        const rawQText = response.headers.get("X-Question-Text");
        if (rawQText) {
            try {
                displayQuestionText(decodeURIComponent(rawQText));
            } catch (_) {}
        }

        const qNum = response.headers.get("X-Question-Number");
        if (qNum) updateQuestionNumber(qNum);

        // Stream and play Natalie's audio question
        await handleAudioStream(response, () => {
            enableRecording();
            endInterviewBtn.disabled = false;
        });
    } catch (error) {
        console.error("Start interview connection error:", error);
        recordingStatus.textContent = "Backend not connected";
        hideSpeakingBubble();
        recordBtn.classList.add("hidden");
        startInterviewBtn.classList.remove("hidden");
    }
}


async function submitAnswer() {
    if (!recordedBlob) return;
    primeAudio();

    disableRecording();
    recordingStatus.textContent = "Submitting answer...";
    showSpeakingBubble("Natalie is listening to your answer...");

    const formData = new FormData();
    formData.append("audio", recordedBlob, "answer.webm");
    formData.append("session_id", sessionId);

    try {
        const response = await fetch(submitAnswerApiUrl, {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            recordingStatus.textContent = errData.error || `Error submitting answer (${response.status})`;
            hideSpeakingBubble();
            enableRecording();
            return;
        }

        const isComplete = response.headers.get('X-Interview-Complete') === 'true';
        const questionNumber = response.headers.get('X-Question-Number');

        if (questionNumber) {
            updateQuestionNumber(questionNumber);
        }

        // Display follow-up question text or conclusion text
        const rawQText = response.headers.get("X-Question-Text");
        if (rawQText) {
            try {
                displayQuestionText(decodeURIComponent(rawQText));
            } catch (_) {}
        }

        recordedBlob = null;
        recordingChunks = [];

        // Stream and play Natalie's follow-up audio response
        await handleAudioStream(response, () => {
            if (isComplete) {
                showFeedbackSection();
            } else {
                enableRecording();
                endInterviewBtn.disabled = false;
            }
        });
    } catch (error) {
        console.error("Submit answer error:", error);
        recordingStatus.textContent = "Connection error";
        hideSpeakingBubble();
        enableRecording();
    }
}



async function endInterview() {
    if (!confirm("End interview and get feedback?")) return;

    disableRecording();
    endInterviewBtn.disabled = true;
    recordingStatus.textContent = "Ending interview...";

    await getFeedback();
}

async function getFeedback() {
    showFeedbackSection();
    getFeedbackBtn.textContent = "Generating...";
    getFeedbackBtn.disabled = true;

    try {
        const response = await fetch(getFeedbackApiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId })
        });

        const data = await response.json();

        if (data.success) {
            displayFeedback(data.feedback);
        }
    } catch (error) {
        getFeedbackBtn.textContent = "Error - Retry";
        getFeedbackBtn.disabled = false;
    }
}


// ========== EVENT LISTENERS ==========

subjectBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
        if (currentSubject === btn.dataset.subject) return;
        resetToWelcome();
        showInterviewPanel(btn.dataset.subject);
    });
});

startInterviewBtn.addEventListener("click", () => {
    primeAudio();
    startInterview();
});

recordBtn.addEventListener("click", () => {
    if (isSpeaking || recordBtn.disabled) return;

    if (!mediaRecorder || mediaRecorder.state === "inactive") {
        startRecording();
    } else {
        stopRecording();
    }
});

submitBtn.addEventListener("click", () => {
    primeAudio();
    submitAnswer();
});

if (replayAudioBtn) {
    replayAudioBtn.addEventListener("click", replayCurrentAudio);
}

endInterviewBtn.addEventListener("click", endInterview);
getFeedbackBtn.addEventListener("click", getFeedback);
newInterviewBtn.addEventListener("click", resetToWelcome);
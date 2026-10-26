# Deployment Guide: AI Interview Assistant

This project is now configured as a **unified web application**:
- The Flask backend runs the AI agent, handles AssemblyAI speech-to-text, and streams Murf AI voice audio.
- The same Flask server automatically serves the frontend interface (`index.html`, `index.js`, styling, etc.) from `/`.
- Multi-user sessions are automatically isolated using dynamic session IDs.
- Port binding is fully dynamic via `$PORT`.

---

## Recommended Hosting Providers

| Provider | Compatibility | Free Tier | Setup Ease | Recommended For |
| :--- | :---: | :---: | :---: | :--- |
| **[Render](https://render.com)** | **100% (Native Python + Gunicorn)** | **Yes (Free Web Service)** | **Easiest (1 Click)** | **Best overall choice for this project** |
| **[Railway](https://railway.app)** | **100% (Native / Docker)** | $5 trial credit | Very Easy | High performance, instant deploy |
| **[Hugging Face Spaces](https://huggingface.co/spaces)** | **100% (Docker)** | **Yes (Free 16GB RAM CPU)** | Easy | Free AI app hosting |
| **[Google Cloud Run](https://cloud.google.com/run)** | **100% (Docker)** | Generous free tier | Moderate | Enterprise serverless scaling |
| **VPS (Ubuntu / DigitalOcean / AWS)** | **100% (Docker or Systemd)** | Paid | Manual | Dedicated hosting |

---

## Option 1: Deploy on Render (Recommended & Free)

Render is the simplest and best platform for this project:

### Steps:
1. **Push your code to GitHub**:
   - Create a repository on GitHub (e.g. `ai-interview-assistant`).
   - Push this workspace to your GitHub repository:
     ```bash
     git init
     git add .
     git commit -m "Initial commit"
     git branch -M main
     git remote add origin https://github.com/YOUR_USERNAME/ai-interview-assistant.git
     git push -u origin main
     ```

2. **Create a Web Service on Render**:
   - Go to [dashboard.render.com](https://dashboard.render.com/) and click **New +** > **Web Service**.
   - Select your GitHub repository.
   - Configure the service settings:
     - **Name**: `ai-interview-assistant` (or any name)
     - **Region**: Choose closest to you (e.g., Frankfurt, Oregon, Singapore)
     - **Branch**: `main`
     - **Runtime**: `Python 3`
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `gunicorn --chdir backend app:app --workers 1 --threads 4 --timeout 120`
     - **Instance Type**: `Free`

3. **Add Environment Variables**:
   Under **Environment Variables**, add:
   - `NVIDIA_API_KEY`: *(Your NVIDIA NIM API key starting with `nvapi-...` from [build.nvidia.com](https://build.nvidia.com/))*
   - `NVIDIA_MODEL`: `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`
   - `GOOGLE_API_KEY`: *(Your Google Gemini API Key - used as fallback)*
   - `MURF_API_KEY`: *(Your Murf AI API Key)*
   - `ASSEMBLYAI_API_KEY`: *(Your AssemblyAI API Key)*

4. **Deploy**:
   - Click **Create Web Service**.
   - Render will build the app and give you a live URL like:
     `https://ai-interview-assistant.onrender.com`
   - Open that URL — your full application is live!

---

## Option 2: Deploy with Docker (Any Server / Cloud Run / Railway / Fly.io)

A production-ready `Dockerfile` and `.dockerignore` are included in the repository.

### Run locally or on a VPS with Docker:
```bash
# Build the Docker image
docker build -t ai-interview-assistant .

# Run the container
docker run -d -p 5000:5000 \
  -e GOOGLE_API_KEY="your_google_key" \
  -e MURF_API_KEY="your_murf_key" \
  -e ASSEMBLYAI_API_KEY="your_assemblyai_key" \
  ai-interview-assistant
```
Then visit `http://localhost:5000`.

---

## Option 3: Deploy on Railway

1. Go to [railway.app](https://railway.app/) and sign in with GitHub.
2. Click **New Project** > **Deploy from GitHub repo**.
3. Select this repository.
4. Go to **Variables** and add:
   - `GOOGLE_API_KEY`
   - `MURF_API_KEY`
   - `ASSEMBLYAI_API_KEY`
5. Railway will automatically detect the `Procfile` or `Dockerfile` and deploy the service.
6. Under **Settings** > **Networking**, click **Generate Domain** to get your public HTTPS URL.

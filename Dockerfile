FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

ENV PORT=5000
EXPOSE 5000

CMD ["sh", "-c", "gunicorn --chdir backend app:app --bind 0.0.0.0:${PORT:-5000} --workers 1 --threads 4 --timeout 120"]

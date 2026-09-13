# syntax=docker/dockerfile:1
FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl build-essential \
    && rm -rf /var/lib/apt/lists/*

# Configurable for slow connections; pip 25.2 can resume interrupted downloads.
ARG PIP_TIMEOUT=300
ARG PIP_RETRIES=10
ARG PIP_RESUME_RETRIES=10

COPY requirements.txt .
# Preserve downloaded wheels between build attempts without adding cache to the image.
RUN --mount=type=cache,id=bookflow-ai-pip,target=/root/.cache/pip \
    python -m pip install --timeout=${PIP_TIMEOUT} --retries=${PIP_RETRIES} --upgrade pip==25.2 \
    && python -m pip install --timeout=${PIP_TIMEOUT} --retries=${PIP_RETRIES} \
        --resume-retries=${PIP_RESUME_RETRIES} --prefer-binary -r requirements.txt \
    && python -m pip check

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

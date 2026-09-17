# syntax=docker/dockerfile:1
FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl build-essential \
    && rm -rf /var/lib/apt/lists/*

# Configurable for slow connections.
ARG PIP_TIMEOUT=300
ARG PIP_RETRIES=10

COPY requirements.txt .
RUN python -m pip install --no-cache-dir --timeout=${PIP_TIMEOUT} --retries=${PIP_RETRIES} --upgrade pip==25.2 \
    && python -m pip install --timeout=${PIP_TIMEOUT} --retries=${PIP_RETRIES} \
        --no-cache-dir --prefer-binary -r requirements.txt \
    && python -m pip check

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

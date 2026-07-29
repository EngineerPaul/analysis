FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p logs /data

EXPOSE 9002

# Default: API server. Tests: docker compose run --rm backend pytest
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9002"]

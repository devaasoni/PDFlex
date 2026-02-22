FROM python:3.10-slim

# Install system dependencies for OCR and PDF Image conversion
RUN apt-get update && apt-get install -y \
    poppler-utils \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy your server code
COPY server.py .

# Expose port and run server using Gunicorn (production server)
EXPOSE 10000
CMD ["gunicorn", "--bind", "0.0.0.0:10000", "--timeout", "120", "server:app"]
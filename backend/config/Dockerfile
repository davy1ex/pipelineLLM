FROM python:3.11-slim

WORKDIR /app

# System libs required by OpenCV/docling (libGL etc.)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       libgl1 \
       libglib2.0-0 \
       libsm6 \
       libxext6 \
       libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY config/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/
COPY workflow/ ./workflow/
COPY executors/ ./executors/
COPY shared/ ./shared/

# Expose port
EXPOSE 5000

# Set environment variables
ENV DOCKER_CONTAINER=1
ENV FLASK_PORT=5000
ENV FLASK_DEBUG=1

# Run with flask (development)
# For production, use gunicorn: gunicorn -w 4 -b 0.0.0.0:5000 app.server:app
CMD ["python", "-m", "app"]





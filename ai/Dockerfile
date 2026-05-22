# Use a slim, stable Python base image
FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set the working directory
WORKDIR /app

# Install system dependencies if any are needed (none required for standard scikit-learn/pandas)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file first to leverage Docker's cache system
COPY requirements.txt .

# Install Python packages
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application files (dataset, model pickle files, and scripts)
COPY . .

# Expose ports for both services (5000 for Predict, 5001 for Anomaly Detection)
EXPOSE 5000
EXPOSE 5001

# Default environment variable specifying which service to start.
# This makes the image highly reusable for both Predict and Anomaly containers.
ENV SERVICE_NAME=predict

# Start the selected service via a shell instruction that handles the environment variable
CMD if [ "$SERVICE_NAME" = "anomaly" ]; then \
        gunicorn -w 1 --threads 4 -b 0.0.0.0:${PORT:-5001} anomaly_server:app; \
    else \
        gunicorn -w 1 --threads 4 -b 0.0.0.0:${PORT:-5000} ai_server:app; \
    fi

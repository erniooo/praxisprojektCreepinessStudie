FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p storage/audio storage/sessions

EXPOSE 8080

CMD gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 300 --threads 4

FROM python:3.11-slim

WORKDIR /app

# Instala dependencias del sistema
RUN apt-get update && apt-get install -y \
    octave \
    octave-optim \
    octave-signal \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copia requirements y instala dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia código
COPY . .

# Expone puerto
EXPOSE 8000

# Inicia aplicación
CMD ["python", "main.py"]

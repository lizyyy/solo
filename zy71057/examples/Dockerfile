FROM python:3.9-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y build-essential

RUN pip install torch tensorflow pandas numpy scikit-learn

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY model_weights.pt /app/model/
COPY . /app

CMD ["python", "app.py"]

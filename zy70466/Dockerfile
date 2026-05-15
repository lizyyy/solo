FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY setup.py .
COPY finance_carrier/ ./finance_carrier/
COPY data/samples/ ./data/samples/

RUN pip install -e .

ENV PYTHONUNBUFFERED=1

ENTRYPOINT ["fcarrier"]
CMD ["--help"]

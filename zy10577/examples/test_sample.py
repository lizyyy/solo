import pytest
import requests
from .sample import fetch_data, send_data

def test_fetch_data():
    result = fetch_data()
    assert isinstance(result, dict)

def test_send_data():
    result = send_data({"test": "data"})
    assert result == 200

def test_requests_direct():
    response = requests.get("https://example.com")
    assert response.status_code == 200

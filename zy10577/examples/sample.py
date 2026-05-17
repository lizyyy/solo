import requests
from requests import get, post
import requests.some_function
from requests.utils import helper

def fetch_data():
    response = requests.get("https://example.com")
    return response.json()

def send_data(data):
    result = requests.post("https://example.com/api", json=data)
    return result.status_code

def use_deprecated():
    result = requests.some_function("old-api")
    return result

def use_utils():
    return requests.utils.helper()

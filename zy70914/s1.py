import sys
sys.path.insert(0, ".")
from fastapi.testclient import TestClient
from main import app, global_store
import json, io
c = TestClient(app)
print("start")

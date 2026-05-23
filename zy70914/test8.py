import sys
sys.path.insert(0, ".")
from fastapi.testclient import TestClient
from main import app, global_store
import json

print("=" * 80)
print("第四轮修复 - 完整功能验证测试 (8项)")
print("=" * 80)

results = {}


import sys
sys.path.insert(0, ".")
from fastapi.testclient import TestClient
from main import app

c = TestClient(app)

print("=" * 70)
print("完整业务链路测试 - 第二轮修复验证")
print("=" * 70)
print()

passed = 0
total = 7

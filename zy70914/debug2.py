import sys
sys.path.insert(0, ".")

# 直接导入并检查
import main
print("dir(main):", [x for x in dir(main) if not x.startswith("_")])
print()

# 手动检查
from fastapi.testclient import TestClient
from main import app
from app.services import DataStore

# 检查是否每次请求创建新实例
print("=== Testing ===")
c = TestClient(app)

# 导入前检查
from main import create_app
print("App created")

# 导入数据
f = open("sample_data/claims.csv", "rb")
r = c.post("/api/import/claims/csv", files={"file": ("claims.csv", f, "text/csv")})
f.close()
print("Import result:", r.json())

# 直接检查 global_store
import main as m2
print("main module has global_store:", hasattr(m2, "global_store"))
if hasattr(m2, "global_store"):
    print("global_store claims:", len(m2.global_store.claims))


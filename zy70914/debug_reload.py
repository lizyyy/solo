import sys
sys.path.insert(0, ".")
import main
print("First import, id:", id(main.global_store))
print("Claims:", len(main.global_store.claims))

# 模拟导入
store = main.global_store
from app.services import DataImporter
importer = DataImporter(store)
with open("sample_data/claims.csv", "r") as f:
    content = f.read()
importer.import_claims_csv(content)
print("After import, claims:", len(store.claims))

# 重新导入
import importlib
importlib.reload(main)
print("After reload, id:", id(main.global_store))
print("Claims:", len(main.global_store.claims))


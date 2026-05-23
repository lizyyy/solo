import sys
sys.path.insert(0, ".")
from app.services import DataStore, DataImporter

store = DataStore()
importer = DataImporter(store)

print("Before import:", len(store.claims), "claims")

with open("sample_data/claims.csv", "r") as f:
    content = f.read()

result = importer.import_claims_csv(content)
print("Import result:", result)
print("After import:", len(store.claims), "claims")
print("Claim IDs:", list(store.claims.keys()))


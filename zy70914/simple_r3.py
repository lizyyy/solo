import sys
sys.path.insert(0, ".")
from fastapi.testclient import TestClient
from main import app, global_store
import json, io

c = TestClient(app)
logf = open("/tmp/testlog.txt", "w")
def P(s):
    logf.write(str(s) + "\n")
    print(s)

P("=" * 70)
P("Round 3 Test")
P("=" * 70)

P("\n[1] Import custom rule")
rule = [{"rule_id":"C999","rule_name":"test","claim_type":"delay","flight_type":"domestic","min_delay_minutes":120,"compensation_amount":999,"max_compensation":999,"valid_from":"2024-01-01","description":"test"}]
f = io.BytesIO(json.dumps(rule).encode())
r = c.post("/api/import/rules", files={"file":("r.json", f, "application/json")})
P("  Status: " + str(r.status_code))
P("  Imported: " + str(r.json().get("imported")))
P("  Rules: " + str(len(global_store.get_all_rules())))

P("\n[2] Import data")
with open("sample_data/claims.csv", "rb") as f:
    r = c.post("/api/import/claims/csv", files={"file":("c.csv", f, "text/csv")})
P("  Claims: " + str(r.json().get("imported")))

with open("sample_data/flights.json", "rb") as f:
    r = c.post("/api/import/flights/json", files={"file":("f.json", f, "application/json")})
P("  Flights: " + str(r.json().get("imported")))

with open("sample_data/photos.json", "rb") as f:
    r = c.post("/api/import/photos", files={"file":("p.json", f, "application/json")})
P("  Photos: " + str(r.json().get("imported")))

P("\n[3] Compare all")
r = c.post("/api/compare/all")
data = r.json()
results = data.get("results", [])
P("  Total: " + str(data.get("total")))

c1 = None
for x in results:
    if x.get("claim_id") == "CLAIM001":
        c1 = x
        break
if c1:
    sa = c1.get("suggested_amount")
    ar = len(c1.get("applicable_rules", []))
    P("  CLAIM001 suggested_amount: " + str(sa))
    P("  CLAIM001 applicable_rules: " + str(ar))
    P("  Rule effective: " + str(sa == 999))

P("\n[4] Review")
r = c.post("/api/review/CLAIM001", data={"reviewer":"t","status":"approved","reviewed_amount":999,"review_notes":"ok","adjustment_reason":""})
P("  Review: " + str(r.status_code))

r = c.get("/api/comparisons/CLAIM001")
d = r.json().get("result", {})
P("  final_status: " + str(d.get("final_status")))
P("  final_amount: " + str(d.get("final_amount")))

P("\n[5] Statistics")
r = c.get("/api/statistics/summary")
s = r.json().get("summary", {})
P("  total_claimed: " + str(s.get("total_claimed_amount")))
P("  total_approved: " + str(s.get("total_approved_amount")))

P("\n[6] Export")
r = c.get("/api/export/csv")
P("  CSV size: " + str(len(r.content)))
csv_text = r.content.decode("utf-8-sig")
P("  CSV has CLAIM001: " + str("CLAIM001" in csv_text))
P("  CSV has 999: " + str("999" in csv_text))

r = c.get("/api/export/excel")
P("  Excel size: " + str(len(r.content)))

P("\n" + "=" * 70)
P("DONE")
logf.close()

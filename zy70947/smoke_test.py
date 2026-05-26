import json
import sys
sys.path.insert(0, ".")
import app as appmod
from app import app, init_db

init_db()
client = app.test_client()

payload = {
    "source_file": "材料批次-2026-05.xlsx",
    "items": [
        {
            "deposit_no": "YZ-2026-0001",
            "owner_name": "张小明",
            "owner_phone": "13800000001",
            "property_address": "阳光花园1栋101",
            "deposit_amount": 5000,
            "violation_deduction": 0,
            "renovation_no": "ZX-2026-0001",
            "acceptor": "李工程",
            "acceptance_date": "2026-03-20",
            "renovation_start_date": "2026-01-10",
            "renovation_end_date": "2026-03-15",
            "submit_date": "2026-03-21",
            "approval_chain": [
                {"role": "物业管家", "approved": True, "comment": "材料齐全"},
                {"role": "工程主管", "approved": True, "comment": "无违规"},
                {"role": "客服主管", "approved": True, "comment": "同意"},
                {"role": "项目经理", "approved": True, "comment": ""},
                {"role": "财务", "approved": True, "comment": ""},
            ],
            "final_handler": "王财务",
        },
        {
            "deposit_no": "YZ-2026-0002",
            "owner_name": "刘小美",
            "owner_phone": "13800000002",
            "property_address": "阳光花园2栋302",
            "deposit_amount": 3000,
            "violation_deduction": 500,
            "renovation_no": "ZX-2026-0002",
            "acceptor": "赵工程",
            "acceptance_date": "2026-04-10",
            "renovation_start_date": "2026-02-01",
            "renovation_end_date": "2026-04-01",
            "submit_date": "2026-04-11",
            "approval_chain": [],
            "final_handler": "孙客服",
        },
        {
            "deposit_no": "YZ-2026-0003",
            "owner_name": "陈小东",
            "owner_phone": "13800000003",
            "property_address": "阳光花园3栋501",
            "deposit_amount": 4000,
            "violation_deduction": 100,
            "renovation_no": "ZX-2026-0003",
            "acceptor": "",
            "acceptance_date": "",
            "renovation_start_date": "2026-02-15",
            "renovation_end_date": "2026-04-20",
            "submit_date": "2026-04-21",
            "approval_chain": [],
            "final_handler": "",
        },
        {
            "deposit_no": "YZ-2026-0004",
            "owner_name": "黄小华",
            "owner_phone": "13800000004",
            "property_address": "阳光花园4栋702",
            "deposit_amount": 6000,
            "violation_deduction": 8000,
            "renovation_no": "ZX-2026-0004",
            "acceptor": "周工程",
            "acceptance_date": "2026-01-01",
            "renovation_start_date": "2026-03-01",
            "renovation_end_date": "2026-02-01",
            "submit_date": "2026-04-01",
            "approval_chain": [],
            "final_handler": "吴财务",
        },
        {
            "deposit_no": "YZ-2026-0001",
            "owner_name": "张小明-重复",
            "owner_phone": "13800000001",
            "property_address": "阳光花园1栋101",
            "deposit_amount": 5000,
            "renovation_no": "ZX-2026-0001",
            "acceptor": "李工程",
            "acceptance_date": "2026-03-20",
            "renovation_start_date": "2026-01-10",
            "renovation_end_date": "2026-03-15",
            "submit_date": "2026-03-21",
            "approval_chain": [],
            "final_handler": "王财务",
        },
    ],
}

r = client.post("/api/submissions", json=payload)
print("SUBMIT:", r.status_code, json.dumps(r.get_json(), ensure_ascii=False, indent=2))

r = client.get("/api/stats")
print("\nSTATS:", r.status_code, json.dumps(r.get_json(), ensure_ascii=False, indent=2))

r = client.get("/api/submissions")
print("\nLIST:", r.status_code)
for item in r.get_json():
    print(" -", item["submission_uuid"], item["category"], item["status"], item["deposit_no"], item["owner_name"])

# Detail on pending one
pending = client.get("/api/submissions").get_json()
for p in pending:
    if p["category"] == "pending":
        d = client.get(f"/api/submissions/{p['submission_uuid']}").get_json()
        print("\nPENDING DETAIL:", json.dumps(d, ensure_ascii=False, indent=2))
        break
for p in pending:
    if p["category"] == "blocked":
        d = client.get(f"/api/submissions/{p['submission_uuid']}").get_json()
        print("\nBLOCKED DETAIL:", json.dumps(d, ensure_ascii=False, indent=2))
        break

# Manual confirm on pending
for p in pending:
    if p["category"] == "pending":
        cr = client.post(f"/api/submissions/{p['submission_uuid']}/confirm",
                         json={"decision": "approve", "comment": "联系业主补充后通过"})
        print("\nCONFIRM:", cr.status_code, cr.get_json())
        break

# Export
r = client.get("/api/export?status=completed")
print("\nEXPORT:", r.status_code, json.dumps(r.get_json(), ensure_ascii=False, indent=2)[:1000])

# Final stats
r = client.get("/api/stats")
print("\nFINAL STATS:", r.status_code, json.dumps(r.get_json(), ensure_ascii=False, indent=2))

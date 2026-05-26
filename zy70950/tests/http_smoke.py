from __future__ import annotations

import io
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from recon.main import app


def _fixtures():
    csv = (
        "addition_id,examinee_id,examinee_name,agreement_id,item_code,item_name,"
        "unit_price,qty,gross_amount,onsite_receivable,applied_coupons\n"
        'A1,E001,张三,AG-001,CT01,胸部CT,200,1,200,120,"C1,C2"\n'
        "A2,E001,张三,AG-001,BL01,血常规,30,1,30,30,\n"
        "A3,E002,李四,AG-001,US01,腹部B超,150,1,150,0,\n"
    )
    packages = [
        {
            "package_id": "P1",
            "examinee_id": "E001",
            "examinee_name": "张三",
            "agreement_id": "AG-001",
            "items": [
                {"item_code": "CT01", "item_name": "胸部CT", "unit_price": 200, "qty": 2, "refunded_qty": 1},
                {"item_code": "BL01", "item_name": "血常规", "unit_price": 30, "qty": 1},
            ],
        },
        {
            "package_id": "P2",
            "examinee_id": "E002",
            "examinee_name": "李四",
            "agreement_id": "AG-001",
            "items": [
                {"item_code": "US01", "item_name": "腹部B超", "unit_price": 150, "qty": 1},
            ],
        },
    ]
    agreements = [
        {
            "agreement_id": "AG-001",
            "company_name": "ACME",
            "per_person_limit": 100,
            "company_total_limit": 10000,
            "coupons": [
                {"coupon_id": "C1", "type": "fixed", "value": 20, "stackable": True},
                {"coupon_id": "C2", "type": "fixed", "value": 60, "stackable": True},
            ],
        }
    ]
    return csv, packages, agreements


def main():
    client = TestClient(app)
    csv_raw, packages, agreements = _fixtures()

    # 1) 创建会话
    r = client.post("/sessions", json={"name": "http-smoke"})
    assert r.status_code == 200, r.text
    sid = r.json()["id"]
    print(f"[*] session {sid}")

    # 2) 导入
    r = client.post(
        f"/sessions/{sid}/import/additions",
        files={"file": ("additions.csv", csv_raw.encode("utf-8"), "text/csv")},
    )
    assert r.status_code == 200, r.text
    print(f"[*] import additions {r.json()}")

    r = client.post(
        f"/sessions/{sid}/import/packages",
        files={"file": ("packages.json", json.dumps(packages, ensure_ascii=False).encode("utf-8"), "application/json")},
    )
    assert r.status_code == 200, r.text
    print(f"[*] import packages {r.json()}")

    r = client.post(
        f"/sessions/{sid}/import/agreements",
        files={"file": ("agreements.json", json.dumps(agreements, ensure_ascii=False).encode("utf-8"), "application/json")},
    )
    assert r.status_code == 200, r.text
    print(f"[*] import agreements {r.json()}")

    # 3) 自动比对
    r = client.post(f"/sessions/{sid}/match")
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    print(f"[*] matched {len(items)}")
    print(f"    first reasons={items[0]['explanation']['reason_codes']}")
    print(f"    first human={items[0]['explanation']['human_readable']}")

    # 4) 人工复核
    trace0 = items[0]["trace_id"]
    trace2 = items[2]["trace_id"]
    for tr, status, comment in [
        (trace0, "APPROVED", "券和限额都有依据，放行"),
        (items[1]["trace_id"], "APPROVED", "一致"),
        (trace2, "SUPPLEMENT", "现场应收为 0，需补收费凭证"),
    ]:
        r = client.post(
            f"/sessions/{sid}/review",
            json={"trace_id": tr, "status": status, "adjustment_amount": -150 if tr == trace2 else 0, "comment": comment},
        )
        assert r.status_code == 200, r.text

    # 5) 重算
    r = client.post(f"/sessions/{sid}/recalc")
    assert r.status_code == 200, r.text
    summary = r.json()
    print(f"[*] summary final_total={summary['final_total']} adjustment_total={summary['adjustment_total']}")

    # 6) 明细全链路
    r = client.get(f"/sessions/{sid}/details", params={"trace_id": trace0})
    assert r.status_code == 200, r.text
    chain = r.json()[0]["trace_chain"]
    print(f"[*] trace chain stages: {[c['stage'] for c in chain]}")

    # 7) 报告
    r = client.get(f"/sessions/{sid}/report.csv")
    assert r.status_code == 200, r.text
    assert "final_amount" in r.text
    print(f"[*] report.csv {len(r.text)} bytes, content-type={r.headers.get('content-type')}")

    print("OK")


if __name__ == "__main__":
    main()

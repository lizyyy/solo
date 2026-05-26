from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from recon import service
from recon.importers import parse_additions_csv, parse_agreements_json, parse_packages_json
from recon.schemas import ReasonCode, ReviewStatus


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
    return csv, json.dumps(packages, ensure_ascii=False), json.dumps(agreements, ensure_ascii=False)


def main():
    csv_raw, pkg_raw, agr_raw = _fixtures()
    sess = service.create_session(name="smoke")
    sid = sess.id
    print(f"[*] session {sid}")

    additions = parse_additions_csv(csv_raw)
    service.import_additions(sid, additions)

    pkgs = parse_packages_json(pkg_raw)
    service.import_packages(sid, pkgs)

    agrs = parse_agreements_json(agr_raw)
    service.import_agreements(sid, agrs)

    items = service.run_match(sid)
    print(f"[*] matched {len(items)} items")

    # 第一条应有 退项冲正 + 券叠加 + 单位限额 三类差异
    first = items[0]
    print(f"[*] first item trace_id={first.trace_id}")
    print(f"    expected={first.expected_amount} onsite={first.onsite_amount} diff={first.diff_amount}")
    print(f"    reasons={[r.value for r in first.explanation.reason_codes]}")
    print(f"    human={first.explanation.human_readable}")

    # 复核：第一条 放行，第二条 放行，第三条 补材料
    service.apply_review(sid, items[0].trace_id, ReviewStatus.APPROVED, 0, "券和限额都有依据，放行")
    service.apply_review(sid, items[1].trace_id, ReviewStatus.APPROVED, 0, "一致")
    service.apply_review(sid, items[2].trace_id, ReviewStatus.SUPPLEMENT, -150, "现场应收为 0，需补收费凭证")

    summary = service.recalc(sid)
    print(f"[*] summary final_total={summary.final_total} onsite_total={summary.onsite_total} "
          f"expected_total={summary.expected_total} adjustment_total={summary.adjustment_total}")
    print(f"    reason_distribution={summary.reason_distribution}")

    details = service.details(sid, trace_id=first.trace_id)
    print(f"[*] detail trace_chain stages: {[c['stage'] for c in details[0]['trace_chain']]}")

    csv_report = service.build_report_csv(sid)
    print(f"[*] report.csv ({len(csv_report)} bytes) preview:")
    for line in csv_report.splitlines()[:4]:
        print("    " + line)

    assert summary.final_total > 0
    assert ReasonCode.COUPON_STACK.value in summary.reason_distribution
    print("OK")


if __name__ == "__main__":
    main()

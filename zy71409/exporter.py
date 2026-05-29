import json
import csv
import os
from models import ReviewResult


class Exporter:
    @staticmethod
    def to_console(batch_result: dict):
        normal = batch_result["normal"]
        problematic = batch_result["problematic"]

        print(f"\n{'═' * 60}")
        print(f"基金销售适当性留痕 — 校验报告")
        print(f"{'═' * 60}")
        print(f"正常记录: {len(normal)} 条")
        print(f"问题记录: {len(problematic)} 条")
        print(f"{'═' * 60}")

        if normal:
            print(f"\n{'─' * 40}")
            print("✅ 正常记录")
            print(f"{'─' * 40}")
            for r in normal:
                Exporter._print_result(r)

        if problematic:
            print(f"\n{'─' * 40}")
            print("❌ 问题记录")
            print(f"{'─' * 40}")
            for r in problematic:
                Exporter._print_result(r)

    @staticmethod
    def _print_result(r: ReviewResult):
        print(f"  申请号: {r.app_id}  |  客户: {r.cust_id}  |  产品: {r.prod_code}")
        print(f"  适当性校验: {r.suitability_verify}")
        print(f"  材料版本: {r.material_version}")
        print(f"  回访状态: {r.callback_status}")
        if r.issues:
            for issue in r.issues:
                print(f"  ⚠ [{issue.issue_type.value}] {issue.description}")
                print(f"    来源: {issue.source.value}")
        if r.cust_assessment:
            print(f"  客户测评来源: {r.cust_assessment.get('source', 'N/A')}")
        if r.prod_grade:
            print(f"  产品等级来源: {r.prod_grade.get('source', 'N/A')}")
        if r.purchase_app:
            print(f"  购买申请来源: {r.purchase_app.get('source', 'N/A')}")
        print()

    @staticmethod
    def to_json(batch_result: dict, output_path: str):
        data = {
            "summary": {
                "normal_count": len(batch_result["normal"]),
                "problematic_count": len(batch_result["problematic"]),
            },
            "normal": [r.to_dict() for r in batch_result["normal"]],
            "problematic": [r.to_dict() for r in batch_result["problematic"]],
        }
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    @staticmethod
    def to_csv(batch_result: dict, output_dir: str):
        os.makedirs(output_dir, exist_ok=True)

        normal_path = os.path.join(output_dir, "normal_records.csv")
        problematic_path = os.path.join(output_dir, "problematic_records.csv")

        fieldnames = [
            "app_id",
            "cust_id",
            "prod_code",
            "suitability_verify",
            "material_version",
            "callback_status",
            "is_pass",
            "issue_types",
            "issue_descriptions",
            "cust_assessment_source",
            "prod_grade_source",
            "purchase_app_source",
        ]

        for path, records in [
            (normal_path, batch_result["normal"]),
            (problematic_path, batch_result["problematic"]),
        ]:
            with open(path, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for r in records:
                    row = {
                        "app_id": r.app_id,
                        "cust_id": r.cust_id,
                        "prod_code": r.prod_code,
                        "suitability_verify": r.suitability_verify,
                        "material_version": r.material_version,
                        "callback_status": r.callback_status,
                        "is_pass": r.is_pass,
                        "issue_types": ";".join(
                            i.issue_type.value for i in r.issues
                        ),
                        "issue_descriptions": ";".join(
                            i.description for i in r.issues
                        ),
                        "cust_assessment_source": (
                            r.cust_assessment.get("source", "")
                            if r.cust_assessment
                            else ""
                        ),
                        "prod_grade_source": (
                            r.prod_grade.get("source", "")
                            if r.prod_grade
                            else ""
                        ),
                        "purchase_app_source": (
                            r.purchase_app.get("source", "")
                            if r.purchase_app
                            else ""
                        ),
                    }
                    writer.writerow(row)

        return normal_path, problematic_path

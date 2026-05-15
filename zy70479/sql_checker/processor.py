import json
from typing import List, Dict, Tuple
from datetime import datetime
from collections import defaultdict

from .database import Database
from .rules import RuleEngine
from .sample_data import generate_channel_receipts, save_samples_to_json, load_samples_from_file, get_default_sample_path


class CheckProcessor:
    def __init__(self, db_path: str = "sql_checker.db"):
        self.db = Database(db_path)
        self.rule_engine = RuleEngine(self.db)

    def generate_batch_no(self) -> str:
        return f"BATCH{datetime.now().strftime('%Y%m%d%H%M%S')}"

    def generate_sample_data(self, filepath: str = None) -> str:
        if not filepath:
            filepath = get_default_sample_path()
        samples = generate_channel_receipts()
        save_samples_to_json(samples, filepath)
        return filepath

    def process_file(self, filepath: str, rule_version: str = None) -> Tuple[str, Dict]:
        batch_no = self.generate_batch_no()
        samples = load_samples_from_file(filepath)

        latest_rule = self.db.get_latest_rule_version()
        actual_rule_version = rule_version if rule_version else latest_rule["version"]

        batch_id = self.db.create_batch(batch_no, actual_rule_version, filepath)

        results = {
            "batch_no": batch_no,
            "total": len(samples),
            "success": 0,
            "fail": 0,
            "skipped": 0,
            "swallowed": 0,
            "records": [],
            "summary_by_business": {}
        }

        for idx, item in enumerate(samples):
            business_no = item.get("business_no", "").strip()

            if not business_no:
                results["swallowed"] += 1
                self.db.add_record(
                    batch_id=batch_id,
                    business_no=f"SWALLOWED_{idx}",
                    source_data=item,
                    status="swallowed",
                    errors=["业务单号为空，记录被吞掉"],
                    conclusion="异常记录：缺失业务单号，无法关联，请检查数据源"
                )
                continue

            if item.get("is_dirty") and not item.get("sql"):
                results["skipped"] += 1
                self.db.add_record(
                    batch_id=batch_id,
                    business_no=business_no,
                    source_data=item,
                    status="skipped",
                    errors=["SQL内容为空，金额异常"],
                    conclusion="脏数据：SQL为空，金额为负，已跳过处理"
                )
                continue

            sql = item.get("sql", "")
            check_result = self.rule_engine.check_sql(sql, actual_rule_version)

            status = "success" if check_result.passed else "fail"
            if status == "success":
                results["success"] += 1
            else:
                results["fail"] += 1

            conclusion = self._generate_conclusion(business_no, check_result, item)

            self.db.add_record(
                batch_id=batch_id,
                business_no=business_no,
                source_data=item,
                status=status,
                check_result=check_result.details,
                errors=check_result.errors,
                corrections=check_result.corrections,
                conclusion=conclusion
            )

            results["records"].append({
                "business_no": business_no,
                "status": status,
                "errors": check_result.errors,
                "corrections": check_result.corrections,
                "conclusion": conclusion
            })

        results["summary_by_business"] = self._summarize_by_business(batch_id)
        final_summary = self._generate_final_summary(results)

        final_status = "partial_success" if 0 < results["fail"] < results["total"] else \
                       "completed" if results["fail"] == 0 else "failed"

        self.db.update_batch_status(
            batch_id=batch_id,
            status=final_status,
            total_count=results["total"],
            success_count=results["success"],
            fail_count=results["fail"],
            summary=final_summary
        )

        return batch_no, results

    def _generate_conclusion(self, business_no: str, check_result, item: Dict) -> str:
        parts = [f"业务单号[{business_no}]"]

        if check_result.errors:
            parts.append(f"发现{len(check_result.errors)}个严重问题：")
            for err in check_result.errors[:3]:
                parts.append(f"  - {err}")
        elif check_result.warnings:
            parts.append(f"发现{len(check_result.warnings)}个警告：")
            for warn in check_result.warnings[:3]:
                parts.append(f"  - {warn}")
        else:
            parts.append("SQL参数化检查通过，未发现注入风险")

        if check_result.corrections:
            parts.append("修正建议：")
            for corr in set(check_result.corrections):
                parts.append(f"  - {corr}")

        parts.append(f"数据来源：{item.get('source', '未知')}")
        parts.append(f"渠道描述：{item.get('description', '无')}")

        return "\n".join(parts)

    def _summarize_by_business(self, batch_id: int) -> Dict:
        records = self.db.get_batch_records(batch_id)
        summary = defaultdict(lambda: {
            "status": "",
            "errors": [],
            "corrections": [],
            "conclusion": "",
            "source": ""
        })

        for rec in records:
            business_no = rec["business_no"]
            source_data = json.loads(rec["source_data"])
            errors = json.loads(rec["errors"] or "[]")
            corrections = json.loads(rec["corrections"] or "[]")

            summary[business_no].update({
                "status": rec["status"],
                "errors": errors,
                "corrections": corrections,
                "conclusion": rec["conclusion"] or "",
                "source": source_data.get("source", ""),
                "channel_code": source_data.get("channel_code", ""),
                "amount": source_data.get("amount", 0)
            })

        return dict(summary)

    def _generate_final_summary(self, results: Dict) -> str:
        parts = []
        parts.append(f"批次处理完成：共{results['total']}条记录")
        parts.append(f"成功：{results['success']}条 | 失败：{results['fail']}条 | 跳过：{results['skipped']}条 | 被吞：{results['swallowed']}条")

        if results["summary_by_business"]:
            parts.append("\n===== 按业务单号汇总边缘节点清册 =====")
            for business_no, info in sorted(results["summary_by_business"].items()):
                if business_no.startswith("SWALLOWED_"):
                    continue

                status_display = {
                    "success": "✓ 通过",
                    "fail": "✗ 失败",
                    "skipped": "⊘ 跳过",
                    "swallowed": "⚠ 被吞"
                }.get(info["status"], info["status"])

                parts.append(f"\n【{business_no}】{status_display}")

                if info["errors"]:
                    parts.append("  ▶ 异常：")
                    for err in info["errors"]:
                        parts.append(f"     {err}")

                if info["corrections"]:
                    parts.append("  ▶ 修正：")
                    for corr in set(info["corrections"]):
                        parts.append(f"     {corr}")

                if info["conclusion"]:
                    parts.append("  ▶ 结论：")
                    parts.append(f"     {info['conclusion'].split(chr(10))[0]}")

        if results["swallowed"] > 0:
            parts.append(f"\n⚠ 特别注意：有{results['swallowed']}条记录因业务单号为空被吞掉！")
            parts.append("  请检查数据源，补充业务单号以确保每条记录都能被正确追踪。")

        return "\n".join(parts)

    def query_batch(self, batch_no: str) -> Dict:
        batch = self.db.get_batch(batch_no)
        if not batch:
            return {"error": f"批次[{batch_no}]不存在"}

        records = self.db.get_batch_records(batch["id"])
        rule = self.db.get_rule_version(batch["rule_version"])

        return {
            "batch_info": batch,
            "rule_info": rule,
            "records_count": len(records),
            "records": records
        }

    def query_business(self, business_no: str) -> Dict:
        records = self.db.get_record_by_business_no(business_no)
        if not records:
            return {"error": f"业务单号[{business_no}]无处理记录"}

        return {
            "business_no": business_no,
            "record_count": len(records),
            "history": records
        }

    def list_batches(self, limit: int = 50) -> List[Dict]:
        return self.db.list_batches(limit)

    def list_rule_versions(self) -> List[Dict]:
        return self.rule_engine.list_rule_versions()

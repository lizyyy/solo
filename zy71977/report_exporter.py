import json
import csv
from datetime import datetime, timedelta
from pathlib import Path
from database import Database
from config import OUTPUT_DIR, HISTORY_DIR, STATUS_CODES


class ReportExporter:
    def __init__(self):
        self.db = Database()

    def export_weekly_report(self, start_date=None, end_date=None, output_format="json"):
        if not start_date:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=7)
        
        batches = self.db.get_all_batches()
        filtered_batches = []
        for batch in batches:
            created_at = datetime.fromisoformat(batch["created_at"])
            if start_date <= created_at <= end_date:
                filtered_batches.append(batch)

        report_data = {
            "report_period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
                "generated_at": datetime.now().isoformat()
            },
            "summary": self._generate_summary(filtered_batches),
            "batches": [],
            "warnings": []
        }

        for batch in filtered_batches:
            batch_detail = self._get_batch_detail(batch)
            report_data["batches"].append(batch_detail)
            
            warnings = self.db.get_warning_records(batch["batch_id"])
            for warning in warnings:
                report_data["warnings"].append({
                    "batch_id": batch["batch_id"],
                    "batch_name": batch["batch_name"],
                    "record_id": warning["record_id"],
                    "version": warning["version"],
                    "source_type": warning["source_type"],
                    "updated_at": warning["updated_at"],
                    "changes": self.db.get_record_changes(warning["record_id"])
                })

        filename = f"weekly_report_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}"
        
        if output_format == "json":
            return self._export_json(report_data, filename)
        elif output_format == "csv":
            return self._export_csv(report_data, filename)
        else:
            raise ValueError(f"不支持的导出格式: {output_format}")

    def _generate_summary(self, batches):
        total_batches = len(batches)
        total_records = sum(b["total_records"] or 0 for b in batches)
        total_masked = sum(b["masked_count"] or 0 for b in batches)
        
        status_counts = {}
        source_counts = {}
        for b in batches:
            status_counts[b["status"]] = status_counts.get(b["status"], 0) + 1
            source_counts[b["source_type"]] = source_counts.get(b["source_type"], 0) + 1

        warning_count = len(self.db.get_warning_records())

        return {
            "total_batches": total_batches,
            "total_records": total_records,
            "total_masked": total_masked,
            "masking_rate": round(total_masked / total_records * 100, 2) if total_records > 0 else 0,
            "status_breakdown": {STATUS_CODES.get(k, k): v for k, v in status_counts.items()},
            "source_breakdown": source_counts,
            "warning_count": warning_count
        }

    def _get_batch_detail(self, batch):
        records = self.db.get_batch_records(batch["batch_id"])
        return {
            "batch_id": batch["batch_id"],
            "batch_name": batch["batch_name"],
            "source_type": batch["source_type"],
            "status": STATUS_CODES.get(batch["status"], batch["status"]),
            "total_records": batch["total_records"],
            "masked_count": batch["masked_count"],
            "created_at": batch["created_at"],
            "updated_at": batch["updated_at"],
            "remark": batch["remark"],
            "record_count": len(records),
            "records": records
        }

    def _export_json(self, data, filename):
        output_path = OUTPUT_DIR / f"{filename}.json"
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return str(output_path)

    def _export_csv(self, data, filename):
        output_path = OUTPUT_DIR / f"{filename}.csv"
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow(["【周报概览】"])
            writer.writerow(["统计周期", f"{data['report_period']['start']} 至 {data['report_period']['end']}"])
            writer.writerow(["生成时间", data['report_period']['generated_at']])
            writer.writerow([])
            
            writer.writerow(["【汇总统计】"])
            summary = data["summary"]
            writer.writerow(["总批次", summary["total_batches"]])
            writer.writerow(["总记录数", summary["total_records"]])
            writer.writerow(["脱敏记录数", summary["total_masked"]])
            writer.writerow(["脱敏率", f"{summary['masking_rate']}%"])
            writer.writerow(["异常变更数", summary["warning_count"]])
            writer.writerow([])
            
            writer.writerow(["【批次明细】"])
            writer.writerow(["批次ID", "批次名称", "来源类型", "状态", "记录数", "脱敏数", "创建时间", "备注"])
            for batch in data["batches"]:
                writer.writerow([
                    batch["batch_id"],
                    batch["batch_name"],
                    batch["source_type"],
                    batch["status"],
                    batch["total_records"],
                    batch["masked_count"],
                    batch["created_at"],
                    batch["remark"]
                ])
            writer.writerow([])
            
            writer.writerow(["【异常变更记录】"])
            writer.writerow(["批次ID", "批次名称", "记录ID", "当前版本", "来源类型", "更新时间", "变更详情"])
            for warning in data["warnings"]:
                changes_text = "; ".join([
                    f"V{c['old_version']}→V{c['new_version']}: {c['change_type']}"
                    for c in warning["changes"]
                ])
                writer.writerow([
                    warning["batch_id"],
                    warning["batch_name"],
                    warning["record_id"],
                    warning["version"],
                    warning["source_type"],
                    warning["updated_at"],
                    changes_text
                ])
        
        return str(output_path)

    def export_batch_detail(self, batch_id, output_format="json"):
        batch = self.db.get_batch(batch_id)
        if not batch:
            raise ValueError(f"批次不存在: {batch_id}")
        
        records = self.db.get_batch_records(batch_id)
        warnings = self.db.get_warning_records(batch_id)
        
        data = {
            "batch_info": batch,
            "records": records,
            "warnings": warnings,
            "exported_at": datetime.now().isoformat()
        }
        
        filename = f"batch_{batch_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        if output_format == "json":
            return self._export_json(data, filename)
        elif output_format == "csv":
            return self._export_batch_csv(data, filename)
        else:
            raise ValueError(f"不支持的导出格式: {output_format}")

    def _export_batch_csv(self, data, filename):
        output_path = OUTPUT_DIR / f"{filename}.csv"
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            batch = data["batch_info"]
            writer.writerow(["【批次信息】"])
            writer.writerow(["批次ID", batch["batch_id"]])
            writer.writerow(["批次名称", batch["batch_name"]])
            writer.writerow(["来源类型", batch["source_type"]])
            writer.writerow(["状态", STATUS_CODES.get(batch["status"], batch["status"])])
            writer.writerow(["记录数", batch["total_records"]])
            writer.writerow(["脱敏数", batch["masked_count"]])
            writer.writerow(["创建时间", batch["created_at"]])
            writer.writerow([])
            
            writer.writerow(["【记录明细】"])
            writer.writerow(["记录ID", "状态", "版本", "敏感类型", "创建时间", "更新时间"])
            for record in data["records"]:
                writer.writerow([
                    record["record_id"],
                    STATUS_CODES.get(record["status"], record["status"]),
                    record["version"],
                    record["sensitive_types"],
                    record["created_at"],
                    record["updated_at"]
                ])
        
        return str(output_path)

    def export_masked_data(self, batch_id):
        batch = self.db.get_batch(batch_id)
        if not batch:
            raise ValueError(f"批次不存在: {batch_id}")
        
        records = self.db.get_batch_records(batch_id)
        
        output_data = []
        for record in records:
            output_data.append({
                "record_id": record["record_id"],
                "source_type": record["source_type"],
                "masked_content": record["masked_content"],
                "sensitive_types": json.loads(record["sensitive_types"]) if record["sensitive_types"] else []
            })
        
        filename = f"masked_{batch_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.json"
        output_path = HISTORY_DIR / filename
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        
        return str(output_path)

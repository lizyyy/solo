import json
import csv
import os
from typing import List, Dict, Optional
from datetime import datetime
from core.models import ReplayRecord, ReplayStatus, Parameter


class PersistenceManager:
    def __init__(self, data_dir: str = "data", output_dir: str = "output"):
        self.data_dir = data_dir
        self.output_dir = output_dir
        self._ensure_dirs()

    def _ensure_dirs(self):
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.output_dir, exist_ok=True)

    def save_records_json(self, records: List[ReplayRecord], filename: str = "replay_records.json"):
        filepath = os.path.join(self.data_dir, filename)
        data = [r.to_dict() for r in records]
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return filepath

    def load_records_json(self, filename: str = "replay_records.json") -> List[ReplayRecord]:
        filepath = os.path.join(self.data_dir, filename)
        if not os.path.exists(filepath):
            return []

        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        return [ReplayRecord.from_dict(d) for d in data]

    def load_records_into_manager(self, draft_manager) -> int:
        records = self.load_records_json()
        for record in records:
            if record.problem_id not in draft_manager._records:
                draft_manager._records[record.problem_id] = []
            draft_manager._records[record.problem_id].append(record)
            draft_manager._record_index[record.record_id] = record
        return len(records)

    def export_summary_csv(self, records: List[ReplayRecord], filename: str = "replay_summary.csv") -> str:
        filepath = os.path.join(self.output_dir, filename)

        fieldnames = [
            "记录ID", "题目ID", "题目名称", "版本", "状态",
            "最终结果", "结果单位", "失败原因", "失败详情",
            "是否边界样本", "边界类型", "边界判定依据",
            "创建人", "创建时间", "更新时间", "备注",
        ]

        with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for r in records:
                writer.writerow({
                    "记录ID": r.record_id,
                    "题目ID": r.problem_id,
                    "题目名称": r.problem_title,
                    "版本": r.version,
                    "状态": r.status.value,
                    "最终结果": r.final_result if r.final_result is not None else "",
                    "结果单位": r.final_unit if r.final_unit else "",
                    "失败原因": r.fail_reason if r.fail_reason else "",
                    "失败详情": r.fail_detail if r.fail_detail else "",
                    "是否边界样本": "是" if r.is_boundary else "否",
                    "边界类型": r.boundary_type if r.boundary_type else "",
                    "边界判定依据": r.boundary_evidence if r.boundary_evidence else "",
                    "创建人": r.created_by,
                    "创建时间": r.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                    "更新时间": r.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
                    "备注": r.remark,
                })

        return filepath

    def export_detail_csv(self, record: ReplayRecord, filename: str = None) -> str:
        if not filename:
            filename = f"{record.record_id}_detail.csv"
        filepath = os.path.join(self.output_dir, filename)

        with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)

            writer.writerow(["【基本信息】"])
            writer.writerow(["记录ID", record.record_id])
            writer.writerow(["题目ID", record.problem_id])
            writer.writerow(["题目名称", record.problem_title])
            writer.writerow(["版本", record.version])
            writer.writerow(["状态", record.status.value])
            writer.writerow(["最终结果", record.final_result if record.final_result is not None else ""])
            writer.writerow(["结果单位", record.final_unit if record.final_unit else ""])
            writer.writerow(["失败原因", record.fail_reason if record.fail_reason else ""])
            writer.writerow(["失败详情", record.fail_detail if record.fail_detail else ""])
            writer.writerow(["是否边界样本", "是" if record.is_boundary else "否"])
            writer.writerow(["边界类型", record.boundary_type if record.boundary_type else ""])
            writer.writerow(["边界判定依据", record.boundary_evidence if record.boundary_evidence else ""])
            writer.writerow(["创建人", record.created_by])
            writer.writerow(["创建时间", record.created_at.strftime("%Y-%m-%d %H:%M:%S")])
            writer.writerow(["更新时间", record.updated_at.strftime("%Y-%m-%d %H:%M:%S")])
            writer.writerow([])

            writer.writerow(["【参数列表】"])
            writer.writerow(["参数名", "数值", "单位", "来源"])
            for p in record.parameters:
                writer.writerow([p.name, p.value, p.unit, p.source])
            writer.writerow([])

            writer.writerow(["【计算步骤】"])
            writer.writerow(["步骤名", "公式", "输入参数", "输入单位", "结果值", "结果单位", "错误信息"])
            for s in record.steps:
                input_vals = "; ".join(f"{k}={v}" for k, v in s.input_values.items())
                input_units = "; ".join(f"{k}={v}" for k, v in s.input_units.items())
                writer.writerow([
                    s.step_name,
                    s.formula,
                    input_vals,
                    input_units,
                    s.result_value if s.result_value is not None else "",
                    s.result_unit if s.result_unit else "",
                    s.error_msg if s.error_msg else "",
                ])
            writer.writerow([])

            if record.is_boundary and record.boundary_evidence:
                writer.writerow(["【边界分析】"])
                writer.writerow(["卡点分类", record.boundary_type if record.boundary_type else ""])
                for line in record.boundary_evidence.split("\n"):
                    writer.writerow([line])
                writer.writerow([])

            writer.writerow(["【备注记录】"])
            if record.remark:
                for line in record.remark.split("\n"):
                    writer.writerow([line])
            else:
                writer.writerow(["(暂无备注)"])

        return filepath

    def export_comparison_csv(self, comparison: Dict, filename: str) -> str:
        filepath = os.path.join(self.output_dir, filename)

        with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)

            writer.writerow(["【参数对照】"])
            writer.writerow(["参数名", "A组数值", "B组数值", "A组单位", "B组单位", "有差异"])
            for pd in comparison["params_diff"]:
                writer.writerow([
                    pd["name"],
                    pd["value_a"],
                    pd["value_b"],
                    pd["unit_a"],
                    pd["unit_b"],
                    "是" if pd["has_diff"] else "否",
                ])
            writer.writerow([])

            writer.writerow(["【步骤对照】"])
            writer.writerow(["步骤", "步骤名", "A结果", "B结果", "A单位", "B单位", "有差异", "A错误", "B错误"])
            for sd in comparison["steps_diff"]:
                writer.writerow([
                    sd["step_index"],
                    sd["step_name"],
                    sd["result_a"] if sd["result_a"] is not None else "",
                    sd["result_b"] if sd["result_b"] is not None else "",
                    sd["unit_a"] if sd["unit_a"] else "",
                    sd["unit_b"] if sd["unit_b"] else "",
                    "是" if sd["has_diff"] else "否",
                    sd["error_a"] if sd["error_a"] else "",
                    sd["error_b"] if sd["error_b"] else "",
                ])
            writer.writerow([])

            writer.writerow(["【最终结果对比】"])
            rd = comparison["result_diff"]
            if rd:
                writer.writerow(["", "A组", "B组", "单位"])
                writer.writerow(["最终值", rd["value_a"], rd["value_b"], rd["unit"]])
                writer.writerow(["绝对差", rd["abs_diff"], "", ""])
                writer.writerow(["相对差(%)", rd["pct_diff"], "", ""])
            else:
                writer.writerow(["无法对比（记录不完整）"])

        return filepath

    def import_from_csv(self, filepath: str) -> List[Dict]:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"文件不存在: {filepath}")

        records_data = []
        with open(filepath, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                records_data.append(dict(row))

        return records_data

    def verify_csv_consistency(self, records: List[ReplayRecord], csv_filepath: str) -> Dict:
        if not os.path.exists(csv_filepath):
            return {"consistent": False, "reason": "CSV文件不存在"}

        csv_records = {}
        with open(csv_filepath, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                csv_records[row["记录ID"]] = row

        issues = []
        for record in records:
            csv_row = csv_records.get(record.record_id)
            if not csv_row:
                issues.append(f"记录 {record.record_id} 在CSV中不存在")
                continue

            if csv_row["状态"] != record.status.value:
                issues.append(f"记录 {record.record_id} 状态不一致: 内存={record.status.value}, CSV={csv_row['状态']}")

            if record.final_result is not None:
                csv_result = float(csv_row["最终结果"]) if csv_row["最终结果"] else None
                if csv_result and abs(csv_result - record.final_result) > 0.0001:
                    issues.append(f"记录 {record.record_id} 结果不一致: 内存={record.final_result}, CSV={csv_result}")

            csv_remark = csv_row.get("备注", "")
            if csv_remark != record.remark:
                issues.append(f"记录 {record.record_id} 备注不一致: 内存='{record.remark}', CSV='{csv_remark}'")

            csv_boundary_type = csv_row.get("边界类型", "")
            expected_boundary_type = record.boundary_type if record.boundary_type else ""
            if csv_boundary_type != expected_boundary_type:
                issues.append(f"记录 {record.record_id} 边界分类不一致: 内存='{expected_boundary_type}', CSV='{csv_boundary_type}'")

            csv_boundary_evidence = csv_row.get("边界判定依据", "")
            expected_evidence = record.boundary_evidence if record.boundary_evidence else ""
            if csv_boundary_evidence != expected_evidence:
                issues.append(f"记录 {record.record_id} 边界判定依据不一致")

            detail_filename = f"{record.record_id}_detail.csv"
            detail_path = os.path.join(self.output_dir, detail_filename)
            if os.path.exists(detail_path):
                detail_issues = self._verify_detail_csv_consistency(record, detail_path)
                issues.extend(detail_issues)

        return {
            "consistent": len(issues) == 0,
            "total_records": len(records),
            "csv_records": len(csv_records),
            "issues": issues,
        }

    def _verify_detail_csv_consistency(self, record: ReplayRecord, detail_path: str) -> List[str]:
        issues = []
        try:
            with open(detail_path, "r", encoding="utf-8-sig") as f:
                content = f.read()

            if record.is_boundary and record.boundary_type:
                if record.boundary_type not in content:
                    issues.append(f"记录 {record.record_id} 明细CSV中缺少边界分类'{record.boundary_type}'")

            if record.boundary_evidence:
                first_evidence_line = record.boundary_evidence.split("\n")[0]
                if first_evidence_line not in content:
                    issues.append(f"记录 {record.record_id} 明细CSV中缺少边界判定依据")

            if record.remark:
                first_remark_line = record.remark.split("\n")[0]
                if first_remark_line not in content:
                    issues.append(f"记录 {record.record_id} 明细CSV中备注内容不一致")

        except Exception as e:
            issues.append(f"记录 {record.record_id} 明细CSV读取失败: {str(e)}")

        return issues

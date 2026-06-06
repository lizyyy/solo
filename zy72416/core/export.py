import csv
import json
from typing import List
from .single_source import SingleSourceOfTruth


class ExportService:
    """
    导出服务 - 必须从单一数据源读取
    确保导出的明细与页面展示、接口返回完全一致
    """

    def __init__(self, source_of_truth: SingleSourceOfTruth):
        self.source = source_of_truth

    def export_to_csv(self, output_path: str):
        """导出为CSV格式"""
        records = self.source.get_for_export()
        if not records:
            return

        fieldnames = list(records[0].keys())
        with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(records)

    def export_to_json(self, output_path: str):
        """导出为JSON格式"""
        records = self.source.get_for_export()
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(records, f, ensure_ascii=False, indent=2)

    def export_abnormal_only(self, output_path: str, format: str = "csv"):
        """仅导出异常记录"""
        all_records = self.source.get_for_export()
        abnormal = [r for r in all_records if r["状态"] not in ["正常", "待处理"]]
        if format == "csv":
            if abnormal:
                fieldnames = list(abnormal[0].keys())
                with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
                    writer = csv.DictWriter(f, fieldnames=fieldnames)
                    writer.writeheader()
                    writer.writerows(abnormal)
        else:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(abnormal, f, ensure_ascii=False, indent=2)

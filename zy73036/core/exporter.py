import csv
import json
import os
from typing import Dict, List, Any
from .models import ProcessingStatus, AnomalyRecord, HistoryChange


class Exporter:
    def __init__(self, output_dir: str = None):
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.output_dir = output_dir or os.path.join(base, "output")
        os.makedirs(self.output_dir, exist_ok=True)

    def export_anomaly_queue_csv(self, records: List[Dict], filename: str = "异常队列.csv",
                                filters_used: Dict = None):
        path = os.path.join(self.output_dir, filename)
        if not records:
            with open(path, "w", encoding="utf-8-sig") as f:
                f.write("(空异常队列")
            return path
        fieldnames = self._unique_keys(records)
        self._write_csv(path, records, fieldnames)
        self._save_filters_meta(path, filters_used)
        return path

    def export_anomaly_queue_xlsx(self, records: List[Dict], filename: str = "异常队列.xlsx",
                                  filters_used: Dict = None):
        path = os.path.join(self.output_dir, filename)
        try:
            from openpyxl import Workbook
            wb = Workbook()
            ws = wb.active
            ws.title = "异常队列"
            if not records:
                ws["A1"] = "(空异常队列)"
                wb.save(path)
                return path
            keys = self._unique_keys(records)
            for c, k in enumerate(keys, start=1):
                ws.cell(row=1, column=c, value=k)
            for r, rec in enumerate(records, start=2):
                for c, k in enumerate(keys, start=1):
                    v = rec.get(k, "")
                    if isinstance(v, (list, dict)):
                        v = json.dumps(v, ensure_ascii=False)
                    ws.cell(row=r, column=c, value=v)
            ws2 = wb.create_sheet("筛选口径")
            ws2["A1"] = "筛选口径说明：导出时生效的筛选条件与屏幕一致"
            if filters_used:
                for i, (k, v) in enumerate(filters_used.items(), start=2):
                    ws2.cell(row=i, column=1, value=k)
                    ws2.cell(row=i, column=2, value=str(v))
            wb.save(path)
            return path
        except ImportError:
            csv_path = path.replace(".xlsx", ".csv")
            return self.export_anomaly_queue_csv(records, os.path.basename(csv_path), filters_used)

    def export_curves_csv(self, curves: Dict, filename: str = "体重曲线.json"):
        path = os.path.join(self.output_dir, filename)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(curves, f, ensure_ascii=False, indent=2, default=str)
        return path

    def export_history_csv(self, history: List, filename: str = "变更历史.csv"):
        path = os.path.join(self.output_dir, filename)
        records = [h.to_dict() if hasattr(h, "to_dict") else h for h in history]
        fieldnames = self._unique_keys(records)
        self._write_csv(path, records, fieldnames)
        return path

    def export_records_debug(self, records: List, filename: str = "体重记录明细.csv"):
        path = os.path.join(self.output_dir, filename)
        dicts = [r.to_dict() if hasattr(r, "to_dict") else r for r in records]
        fieldnames = self._unique_keys(dicts)
        self._write_csv(path, dicts, fieldnames)
        return path

    @staticmethod
    def _unique_keys(records: List[Dict]) -> List[str]:
        seen = []
        for r in records:
            for k in r.keys():
                if k not in seen:
                    seen.append(k)
        return seen

    @staticmethod
    def _write_csv(path: str, records: List[Dict], fieldnames: List[str]):
        with open(path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for r in records:
                row = {}
                for k in fieldnames:
                    v = r.get(k, "")
                    if isinstance(v, (list, dict)):
                        v = json.dumps(v, ensure_ascii=False)
                    row[k] = v
                writer.writerow(row)

    @staticmethod
    def _save_filters_meta(base_path: str, filters_used: Dict = None):
        meta_path = base_path + ".filters.json"
        meta = {
            "generated_at": __import__("datetime").datetime.now().isoformat(),
            "filters_applied": filters_used or {},
            "note": "本文件导出时使用的筛选口径与屏幕显示一致，请勿另起一套"
        }
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

import os
import json
import pandas as pd
from datetime import datetime
from pathlib import Path
from typing import List, Set

from .models import ClaimRecord, ProcessResult
from .parser import ClaimFileParser


class ClaimProcessor:
    def __init__(self, output_dir: str = "output"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.record_file = self.output_dir / "processed_records.json"
        self.existing_keys: Set[str] = self._load_existing_keys()
        
        self.parser = ClaimFileParser()

    def _load_existing_keys(self) -> Set[str]:
        if self.record_file.exists():
            try:
                with open(self.record_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return set(data.get("processed_keys", []))
            except Exception:
                return set()
        return set()

    def _save_keys(self):
        data = {
            "processed_keys": list(self.existing_keys),
            "last_update": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        with open(self.record_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def process_inputs(self, input_paths: List[str]) -> ProcessResult:
        result = ProcessResult(success=True)
        all_records: List[ClaimRecord] = []

        files_to_process = []
        for path in input_paths:
            if os.path.isfile(path):
                files_to_process.append(path)
            elif os.path.isdir(path):
                for ext in self.parser.supported_formats:
                    files_to_process.extend(Path(path).glob(f"*{ext}"))
                    files_to_process.extend(Path(path).glob(f"*{ext.upper()}"))
            else:
                result.add_failure(path, "路径不存在或不可访问")

        files_to_process = sorted(set(str(f) for f in files_to_process))

        if not files_to_process:
            result.add_failure("输入路径", "未找到任何可处理的文件")
            result.success = False
            return result

        for filepath in files_to_process:
            records = self.parser.parse_file(filepath, result)
            all_records.extend(records)

        result.total_records = len(all_records)

        unique_records = []
        for record in all_records:
            key = record.get_unique_key()
            if key in self.existing_keys:
                result.skipped_records += 1
            else:
                unique_records.append(record)
                self.existing_keys.add(key)

        result.records = unique_records
        result.new_records = len(unique_records)

        if unique_records:
            self._save_output(unique_records)
            self._save_keys()

        return result

    def _save_output(self, records: List[ClaimRecord]):
        if not records:
            return

        output_file = self.output_dir / "cold_chain_claim_records.xlsx"
        df_new = pd.DataFrame([r.to_dict() for r in records])

        if output_file.exists():
            try:
                df_existing = pd.read_excel(output_file)
                df_combined = pd.concat([df_existing, df_new], ignore_index=True)
                df_combined.drop_duplicates(subset=["赔付单号", "批次号", "仓库编码"], keep="first", inplace=True)
                df_combined.to_excel(output_file, index=False)
            except Exception:
                df_new.to_excel(output_file, index=False)
        else:
            df_new.to_excel(output_file, index=False)

        self._save_error_report()

    def _save_error_report(self):
        error_file = self.output_dir / "error_report.txt"
        with open(error_file, "w", encoding="utf-8") as f:
            f.write("冷链小仓冷链赔付材料处理错误报告\n")
            f.write("=" * 50 + "\n")
            f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

    def reset(self):
        self.existing_keys = set()
        if self.record_file.exists():
            self.record_file.unlink()

    def get_summary(self) -> dict:
        return {
            "total_processed": len(self.existing_keys),
            "output_dir": str(self.output_dir),
        }

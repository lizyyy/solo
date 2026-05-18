#!/usr/bin/env python3
import os
import sys
import csv
import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple, Any

VALID_ROTATIONS = {"无", "0度", "90度", "180度"}
STANDARD_LENGTHS_MM = {2440, 1800, 1220, 1200, 1000, 900, 800, 600, 500, 450, 400, 300, 200, 150}
STANDARD_WIDTHS_MM = {1220, 1000, 900, 750, 600, 500, 450, 400, 300, 200, 150}


class OffcutMatcherError(Exception):
    pass


class ErrorCounter:
    def __init__(self):
        self.unit_mismatch: List[Dict] = []
        self.rotation_errors: List[Dict] = []
        self.format_errors: List[Dict] = []
        self.duplicate_rows: List[Dict] = []
        self.missing_columns: List[Dict] = []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "unit_mismatch_count": len(self.unit_mismatch),
            "unit_mismatch_details": self.unit_mismatch,
            "rotation_errors_count": len(self.rotation_errors),
            "rotation_errors_details": self.rotation_errors,
            "format_errors_count": len(self.format_errors),
            "format_errors_details": self.format_errors,
            "duplicate_rows_count": len(self.duplicate_rows),
            "duplicate_rows_details": self.duplicate_rows,
            "missing_columns_count": len(self.missing_columns),
            "missing_columns_details": self.missing_columns,
            "total_errors": (
                len(self.unit_mismatch)
                + len(self.rotation_errors)
                + len(self.format_errors)
                + len(self.duplicate_rows)
                + len(self.missing_columns)
            ),
        }


class OffcutMatcher:
    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.processed_files: Dict[str, str] = {}
        self._load_state()

    def _load_state(self):
        state_file = self.output_dir / "processing_state.json"
        if state_file.exists():
            with open(state_file, "r", encoding="utf-8") as f:
                state = json.load(f)
                self.processed_files = state.get("processed_files", {})

    def _save_state(self):
        state_file = self.output_dir / "processing_state.json"
        state = {
            "run_id": self.run_id,
            "processed_at": datetime.now().isoformat(),
            "processed_files": self.processed_files,
        }
        with open(state_file, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)

    def _is_already_processed(self, file_path: str) -> bool:
        file_key = str(Path(file_path).resolve())
        return file_key in self.processed_files

    def _mark_processed(self, file_path: str, status: str):
        file_key = str(Path(file_path).resolve())
        self.processed_files[file_key] = {
            "status": status,
            "processed_at": datetime.now().isoformat(),
            "run_id": self.run_id,
        }
        self._save_state()

    def detect_unit_mismatch(
        self, row: Dict, row_num: int, filename: str
    ) -> List[Dict]:
        errors = []
        length_cols = [
            k for k in row.keys() if "长度" in k or "宽度" in k or "厚度" in k
        ]

        for col in length_cols:
            try:
                value = int(row[col].strip()) if row[col].strip() else 0

                if col.endswith("(cm)"):
                    value_mm = value * 10
                    errors.append(
                        {
                            "row": row_num,
                            "column": col,
                            "value": value,
                            "expected_unit": "mm",
                            "detected_unit": "cm",
                            "converted_value_mm": value_mm,
                            "filename": filename,
                            "error_type": "单位混用 - 厘米/毫米",
                        }
                    )
                elif value > 0 and value < 100:
                    if value * 10 in STANDARD_LENGTHS_MM or value * 10 in STANDARD_WIDTHS_MM:
                        errors.append(
                            {
                                "row": row_num,
                                "column": col,
                                "value": value,
                                "expected_unit": "mm",
                                "detected_unit": "cm (suspected)",
                                "converted_value_mm": value * 10,
                                "filename": filename,
                                "error_type": "单位混用 - 疑似厘米值",
                            }
                        )
            except (ValueError, TypeError):
                pass

        return errors

    def detect_rotation_errors(
        self, row: Dict, row_num: int, filename: str
    ) -> List[Dict]:
        errors = []
        rot_col = None
        for k in row.keys():
            if "旋转" in k:
                rot_col = k
                break

        if rot_col and row[rot_col]:
            rot_value = row[rot_col].strip()
            if rot_value not in VALID_ROTATIONS:
                errors.append(
                    {
                        "row": row_num,
                        "column": rot_col,
                        "value": rot_value,
                        "valid_values": sorted(list(VALID_ROTATIONS)),
                        "filename": filename,
                        "error_type": "旋转限制错误",
                    }
                )

        return errors

    def process_file(self, file_path: str, rerun: bool = False) -> Dict[str, Any]:
        filename = os.path.basename(file_path)

        if not rerun and self._is_already_processed(file_path):
            return {
                "filename": filename,
                "status": "skipped",
                "message": "Already processed in previous run",
            }

        errors = ErrorCounter()
        valid_rows = []
        seen_rows = set()

        try:
            file_size = os.path.getsize(file_path)
            if file_size == 0:
                self._mark_processed(file_path, "empty")
                return {
                    "filename": filename,
                    "status": "empty",
                    "total_rows": 0,
                    "valid_rows": 0,
                    **errors.to_dict(),
                }

            with open(file_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                headers = reader.fieldnames or []

                if len(headers) == 0:
                    self._mark_processed(file_path, "error")
                    return {
                        "filename": filename,
                        "status": "error",
                        "error": "No headers found",
                        **errors.to_dict(),
                    }

                expected_cols = max(10, len(headers))

                for row_num, row in enumerate(reader, start=2):
                    row_key = "|".join(
                        str(row.get(h, "")).strip() for h in headers[:5]
                    )

                    if row_key in seen_rows:
                        errors.duplicate_rows.append(
                            {
                                "row": row_num,
                                "key": row_key,
                                "filename": filename,
                                "error_type": "重复行",
                            }
                        )
                        continue
                    seen_rows.add(row_key)

                    actual_cols = sum(1 for v in row.values() if v is not None)
                    if actual_cols < expected_cols:
                        errors.missing_columns.append(
                            {
                                "row": row_num,
                                "expected_columns": expected_cols,
                                "actual_columns": actual_cols,
                                "filename": filename,
                                "error_type": "缺列",
                            }
                        )
                        continue

                    unit_errors = self.detect_unit_mismatch(row, row_num, filename)
                    errors.unit_mismatch.extend(unit_errors)

                    rot_errors = self.detect_rotation_errors(row, row_num, filename)
                    errors.rotation_errors.extend(rot_errors)

                    if not unit_errors and not rot_errors:
                        valid_rows.append(row)

            self._mark_processed(file_path, "success")

            return {
                "filename": filename,
                "status": "success",
                "total_rows": len(seen_rows) + len(errors.duplicate_rows),
                "valid_rows": len(valid_rows),
                "headers": headers,
                "data": sorted(valid_rows, key=lambda x: str(x.get(headers[0], ""))),
                **errors.to_dict(),
            }

        except Exception as e:
            self._mark_processed(file_path, "error")
            errors.format_errors.append(
                {
                    "row": 0,
                    "error": str(e),
                    "filename": filename,
                    "error_type": "文件读取/解析错误",
                }
            )
            return {
                "filename": filename,
                "status": "error",
                "error": str(e),
                **errors.to_dict(),
            }

    def process_directory(self, dir_path: str, rerun: bool = False) -> Dict[str, Any]:
        results = []
        summary = ErrorCounter()

        path = Path(dir_path)
        csv_files = sorted(path.glob("*.csv"))

        for csv_file in csv_files:
            result = self.process_file(str(csv_file), rerun=rerun)
            results.append(result)

            summary.unit_mismatch.extend(result.get("unit_mismatch_details", []))
            summary.rotation_errors.extend(result.get("rotation_errors_details", []))
            summary.format_errors.extend(result.get("format_errors_details", []))
            summary.duplicate_rows.extend(result.get("duplicate_rows_details", []))
            summary.missing_columns.extend(result.get("missing_columns_details", []))

        successful = sum(1 for r in results if r["status"] == "success")
        skipped = sum(1 for r in results if r["status"] == "skipped")
        empty_files = sum(1 for r in results if r["status"] == "empty")
        failed = sum(1 for r in results if r["status"] == "error")

        output = {
            "run_id": self.run_id,
            "directory": dir_path,
            "total_files": len(results),
            "successful": successful,
            "skipped": skipped,
            "empty_files": empty_files,
            "failed": failed,
            "file_results": sorted(results, key=lambda x: x["filename"]),
            **summary.to_dict(),
        }

        output_file = self.output_dir / f"result_{self.run_id}.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2, sort_keys=True)

        return output


def print_summary(results: Dict[str, Any]):
    print(f"\n{'='*60}")
    print(f"家具定制厂板材余料匹配 - 处理报告")
    print(f"运行ID: {results['run_id']}")
    print(f"处理目录: {results['directory']}")
    print(f"{'='*60}")

    print(f"\n文件统计:")
    print(f"  总文件数: {results['total_files']}")
    print(f"  成功处理: {results['successful']}")
    print(f"  跳过(已处理): {results['skipped']}")
    print(f"  空文件: {results['empty_files']}")
    print(f"  失败: {results['failed']}")

    print(f"\n错误分类统计:")
    print(f"  毫米/厘米混用: {results['unit_mismatch_count']}")
    print(f"  旋转限制错误: {results['rotation_errors_count']}")
    print(f"  格式错误: {results['format_errors_count']}")
    print(f"  重复行: {results['duplicate_rows_count']}")
    print(f"  缺列: {results['missing_columns_count']}")
    print(f"  总错误数: {results['total_errors']}")

    if results["unit_mismatch_details"]:
        print(f"\n毫米/厘米混用详情 (前5条):")
        for err in results["unit_mismatch_details"][:5]:
            print(f"  {err['filename']} 行{err['row']}: {err['column']}={err['value']} -> {err['error_type']}")

    if results["rotation_errors_details"]:
        print(f"\n旋转限制错误详情 (前5条):")
        for err in results["rotation_errors_details"][:5]:
            print(f"  {err['filename']} 行{err['row']}: '{err['value']}' 不在有效值 {err['valid_values']}")

    if results["duplicate_rows_details"]:
        print(f"\n重复行详情 (前5条):")
        for err in results["duplicate_rows_details"][:5]:
            print(f"  {err['filename']} 行{err['row']}: 重复记录")

    if results["missing_columns_details"]:
        print(f"\n缺列详情 (前5条):")
        for err in results["missing_columns_details"][:5]:
            print(f"  {err['filename']} 行{err['row']}: 缺{err['expected_columns'] - err['actual_columns']}列")

    print(f"\n结果文件已保存到 output/result_{results['run_id']}.json")
    print(f"{'='*60}\n")


def main():
    parser = argparse.ArgumentParser(
        description="家具定制厂板材余料匹配 CLI - 数据验证与错误统计工具"
    )
    parser.add_argument(
        "directory",
        nargs="?",
        default=".",
        help="要处理的目录路径 (默认: 当前目录)",
    )
    parser.add_argument(
        "--output", "-o", default="./output", help="输出目录 (默认: ./output)"
    )
    parser.add_argument(
        "--rerun", "-r", action="store_true", help="重新处理所有文件(忽略已处理状态)"
    )
    parser.add_argument(
        "--good", action="store_true", help="仅处理good目录(正常文件)"
    )
    parser.add_argument(
        "--bad", action="store_true", help="仅处理bad目录(错误文件)"
    )
    parser.add_argument(
        "--test", action="store_true", help="运行所有测试用例"
    )

    args = parser.parse_args()

    base_path = Path(args.directory)

    if args.test:
        print("运行完整测试...")
        matcher = OffcutMatcher(args.output)
        all_results = []

        for subdir in ["good", "bad", "empty", "tests"]:
            subdir_path = base_path / subdir
            if subdir_path.exists():
                print(f"\n处理 {subdir} 目录...")
                result = matcher.process_directory(str(subdir_path), rerun=True)
                all_results.append((subdir, result))
                print_summary(result)

        print("\n" + "="*60)
        print("完整测试运行完成!")
        print("="*60)
        return

    process_dirs = []
    if args.good:
        process_dirs.append(str(base_path / "good"))
    elif args.bad:
        process_dirs.append(str(base_path / "bad"))
    else:
        process_dirs.append(args.directory)

    matcher = OffcutMatcher(args.output)

    for dir_path in process_dirs:
        if Path(dir_path).exists():
            results = matcher.process_directory(dir_path, rerun=args.rerun)
            print_summary(results)
        else:
            print(f"错误: 目录不存在 - {dir_path}")
            sys.exit(1)


if __name__ == "__main__":
    main()

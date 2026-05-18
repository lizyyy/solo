#!/usr/bin/env python3
import csv
import os
import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple


class ReconciliationConfig:
    DEFAULT_CONFIG = {
        "required_columns": [
            "交易日期", "会员ID", "会员姓名", "课包ID", "课包名称",
            "课程类型", "教练ID", "教练姓名", "消耗课时", "剩余课时",
            "交易类型", "备注", "操作人", "门店ID"
        ],
        "transaction_types": ["正常消课", "赠课消耗", "转让消课", "课包冻结", "课包解冻"],
        "gift_course_keywords": ["赠课", "活动", "奖励", "节日"],
        "transfer_keywords": ["转让", "转赠"],
        "freeze_keywords": ["冻结", "解冻", "请假", "假期"],
        "output_dir": "reports",
        "continue_on_failure": True,
        "deduplicate": True,
        "encoding": "utf-8"
    }

    def __init__(self, config_path: Optional[str] = None):
        self.config = self.DEFAULT_CONFIG.copy()
        if config_path and os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as f:
                user_config = json.load(f)
                self.config.update(user_config)

    def __getitem__(self, key: str) -> Any:
        return self.config.get(key)


class ReconciliationResult:
    def __init__(self):
        self.total_files = 0
        self.success_files = 0
        self.failed_files = 0
        self.total_rows = 0
        self.valid_rows = 0
        self.invalid_rows = 0
        self.duplicate_rows = 0
        self.empty_files = 0
        self.errors: List[Dict[str, Any]] = []
        self.gift_courses: List[Dict[str, Any]] = []
        self.transfers: List[Dict[str, Any]] = []
        self.freezes: List[Dict[str, Any]] = []
        self.retryable: List[Dict[str, Any]] = []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "summary": {
                "total_files": self.total_files,
                "success_files": self.success_files,
                "failed_files": self.failed_files,
                "total_rows": self.total_rows,
                "valid_rows": self.valid_rows,
                "invalid_rows": self.invalid_rows,
                "duplicate_rows": self.duplicate_rows,
                "empty_files": self.empty_files
            },
            "gift_courses": self.gift_courses,
            "transfers": self.transfers,
            "freezes": self.freezes,
            "retryable_items": self.retryable,
            "errors": self.errors
        }


class GymCourseReconciler:
    def __init__(self, config: ReconciliationConfig):
        self.config = config
        self.result = ReconciliationResult()
        self.seen_rows = set()

    def _get_row_hash(self, row: Dict[str, str]) -> str:
        row_str = '|'.join([str(row.get(col, '')) for col in sorted(row.keys())])
        return hashlib.md5(row_str.encode('utf-8')).hexdigest()

    def _validate_row(self, row: Dict[str, str], file_path: str, row_num: int) -> Tuple[bool, List[str]]:
        errors = []
        required_cols = self.config["required_columns"]
        
        for col in required_cols:
            if col not in row or not str(row[col]).strip():
                if col in ["消耗课时", "剩余课时"]:
                    errors.append(f"列 '{col}' 值无效: '{row.get(col, '')}'")
                elif col not in ["备注"]:
                    errors.append(f"缺少必填列: '{col}'")
        
        if "消耗课时" in row:
            try:
                val = float(row["消耗课时"])
                if val < 0:
                    errors.append(f"消耗课时不能为负数: {val}")
            except (ValueError, TypeError):
                errors.append(f"消耗课时格式错误: '{row['消耗课时']}'")
        
        if "剩余课时" in row:
            try:
                val = float(row["剩余课时"])
                if val < 0:
                    errors.append(f"剩余课时不能为负数: {val}")
            except (ValueError, TypeError):
                errors.append(f"剩余课时格式错误: '{row['剩余课时']}'")
        
        return len(errors) == 0, errors

    def _classify_transaction(self, row: Dict[str, str], file_path: str, row_num: int) -> None:
        tx_type = row.get("交易类型", "")
        remark = row.get("备注", "")
        course_name = row.get("课包名称", "")
        
        full_text = f"{tx_type} {remark} {course_name}"
        
        source_info = {
            "source_file": os.path.basename(file_path),
            "source_file_path": file_path,
            "row_number": row_num,
            "data": row
        }
        
        if any(kw in full_text for kw in self.config["gift_course_keywords"]):
            self.result.gift_courses.append(source_info)
        elif any(kw in full_text for kw in self.config["transfer_keywords"]):
            self.result.transfers.append(source_info)
        elif any(kw in full_text for kw in self.config["freeze_keywords"]):
            self.result.freezes.append(source_info)

    def process_file(self, file_path: str) -> bool:
        self.result.total_files += 1
        file_name = os.path.basename(file_path)
        
        try:
            file_size = os.path.getsize(file_path)
            if file_size == 0:
                self.result.empty_files += 1
                self.result.errors.append({
                    "file": file_name,
                    "error": "文件为空（0字节）",
                    "type": "empty_file"
                })
                return False
            
            with open(file_path, 'r', encoding=self.config["encoding"]) as f:
                content = f.read().strip()
                if not content:
                    self.result.empty_files += 1
                    self.result.errors.append({
                        "file": file_name,
                        "error": "文件只有表头或为空",
                        "type": "empty_content"
                    })
                    return False
                
                f.seek(0)
                reader = csv.DictReader(f)
                
                if not reader.fieldnames:
                    self.result.errors.append({
                        "file": file_name,
                        "error": "无法读取CSV表头",
                        "type": "invalid_csv"
                    })
                    return False
                
                missing_cols = set(self.config["required_columns"]) - set(reader.fieldnames)
                if missing_cols:
                    self.result.errors.append({
                        "file": file_name,
                        "error": f"缺少列: {', '.join(missing_cols)}",
                        "type": "missing_columns",
                        "missing_columns": list(missing_cols)
                    })
                    self.result.retryable.append({
                        "file": file_name,
                        "reason": f"缺少列: {', '.join(missing_cols)}",
                        "fix_hint": "补充缺失列后可重新处理"
                    })
                    return False
                
                rows = list(reader)
                if len(rows) == 0:
                    self.result.empty_files += 1
                    return False
                
                file_valid = True
                for row_num, row in enumerate(rows, start=2):
                    self.result.total_rows += 1
                    
                    if self.config["deduplicate"]:
                        row_hash = self._get_row_hash(row)
                        if row_hash in self.seen_rows:
                            self.result.duplicate_rows += 1
                            self.result.errors.append({
                                "file": file_name,
                                "row": row_num,
                                "error": "重复行",
                                "type": "duplicate_row"
                            })
                            continue
                        self.seen_rows.add(row_hash)
                    
                    is_valid, errors = self._validate_row(row, file_path, row_num)
                    if not is_valid:
                        self.result.invalid_rows += 1
                        file_valid = False
                        for err in errors:
                            self.result.errors.append({
                                "file": file_name,
                                "row": row_num,
                                "error": err,
                                "type": "validation_error"
                            })
                        self.result.retryable.append({
                            "file": file_name,
                            "row": row_num,
                            "reason": "; ".join(errors),
                            "fix_hint": "修正数据格式后可重新处理",
                            "data": row
                        })
                    else:
                        self.result.valid_rows += 1
                        self._classify_transaction(row, file_path, row_num)
                
                if file_valid:
                    self.result.success_files += 1
                else:
                    self.result.failed_files += 1
                
                return file_valid
                
        except Exception as e:
            self.result.failed_files += 1
            self.result.errors.append({
                "file": file_name,
                "error": f"处理异常: {str(e)}",
                "type": "processing_exception"
            })
            self.result.retryable.append({
                "file": file_name,
                "reason": f"处理异常: {str(e)}",
                "fix_hint": "检查文件格式和编码后可重新处理"
            })
            return False

    def process_directory(self, dir_path: str) -> ReconciliationResult:
        path = Path(dir_path)
        csv_files = sorted(path.glob("**/*.csv"))
        
        for csv_file in csv_files:
            success = self.process_file(str(csv_file))
            if not success and not self.config["continue_on_failure"]:
                break
        
        return self.result

    def generate_report(self, output_path: str) -> None:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        report_data = self.result.to_dict()
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
        
        print(f"报告已生成: {output_path}")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="健身私教馆课包消耗对账工具")
    parser.add_argument("input", help="输入文件或目录路径")
    parser.add_argument("-c", "--config", help="配置文件路径", default=None)
    parser.add_argument("-o", "--output", help="输出报告路径", default=None)
    parser.add_argument("--no-continue", action="store_true", help="遇到失败时停止")
    
    args = parser.parse_args()
    
    config = ReconciliationConfig(args.config)
    
    if args.no_continue:
        config.config["continue_on_failure"] = False
    
    reconciler = GymCourseReconciler(config)
    
    if os.path.isdir(args.input):
        result = reconciler.process_directory(args.input)
    else:
        reconciler.process_file(args.input)
        result = reconciler.result
    
    output_path = args.output or f"reports/reconcile_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    reconciler.generate_report(output_path)
    
    print(f"\n对账完成!")
    print(f"处理文件: {result.total_files} 个 (成功: {result.success_files}, 失败: {result.failed_files}, 空文件: {result.empty_files})")
    print(f"处理记录: {result.total_rows} 行 (有效: {result.valid_rows}, 无效: {result.invalid_rows}, 重复: {result.duplicate_rows})")
    print(f"赠课记录: {len(result.gift_courses)} 条")
    print(f"转让记录: {len(result.transfers)} 条")
    print(f"冻结/解冻记录: {len(result.freezes)} 条")
    print(f"可复跑项: {len(result.retryable)} 个")


if __name__ == "__main__":
    main()

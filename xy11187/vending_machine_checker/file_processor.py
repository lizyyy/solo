import os
import hashlib
import yaml
import pandas as pd
from datetime import datetime
from typing import List, Dict, Set, Tuple
from pathlib import Path
from .config import config
from .validator import ChannelValidator, SpecialCaseHandler, ValidationResult, ValidationStatus, ValidationIssue

class FileProcessor:
    def __init__(self):
        self.validator = ChannelValidator()
        self.special_handler = SpecialCaseHandler()
        self.processed_files: Dict[str, Dict] = {}
        self._load_processed_records()
    
    def _load_processed_records(self):
        record_path = os.path.join(config.OUTPUT_DIR, config.PROCESSED_RECORD)
        if os.path.exists(record_path):
            try:
                with open(record_path, 'r', encoding='utf-8') as f:
                    self.processed_files = yaml.safe_load(f) or {}
            except Exception:
                self.processed_files = {}
    
    def _save_processed_records(self):
        record_path = os.path.join(config.OUTPUT_DIR, config.PROCESSED_RECORD)
        try:
            with open(record_path, 'w', encoding='utf-8') as f:
                yaml.dump(self.processed_files, f, allow_unicode=True)
        except Exception as e:
            print(f"警告：保存处理记录失败: {e}")
    
    def _calculate_file_hash(self, file_path: str) -> str:
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    
    def is_file_processed(self, file_path: str) -> Tuple[bool, str]:
        file_name = os.path.basename(file_path)
        file_hash = self._calculate_file_hash(file_path)
        
        if file_name in self.processed_files:
            stored_hash = self.processed_files[file_name].get("file_hash", "")
            if stored_hash == file_hash:
                return True, file_hash
        return False, file_hash
    
    def mark_file_processed(self, file_path: str, file_hash: str, result: ValidationResult):
        file_name = os.path.basename(file_path)
        self.processed_files[file_name] = {
            "file_hash": file_hash,
            "processed_at": datetime.now().isoformat(),
            "success": result.success,
            "total_rows": result.total_rows,
            "passed_count": result.passed_count,
            "failed_count": result.failed_count
        }
        self._save_processed_records()
    
    def read_file(self, file_path: str) -> pd.DataFrame:
        ext = os.path.splitext(file_path)[1].lower()
        if ext in ['.xlsx', '.xls']:
            return pd.read_excel(file_path, dtype=str, engine='openpyxl')
        elif ext == '.csv':
            try:
                return pd.read_csv(file_path, dtype=str, encoding='utf-8')
            except UnicodeDecodeError:
                return pd.read_csv(file_path, dtype=str, encoding='gbk')
        else:
            raise ValueError(f"不支持的文件格式: {ext}")
    
    def validate_columns(self, df: pd.DataFrame) -> List[str]:
        missing_columns = []
        for col in config.REQUIRED_COLUMNS:
            if col not in df.columns:
                missing_columns.append(col)
        return missing_columns
    
    def process_single_file(self, file_path: str) -> ValidationResult:
        file_name = os.path.basename(file_path)
        result = ValidationResult(file_name=file_name, success=False)
        
        try:
            is_processed, file_hash = self.is_file_processed(file_path)
            result.file_hash = file_hash
            
            if is_processed:
                result.success = True
                result.error_message = "文件已处理过，跳过（内容未变化）"
                result.skipped_count = 1
                return result
            
            df = self.read_file(file_path)
            result.total_rows = len(df)
            
            missing_cols = self.validate_columns(df)
            if missing_cols:
                result.error_message = f"缺少必需列: {', '.join(missing_cols)}"
                return result
            
            passed_count = 0
            
            for idx, row in df.iterrows():
                row_idx = idx + 2
                row_data = row.to_dict()
                
                issues = []
                
                machine_id = str(row.get("售货机编号", ""))
                channel_id = str(row.get("货道编号", ""))
                
                issue = self.validator.validate_machine_id(row.get("售货机编号"), row_idx)
                if issue:
                    issues.append(issue)
                
                issue = self.validator.validate_channel_id(row.get("货道编号"), row.get("售货机编号"), row_idx)
                if issue:
                    issues.append(issue)
                
                product_issues = self.validator.validate_product(
                    row.get("商品名称"), row.get("商品编码"),
                    row.get("售货机编号"), row.get("货道编号"), row_idx
                )
                issues.extend(product_issues)
                
                issue = self.validator.validate_stock(
                    row.get("库存数量"), row.get("售货机编号"), row.get("货道编号"), row_idx
                )
                if issue:
                    issues.append(issue)
                
                if self.special_handler.is_combination_product(row.get("商品名称")):
                    combo_item = self.special_handler.process_combination_product(row_data, row_idx)
                    result.combination_products.append(combo_item)
                
                if self.special_handler.is_temp_replacement(row_data):
                    temp_item = self.special_handler.process_temp_replacement(row_data, row_idx)
                    result.temp_replacements.append(temp_item)
                
                if self.special_handler.is_rerun_needed(row_data):
                    rerun_item = self.special_handler.process_rerun_item(row_data, row_idx)
                    result.rerun_items.append(rerun_item)
                
                result.issues.extend(issues)
                
                has_errors = any(i.severity == ValidationStatus.FAIL for i in issues)
                has_warnings = any(i.severity == ValidationStatus.WARN for i in issues)
                
                if not has_errors:
                    passed_count += 1
                    if has_warnings:
                        result.warning_count += 1
            
            result.passed_count = passed_count
            result.failed_count = result.total_rows - passed_count
            result.success = True
            result.processed_at = datetime.now().isoformat()
            
            self.mark_file_processed(file_path, file_hash, result)
            
        except Exception as e:
            result.error_message = f"处理失败: {str(e)}"
            result.success = False
        
        return result
    
    def get_all_input_files(self) -> List[str]:
        files = []
        for file_name in os.listdir(config.INPUT_DIR):
            ext = os.path.splitext(file_name)[1].lower()
            if ext in config.VALID_FILE_TYPES:
                files.append(os.path.join(config.INPUT_DIR, file_name))
        return sorted(files)
    
    def process_all_files(self) -> List[ValidationResult]:
        config.ensure_dirs()
        files = self.get_all_input_files()
        results = []
        
        for file_path in files:
            result = self.process_single_file(file_path)
            results.append(result)
        
        return results

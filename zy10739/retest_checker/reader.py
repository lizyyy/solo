import os
import glob
import pandas as pd
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
from .config import get_config


class FileType(Enum):
    SAMPLE_RESULT = "sample_result"
    RETEST_ORDER = "retest_order"
    INSTRUMENT_LOG = "instrument_log"


@dataclass
class ValidationError:
    error_type: str
    message: str
    file: str
    row: Optional[int] = None
    column: Optional[str] = None


@dataclass
class DataReadResult:
    data: pd.DataFrame
    file_type: FileType
    file_path: str
    errors: List[ValidationError]
    warnings: List[str]


class DataReader:
    def __init__(self, config_dir: Optional[str] = None):
        self.config = get_config(config_dir)
        self.settings = self.config.settings
        self.errors: List[ValidationError] = []
        self.warnings: List[str] = []

    def read_directory(self, directory: str) -> Dict[FileType, List[DataReadResult]]:
        if not os.path.exists(directory):
            raise FileNotFoundError(f"目录不存在: {directory}")
        
        if not os.listdir(directory):
            self.errors.append(ValidationError(
                error_type="empty_directory",
                message="目录为空，没有找到任何数据文件",
                file=directory
            ))
            return {}

        results = {
            FileType.SAMPLE_RESULT: [],
            FileType.RETEST_ORDER: [],
            FileType.INSTRUMENT_LOG: []
        }

        patterns = {
            FileType.SAMPLE_RESULT: self.settings["input"]["sample_result_pattern"],
            FileType.RETEST_ORDER: self.settings["input"]["retest_order_pattern"],
            FileType.INSTRUMENT_LOG: self.settings["input"]["instrument_log_pattern"],
        }

        for file_type, pattern in patterns.items():
            files = []
            for ext in ["xlsx", "csv"]:
                ext_pattern = pattern.replace("{xlsx,csv}", ext)
                files.extend(glob.glob(os.path.join(directory, ext_pattern)))
            for file_path in files:
                result = self._read_file(file_path, file_type)
                results[file_type].append(result)

        return results

    def _read_file(self, file_path: str, file_type: FileType) -> DataReadResult:
        file_errors: List[ValidationError] = []
        file_warnings: List[str] = []

        try:
            if file_path.endswith(".csv"):
                df = pd.read_csv(file_path, encoding=self.settings["input"]["encoding"])
            elif file_path.endswith(".xlsx"):
                df = pd.read_excel(file_path, sheet_name=self.settings["input"]["sheet_name"])
            else:
                file_errors.append(ValidationError(
                    error_type="unsupported_format",
                    message=f"不支持的文件格式",
                    file=file_path
                ))
                return DataReadResult(
                    data=pd.DataFrame(),
                    file_type=file_type,
                    file_path=file_path,
                    errors=file_errors,
                    warnings=file_warnings
                )
        except Exception as e:
            file_errors.append(ValidationError(
                error_type="file_corrupted",
                message=f"文件读取失败: {str(e)}",
                file=file_path
            ))
            return DataReadResult(
                data=pd.DataFrame(),
                file_type=file_type,
                file_path=file_path,
                errors=file_errors,
                warnings=file_warnings
            )

        if df.empty:
            file_warnings.append(f"文件内容为空: {os.path.basename(file_path)}")
        else:
            validation = self._validate_dataframe(df, file_type, file_path)
            file_errors.extend(validation["errors"])
            file_warnings.extend(validation["warnings"])

        return DataReadResult(
            data=df,
            file_type=file_type,
            file_path=file_path,
            errors=file_errors,
            warnings=file_warnings
        )

    def _validate_dataframe(self, df: pd.DataFrame, file_type: FileType, file_path: str) -> Dict[str, list]:
        errors: List[ValidationError] = []
        warnings: List[str] = []
        config_key = file_type.value

        required_columns = self.config.get_required_columns(config_key)
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            errors.append(ValidationError(
                error_type="missing_columns",
                message=f"缺少必需列: {', '.join(missing_columns)}",
                file=file_path,
                column=", ".join(missing_columns)
            ))

        if self.settings["validation"]["check_duplicates"]:
            sample_id_col = self.config.get_match_field("sample_id", list(df.columns))
            test_item_col = self.config.get_match_field("test_item", list(df.columns))
            
            if sample_id_col and test_item_col:
                duplicates = df.duplicated(subset=[sample_id_col, test_item_col], keep=False)
                if duplicates.any():
                    dup_rows = df[duplicates].index.tolist()
                    for row in dup_rows[:5]:
                        errors.append(ValidationError(
                            error_type="duplicate_row",
                            message=f"发现重复行 (样本+项目组合重复)",
                            file=file_path,
                            row=row + 2
                        ))
                    if len(dup_rows) > 5:
                        warnings.append(f"还有 {len(dup_rows) - 5} 行重复行未列出")

        if self.settings["validation"]["check_empty_rows"]:
            empty_rows = df[df.isnull().all(axis=1)].index.tolist()
            if empty_rows:
                for row in empty_rows[:3]:
                    warnings.append(f"空行在行号 {row + 2}")
                if len(empty_rows) > 3:
                    warnings.append(f"还有 {len(empty_rows) - 3} 行空行")

        return {"errors": errors, "warnings": warnings}

    def merge_data(self, results: List[DataReadResult]) -> Tuple[pd.DataFrame, List[ValidationError], List[str]]:
        if not results:
            return pd.DataFrame(), [], []
        
        all_dfs = []
        all_errors = []
        all_warnings = []
        
        for result in results:
            all_errors.extend(result.errors)
            all_warnings.extend(result.warnings)
            if not result.data.empty:
                all_dfs.append(result.data)
        
        if not all_dfs:
            return pd.DataFrame(), all_errors, all_warnings
        
        merged = pd.concat(all_dfs, ignore_index=True)
        return merged, all_errors, all_warnings

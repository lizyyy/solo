"""数据读取模块。"""

import pandas as pd
from pathlib import Path
from typing import Dict, List, Optional, Any
from .config import AnalysisConfig
from .logger import AnalysisLogger, ErrorType


class DataReader:
    """数据读取器。"""
    
    def __init__(self, config: AnalysisConfig, logger: Optional[AnalysisLogger] = None):
        self.config = config
        self.logger = logger or AnalysisLogger(
            log_to_file=config.log_to_file,
            log_file=config.log_file,
            log_level=config.log_level
        )
    
    def read_file(self, file_path: str) -> Optional[pd.DataFrame]:
        """
        读取单个数据文件，支持多种格式。
        """
        path = Path(file_path)
        if not path.exists():
            self.logger.error("读取", f"文件不存在: {file_path}")
            return None
        
        suffix = path.suffix.lower()
        
        try:
            if suffix in ['.csv', '.txt']:
                return self._read_csv(path)
            elif suffix in ['.xlsx', '.xls']:
                return self._read_excel(path)
            elif suffix == '.json':
                return self._read_json(path)
            else:
                self.logger.error("读取", f"不支持的文件格式: {suffix}")
                return None
        except Exception as e:
            self.logger.error(
                "读取",
                f"读取文件失败: {file_path}",
                {"error": str(e), "file": str(path)}
            )
            return None
    
    def _read_csv(self, path: Path) -> Optional[pd.DataFrame]:
        """读取 CSV/TXT 文件。"""
        encodings = ['utf-8', 'gbk', 'gb2312', 'utf-8-sig', 'latin1']
        separators = [',', ';', '\t', '|']
        
        for encoding in encodings:
            for sep in separators:
                try:
                    df = pd.read_csv(path, encoding=encoding, sep=sep, engine='python')
                    if len(df.columns) > 1:
                        self.logger.info(
                            "读取",
                            f"成功读取 CSV: {path.name}",
                            {"rows": len(df), "columns": len(df.columns), "encoding": encoding, "sep": repr(sep)}
                        )
                        return df
                except (UnicodeDecodeError, pd.errors.ParserError):
                    continue
        
        self.logger.error("读取", f"无法解析 CSV 文件: {path.name}")
        return None
    
    def _read_excel(self, path: Path) -> Optional[pd.DataFrame]:
        """读取 Excel 文件。"""
        try:
            xls = pd.ExcelFile(path)
            if len(xls.sheet_names) == 1:
                df = pd.read_excel(path)
            else:
                self.logger.info(
                    "读取",
                    f"检测到多个工作表: {xls.sheet_names}",
                    {"file": path.name}
                )
                df = self._read_excel_sheets(xls, path)
            
            self.logger.info(
                "读取",
                f"成功读取 Excel: {path.name}",
                {"rows": len(df), "columns": len(df.columns), "sheets": len(xls.sheet_names)}
            )
            return df
        except Exception as e:
            self.logger.error(
                "读取",
                f"读取 Excel 失败: {path.name}",
                {"error": str(e)}
            )
            return None
    
    def _read_excel_sheets(self, xls: pd.ExcelFile, path: Path) -> pd.DataFrame:
        """读取多个工作表。"""
        all_dfs = []
        for sheet_name in xls.sheet_names:
            df = pd.read_excel(xls, sheet_name=sheet_name)
            if len(df) > 0:
                df['_sheet'] = sheet_name
                if '电池编号' not in df.columns and 'battery_id' not in df.columns:
                    df['_battery_id'] = sheet_name
                all_dfs.append(df)
        
        if all_dfs:
            return pd.concat(all_dfs, ignore_index=True)
        return pd.DataFrame()
    
    def _read_json(self, path: Path) -> Optional[pd.DataFrame]:
        """读取 JSON 文件。"""
        try:
            df = pd.read_json(path)
            self.logger.info(
                "读取",
                f"成功读取 JSON: {path.name}",
                {"rows": len(df), "columns": len(df.columns)}
            )
            return df
        except Exception as e:
            self.logger.error(
                "读取",
                f"读取 JSON 失败: {path.name}",
                {"error": str(e)}
            )
            return None
    
    def read_directory(self, directory_path: str) -> Optional[pd.DataFrame]:
        """读取整个目录的所有支持的文件。"""
        path = Path(directory_path)
        if not path.exists() or not path.is_dir():
            self.logger.error("读取", f"目录不存在: {directory_path}")
            return None
        
        supported_extensions = {'.csv', '.txt', '.xlsx', '.xls', '.json'}
        files = [f for f in path.iterdir() if f.suffix.lower() in supported_extensions]
        
        if not files:
            self.logger.warning("读取", f"目录中没有支持的文件: {directory_path}")
            return None
        
        self.logger.info(
            "读取",
            f"发现 {len(files)} 个文件",
            {"files": [f.name for f in files]}
        )
        
        all_dfs = []
        for file_path in files:
            df = self.read_file(str(file_path))
            if df is not None and len(df) > 0:
                df['_source_file'] = file_path.name
                all_dfs.append(df)
        
        if all_dfs:
            combined_df = pd.concat(all_dfs, ignore_index=True)
            self.logger.info(
                "读取",
                f"合并完成，共 {len(combined_df)} 行数据",
                {"files": len(all_dfs)}
            )
            return combined_df
        return None
    
    def detect_columns(self, df: pd.DataFrame) -> Dict[str, str]:
        """
        自动检测关键列的映射关系。
        """
        if df is None or len(df) == 0:
            return {}
        
        column_mapping = {}
        columns_lower = {col.lower().strip(): col for col in df.columns}
        
        for config_col, candidates in [
            ('capacity', self.config.capacity_columns),
            ('cycle', self.config.cycle_columns),
            ('battery_id', self.config.battery_id_columns),
            ('batch', self.config.batch_columns),
        ]:
            for candidate in candidates:
                candidate_lower = candidate.lower()
                if candidate_lower in columns_lower:
                    column_mapping[config_col] = columns_lower[candidate_lower]
                    break
        
        self.logger.info(
            "列检测",
            f"检测到的列映射",
            column_mapping
        )
        
        return column_mapping

"""数据加载模块 - 支持 CSV/Excel，详细记录加载问题"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Dict, Any
import pandas as pd
import numpy as np


@dataclass
class LoadIssue:
    """加载问题记录"""
    type: str
    message: str
    location: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class LoadResult:
    """加载结果 - 包含数据和所有问题记录"""
    data: Optional[pd.DataFrame]
    success: bool
    issues: List[LoadIssue] = field(default_factory=list)
    file_path: str = ""
    file_type: str = ""
    row_count: int = 0
    column_count: int = 0
    load_time: float = 0.0

    def has_critical_issues(self) -> bool:
        """是否有严重问题"""
        return any(issue.type.startswith("critical") for issue in self.issues)

    def has_warnings(self) -> bool:
        """是否有警告"""
        return any(issue.type.startswith("warning") for issue in self.issues)

    def get_issues_by_type(self, issue_type: str) -> List[LoadIssue]:
        """按类型获取问题"""
        return [i for i in self.issues if i.type == issue_type]


class DataLoader:
    """数据加载器"""

    def __init__(self, config=None):
        self.config = config or {}

    def load(self, file_path: str, sheet_name: Optional[str] = None) -> LoadResult:
        """加载数据文件，详细记录所有问题"""
        import time
        start_time = time.time()
        issues: List[LoadIssue] = []
        path = Path(file_path)

        if not path.exists():
            return LoadResult(
                data=None,
                success=False,
                issues=[LoadIssue(
                    type="critical_file_not_found",
                    message=f"文件不存在: {file_path}",
                    location=file_path
                )],
                file_path=file_path
            )

        file_type = self._detect_file_type(path)
        if file_type == "unknown":
            return LoadResult(
                data=None,
                success=False,
                issues=[LoadIssue(
                    type="critical_unknown_format",
                    message=f"不支持的文件格式: {path.suffix}",
                    location=file_path,
                    details={"supported": [".csv", ".xlsx", ".xls"]}
                )],
                file_path=file_path
            )

        try:
            if file_type == "csv":
                df, load_issues = self._load_csv(path)
            else:
                df, load_issues = self._load_excel(path, sheet_name)
            
            issues.extend(load_issues)

            if df is None or df.empty:
                issues.append(LoadIssue(
                    type="critical_empty_data",
                    message="数据为空或无法解析",
                    location=file_path
                ))
                return LoadResult(
                    data=None,
                    success=False,
                    issues=issues,
                    file_path=file_path,
                    file_type=file_type,
                    load_time=time.time() - start_time
                )

            validation_issues = self._validate_structure(df)
            issues.extend(validation_issues)

            has_critical = any(i.type.startswith("critical") for i in issues)

            return LoadResult(
                data=df,
                success=not has_critical,
                issues=issues,
                file_path=file_path,
                file_type=file_type,
                row_count=len(df),
                column_count=len(df.columns),
                load_time=time.time() - start_time
            )

        except Exception as e:
            issues.append(LoadIssue(
                type="critical_load_exception",
                message=f"加载失败: {str(e)}",
                location=file_path,
                details={"error_type": type(e).__name__}
            ))
            return LoadResult(
                data=None,
                success=False,
                issues=issues,
                file_path=file_path,
                file_type=file_type,
                load_time=time.time() - start_time
            )

    def _detect_file_type(self, path: Path) -> str:
        """检测文件类型"""
        suffix = path.suffix.lower()
        if suffix == ".csv":
            return "csv"
        elif suffix in [".xlsx", ".xls"]:
            return "excel"
        return "unknown"

    def _load_csv(self, path: Path) -> tuple:
        """加载 CSV，记录问题"""
        issues: List[LoadIssue] = []

        try:
            df = pd.read_csv(path, encoding="utf-8")
        except UnicodeDecodeError:
            try:
                df = pd.read_csv(path, encoding="gbk")
                issues.append(LoadIssue(
                    type="warning_encoding",
                    message="UTF-8解码失败，已使用GBK编码",
                    location=str(path)
                ))
            except Exception:
                for enc in ["utf-8-sig", "latin1"]:
                    try:
                        df = pd.read_csv(path, encoding=enc)
                        issues.append(LoadIssue(
                            type="warning_encoding",
                            message=f"使用备用编码加载: {enc}",
                            location=str(path)
                        ))
                        break
                    except Exception:
                        continue
                else:
                    return None, [LoadIssue(
                        type="critical_encoding",
                        message="无法识别文件编码",
                        location=str(path)
                    )]

        if df.columns.duplicated().any():
            dup_cols = df.columns[df.columns.duplicated()].unique().tolist()
            issues.append(LoadIssue(
                type="warning_duplicate_columns",
                message=f"存在重复列名: {dup_cols}",
                location=str(path),
                details={"duplicate_columns": dup_cols}
            ))
            df.columns = [
                f"{col}_{list(df.columns[:i]).count(col)}" if df.columns.duplicated()[i] else col
                for i, col in enumerate(df.columns)
            ]

        return df, issues

    def _load_excel(self, path: Path, sheet_name: Optional[str]) -> tuple:
        """加载 Excel，记录问题"""
        issues: List[LoadIssue] = []

        try:
            if sheet_name:
                df = pd.read_excel(path, sheet_name=sheet_name)
            else:
                xl = pd.ExcelFile(path)
                if len(xl.sheet_names) == 0:
                    return None, [LoadIssue(
                        type="critical_no_sheets",
                        message="Excel文件没有工作表",
                        location=str(path)
                    )]
                if len(xl.sheet_names) > 1:
                    issues.append(LoadIssue(
                        type="info_multiple_sheets",
                        message=f"发现多个工作表，默认加载第一个: {xl.sheet_names[0]}",
                        location=str(path),
                        details={"all_sheets": xl.sheet_names}
                    ))
                df = pd.read_excel(path, sheet_name=xl.sheet_names[0])

            if df.columns.duplicated().any():
                dup_cols = df.columns[df.columns.duplicated()].unique().tolist()
                issues.append(LoadIssue(
                    type="warning_duplicate_columns",
                    message=f"存在重复列名: {dup_cols}",
                    location=str(path),
                    details={"duplicate_columns": dup_cols}
                ))

            return df, issues

        except Exception as e:
            return None, [LoadIssue(
                type="critical_excel_read",
                message=f"Excel读取失败: {str(e)}",
                location=str(path),
                details={"error_type": type(e).__name__}
            )]

    def _validate_structure(self, df: pd.DataFrame) -> List[LoadIssue]:
        """验证数据结构"""
        issues: List[LoadIssue] = []

        if df.empty:
            issues.append(LoadIssue(
                type="critical_empty_dataframe",
                message="数据框为空"
            ))
            return issues

        if len(df.columns) == 0:
            issues.append(LoadIssue(
                type="critical_no_columns",
                message="没有检测到列"
            ))
            return issues

        unnamed_cols = [str(c) for c in df.columns if str(c).startswith("Unnamed")]
        if unnamed_cols:
            issues.append(LoadIssue(
                type="warning_unnamed_columns",
                message=f"存在未命名列: {unnamed_cols}",
                details={"count": len(unnamed_cols)}
            ))

        missing_count = df.isna().sum().sum()
        if missing_count > 0:
            missing_by_col = {k: int(v) for k, v in df.isna().sum().items() if v > 0}
            issues.append(LoadIssue(
                type="info_missing_values",
                message=f"发现 {missing_count} 个缺失值",
                details={"by_column": missing_by_col}
            ))

        return issues

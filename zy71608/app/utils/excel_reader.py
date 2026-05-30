import io
import pandas as pd
from typing import Dict, Any, Tuple, Optional, List


class ExcelReader:
    @classmethod
    def read_file(
        cls,
        file_content: bytes,
        file_name: str,
        sheet_name: Optional[str] = None,
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        stats = {
            "sheet_name": sheet_name,
            "encoding": None,
            "total_rows": 0,
        }

        if file_name.lower().endswith(".csv"):
            return cls._read_csv(file_content, stats)
        elif file_name.lower().endswith((".xlsx", ".xls")):
            return cls._read_excel(file_content, file_name, sheet_name, stats)
        else:
            raise ValueError(f"不支持的文件格式: {file_name}")

    @classmethod
    def _read_csv(
        cls, file_content: bytes, stats: Dict[str, Any]
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        encodings = ["utf-8", "gbk", "gb2312", "utf-16", "latin1"]

        for encoding in encodings:
            try:
                content = io.BytesIO(file_content)
                df = pd.read_csv(content, encoding=encoding, dtype=str)
                stats["encoding"] = encoding
                stats["total_rows"] = len(df)
                return df, stats
            except (UnicodeDecodeError, Exception):
                continue

        raise ValueError("无法识别CSV文件编码，请检查文件格式")

    @classmethod
    def _read_excel(
        cls,
        file_content: bytes,
        file_name: str,
        sheet_name: Optional[str],
        stats: Dict[str, Any],
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        content = io.BytesIO(file_content)

        try:
            xl = pd.ExcelFile(content)

            if sheet_name is None:
                sheet_name = xl.sheet_names[0]
            elif sheet_name not in xl.sheet_names:
                raise ValueError(f"工作表 '{sheet_name}' 不存在，可用工作表: {xl.sheet_names}")

            stats["sheet_name"] = sheet_name

            df = pd.read_excel(content, sheet_name=sheet_name, dtype=str, engine="openpyxl")
            stats["total_rows"] = len(df)

            return df, stats
        except Exception as e:
            raise ValueError(f"读取Excel文件失败: {str(e)}")

    @classmethod
    def get_sheet_names(cls, file_content: bytes, file_name: str) -> List[str]:
        if file_name.lower().endswith(".csv"):
            return ["Sheet1"]

        content = io.BytesIO(file_content)
        xl = pd.ExcelFile(content)
        return xl.sheet_names

    @classmethod
    def preview_data(cls, df: pd.DataFrame, n_rows: int = 5) -> List[Dict[str, Any]]:
        preview = df.head(n_rows).copy()
        preview = preview.where(pd.notnull(preview), None)
        return preview.to_dict("records")

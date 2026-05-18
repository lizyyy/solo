import os
import pandas as pd
from datetime import datetime
from typing import List, Optional, Tuple
from pathlib import Path

from .models import ClaimRecord, ProcessResult


REQUIRED_COLUMNS = [
    "赔付单号", "仓库编码", "赔付日期", "承运商", "商品名称",
    "批次号", "温度异常类型", "最低温度", "最高温度",
    "异常持续时长(小时)", "损失金额", "赔付状态", "处理人"
]

WAREHOUSE_CODES = ["CC001", "CC002", "CC003", "CC004", "CC005"]


class ClaimFileParser:
    def __init__(self):
        self.supported_formats = [".xlsx", ".xls", ".csv"]

    def parse_file(self, filepath: str, result: ProcessResult) -> List[ClaimRecord]:
        records = []
        filename = os.path.basename(filepath)

        try:
            if not os.path.exists(filepath):
                result.add_failure(filename, "文件不存在")
                return records

            if not os.access(filepath, os.R_OK):
                result.add_failure(filename, "文件不可读")
                return records

            ext = Path(filepath).suffix.lower()
            if ext not in self.supported_formats:
                result.add_failure(filename, f"不支持的文件格式: {ext}")
                return records

            df = self._read_file(filepath, ext)
            
            if df.empty:
                result.add_failure(filename, "文件内容为空")
                return records

            missing_cols = [col for col in REQUIRED_COLUMNS if col not in df.columns]
            if missing_cols:
                result.add_failure(filename, f"缺少必需列: {', '.join(missing_cols)}")
                return records

            for idx, row in df.iterrows():
                try:
                    record = self._parse_row(row, filename, idx + 2)
                    if record:
                        records.append(record)
                except Exception as e:
                    result.add_failure(filename, f"第{idx + 2}行解析失败: {str(e)}", idx + 2)

        except pd.errors.EmptyDataError:
            result.add_failure(filename, "CSV文件为空或格式错误")
        except Exception as e:
            result.add_failure(filename, f"文件读取失败: {str(e)}")

        return records

    def _read_file(self, filepath: str, ext: str) -> pd.DataFrame:
        if ext in [".xlsx", ".xls"]:
            return pd.read_excel(filepath, dtype=str)
        else:
            encodings = ["utf-8", "gbk", "gb2312", "utf-8-sig"]
            for encoding in encodings:
                try:
                    return pd.read_csv(filepath, dtype=str, encoding=encoding)
                except UnicodeDecodeError:
                    continue
            raise ValueError("无法识别文件编码，请检查文件格式")

    def _parse_row(self, row: pd.Series, filename: str, line_num: int) -> Optional[ClaimRecord]:
        def safe_get(key: str, default: str = "") -> str:
            val = row.get(key, default)
            return str(val).strip() if pd.notna(val) else default

        def safe_float(key: str) -> float:
            val = safe_get(key)
            if not val:
                return 0.0
            try:
                return float(val.replace(",", ""))
            except ValueError:
                return 0.0

        def safe_date(key: str) -> Optional[datetime]:
            val = safe_get(key)
            if not val:
                return None
            date_formats = ["%Y-%m-%d", "%Y/%m/%d", "%Y%m%d", "%Y-%m-%d %H:%M:%S"]
            for fmt in date_formats:
                try:
                    return datetime.strptime(val, fmt)
                except ValueError:
                    continue
            return None

        claim_id = safe_get("赔付单号")
        if not claim_id:
            raise ValueError("赔付单号不能为空")

        warehouse_code = safe_get("仓库编码")
        if warehouse_code and warehouse_code not in WAREHOUSE_CODES:
            pass

        claim_date = safe_date("赔付日期")
        if not claim_date:
            raise ValueError("赔付日期格式错误")

        return ClaimRecord(
            claim_id=claim_id,
            warehouse_code=warehouse_code,
            claim_date=claim_date,
            carrier=safe_get("承运商"),
            product_name=safe_get("商品名称"),
            batch_number=safe_get("批次号"),
            temperature_anomaly=safe_get("温度异常类型"),
            temperature_min=safe_float("最低温度"),
            temperature_max=safe_float("最高温度"),
            anomaly_duration=safe_float("异常持续时长(小时)"),
            loss_amount=safe_float("损失金额"),
            claim_status=safe_get("赔付状态"),
            handler=safe_get("处理人"),
            remark=safe_get("备注"),
            source_file=filename,
        )

import os
import glob
import pandas as pd
from datetime import datetime


class DataLoader:
    def __init__(self, encoding="utf-8", verbose=False):
        self.encoding = encoding
        self.verbose = verbose
        self.cash_columns = ["trade_no", "amount", "time", "is_refund", "store_id"]
        self.payment_columns = ["trade_no", "amount", "time", "is_refund", "platform"]

    def _parse_amount(self, value):
        if pd.isna(value):
            return None
        try:
            s = str(value).strip()
            s = s.replace(",", "").replace("¥", "").replace("￥", "")
            return float(s)
        except (ValueError, TypeError):
            return None

    def _parse_time(self, value):
        if pd.isna(value):
            return None
        try:
            if isinstance(value, datetime):
                return value
            s = str(value).strip()
            formats = [
                "%Y-%m-%d %H:%M:%S",
                "%Y/%m/%d %H:%M:%S",
                "%Y-%m-%d %H:%M",
                "%Y/%m/%d %H:%M",
                "%Y-%m-%d",
                "%Y/%m/%d",
                "%Y%m%d %H%M%S",
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(s, fmt)
                except ValueError:
                    continue
            return None
        except Exception:
            return None

    def _parse_is_refund(self, value):
        if pd.isna(value):
            return False
        s = str(value).strip().lower()
        return s in ["1", "true", "yes", "是", "退款", "refund", "t", "y"]

    def _validate_row(self, row, required_columns):
        errors = []
        if pd.isna(row.get("trade_no")) or str(row["trade_no"]).strip() == "":
            errors.append("订单号不能为空")
        if pd.isna(row.get("amount_parsed")):
            errors.append("金额格式无效")
        if pd.isna(row.get("time_parsed")):
            errors.append("时间格式无效")
        return errors

    def load_csv_files(self, directory, required_columns):
        all_data = []
        errors = []
        
        csv_files = glob.glob(os.path.join(directory, "*.csv"))
        if not csv_files:
            raise ValueError(f"目录 {directory} 中没有找到CSV文件")
        
        for filepath in sorted(csv_files):
            filename = os.path.basename(filepath)
            if self.verbose:
                print(f"  读取文件: {filename}")
            
            try:
                df = pd.read_csv(
                    filepath,
                    encoding=self.encoding,
                    dtype=str,
                    on_bad_lines="warn"
                )
            except Exception as e:
                errors.append({
                    "file": filename,
                    "row": None,
                    "raw_content": None,
                    "error": f"文件读取失败: {str(e)}"
                })
                continue
            
            missing_cols = [c for c in required_columns if c not in df.columns]
            if missing_cols:
                errors.append({
                    "file": filename,
                    "row": None,
                    "raw_content": None,
                    "error": f"缺少必需列: {', '.join(missing_cols)}"
                })
                continue
            
            for idx, row in df.iterrows():
                row_num = idx + 2
                
                parsed_row = {
                    "file": filename,
                    "row": row_num,
                    "trade_no": str(row.get("trade_no", "")).strip(),
                    "amount_raw": row.get("amount"),
                    "amount_parsed": self._parse_amount(row.get("amount")),
                    "time_raw": row.get("time"),
                    "time_parsed": self._parse_time(row.get("time")),
                    "is_refund": self._parse_is_refund(row.get("is_refund", "0")),
                }
                
                if "store_id" in required_columns:
                    parsed_row["store_id"] = str(row.get("store_id", "")).strip()
                if "platform" in required_columns:
                    parsed_row["platform"] = str(row.get("platform", "")).strip()
                
                row_errors = self._validate_row(parsed_row, required_columns)
                if row_errors:
                    errors.append({
                        "file": filename,
                        "row": row_num,
                        "raw_content": str(dict(row)),
                        "error": "; ".join(row_errors)
                    })
                    continue
                
                all_data.append(parsed_row)
        
        result_df = pd.DataFrame(all_data)
        if not result_df.empty:
            result_df = result_df.sort_values("time_parsed").reset_index(drop=True)
        
        return result_df, errors

    def load_cash_records(self, directory, store_id_filter=None):
        df, errors = self.load_csv_files(directory, self.cash_columns)
        
        if not df.empty and store_id_filter:
            df = df[df["store_id"] == store_id_filter].reset_index(drop=True)
        
        if not df.empty:
            df["amount"] = df["amount_parsed"]
            df["time"] = df["time_parsed"]
        
        return df, errors

    def load_payment_records(self, directory):
        df, errors = self.load_csv_files(directory, self.payment_columns)
        
        if not df.empty:
            df["amount"] = df["amount_parsed"]
            df["time"] = df["time_parsed"]
        
        return df, errors

import csv
import os
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from .models import TransactionRecord, RecordSource, Attachment


class FileReader:
    SOURCE_MAPPING = {
        "银行回单": RecordSource.BANK_RECEIPT,
        "bank": RecordSource.BANK_RECEIPT,
        "业务台账": RecordSource.BUSINESS_LEDGER,
        "台账": RecordSource.BUSINESS_LEDGER,
        "ledger": RecordSource.BUSINESS_LEDGER,
        "月底对账表": RecordSource.MONTHLY_STATEMENT,
        "对账表": RecordSource.MONTHLY_STATEMENT,
        "statement": RecordSource.MONTHLY_STATEMENT,
        "群截图": RecordSource.SCREENSHOT,
        "截图": RecordSource.SCREENSHOT,
        "screenshot": RecordSource.SCREENSHOT,
        "补录说明": RecordSource.SUPPLEMENT_NOTE,
        "说明": RecordSource.SUPPLEMENT_NOTE,
        "note": RecordSource.SUPPLEMENT_NOTE,
    }

    FIELD_MAPPINGS = {
        "id": ["记录ID", "ID", "id", "编号"],
        "store_id": ["门店编号", "门店ID", "store_id", "店铺编号"],
        "store_name": ["门店名称", "门店", "store_name", "店铺名称"],
        "trade_date": ["交易日期", "日期", "trade_date", "发生日期"],
        "amount": ["金额", "交易金额", "amount", "现金金额"],
        "batch_no": ["批次号", "批次", "batch_no", "批处理号"],
        "remark": ["备注", "说明", "remark", "门店日结现金差异"],
        "source": ["数据来源", "来源", "source", "类型"],
    }

    def __init__(self):
        self.read_log: List[str] = []

    def _log(self, msg: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.read_log.append(f"[{timestamp}] {msg}")

    def _detect_source(self, value: str) -> RecordSource:
        if not value:
            return RecordSource.MONTHLY_STATEMENT
        value_lower = str(value).lower().strip()
        for key, src in self.SOURCE_MAPPING.items():
            if key.lower() in value_lower:
                return src
        return RecordSource.MONTHLY_STATEMENT

    def _map_field(self, row: Dict[str, Any], field_names: List[str]) -> Optional[str]:
        for name in field_names:
            if name in row and row[name] is not None:
                val = str(row[name]).strip()
                if val.lower() not in ("nan", "none", "null", ""):
                    return val
        return None

    def _is_empty(self, value: Any) -> bool:
        if value is None:
            return True
        if isinstance(value, str):
            s = value.strip().lower()
            return s == "" or s == "nan" or s == "none" or s == "null"
        return False

    def _parse_amount(self, value: Any) -> Optional[float]:
        if self._is_empty(value):
            return None
        if isinstance(value, (int, float)):
            import math
            if math.isnan(value):
                return None
            return float(value)
        try:
            s = str(value).replace(",", "").replace("￥", "").replace("¥", "").strip()
            if s.lower() in ("nan", "none", "null", ""):
                return None
            return float(s)
        except (ValueError, TypeError):
            return None

    def _generate_id(self, row: Dict[str, Any], idx: int, source: RecordSource) -> str:
        store_id = self._map_field(row, self.FIELD_MAPPINGS["store_id"]) or "UNKNOWN"
        date = self._map_field(row, self.FIELD_MAPPINGS["trade_date"]) or "NODATE"
        return f"{source.value[:2]}_{store_id}_{date}_{idx:04d}"

    def read_csv(self, file_path: str, source_hint: Optional[str] = None) -> List[TransactionRecord]:
        self._log(f"开始读取CSV文件: {file_path}")
        records = []
        
        if not os.path.exists(file_path):
            self._log(f"  错误: 文件不存在 {file_path}")
            return records

        try:
            import pandas as pd
            df = pd.read_csv(file_path, dtype=str)
            rows = df.to_dict('records')
        except ImportError:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                rows = list(reader)

        for idx, row in enumerate(rows, 1):
            try:
                source_val = source_hint or self._map_field(row, self.FIELD_MAPPINGS["source"])
                source = self._detect_source(source_val)
                
                rec_id = self._map_field(row, self.FIELD_MAPPINGS["id"]) or \
                         self._generate_id(row, idx, source)
                
                amount = self._parse_amount(
                    self._map_field(row, self.FIELD_MAPPINGS["amount"])
                )
                
                original_remark = self._map_field(row, self.FIELD_MAPPINGS["remark"])
                
                rec = TransactionRecord(
                    id=rec_id,
                    store_id=self._map_field(row, self.FIELD_MAPPINGS["store_id"]) or "",
                    store_name=self._map_field(row, self.FIELD_MAPPINGS["store_name"]) or "未知门店",
                    trade_date=self._map_field(row, self.FIELD_MAPPINGS["trade_date"]) or "",
                    amount=amount,
                    batch_no=self._map_field(row, self.FIELD_MAPPINGS["batch_no"]),
                    source=source,
                    original_remark=original_remark,
                    current_remark=original_remark,
                    raw_data=row,
                )
                records.append(rec)
            except Exception as e:
                self._log(f"  警告: 第{idx}行解析失败: {str(e)}")
                continue

        self._log(f"  成功读取 {len(records)} 条记录")
        return records

    def read_excel(self, file_path: str, sheet_name: Optional[str] = None,
                   source_hint: Optional[str] = None) -> List[TransactionRecord]:
        self._log(f"开始读取Excel文件: {file_path}")
        records = []
        
        if not os.path.exists(file_path):
            self._log(f"  错误: 文件不存在 {file_path}")
            return records

        try:
            import pandas as pd
            if sheet_name:
                df = pd.read_excel(file_path, sheet_name=sheet_name, dtype=str)
            else:
                df = pd.read_excel(file_path, dtype=str)
            rows = df.to_dict('records')
        except ImportError as e:
            self._log(f"  错误: 未安装pandas/openpyxl，无法读取Excel: {str(e)}")
            return records

        for idx, row in enumerate(rows, 1):
            try:
                source_val = source_hint or self._map_field(row, self.FIELD_MAPPINGS["source"])
                source = self._detect_source(source_val)
                
                rec_id = self._map_field(row, self.FIELD_MAPPINGS["id"]) or \
                         self._generate_id(row, idx, source)
                
                amount = self._parse_amount(
                    self._map_field(row, self.FIELD_MAPPINGS["amount"])
                )
                
                original_remark = self._map_field(row, self.FIELD_MAPPINGS["remark"])
                
                rec = TransactionRecord(
                    id=rec_id,
                    store_id=self._map_field(row, self.FIELD_MAPPINGS["store_id"]) or "",
                    store_name=self._map_field(row, self.FIELD_MAPPINGS["store_name"]) or "未知门店",
                    trade_date=self._map_field(row, self.FIELD_MAPPINGS["trade_date"]) or "",
                    amount=amount,
                    batch_no=self._map_field(row, self.FIELD_MAPPINGS["batch_no"]),
                    source=source,
                    original_remark=original_remark,
                    current_remark=original_remark,
                    raw_data=row,
                )
                records.append(rec)
            except Exception as e:
                self._log(f"  警告: 第{idx}行解析失败: {str(e)}")
                continue

        self._log(f"  成功读取 {len(records)} 条记录")
        return records

    def read_attachment_index(self, file_path: str) -> Dict[str, List[Attachment]]:
        self._log(f"开始读取附件索引: {file_path}")
        attachments: Dict[str, List[Attachment]] = {}
        
        if not os.path.exists(file_path):
            self._log(f"  警告: 附件索引文件不存在 {file_path}")
            return attachments

        try:
            import pandas as pd
            df = pd.read_csv(file_path, dtype=str) if file_path.endswith('.csv') else \
                 pd.read_excel(file_path, dtype=str)
            rows = df.to_dict('records')
        except ImportError:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                rows = list(reader)

        field_maps = {
            "record_id": ["记录ID", "关联记录ID", "record_id", "关联ID"],
            "attach_id": ["附件ID", "附件编号", "attach_id", "id"],
            "type": ["附件类型", "类型", "type", "文件类型"],
            "path": ["附件路径", "路径", "path", "文件路径", "文件名"],
            "desc": ["描述", "说明", "desc", "description"],
            "received_at": ["收到时间", "接收时间", "received_at", "到账时间"],
        }

        for idx, row in enumerate(rows, 1):
            try:
                record_id = self._map_field(row, field_maps["record_id"])
                if not record_id:
                    continue
                
                attach = Attachment(
                    id=self._map_field(row, field_maps["attach_id"]) or f"ATT{idx:04d}",
                    type=self._map_field(row, field_maps["type"]) or "其他",
                    path=self._map_field(row, field_maps["path"]) or "",
                    description=self._map_field(row, field_maps["desc"]),
                )
                
                received_str = self._map_field(row, field_maps["received_at"])
                if received_str:
                    try:
                        attach.received_at = datetime.strptime(received_str, "%Y-%m-%d %H:%M:%S")
                    except ValueError:
                        try:
                            attach.received_at = datetime.strptime(received_str, "%Y-%m-%d")
                        except ValueError:
                            pass
                
                if record_id not in attachments:
                    attachments[record_id] = []
                attachments[record_id].append(attach)
            except Exception as e:
                self._log(f"  警告: 附件索引第{idx}行解析失败: {str(e)}")
                continue

        total = sum(len(v) for v in attachments.values())
        self._log(f"  成功读取 {total} 个附件，关联 {len(attachments)} 条记录")
        return attachments

    def read_all(self, data_files: List[Tuple[str, Optional[str]]], 
                 attachment_file: Optional[str] = None) -> Tuple[List[TransactionRecord], Dict[str, List[Attachment]]]:
        all_records = []
        attachments = {}

        for file_path, source_hint in data_files:
            if file_path.endswith('.csv'):
                records = self.read_csv(file_path, source_hint)
            elif file_path.endswith(('.xlsx', '.xls')):
                records = self.read_excel(file_path, source_hint=source_hint)
            else:
                self._log(f"  跳过不支持的文件格式: {file_path}")
                continue
            all_records.extend(records)

        if attachment_file:
            attachments = self.read_attachment_index(attachment_file)
            for rec in all_records:
                if rec.id in attachments:
                    for att in attachments[rec.id]:
                        rec.add_attachment(att)
                    self._log(f"  记录 {rec.id} 关联了 {len(attachments[rec.id])} 个附件")

        self._log(f"文件读取完成，共 {len(all_records)} 条记录")
        return all_records, attachments

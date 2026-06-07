import pandas as pd
import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Tuple
from collections import defaultdict
from dateutil.parser import parse as date_parse

from .models import CollateralRecord, ImportBatch, RecordStatus, SkipReason
from .database import Database


REQUIRED_FIELDS = ["client_id", "collateral_code", "quantity", "market_value"]

FIELD_ALIASES = {
    "client_id": ["客户编号", "客户ID", "client_id", "cust_id", "custno"],
    "client_name": ["客户名称", "客户姓名", "client_name", "cust_name"],
    "account_id": ["账号", "资金账号", "account_id", "acct_id", "fund_account"],
    "collateral_code": ["证券代码", "担保品代码", "collateral_code", "sec_code", "stock_code"],
    "collateral_name": ["证券名称", "担保品名称", "collateral_name", "sec_name", "stock_name"],
    "collateral_type": ["证券类型", "担保品类型", "collateral_type", "sec_type"],
    "quantity": ["数量", "持仓数量", "quantity", "qty", "volume"],
    "market_value": ["市值", "持仓市值", "market_value", "mkt_val", "market_val"],
    "collateral_ratio": ["折算率", "担保折算率", "collateral_ratio", "ratio"],
    "available_collateral": ["可用担保品", "可充抵保证金", "available_collateral", "avail_collateral"],
    "trade_date": ["交易日", "交易日期", "trade_date", "trd_date", "biz_date"],
    "settlement_date": ["清算日", "交收日", "settlement_date", "set_date"],
    "is_refund": ["是否退款", "退款标志", "is_refund", "refund_flag"],
    "source_system": ["来源系统", "系统来源", "source_system", "src_sys"],
}


class DataImporter:
    def __init__(self, db: Database):
        self.db = db

    def import_file(self, file_path: str, import_user: str = None) -> Tuple[ImportBatch, List[str]]:
        batch_id = f"BATCH_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
        file_name = file_path.split("/")[-1]

        if file_path.endswith(".csv"):
            df = self._read_csv(file_path)
        elif file_path.endswith(".json"):
            df = self._read_json(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {file_path}")

        records, warnings = self._parse_dataframe(df, batch_id)
        processed_count, skipped_count, normal_count, need_review_count, skip_reason_summary = self._process_records(records)

        batch = ImportBatch(
            batch_id=batch_id,
            file_name=file_name,
            total_count=len(records),
            processed_count=processed_count,
            skipped_count=skipped_count,
            normal_count=normal_count,
            need_review_count=need_review_count,
            import_user=import_user,
            skip_reason_summary=skip_reason_summary
        )
        self.db.insert_batch(batch)

        return batch, warnings

    def _read_csv(self, file_path: str) -> pd.DataFrame:
        return pd.read_csv(file_path, dtype=str, keep_default_na=False)

    def _read_json(self, file_path: str) -> pd.DataFrame:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            return pd.DataFrame(data, dtype=str)
        elif isinstance(data, dict):
            for key in data:
                if isinstance(data[key], list):
                    return pd.DataFrame(data[key], dtype=str)
            return pd.DataFrame([data], dtype=str)
        raise ValueError("JSON 格式不正确，需要是数组或包含数组的对象")

    def _parse_dataframe(self, df: pd.DataFrame, batch_id: str) -> Tuple[List[CollateralRecord], List[str]]:
        records = []
        warnings = []

        column_mapping = self._map_columns(df.columns.tolist())

        for idx, row in df.iterrows():
            raw_data = row.to_dict()
            record = CollateralRecord(
                batch_id=batch_id,
                raw_data=raw_data
            )

            for field, possible_columns in FIELD_ALIASES.items():
                for col in possible_columns:
                    mapped_col = column_mapping.get(col, col)
                    if mapped_col in df.columns and pd.notna(row[mapped_col]) and str(row[mapped_col]).strip():
                        value = str(row[mapped_col]).strip()
                        if field in ["quantity", "market_value", "collateral_ratio", "available_collateral"]:
                            try:
                                value = float(value.replace(",", ""))
                            except (ValueError, TypeError):
                                value = 0.0
                        elif field == "is_refund":
                            value = value.lower() in ["是", "true", "1", "yes", "退款"]
                        setattr(record, field, value)
                        break

            if not record.client_name:
                record.client_name = raw_data.get("client_name", "")
            if not record.account_id:
                record.account_id = raw_data.get("account_id", "")

            records.append(record)

        if not column_mapping:
            warnings.append("未找到明确的字段映射，使用默认字段名解析")

        return records, warnings

    def _map_columns(self, columns: List[str]) -> Dict[str, str]:
        mapping = {}
        col_lower_map = {col.lower().strip(): col for col in columns}

        for field, aliases in FIELD_ALIASES.items():
            for alias in aliases:
                alias_lower = alias.lower().strip()
                if alias_lower in col_lower_map:
                    mapping[alias] = col_lower_map[alias_lower]
                    break
        return mapping

    def _process_records(self, records: List[CollateralRecord]) -> Tuple[int, int, int, int, Dict[str, int]]:
        skip_reason_summary = defaultdict(int)
        client_account_map = defaultdict(set)
        seen_keys = set()

        for record in records:
            skip_reasons = []
            skip_details = []

            missing_fields = [f for f in REQUIRED_FIELDS if not getattr(record, f)]
            if missing_fields:
                skip_reasons.append(SkipReason.MISSING_FIELD.value)
                skip_details.append(f"缺少必填字段: {', '.join(missing_fields)}")
                skip_reason_summary[SkipReason.MISSING_FIELD.value] += 1

            dup_key = (record.client_id, record.collateral_code, record.account_id, record.trade_date)
            if dup_key in seen_keys and not missing_fields:
                skip_reasons.append(SkipReason.DUPLICATE.value)
                skip_details.append(f"重复记录: client_id={record.client_id}, collateral_code={record.collateral_code}")
                skip_reason_summary[SkipReason.DUPLICATE.value] += 1
            seen_keys.add(dup_key)

            if record.market_value > 0 and record.available_collateral > 0 and record.collateral_ratio > 0:
                calc_collateral = record.market_value * record.collateral_ratio
                if abs(calc_collateral - record.available_collateral) / max(record.available_collateral, 0.01) > 0.005:
                    if SkipReason.CALIBER_MISMATCH.value not in skip_reasons:
                        skip_reasons.append(SkipReason.CALIBER_MISMATCH.value)
                        skip_details.append(f"口径不一致: 计算值 {calc_collateral:.2f} != 上报值 {record.available_collateral:.2f}")
                        skip_reason_summary[SkipReason.CALIBER_MISMATCH.value] += 1

            if record.client_id and record.account_id:
                client_account_map[record.client_id].add(record.account_id)

            if record.is_refund and record.trade_date and record.settlement_date:
                try:
                    trade_dt = date_parse(record.trade_date)
                    set_dt = date_parse(record.settlement_date)
                    if (set_dt - trade_dt).days > 1:
                        skip_reasons.append(SkipReason.CROSS_SETTLEMENT_REFUND.value)
                        skip_details.append(f"退款跨清算日: 交易日={record.trade_date}, 清算日={record.settlement_date}")
                        skip_reason_summary[SkipReason.CROSS_SETTLEMENT_REFUND.value] += 1
                except Exception:
                    pass

            if skip_reasons:
                record.status = RecordStatus.SKIPPED.value
                record.skip_reason = skip_reasons[0]
                record.skip_detail = "; ".join(skip_details)
            else:
                record.status = RecordStatus.NORMAL.value

        for client_id, accounts in client_account_map.items():
            if len(accounts) > 1:
                for record in records:
                    if record.client_id == client_id and record.status == RecordStatus.NORMAL.value:
                        record.status = RecordStatus.SKIPPED.value
                        if record.skip_reason:
                            record.skip_reason += f",{SkipReason.MULTI_ACCOUNT.value}"
                        else:
                            record.skip_reason = SkipReason.MULTI_ACCOUNT.value
                        detail = f"同一客户{len(accounts)}个账号: {', '.join(sorted(accounts))}"
                        if record.skip_detail:
                            record.skip_detail += f"; {detail}"
                        else:
                            record.skip_detail = detail
                        skip_reason_summary[SkipReason.MULTI_ACCOUNT.value] += 1

        self.db.batch_insert_records(records)

        skipped_count = sum(1 for r in records if r.status == RecordStatus.SKIPPED.value)
        normal_count = sum(1 for r in records if r.status == RecordStatus.NORMAL.value)
        need_review_count = sum(
            1 for r in records
            if r.status == RecordStatus.SKIPPED.value and r.skip_reason in [
                SkipReason.CALIBER_MISMATCH.value,
                SkipReason.MULTI_ACCOUNT.value,
                SkipReason.CROSS_SETTLEMENT_REFUND.value
            ]
        )
        processed_count = len(records)

        return processed_count, skipped_count, normal_count, need_review_count, dict(skip_reason_summary)

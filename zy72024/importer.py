import json
import pandas as pd
import re
from datetime import datetime
from pathlib import Path
from typing import Tuple, List, Dict, Any, Optional

from models import Database


HANDLER_ALIASES = {
    "老张": "张伟",
    "老李": "李明",
    "老王": "王芳",
    "小周": "周杰",
    "zhou": "周杰",
    "zhang": "张伟",
    "li": "李明",
}

DATE_PATTERNS = [
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%Y.%m.%d",
    "%Y年%m月%d日",
    "%m/%d/%Y",
    "%d-%m-%Y",
    "%d/%m/%Y",
    "%Y%m%d",
]

TRANS_TYPE_MAP = {
    "预付": "prepay",
    "预存": "prepay",
    "充值": "prepay",
    "prepay": "prepay",
    "充值缴费": "prepay",
    "使用": "usage",
    "消费": "usage",
    "usage": "usage",
    "电费": "usage",
    "水费": "usage",
    "扣费": "usage",
    "扣款": "usage",
}

CURRENCY_MAP = {
    "¥": "CNY",
    "￥": "CNY",
    "CNY": "CNY",
    "RMB": "CNY",
    "人民币": "CNY",
    "$": "USD",
    "USD": "USD",
    "美元": "USD",
    "€": "EUR",
    "EUR": "EUR",
}


class DataImporter:
    def __init__(self, db: Database):
        self.db = db
        self.warnings: List[str] = []
        self.errors: List[str] = []

    def parse_date(self, date_str: Any) -> Tuple[Optional[str], Optional[str]]:
        if pd.isna(date_str) or date_str is None or str(date_str).strip() == "":
            return None, "日期为空"

        date_str = str(date_str).strip()

        if isinstance(date_str, str) and date_str.isdigit() and len(date_str) == 8:
            try:
                dt = datetime.strptime(date_str, "%Y%m%d")
                return dt.strftime("%Y-%m-%d"), None
            except ValueError:
                pass

        for pattern in DATE_PATTERNS:
            try:
                dt = datetime.strptime(date_str, pattern)
                return dt.strftime("%Y-%m-%d"), None
            except ValueError:
                continue

        try:
            ts = pd.to_datetime(date_str)
            if pd.notna(ts):
                return ts.strftime("%Y-%m-%d"), None
        except Exception:
            pass

        return None, f"无法解析日期格式: {date_str}"

    def parse_amount(self, amount_str: Any) -> Tuple[Optional[float], str, Optional[str]]:
        if pd.isna(amount_str) or amount_str is None or str(amount_str).strip() == "":
            return None, "CNY", "金额为空"

        raw = str(amount_str).strip()
        currency = "CNY"
        warning = None

        for symbol, curr in CURRENCY_MAP.items():
            if symbol in raw:
                currency = curr
                raw = raw.replace(symbol, "")
                break

        raw = raw.replace(",", "").replace("，", "").strip()

        match = re.search(r"-?\d+\.?\d*", raw)
        if match:
            try:
                amount = float(match.group())
                return amount, currency, warning
            except ValueError:
                pass

        try:
            amount = float(raw)
            return amount, currency, warning
        except ValueError:
            return None, currency, f"无法解析金额: {amount_str}"

    def parse_handler(self, handler_str: Any) -> Tuple[Optional[str], Optional[str]]:
        if pd.isna(handler_str) or handler_str is None or str(handler_str).strip() == "":
            return None, "经办人为空"

        handler = str(handler_str).strip()
        warning = None

        if handler in HANDLER_ALIASES:
            warning = f"经办人别名映射: {handler} -> {HANDLER_ALIASES[handler]}"
            handler = HANDLER_ALIASES[handler]

        return handler, warning

    def parse_trans_type(self, type_str: Any) -> Tuple[Optional[str], Optional[str]]:
        if pd.isna(type_str) or type_str is None or str(type_str).strip() == "":
            return None, "交易类型为空"

        type_str = str(type_str).strip()
        type_lower = type_str.lower()

        for key, value in TRANS_TYPE_MAP.items():
            if key.lower() in type_lower or type_lower in key.lower():
                return value, None

        if "prepay" in type_lower or "预付" in type_str or "充" in type_str:
            return "prepay", f"模糊匹配交易类型: {type_str} -> prepay"
        if "usage" in type_lower or "使用" in type_str or "费" in type_str or "扣" in type_str:
            return "usage", f"模糊匹配交易类型: {type_str} -> usage"

        return None, f"无法识别交易类型: {type_str}"

    def clean_row(self, row: Dict[str, Any], row_num: int) -> Tuple[Optional[Dict[str, Any]], List[str]]:
        cleaned = {}
        warnings = []

        def get_value(*keys: str) -> Any:
            for key in keys:
                if key in row and row[key] is not None and not pd.isna(row[key]):
                    return row[key]
            return None

        date_val = get_value("日期", "date", "交易日期", "发生日期", "时间")
        trans_date, date_warn = self.parse_date(date_val)
        if date_warn:
            warnings.append(f"行{row_num}: {date_warn}")
        if trans_date:
            cleaned["trans_date"] = trans_date
        else:
            return None, warnings + [f"行{row_num}: 缺少有效日期，跳过"]

        type_val = get_value("类型", "交易类型", "type", "收支类型", "类别", "摘要")
        trans_type, type_warn = self.parse_trans_type(type_val)
        if type_warn:
            warnings.append(f"行{row_num}: {type_warn}")
        if trans_type:
            cleaned["trans_type"] = trans_type
        else:
            return None, warnings + [f"行{row_num}: 缺少有效交易类型，跳过"]

        amount_val = get_value("金额", "amount", "发生额", "费用", "发生金额")
        amount, currency, amount_warn = self.parse_amount(amount_val)
        if amount_warn:
            warnings.append(f"行{row_num}: {amount_warn}")
        if amount is not None:
            cleaned["amount"] = abs(amount)
            cleaned["currency"] = currency
            if trans_type == "usage" and amount > 0 and "扣" in str(type_val or ""):
                pass
        else:
            return None, warnings + [f"行{row_num}: 缺少有效金额，跳过"]

        handler_val = get_value("经办人", "handler", "操作员", "经手人", "操作人")
        handler, handler_warn = self.parse_handler(handler_val)
        if handler_warn:
            warnings.append(f"行{row_num}: {handler_warn}")
        cleaned["handler"] = handler

        cleaned["department"] = get_value("部门", "department", "所属部门")
        cleaned["bill_no"] = get_value("单号", "bill_no", "单据号", "发票号", "编号")
        cleaned["remark"] = get_value("备注", "remark", "说明", "附注")

        if cleaned["trans_type"] == "prepay":
            cleaned["amount"] = abs(cleaned["amount"])
        elif cleaned["trans_type"] == "usage":
            cleaned["amount"] = abs(cleaned["amount"])

        return cleaned, warnings

    def read_file(self, file_path: str) -> List[Tuple[str, pd.DataFrame]]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        sheets = []
        suffix = path.suffix.lower()

        if suffix == ".csv":
            df = None
            last_error = None

            for encoding in ["utf-8", "gbk", "utf-8-sig"]:
                try:
                    df = pd.read_csv(path, encoding=encoding, quotechar='"', escapechar='\\')
                    break
                except (UnicodeDecodeError, pd.errors.ParserError) as e:
                    last_error = e
                    continue

            if df is None:
                try:
                    df = pd.read_csv(path, encoding=None, engine='python',
                                     quotechar='"', error_bad_lines=False, warn_bad_lines=True)
                except Exception as e:
                    raise ValueError(f"CSV文件解析失败: {last_error or e}") from last_error

            sheets.append(("Sheet1", df))
        elif suffix in [".xlsx", ".xls"]:
            xls = pd.ExcelFile(path)
            for sheet_name in xls.sheet_names:
                df = pd.read_excel(xls, sheet_name=sheet_name)
                sheets.append((sheet_name, df))
        else:
            raise ValueError(f"不支持的文件格式: {suffix}")

        return sheets

    def detect_conflict(self, existing_raw: str, new_raw: str) -> Optional[str]:
        import json
        try:
            existing = json.loads(existing_raw)
            new = json.loads(new_raw)
        except (json.JSONDecodeError, TypeError):
            return "无法解析原始数据进行比较"

        differences = []
        all_keys = set(existing.keys()) | set(new.keys())

        for key in all_keys:
            old_val = str(existing.get(key, "")) if existing.get(key) is not None else ""
            new_val = str(new.get(key, "")) if new.get(key) is not None else ""
            if old_val != new_val:
                differences.append(f"{key}: '{old_val}' -> '{new_val}'")

        if differences:
            return "; ".join(differences)
        return None

    def import_file(self, file_path: str, on_duplicate: str = "skip") -> Dict[str, Any]:
        sheets = self.read_file(file_path)
        batch_id = self.db.start_batch(file_path)

        total = 0
        imported = 0
        skipped = 0
        updated = 0
        conflicts = 0
        all_warnings = []

        for sheet_name, df in sheets:
            df = df.where(pd.notnull(df), None)

            for idx, row in enumerate(df.itertuples(index=False), start=2):
                total += 1
                row_dict = dict(zip(df.columns, list(row)))

                data_hash = self.db.compute_hash(row_dict)
                existing = self.db.find_existing_record(data_hash)

                if existing:
                    existing_id = existing["id"]
                    if on_duplicate == "skip":
                        self.db.update_source_record_status(
                            existing_id, "skipped",
                            f"批次{batch_id}: 重复记录，已跳过 (文件行{idx})"
                        )
                        skipped += 1
                        all_warnings.append(f"行{idx}: 重复记录，已跳过 (现有记录ID: {existing_id})")
                        continue
                    elif on_duplicate == "update":
                        cleaned, warnings = self.clean_row(row_dict, idx)
                        if cleaned is None:
                            all_warnings.extend(warnings)
                            skipped += 1
                            self.db.update_source_record_status(
                                existing_id, "skipped",
                                f"批次{batch_id}: 数据清洗失败，跳过 (文件行{idx}): {'; '.join(warnings)}"
                            )
                            continue

                        self.db.update_source_record_status(
                            existing_id, "updated",
                            f"批次{batch_id}: 重复记录，已更新 (文件行{idx})"
                        )

                        old_std = self.db.get_standardized_by_source(existing_id)
                        if old_std:
                            changes = self.db.update_standardized_record(old_std["id"], cleaned, warnings)
                            updated += 1
                            if changes > 0:
                                all_warnings.append(f"行{idx}: 记录{existing_id}已更新，{changes}个字段变更")
                            else:
                                all_warnings.append(f"行{idx}: 记录{existing_id}无变化")
                            all_warnings.extend(warnings)
                        else:
                            try:
                                self.db.insert_standardized_record(existing_id, cleaned, warnings)
                                imported += 1
                                all_warnings.extend(warnings)
                            except Exception as e:
                                old_std = self.db.get_standardized_by_source(existing_id)
                                if old_std:
                                    changes = self.db.update_standardized_record(old_std["id"], cleaned, warnings)
                                    updated += 1
                                    all_warnings.append(f"行{idx}: 记录{existing_id}已更新（容错处理），{changes}个字段变更")
                                else:
                                    all_warnings.append(f"行{idx}: 记录{existing_id}处理失败: {e}")
                                    skipped += 1
                                all_warnings.extend(warnings)
                        continue
                    elif on_duplicate == "conflict":
                        conflict_detail = self.detect_conflict(
                            existing["raw_data"], json.dumps(row_dict, ensure_ascii=False)
                        )
                        if conflict_detail:
                            self.db.update_source_record_status(
                                existing_id, "conflict",
                                f"批次{batch_id}: 发现冲突 (文件行{idx}): {conflict_detail}"
                            )
                            conflicts += 1
                            all_warnings.append(f"行{idx}: 记录{existing_id}发现冲突 - {conflict_detail}")
                        else:
                            self.db.update_source_record_status(
                                existing_id, "skipped",
                                f"批次{batch_id}: 重复记录，数据一致，跳过 (文件行{idx})"
                            )
                            skipped += 1
                            all_warnings.append(f"行{idx}: 记录{existing_id}数据一致，跳过")
                        continue

                cleaned, warnings = self.clean_row(row_dict, idx)
                all_warnings.extend(warnings)

                if cleaned is None:
                    self.db.insert_source_record(
                        file_path, sheet_name, idx, row_dict, batch_id,
                        status="skipped", status_note="; ".join(warnings)
                    )
                    skipped += 1
                    continue

                source_id, _ = self.db.insert_source_record(
                    file_path, sheet_name, idx, row_dict, batch_id,
                    status="imported"
                )
                self.db.insert_standardized_record(source_id, cleaned, warnings)
                imported += 1

        self.db.complete_batch(batch_id, total, skipped, updated, conflicts)

        return {
            "batch_id": batch_id,
            "total": total,
            "imported": imported,
            "skipped": skipped,
            "updated": updated,
            "conflicts": conflicts,
            "warnings": all_warnings
        }

    def add_note_to_record(self, record_id: int, note_text: str, operator: str = "operator") -> Dict[str, Any]:
        record = self.db.get_standardized_record(record_id)
        if not record:
            return {"success": False, "error": f"记录不存在: {record_id}"}

        old_balance = 0
        all_records = self.db.get_all_records()
        for r in sorted(all_records, key=lambda x: x["trans_date"]):
            if r["trans_type"] == "prepay":
                old_balance += r["amount"]
            elif r["trans_type"] == "usage":
                old_balance -= r["amount"]

        note_id = self.db.add_note(record_id, note_text, operator)

        all_records_after = self.db.get_all_records()
        new_balance = 0
        for r in sorted(all_records_after, key=lambda x: x["trans_date"]):
            if r["trans_type"] == "prepay":
                new_balance += r["amount"]
            elif r["trans_type"] == "usage":
                new_balance -= r["amount"]

        return {
            "success": True,
            "note_id": note_id,
            "record_id": record_id,
            "balance_before": round(old_balance, 2),
            "balance_after": round(new_balance, 2),
            "balance_diff": round(new_balance - old_balance, 2)
        }

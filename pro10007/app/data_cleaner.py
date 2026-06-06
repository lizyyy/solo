import pandas as pd
import re
from datetime import datetime
from typing import Dict, List, Tuple, Any
import json


class DataCleaningResult:
    def __init__(self):
        self.cleaned_data: List[Dict] = []
        self.cleaning_notes: List[str] = []
        self.invalid_records: List[Dict] = []
        self.duplicate_records: List[Dict] = []

    def add_note(self, note: str):
        self.cleaning_notes.append(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {note}")

    def get_notes_summary(self) -> str:
        return "\n".join(self.cleaning_notes)


class LoanDataCleaner:
    DATE_FORMATS = [
        "%Y-%m-%d", "%Y/%m/%d", "%Y%m%d",
        "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S",
        "%d-%m-%Y", "%d/%m/%Y"
    ]

    def __init__(self):
        self.result = DataCleaningResult()
        self.seen_accounts = set()
        self.seen_customers = {}

    def parse_date(self, date_str: Any) -> Tuple[datetime, List[str]]:
        notes = []
        if pd.isna(date_str) or date_str is None or str(date_str).strip() == "":
            notes.append("日期为空，已标记为待补全")
            return None, notes

        date_str = str(date_str).strip()

        for fmt in self.DATE_FORMATS:
            try:
                parsed = datetime.strptime(date_str, fmt)
                if fmt != "%Y-%m-%d":
                    notes.append(f"日期格式 '{date_str}' 已统一转换为 YYYY-MM-DD 格式")
                return parsed.date(), notes
            except ValueError:
                continue

        notes.append(f"日期格式 '{date_str}' 无法解析，已标记为异常")
        return None, notes

    def parse_amount(self, amount_str: Any, field_name: str) -> Tuple[float, List[str]]:
        notes = []
        if pd.isna(amount_str) or amount_str is None or str(amount_str).strip() == "":
            notes.append(f"{field_name}为空，已标记为待补全")
            return None, notes

        amount_str = str(amount_str).strip()
        amount_str = amount_str.replace(",", "").replace("￥", "").replace("¥", "").replace("元", "")

        try:
            amount = float(amount_str)
            if amount < 0:
                notes.append(f"{field_name}为负数 ({amount_str})，请注意核实")
            return amount, notes
        except ValueError:
            notes.append(f"{field_name}格式异常 '{amount_str}'，无法解析为数字")
            return None, notes

    def normalize_id_card(self, id_card: Any) -> Tuple[str, List[str]]:
        notes = []
        if pd.isna(id_card) or id_card is None or str(id_card).strip() == "":
            notes.append("身份证号为空，已标记为待补全")
            return None, notes

        id_card = str(id_card).strip().upper()

        if len(id_card) == 15:
            notes.append("15位身份证号已升级为18位格式（补全年份和校验位）")
            id_card = id_card[:6] + "19" + id_card[6:]
            weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
            check_codes = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"]
            total = sum(int(id_card[i]) * weights[i] for i in range(17))
            id_card = id_card + check_codes[total % 11]
        elif len(id_card) != 18:
            notes.append(f"身份证号长度异常 ({len(id_card)}位)，请注意核实")

        return id_card, notes

    def normalize_phone(self, phone: Any) -> Tuple[str, List[str]]:
        notes = []
        if pd.isna(phone) or phone is None or str(phone).strip() == "":
            notes.append("手机号为空，已标记为待补全")
            return None, notes

        phone = str(phone).strip()
        phone = re.sub(r"[\s\-()]", "", phone)

        if phone.startswith("+86"):
            phone = phone[3:]
            notes.append("手机号已移除国际区号 +86")

        if len(phone) != 11 or not phone.startswith("1"):
            notes.append(f"手机号格式异常 '{phone}'，请注意核实")

        return phone, notes

    def normalize_customer_name(self, name: Any) -> Tuple[str, List[str]]:
        notes = []
        if pd.isna(name) or name is None or str(name).strip() == "":
            notes.append("客户姓名为空，已标记为待补全")
            return None, notes

        name = str(name).strip()
        name = re.sub(r"\s+", "", name)

        return name, notes

    def normalize_account_no(self, account_no: Any) -> Tuple[str, List[str]]:
        notes = []
        if pd.isna(account_no) or account_no is None or str(account_no).strip() == "":
            notes.append("账号为空，已标记为待补全")
            return None, notes

        account_no = str(account_no).strip()
        account_no = re.sub(r"[\s\-]", "", account_no)

        return account_no, notes

    def clean_customer_data(self, row: pd.Series, row_idx: int) -> Dict:
        record_notes = []
        cleaned = {}

        customer_id = str(row.get("customer_id", row.get("客户编号", ""))).strip()
        if not customer_id or customer_id == "nan":
            customer_id = f"TEMP_{row_idx}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
            record_notes.append(f"客户编号缺失，已生成临时编号: {customer_id}")
        cleaned["customer_id"] = customer_id

        customer_name, name_notes = self.normalize_customer_name(row.get("customer_name", row.get("客户姓名", "")))
        cleaned["customer_name"] = customer_name
        record_notes.extend(name_notes)

        id_card, id_notes = self.normalize_id_card(row.get("id_card", row.get("身份证号", "")))
        cleaned["id_card"] = id_card
        record_notes.extend(id_notes)

        phone, phone_notes = self.normalize_phone(row.get("phone", row.get("手机号", "")))
        cleaned["phone"] = phone
        record_notes.extend(phone_notes)

        if id_card and id_card in self.seen_customers:
            existing_customer = self.seen_customers[id_card]
            if existing_customer["customer_id"] != customer_id:
                record_notes.append(
                    f"发现同一客户拆分为多个账号: "
                    f"身份证 {id_card} 对应客户编号 {existing_customer['customer_id']} 和 {customer_id}，"
                    f"已关联到同一客户"
                )
                cleaned["customer_id"] = existing_customer["customer_id"]
        elif id_card:
            self.seen_customers[id_card] = {
                "customer_id": cleaned["customer_id"],
                "customer_name": cleaned["customer_name"]
            }

        cleaned["data_quality_notes"] = "; ".join(record_notes) if record_notes else ""
        cleaned["_row_notes"] = [f"第{row_idx + 1}行: {note}" for note in record_notes]

        return cleaned

    def clean_account_data(self, row: pd.Series, row_idx: int) -> Dict:
        record_notes = []
        cleaned = {}

        account_no, acct_notes = self.normalize_account_no(row.get("account_no", row.get("贷款账号", "")))
        cleaned["account_no"] = account_no
        record_notes.extend(acct_notes)

        if account_no:
            if account_no in self.seen_accounts:
                record_notes.append(f"发现重复账号 {account_no}，已跳过重复记录")
                self.result.duplicate_records.append({
                    "row": row_idx + 1,
                    "account_no": account_no,
                    "reason": "账号重复"
                })
                return None
            self.seen_accounts.add(account_no)

        customer_id = str(row.get("customer_id", row.get("客户编号", ""))).strip()
        if not customer_id or customer_id == "nan":
            customer_id = f"TEMP_{row_idx}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
            record_notes.append(f"客户编号缺失，已生成临时编号: {customer_id}")
        cleaned["customer_id"] = customer_id

        loan_amount, la_notes = self.parse_amount(row.get("loan_amount", row.get("贷款金额", "")), "贷款金额")
        cleaned["loan_amount"] = loan_amount
        record_notes.extend(la_notes)

        outstanding, op_notes = self.parse_amount(row.get("outstanding_principal", row.get("剩余本金", "")), "剩余本金")
        cleaned["outstanding_principal"] = outstanding
        record_notes.extend(op_notes)

        interest_rate = row.get("interest_rate", row.get("利率", ""))
        if pd.isna(interest_rate) or str(interest_rate).strip() == "":
            record_notes.append("利率为空，已标记为待补全")
            cleaned["interest_rate"] = None
        else:
            try:
                rate_str = str(interest_rate).strip().replace("%", "")
                cleaned["interest_rate"] = float(rate_str)
                if "%" in str(interest_rate):
                    record_notes.append("利率已移除百分号，存储为小数形式")
            except ValueError:
                record_notes.append(f"利率格式异常 '{interest_rate}'")
                cleaned["interest_rate"] = None

        start_date, sd_notes = self.parse_date(row.get("loan_start_date", row.get("放款日期", "")))
        cleaned["loan_start_date"] = start_date
        record_notes.extend(sd_notes)

        due_date, dd_notes = self.parse_date(row.get("loan_due_date", row.get("到期日期", "")))
        cleaned["loan_due_date"] = due_date
        record_notes.extend(dd_notes)

        actual_repay_date, ard_notes = self.parse_date(row.get("actual_repayment_date", row.get("实际还款日期", "")))
        cleaned["actual_repayment_date"] = actual_repay_date
        record_notes.extend(ard_notes)

        status = row.get("status", row.get("贷款状态", ""))
        if pd.isna(status) or str(status).strip() == "":
            record_notes.append("贷款状态为空，已标记为'待核实'")
            cleaned["status"] = "待核实"
        else:
            cleaned["status"] = str(status).strip()

        cleaned["data_quality_notes"] = "; ".join(record_notes) if record_notes else ""
        cleaned["raw_data"] = json.dumps(row.to_dict(), ensure_ascii=False, default=str)

        for note in record_notes:
            self.result.add_note(f"第{row_idx + 1}行: {note}")

        return cleaned

    def clean_repayment_data(self, row: pd.Series, row_idx: int) -> Dict:
        record_notes = []
        cleaned = {}

        account_no, acct_notes = self.normalize_account_no(row.get("account_no", row.get("贷款账号", "")))
        cleaned["account_no"] = account_no
        record_notes.extend(acct_notes)

        repay_date, rd_notes = self.parse_date(row.get("repayment_date", row.get("还款日期", "")))
        cleaned["repayment_date"] = repay_date
        record_notes.extend(rd_notes)

        repay_amount, ra_notes = self.parse_amount(row.get("repayment_amount", row.get("还款金额", "")), "还款金额")
        cleaned["repayment_amount"] = repay_amount
        record_notes.extend(ra_notes)

        repayment_type = row.get("repayment_type", row.get("还款类型", ""))
        if pd.isna(repayment_type) or str(repayment_type).strip() == "":
            record_notes.append("还款类型为空，已标记为'正常还款'")
            cleaned["repayment_type"] = "正常还款"
        else:
            cleaned["repayment_type"] = str(repayment_type).strip()

        clearing_date, cd_notes = self.parse_date(row.get("clearing_date", row.get("清算日期", "")))
        cleaned["clearing_date"] = clearing_date
        record_notes.extend(cd_notes)

        is_refund = row.get("is_refund", row.get("是否退款", False))
        cleaned["is_refund"] = bool(is_refund) if not pd.isna(is_refund) else False

        source_material = row.get("source_material", row.get("来源材料", ""))
        cleaned["source_material"] = str(source_material).strip() if not pd.isna(source_material) else ""

        cleaned["data_quality_notes"] = "; ".join(record_notes) if record_notes else ""

        for note in record_notes:
            self.result.add_note(f"第{row_idx + 1}行: {note}")

        return cleaned

    def clean_dataframe(self, df: pd.DataFrame, data_type: str = "account") -> DataCleaningResult:
        self.result = DataCleaningResult()
        self.seen_accounts = set()
        self.seen_customers = {}

        self.result.add_note(f"开始清洗数据，共 {len(df)} 条记录")

        for idx, row in df.iterrows():
            try:
                if data_type == "customer":
                    cleaned = self.clean_customer_data(row, idx)
                    self.result.cleaned_data.append(cleaned)
                elif data_type == "account":
                    cleaned = self.clean_account_data(row, idx)
                    if cleaned is not None:
                        self.result.cleaned_data.append(cleaned)
                    else:
                        self.result.invalid_records.append({"row": idx + 1, "data": row.to_dict()})
                elif data_type == "repayment":
                    cleaned = self.clean_repayment_data(row, idx)
                    self.result.cleaned_data.append(cleaned)
            except Exception as e:
                self.result.add_note(f"第{idx + 1}行处理异常: {str(e)}")
                self.result.invalid_records.append({"row": idx + 1, "data": row.to_dict(), "error": str(e)})

        valid_count = len(self.result.cleaned_data)
        invalid_count = len(self.result.invalid_records)
        duplicate_count = len(self.result.duplicate_records)

        self.result.add_note(
            f"数据清洗完成: 有效 {valid_count} 条, "
            f"无效/异常 {invalid_count} 条, "
            f"重复 {duplicate_count} 条"
        )

        return self.result

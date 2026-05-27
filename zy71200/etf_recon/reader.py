import csv
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional, Tuple

import pandas as pd

from .models import (
    BrokerReceipt,
    CashSubstitution,
    ComponentSecurity,
    ReceiptStatus,
    RedemptionList,
    SecurityType,
    SubstitutionFlag,
    SuspendedSecurity,
)


class DataReader:
    def __init__(self):
        pass

    def _parse_date(self, date_str: str) -> date:
        for fmt in ["%Y-%m-%d", "%Y%m%d", "%Y/%m/%d", "%m/%d/%Y"]:
            try:
                return datetime.strptime(date_str.strip(), fmt).date()
            except ValueError:
                continue
        raise ValueError(f"无法解析日期: {date_str}")

    def _parse_datetime(self, dt_str: str) -> datetime:
        for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y%m%d %H%M%S"]:
            try:
                return datetime.strptime(dt_str.strip(), fmt)
            except ValueError:
                continue
        raise ValueError(f"无法解析时间: {dt_str}")

    def _parse_substitution_flag(self, flag_str: str) -> SubstitutionFlag:
        flag_str = flag_str.strip().lower()
        if flag_str in ["允许", "allowed", "是", "y", "1"]:
            return SubstitutionFlag.ALLOWED
        elif flag_str in ["必须", "must", "强制"]:
            return SubstitutionFlag.MUST
        return SubstitutionFlag.FORBIDDEN

    def _parse_security_type(self, type_str: str) -> SecurityType:
        type_str = type_str.strip().lower()
        if type_str in ["债券", "bond", "b"]:
            return SecurityType.BOND
        elif type_str in ["现金", "cash", "c"]:
            return SecurityType.CASH
        return SecurityType.STOCK

    def _normalize_security_code(self, code: str) -> str:
        code = code.strip()
        if code.replace('.', '', 1).isdigit():
            num_code = str(int(float(code)))
            if len(num_code) <= 6:
                return num_code.zfill(6)
        return code

    def _find_header_row(self, df, header_keyword: str) -> int:
        for idx, row in df.iterrows():
            for val in row.values:
                if str(val).strip() == header_keyword:
                    return idx
        return 0

    def read_redemption_list(self, file_path: str) -> RedemptionList:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"申赎清单文件不存在: {file_path}")

        df_raw = pd.read_excel(file_path, header=None) if path.suffix in [".xlsx", ".xls"] else pd.read_csv(file_path, header=None)

        etf_code = "510000"
        etf_name = "未知ETF"
        trade_date = date.today()
        creation_unit = 1000000
        total_cash_sub = 0.0
        estimated_cash = 0.0

        header_map = {}
        for idx, row in df_raw.iterrows():
            values = [str(v).strip() if pd.notna(v) else "" for v in row.values]

            if idx == 0:
                for i, val in enumerate(values):
                    if val:
                        header_map[val] = i
                continue

            if idx == 1:
                if "ETF代码" in header_map and header_map["ETF代码"] < len(values):
                    etf_code = values[header_map["ETF代码"]]
                if "ETF名称" in header_map and header_map["ETF名称"] < len(values):
                    etf_name = values[header_map["ETF名称"]]
                if "交易日期" in header_map and header_map["交易日期"] < len(values) and values[header_map["交易日期"]]:
                    trade_date = self._parse_date(values[header_map["交易日期"]])
                if "最小申赎单位" in header_map and header_map["最小申赎单位"] < len(values) and values[header_map["最小申赎单位"]]:
                    creation_unit = int(float(values[header_map["最小申赎单位"]]))
                if "现金替代总金额" in header_map and header_map["现金替代总金额"] < len(values) and values[header_map["现金替代总金额"]]:
                    total_cash_sub = float(values[header_map["现金替代总金额"]])
                if "预估现金" in header_map and header_map["预估现金"] < len(values) and values[header_map["预估现金"]]:
                    estimated_cash = float(values[header_map["预估现金"]])
                break

        header_row = self._find_header_row(df_raw, "证券代码")
        df = pd.read_excel(file_path, header=header_row) if path.suffix in [".xlsx", ".xls"] else pd.read_csv(file_path, header=header_row)

        components = []
        for _, row in df.iterrows():
            code = self._normalize_security_code(str(row.get("证券代码", row.get("code", ""))))
            if not code or code in ["ETF代码", "nan", "证券代码"] or code.lower() == "nan":
                continue
            name = str(row.get("证券名称", row.get("name", ""))).strip()
            try:
                quantity = int(float(row.get("数量", row.get("quantity", 0))))
            except (ValueError, TypeError):
                continue
            if quantity <= 0:
                continue

            comp = ComponentSecurity(
                code=code,
                name=name,
                quantity=quantity,
                security_type=self._parse_security_type(str(row.get("证券类型", row.get("security_type", "股票")))),
                substitution_flag=self._parse_substitution_flag(
                    str(row.get("替代标志", row.get("substitution_flag", "禁止")))
                ),
                substitution_cash=float(row.get("替代金额", row.get("substitution_cash", 0.0)) or 0),
            )
            components.append(comp)

        return RedemptionList(
            etf_code=etf_code,
            etf_name=etf_name,
            trade_date=trade_date,
            creation_unit=creation_unit,
            components=components,
            total_cash_substitution=total_cash_sub,
            estimated_cash=estimated_cash,
        )

    def read_broker_receipt(self, file_path: str) -> BrokerReceipt:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"券商回执文件不存在: {file_path}")

        df_raw = pd.read_excel(file_path, header=None) if path.suffix in [".xlsx", ".xls"] else pd.read_csv(file_path, header=None)

        broker_name = "未知券商"
        receipt_time = datetime.now()
        receipt_version = 1
        status_str = "最终回执"
        total_cash_sub = 0.0
        actual_cash = 0.0
        remarks = ""

        header_map = {}
        for idx, row in df_raw.iterrows():
            values = [str(v).strip() if pd.notna(v) else "" for v in row.values]

            if idx == 0:
                for i, val in enumerate(values):
                    if val:
                        header_map[val] = i
                continue

            if idx == 1:
                if "券商名称" in header_map and header_map["券商名称"] < len(values):
                    broker_name = values[header_map["券商名称"]]
                if "回执时间" in header_map and header_map["回执时间"] < len(values) and values[header_map["回执时间"]]:
                    receipt_time = self._parse_datetime(values[header_map["回执时间"]])
                if "版本号" in header_map and header_map["版本号"] < len(values) and values[header_map["版本号"]]:
                    receipt_version = int(float(values[header_map["版本号"]]))
                if "回执状态" in header_map and header_map["回执状态"] < len(values) and values[header_map["回执状态"]]:
                    status_str = values[header_map["回执状态"]]
                if "实际现金替代总额" in header_map and header_map["实际现金替代总额"] < len(values) and values[header_map["实际现金替代总额"]]:
                    total_cash_sub = float(values[header_map["实际现金替代总额"]])
                if "实际现金" in header_map and header_map["实际现金"] < len(values) and values[header_map["实际现金"]]:
                    actual_cash = float(values[header_map["实际现金"]])
                if "备注" in header_map and header_map["备注"] < len(values):
                    remarks = values[header_map["备注"]]
                break

        status = ReceiptStatus.FINAL
        if "初步" in status_str or "preliminary" in status_str.lower():
            status = ReceiptStatus.PRELIMINARY
        elif "更正" in status_str or "corrected" in status_str.lower():
            status = ReceiptStatus.CORRECTED

        header_row = self._find_header_row(df_raw, "证券代码")
        df = pd.read_excel(file_path, header=header_row) if path.suffix in [".xlsx", ".xls"] else pd.read_csv(file_path, header=header_row)

        components = []
        for _, row in df.iterrows():
            code = self._normalize_security_code(str(row.get("证券代码", row.get("code", ""))))
            if not code or code in ["券商名称", "nan", "证券代码"] or code.lower() == "nan":
                continue
            name = str(row.get("证券名称", row.get("name", ""))).strip()
            try:
                quantity = int(float(row.get("实际数量", row.get("quantity", row.get("实际交收数量", 0)))))
            except (ValueError, TypeError):
                continue

            comp = ComponentSecurity(
                code=code,
                name=name,
                quantity=quantity,
                substitution_flag=self._parse_substitution_flag(
                    str(row.get("替代标志", row.get("substitution_flag", "禁止")))
                ),
                substitution_cash=float(row.get("实际替代金额", row.get("substitution_cash", 0.0)) or 0),
            )
            components.append(comp)

        return BrokerReceipt(
            broker_name=broker_name,
            receipt_time=receipt_time,
            receipt_version=receipt_version,
            status=status,
            components=components,
            total_cash_substituted=total_cash_sub,
            actual_cash=actual_cash,
            remarks=remarks,
        )

    def read_suspended_securities(self, file_path: str) -> List[SuspendedSecurity]:
        path = Path(file_path)
        if not path.exists():
            return []

        df = pd.read_excel(file_path) if path.suffix in [".xlsx", ".xls"] else pd.read_csv(file_path)

        suspended = []
        for _, row in df.iterrows():
            code = self._normalize_security_code(str(row.get("证券代码", row.get("code", ""))))
            if not code or code == "nan":
                continue
            name = str(row.get("证券名称", row.get("name", ""))).strip()
            suspend_date = self._parse_date(str(row.get("停牌日期", row.get("suspend_date", date.today()))))
            reason = str(row.get("停牌原因", row.get("reason", ""))).strip()
            is_resumed = str(row.get("是否复牌", row.get("is_resumed", "否"))).strip() in ["是", "Y", "true", "1"]

            suspended.append(
                SuspendedSecurity(
                    code=code,
                    name=name,
                    suspend_date=suspend_date,
                    reason=reason,
                    is_resumed=is_resumed,
                )
            )
        return suspended

    def read_cash_substitution(self, file_path: str) -> List[CashSubstitution]:
        path = Path(file_path)
        if not path.exists():
            return []

        df = pd.read_excel(file_path) if path.suffix in [".xlsx", ".xls"] else pd.read_csv(file_path)

        substitutions = []
        for _, row in df.iterrows():
            code = self._normalize_security_code(str(row.get("证券代码", row.get("code", ""))))
            if not code or code == "nan":
                continue
            name = str(row.get("证券名称", row.get("name", ""))).strip()
            sub_type = str(row.get("替代类型", row.get("substitution_type", "正常"))).strip()
            amount = float(row.get("替代金额", row.get("amount", 0.0)))
            unit_price = float(row.get("单位价格", row.get("unit_price", 0.0)))
            quantity = int(float(row.get("数量", row.get("quantity", 0))))

            substitutions.append(
                CashSubstitution(
                    code=code,
                    name=name,
                    substitution_type=sub_type,
                    amount=amount,
                    unit_price=unit_price,
                    quantity=quantity,
                )
            )
        return substitutions

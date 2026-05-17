import csv
import os
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

from .models import (
    Contract,
    Showcase,
    LeasePeriod,
    AddCabinetRecord,
    DepositRecord,
    SourceLocation,
    BadRow,
)


class DataParser:
    def __init__(self):
        self.bad_rows: List[BadRow] = []
        self.date_formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%Y%m%d",
            "%m-%d-%Y",
            "%m/%d/%Y",
        ]

    def parse_date(self, date_str: str) -> Optional[date]:
        if not date_str or str(date_str).strip() == "":
            return None
        date_str = str(date_str).strip()
        for fmt in self.date_formats:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        return None

    def parse_decimal(self, value: Any) -> Optional[Decimal]:
        if value is None or str(value).strip() == "":
            return None
        value_str = str(value).strip().replace(",", "")
        try:
            return Decimal(value_str)
        except InvalidOperation:
            return None

    def parse_int(self, value: Any) -> Optional[int]:
        if value is None or str(value).strip() == "":
            return None
        value_str = str(value).strip().replace(",", "")
        try:
            return int(value_str)
        except ValueError:
            return None

    def parse_bool(self, value: Any) -> bool:
        if value is None:
            return False
        value_str = str(value).strip().lower()
        return value_str in ("true", "yes", "1", "是", "有")

    def _create_source_location(
        self, file_path: str, sheet_name: Optional[str] = None, row_number: Optional[int] = None
    ) -> SourceLocation:
        file_name = os.path.basename(file_path)
        return SourceLocation(
            file_name=file_name,
            sheet_name=sheet_name,
            row_number=row_number,
        )

    def parse_contracts_csv(self, file_path: str) -> Tuple[List[Contract], List[BadRow]]:
        contracts = []
        bad_rows = []
        file_path = str(file_path)

        required_columns = [
            "contract_id",
            "merchant_name",
            "start_date",
            "end_date",
            "daily_rate",
            "deposit_amount",
            "showcase_count",
        ]

        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames or []

            missing_cols = [col for col in required_columns if col not in headers]
            if missing_cols:
                raise ValueError(f"合同文件缺少必要列: {', '.join(missing_cols)}")

            for row_num, row in enumerate(reader, start=2):
                source = self._create_source_location(file_path, row_number=row_num)
                try:
                    contract_id = row["contract_id"].strip()
                    if not contract_id:
                        raise ValueError("contract_id不能为空")

                    start_date = self.parse_date(row["start_date"])
                    if not start_date:
                        raise ValueError(f"无效的开始日期: {row['start_date']}")

                    end_date = self.parse_date(row["end_date"])
                    if not end_date:
                        raise ValueError(f"无效的结束日期: {row['end_date']}")

                    daily_rate = self.parse_decimal(row["daily_rate"])
                    if daily_rate is None:
                        raise ValueError(f"无效的日租金: {row['daily_rate']}")

                    deposit_amount = self.parse_decimal(row["deposit_amount"])
                    if deposit_amount is None:
                        raise ValueError(f"无效的保证金: {row['deposit_amount']}")

                    showcase_count = self.parse_int(row["showcase_count"])
                    if showcase_count is None:
                        raise ValueError(f"无效的展柜数量: {row['showcase_count']}")

                    contract = Contract(
                        contract_id=contract_id,
                        merchant_name=row["merchant_name"].strip(),
                        start_date=start_date,
                        end_date=end_date,
                        daily_rate=daily_rate,
                        deposit_amount=deposit_amount,
                        showcase_count=showcase_count,
                        source=source,
                        allow_add_cabinet=self.parse_bool(row.get("allow_add_cabinet", True)),
                        add_cabinet_daily_rate=self.parse_decimal(row.get("add_cabinet_daily_rate")),
                        deposit_refund_days=self.parse_int(row.get("deposit_refund_days")) or 30,
                        billing_cycle_days=self.parse_int(row.get("billing_cycle_days")) or 30,
                        cancellation_notice_days=self.parse_int(row.get("cancellation_notice_days")) or 7,
                    )
                    contracts.append(contract)
                except Exception as e:
                    bad_rows.append(
                        BadRow(
                            source=source,
                            raw_data=dict(row),
                            error_message=str(e),
                        )
                    )

        return contracts, bad_rows

    def parse_showcases_csv(self, file_path: str) -> Tuple[List[Showcase], List[BadRow]]:
        showcases = []
        bad_rows = []
        file_path = str(file_path)

        required_columns = ["showcase_id", "contract_id", "location"]

        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames or []

            missing_cols = [col for col in required_columns if col not in headers]
            if missing_cols:
                raise ValueError(f"展柜文件缺少必要列: {', '.join(missing_cols)}")

            for row_num, row in enumerate(reader, start=2):
                source = self._create_source_location(file_path, row_number=row_num)
                try:
                    showcase_id = row["showcase_id"].strip()
                    if not showcase_id:
                        raise ValueError("showcase_id不能为空")

                    showcase = Showcase(
                        showcase_id=showcase_id,
                        contract_id=row["contract_id"].strip(),
                        location=row["location"].strip(),
                        is_active=self.parse_bool(row.get("is_active", True)),
                        source=source,
                    )
                    showcases.append(showcase)
                except Exception as e:
                    bad_rows.append(
                        BadRow(
                            source=source,
                            raw_data=dict(row),
                            error_message=str(e),
                        )
                    )

        return showcases, bad_rows

    def parse_lease_periods_csv(self, file_path: str) -> Tuple[List[LeasePeriod], List[BadRow]]:
        lease_periods = []
        bad_rows = []
        file_path = str(file_path)

        required_columns = ["lease_id", "contract_id", "showcase_id", "start_date"]

        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames or []

            missing_cols = [col for col in required_columns if col not in headers]
            if missing_cols:
                raise ValueError(f"租期文件缺少必要列: {', '.join(missing_cols)}")

            for row_num, row in enumerate(reader, start=2):
                source = self._create_source_location(file_path, row_number=row_num)
                try:
                    lease_id = row["lease_id"].strip()
                    if not lease_id:
                        raise ValueError("lease_id不能为空")

                    start_date = self.parse_date(row["start_date"])
                    if not start_date:
                        raise ValueError(f"无效的开始日期: {row['start_date']}")

                    lease = LeasePeriod(
                        lease_id=lease_id,
                        contract_id=row["contract_id"].strip(),
                        showcase_id=row["showcase_id"].strip(),
                        start_date=start_date,
                        end_date=self.parse_date(row.get("end_date")),
                        actual_end_date=self.parse_date(row.get("actual_end_date")),
                        source=source,
                    )
                    lease_periods.append(lease)
                except Exception as e:
                    bad_rows.append(
                        BadRow(
                            source=source,
                            raw_data=dict(row),
                            error_message=str(e),
                        )
                    )

        return lease_periods, bad_rows

    def parse_add_cabinet_csv(self, file_path: str) -> Tuple[List[AddCabinetRecord], List[BadRow]]:
        add_records = []
        bad_rows = []
        file_path = str(file_path)

        required_columns = ["add_id", "contract_id", "showcase_id", "add_date"]

        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames or []

            missing_cols = [col for col in required_columns if col not in headers]
            if missing_cols:
                raise ValueError(f"加柜文件缺少必要列: {', '.join(missing_cols)}")

            for row_num, row in enumerate(reader, start=2):
                source = self._create_source_location(file_path, row_number=row_num)
                try:
                    add_id = row["add_id"].strip()
                    if not add_id:
                        raise ValueError("add_id不能为空")

                    add_date = self.parse_date(row["add_date"])
                    if not add_date:
                        raise ValueError(f"无效的加柜日期: {row['add_date']}")

                    record = AddCabinetRecord(
                        add_id=add_id,
                        contract_id=row["contract_id"].strip(),
                        showcase_id=row["showcase_id"].strip(),
                        add_date=add_date,
                        remove_date=self.parse_date(row.get("remove_date")),
                        daily_rate_override=self.parse_decimal(row.get("daily_rate_override")),
                        source=source,
                    )
                    add_records.append(record)
                except Exception as e:
                    bad_rows.append(
                        BadRow(
                            source=source,
                            raw_data=dict(row),
                            error_message=str(e),
                        )
                    )

        return add_records, bad_rows

    def parse_deposit_csv(self, file_path: str) -> Tuple[List[DepositRecord], List[BadRow]]:
        deposit_records = []
        bad_rows = []
        file_path = str(file_path)

        required_columns = ["deposit_id", "contract_id", "amount", "transaction_type", "transaction_date"]

        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames or []

            missing_cols = [col for col in required_columns if col not in headers]
            if missing_cols:
                raise ValueError(f"保证金文件缺少必要列: {', '.join(missing_cols)}")

            for row_num, row in enumerate(reader, start=2):
                source = self._create_source_location(file_path, row_number=row_num)
                try:
                    deposit_id = row["deposit_id"].strip()
                    if not deposit_id:
                        raise ValueError("deposit_id不能为空")

                    amount = self.parse_decimal(row["amount"])
                    if amount is None:
                        raise ValueError(f"无效的金额: {row['amount']}")

                    transaction_date = self.parse_date(row["transaction_date"])
                    if not transaction_date:
                        raise ValueError(f"无效的交易日期: {row['transaction_date']}")

                    record = DepositRecord(
                        deposit_id=deposit_id,
                        contract_id=row["contract_id"].strip(),
                        amount=amount,
                        transaction_type=row["transaction_type"].strip(),
                        transaction_date=transaction_date,
                        is_refunded=self.parse_bool(row.get("is_refunded", False)),
                        refund_date=self.parse_date(row.get("refund_date")),
                        source=source,
                    )
                    deposit_records.append(record)
                except Exception as e:
                    bad_rows.append(
                        BadRow(
                            source=source,
                            raw_data=dict(row),
                            error_message=str(e),
                        )
                    )

        return deposit_records, bad_rows

    def parse_all(
        self,
        contracts_file: Optional[str] = None,
        showcases_file: Optional[str] = None,
        lease_periods_file: Optional[str] = None,
        add_cabinet_file: Optional[str] = None,
        deposit_file: Optional[str] = None,
    ) -> Dict[str, Any]:
        result = {
            "contracts": [],
            "showcases": [],
            "lease_periods": [],
            "add_cabinet_records": [],
            "deposit_records": [],
            "bad_rows": [],
        }

        if contracts_file and Path(contracts_file).exists():
            contracts, bad_rows = self.parse_contracts_csv(contracts_file)
            result["contracts"] = contracts
            result["bad_rows"].extend(bad_rows)

        if showcases_file and Path(showcases_file).exists():
            showcases, bad_rows = self.parse_showcases_csv(showcases_file)
            result["showcases"] = showcases
            result["bad_rows"].extend(bad_rows)

        if lease_periods_file and Path(lease_periods_file).exists():
            lease_periods, bad_rows = self.parse_lease_periods_csv(lease_periods_file)
            result["lease_periods"] = lease_periods
            result["bad_rows"].extend(bad_rows)

        if add_cabinet_file and Path(add_cabinet_file).exists():
            add_records, bad_rows = self.parse_add_cabinet_csv(add_cabinet_file)
            result["add_cabinet_records"] = add_records
            result["bad_rows"].extend(bad_rows)

        if deposit_file and Path(deposit_file).exists():
            deposit_records, bad_rows = self.parse_deposit_csv(deposit_file)
            result["deposit_records"] = deposit_records
            result["bad_rows"].extend(bad_rows)

        return result

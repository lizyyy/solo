import csv
import json
import os
from datetime import date, datetime
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional, Union
from .models import (
    DataContract,
    ExceptionRule,
    HitRecord,
    BadLine,
    FieldContract,
    ExceptionStatus,
)


class ConfigParser:
    def __init__(self):
        self.bad_lines: List[BadLine] = []

    def _parse_date(self, value: str) -> date:
        for fmt in ["%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y"]:
            try:
                return datetime.strptime(value.strip(), fmt).date()
            except ValueError:
                continue
        raise ValueError(f"无法解析日期格式: {value}")

    def _add_bad_line(
        self,
        source_file: str,
        line_number: int,
        raw_content: str,
        error_message: str,
        error_type: str = "parse_error",
    ):
        self.bad_lines.append(
            BadLine(
                source_file=source_file,
                line_number=line_number,
                raw_content=raw_content.strip(),
                error_message=error_message,
                error_type=error_type,
            )
        )

    def parse_contracts(self, file_path: str) -> List[DataContract]:
        contracts = []
        file_path = os.path.abspath(file_path)
        ext = Path(file_path).suffix.lower()

        if ext == ".json":
            return self._parse_contracts_json(file_path)
        elif ext in [".csv"]:
            return self._parse_contracts_csv(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {ext}")

    def _parse_contracts_json(self, file_path: str) -> List[DataContract]:
        contracts = []
        with open(file_path, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError as e:
                self._add_bad_line(file_path, 0, "", f"JSON解析错误: {e}", "json_error")
                return contracts

        if isinstance(data, list):
            for idx, item in enumerate(data):
                try:
                    fields = [
                        FieldContract(**field) for field in item.get("fields", [])
                    ]
                    contract = DataContract(
                        contract_id=item["contract_id"],
                        name=item["name"],
                        version=item["version"],
                        fields=fields,
                        created_at=self._parse_date(item["created_at"]),
                    )
                    contracts.append(contract)
                except Exception as e:
                    self._add_bad_line(
                        file_path, idx + 1, json.dumps(item), f"契约解析错误: {e}"
                    )
        return contracts

    def _parse_contracts_csv(self, file_path: str) -> List[DataContract]:
        contracts: Dict[str, DataContract] = {}
        contract_fields: Dict[str, List[FieldContract]] = {}

        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                try:
                    contract_id = row["contract_id"]
                    if contract_id not in contracts:
                        contracts[contract_id] = DataContract(
                            contract_id=contract_id,
                            name=row["contract_name"],
                            version=row["version"],
                            fields=[],
                            created_at=self._parse_date(row["created_at"]),
                        )
                        contract_fields[contract_id] = []

                    field = FieldContract(
                        field_path=row["field_path"],
                        is_nullable=row.get("is_nullable", "false").lower() == "true",
                        description=row.get("description"),
                    )
                    contract_fields[contract_id].append(field)
                except Exception as e:
                    self._add_bad_line(
                        file_path, line_num, ",".join(row.values()), f"CSV行解析错误: {e}"
                    )

        for contract_id, contract in contracts.items():
            contract.fields = contract_fields[contract_id]

        return list(contracts.values())

    def parse_exceptions(self, file_path: str) -> List[ExceptionRule]:
        exceptions = []
        file_path = os.path.abspath(file_path)
        ext = Path(file_path).suffix.lower()

        if ext == ".json":
            return self._parse_exceptions_json(file_path)
        elif ext in [".csv"]:
            return self._parse_exceptions_csv(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {ext}")

    def _parse_exceptions_json(self, file_path: str) -> List[ExceptionRule]:
        exceptions = []
        with open(file_path, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError as e:
                self._add_bad_line(file_path, 0, "", f"JSON解析错误: {e}", "json_error")
                return exceptions

        if isinstance(data, list):
            for idx, item in enumerate(data):
                try:
                    exception = ExceptionRule(
                        rule_id=item["rule_id"],
                        contract_id=item["contract_id"],
                        field_path=item["field_path"],
                        reason=item["reason"],
                        exception_date=self._parse_date(item["exception_date"]),
                        owner=item.get("owner"),
                        status=ExceptionStatus(item.get("status", "active")),
                        source_file=file_path,
                        source_line=idx + 1,
                    )
                    exceptions.append(exception)
                except Exception as e:
                    self._add_bad_line(
                        file_path, idx + 1, json.dumps(item), f"例外规则解析错误: {e}"
                    )
        return exceptions

    def _parse_exceptions_csv(self, file_path: str) -> List[ExceptionRule]:
        exceptions = []
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                try:
                    exception = ExceptionRule(
                        rule_id=row["rule_id"],
                        contract_id=row["contract_id"],
                        field_path=row["field_path"],
                        reason=row["reason"],
                        exception_date=self._parse_date(row["exception_date"]),
                        owner=row.get("owner"),
                        status=ExceptionStatus(row.get("status", "active")),
                        source_file=file_path,
                        source_line=line_num,
                    )
                    exceptions.append(exception)
                except Exception as e:
                    self._add_bad_line(
                        file_path, line_num, ",".join(row.values()), f"CSV行解析错误: {e}"
                    )
        return exceptions

    def parse_hit_records(self, file_path: str) -> List[HitRecord]:
        records = []
        file_path = os.path.abspath(file_path)
        ext = Path(file_path).suffix.lower()

        if ext == ".json":
            return self._parse_hit_records_json(file_path)
        elif ext in [".csv"]:
            return self._parse_hit_records_csv(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {ext}")

    def _parse_hit_records_json(self, file_path: str) -> List[HitRecord]:
        records = []
        with open(file_path, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError as e:
                self._add_bad_line(file_path, 0, "", f"JSON解析错误: {e}", "json_error")
                return records

        if isinstance(data, list):
            for idx, item in enumerate(data):
                try:
                    record = HitRecord(
                        record_id=item["record_id"],
                        contract_id=item["contract_id"],
                        field_path=item["field_path"],
                        rule_id=item["rule_id"],
                        null_count=int(item.get("null_count", 0)),
                        total_count=int(item.get("total_count", 0)),
                        sample_values=item.get("sample_values", []),
                        source_file=file_path,
                        source_line=idx + 1,
                    )
                    records.append(record)
                except Exception as e:
                    self._add_bad_line(
                        file_path, idx + 1, json.dumps(item), f"命中记录解析错误: {e}"
                    )
        return records

    def _parse_hit_records_csv(self, file_path: str) -> List[HitRecord]:
        records = []
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                try:
                    sample_values = []
                    if row.get("sample_values"):
                        sample_values = [
                            v.strip() for v in row["sample_values"].split(";") if v.strip()
                        ]

                    record = HitRecord(
                        record_id=row["record_id"],
                        contract_id=row["contract_id"],
                        field_path=row["field_path"],
                        rule_id=row["rule_id"],
                        null_count=int(row.get("null_count", 0)),
                        total_count=int(row.get("total_count", 0)),
                        sample_values=sample_values,
                        source_file=file_path,
                        source_line=line_num,
                    )
                    records.append(record)
                except Exception as e:
                    self._add_bad_line(
                        file_path, line_num, ",".join(row.values()), f"CSV行解析错误: {e}"
                    )
        return records

    def get_bad_lines(self) -> List[BadLine]:
        return self.bad_lines

    def clear_bad_lines(self):
        self.bad_lines = []

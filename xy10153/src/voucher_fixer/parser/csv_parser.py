from __future__ import annotations

import csv
import hashlib
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from ..models.voucher import (
    Voucher,
    VoucherBatch,
    VoucherEntry,
    VoucherType,
)


@dataclass
class ParseError:
    source_file: str
    line_number: int
    field: str
    value: str
    message: str


@dataclass
class ParseResult:
    batch: VoucherBatch
    errors: List[ParseError] = field(default_factory=list)
    warnings: List[ParseError] = field(default_factory=list)

    def has_errors(self) -> bool:
        return len(self.errors) > 0


class VoucherCSVParser:
    STANDARD_HEADERS = {
        "date": ["日期", "voucher_date", "date"],
        "voucher_type": ["凭证字", "凭证类型", "voucher_type"],
        "voucher_number": ["凭证号", "voucher_no", "voucher_number"],
        "description": ["摘要", "description", "summary"],
        "account_code": ["科目编码", "account_code"],
        "account_name": ["科目名称", "account_name"],
        "debit": ["借方", "debit"],
        "credit": ["贷方", "credit"],
    }

    def __init__(self):
        self.imported_hashes: Set[str] = set()

    def parse_file(
        self, file_path: str, allow_reimport: bool = False
    ) -> ParseResult:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        batch = VoucherBatch()
        batch.source_files.append(str(path))
        errors: List[ParseError] = []
        warnings: List[ParseError] = []

        with open(path, "r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            header_map = self._map_headers(reader.fieldnames or [])

            all_rows: List[tuple] = []
            for line_num, row in enumerate(reader, start=2):
                clean_row = {k: (v.strip() if v else "") for k, v in row.items()}
                all_rows.append((line_num, clean_row))

            last_vtype = ""
            last_vnum = ""
            groups: List[Dict] = []
            current_key = None

            for line_num, clean_row in all_rows:
                vtype = clean_row.get(header_map["voucher_type"], "")
                vnum = clean_row.get(header_map["voucher_number"], "")

                key = None
                if vtype or vnum:
                    key = (vtype, vnum)
                elif last_vtype and last_vnum:
                    key = (last_vtype, last_vnum)

                if key and (key != current_key):
                    current_key = key
                    last_vtype = vtype or last_vtype
                    last_vnum = vnum or last_vnum
                    groups.append(
                        {
                            "key": key,
                            "start_line": line_num,
                            "rows": [],
                        }
                    )
                if groups:
                    groups[-1]["rows"].append(clean_row)
                else:
                    groups.append(
                        {
                            "key": ("", ""),
                            "start_line": line_num,
                            "rows": [clean_row],
                        }
                    )

            for group in groups:
                if not group["rows"]:
                    continue

                first_row = group["rows"][0]
                row_hash = self._row_hash(
                    str(path), group["start_line"], first_row
                )
                if not allow_reimport and row_hash in self.imported_hashes:
                    warnings.append(
                        ParseError(
                            source_file=str(path),
                            line_number=group["start_line"],
                            field="row",
                            value="",
                            message=f"第 {group['start_line']} 行已导入过，跳过",
                        )
                    )
                    continue

                voucher = self._build_voucher(
                    str(path),
                    group["start_line"],
                    group["rows"],
                    header_map,
                    errors,
                )
                if voucher:
                    batch.add(voucher)
                    self.imported_hashes.add(row_hash)

        return ParseResult(batch=batch, errors=errors, warnings=warnings)

    def parse_files(
        self, file_paths: List[str], allow_reimport: bool = False
    ) -> ParseResult:
        total_batch = VoucherBatch()
        total_errors: List[ParseError] = []
        total_warnings: List[ParseError] = []

        for path in file_paths:
            result = self.parse_file(path, allow_reimport)
            total_batch.add_all(result.batch.vouchers)
            total_batch.source_files.extend(result.batch.source_files)
            total_errors.extend(result.errors)
            total_warnings.extend(result.warnings)

        return ParseResult(
            batch=total_batch, errors=total_errors, warnings=total_warnings
        )

    def _map_headers(self, headers: List[str]) -> Dict[str, str]:
        mapping: Dict[str, str] = {}
        for std_key, possible in self.STANDARD_HEADERS.items():
            for header in headers:
                h_lower = header.lower()
                if h_lower in [p.lower() for p in possible]:
                    mapping[std_key] = header
                    break
            if std_key not in mapping:
                mapping[std_key] = ""
        return mapping

    def _row_hash(
        self, source_file: str, line_num: int, row: Dict[str, str]
    ) -> str:
        content = f"{source_file}:{line_num}:{sorted(row.items())}"
        return hashlib.md5(content.encode("utf-8")).hexdigest()

    def _is_new_voucher(
        self, row: Dict[str, str], header_map: Dict[str, str]
    ) -> bool:
        date = row.get(header_map["date"], "").strip()
        voucher_type = row.get(header_map["voucher_type"], "").strip()
        voucher_number = row.get(header_map["voucher_number"], "").strip()
        return bool(date or voucher_type or voucher_number)

    def _voucher_id(
        self,
        source_file: str,
        row: Dict[str, str],
        header_map: Dict[str, str],
    ) -> str:
        date = row.get(header_map["date"], "")
        vtype = row.get(header_map["voucher_type"], "")
        vnum = row.get(header_map["voucher_number"], "")
        return hashlib.md5(f"{source_file}:{date}:{vtype}:{vnum}".encode("utf-8")).hexdigest()[:16]

    def _parse_date(
        self, value: str, line_num: int, errors: List[ParseError]
    ) -> Optional[datetime]:
        if not value:
            return None
        formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%Y%m%d",
            "%Y年%m月%d日",
            "%Y.%m.%d",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(value.strip(), fmt)
            except ValueError:
                continue
        errors.append(
            ParseError(
                source_file="",
                line_number=line_num,
                field="date",
                value=value,
                message=f"无法解析日期格式: {value}",
            )
        )
        return None

    def _parse_voucher_type(
        self, value: str, line_num: int, errors: List[ParseError]
    ) -> VoucherType:
        v = value.strip()
        mapping = {
            "收": VoucherType.RECEIPT,
            "付": VoucherType.PAYMENT,
            "转": VoucherType.TRANSFER,
            "记": VoucherType.GENERAL,
            "receipt": VoucherType.RECEIPT,
            "payment": VoucherType.PAYMENT,
            "transfer": VoucherType.TRANSFER,
            "general": VoucherType.GENERAL,
        }
        result = mapping.get(v) or mapping.get(v.lower())
        if result:
            return result
        if v:
            errors.append(
                ParseError(
                    source_file="",
                    line_number=line_num,
                    field="voucher_type",
                    value=v,
                    message=f"未知的凭证类型: {v}",
                )
            )
        return VoucherType.GENERAL

    def _parse_sequence(self, voucher_number: str) -> int:
        if not voucher_number:
            return 0
        match = re.search(r"(\d+)", voucher_number)
        if match:
            return int(match.group(1))
        return 0

    def _parse_amount(self, value: str, line_num: int, errors: List[ParseError]) -> float:
        if not value:
            return 0.0
        v = value.strip().replace(",", "")
        try:
            return float(v)
        except ValueError:
            errors.append(
                ParseError(
                    source_file="",
                    line_number=line_num,
                    field="amount",
                    value=value,
                    message=f"无法解析金额: {value}",
                )
            )
            return 0.0

    def _build_voucher(
        self,
        source_file: str,
        start_line: int,
        rows: List[Dict[str, str]],
        header_map: Dict[str, str],
        errors: List[ParseError],
    ) -> Optional[Voucher]:
        if not rows:
            return None

        first = rows[0]
        vid = self._voucher_id(source_file, first, header_map)
        voucher_date = (
            self._parse_date(first.get(header_map["date"], ""), start_line, errors)
            or datetime.min
        )
        voucher_type = self._parse_voucher_type(
            first.get(header_map["voucher_type"], ""), start_line, errors
        )
        voucher_number = first.get(header_map["voucher_number"], "").strip()
        number_sequence = self._parse_sequence(voucher_number)
        description = first.get(header_map["description"], "").strip()

        entries: List[VoucherEntry] = []
        for i, row in enumerate(rows):
            account_code = row.get(header_map["account_code"], "").strip()
            account_name = row.get(header_map["account_name"], "").strip()
            if not account_code and not account_name:
                continue
            entry = VoucherEntry(
                account_code=account_code,
                account_name=account_name,
                debit=self._parse_amount(
                    row.get(header_map["debit"], ""), start_line + i, errors
                ),
                credit=self._parse_amount(
                    row.get(header_map["credit"], ""), start_line + i, errors
                ),
                description=row.get(header_map["description"], "").strip(),
            )
            entries.append(entry)

        voucher = Voucher(
            id=vid,
            source_file=source_file,
            line_number=start_line,
            voucher_date=voucher_date,
            voucher_type=voucher_type,
            voucher_number=voucher_number,
            number_sequence=number_sequence,
            description=description,
            entries=entries,
            original_data={
                "rows": rows,
                "header_map": header_map,
            },
        )

        if not voucher.is_balanced():
            errors.append(
                ParseError(
                    source_file=source_file,
                    line_number=start_line,
                    field="balance",
                    value=f"借={voucher.total_debit():.2f},贷={voucher.total_credit():.2f}",
                    message=f"凭证 {voucher_type.value}{voucher_number} 借贷不平",
                )
            )

        return voucher

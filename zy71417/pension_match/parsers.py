from __future__ import annotations

import csv
import re
from datetime import date
from typing import TextIO

from .models import (
    BadDataCategory,
    BadRecord,
    BujiaoDan,
    CanBaoRen,
    DanWeiHuiKuan,
)


def _parse_date(raw: str) -> date:
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"):
        try:
            return date.fromisoformat(raw.replace("/", "-")) if "/" in raw or "-" in raw else date(
                int(raw[:4]), int(raw[4:6]), int(raw[6:8])
            )
        except (ValueError, IndexError):
            continue
    raise ValueError(f"无法解析日期: {raw}")


def _parse_amount(raw: str) -> float:
    cleaned = raw.replace(",", "").replace("，", "").strip()
    if cleaned.startswith("¥") or cleaned.startswith("￥"):
        cleaned = cleaned[1:]
    try:
        return float(cleaned)
    except ValueError:
        raise ValueError(f"金额格式错误: {raw}")


_ID_PATTERN = re.compile(r"^\d{17}[\dXx]$")


def _validate_id_number(raw: str) -> None:
    if not _ID_PATTERN.match(raw):
        raise ValueError(f"身份证号格式错误: {raw}（应为18位数字，末位可为X）")


def _parse_bujiao_month(raw: str) -> str:
    raw = raw.strip()
    for fmt_out, fmt_check in [("%Y-%m", lambda s: len(s) == 7 and s[4] == "-"),
                                ("%Y/%m", lambda s: len(s) == 7 and s[4] == "/"),
                                ("%Y%m", lambda s: len(s) == 6 and s.isdigit())]:
        if fmt_check(raw):
            return raw.replace("/", "-")
    if len(raw) == 6 and raw.isdigit():
        return f"{raw[:4]}-{raw[4:]}"
    raise ValueError(f"无法解析补缴月份: {raw}")


def parse_bujiao_dan(
    source_file: str, f: TextIO
) -> tuple[list[BujiaoDan], list[BadRecord]]:
    records: list[BujiaoDan] = []
    bad: list[BadRecord] = []
    reader = csv.DictReader(f)
    for line_num, row in enumerate(reader, start=2):
        raw_line = ",".join(f"{k}={v}" for k, v in row.items())
        try:
            dan_hao = row.get("单号", "").strip()
            name = row.get("姓名", "").strip()
            id_number = row.get("身份证号", "").strip()
            unit_code = row.get("单位编号", "").strip()
            bujiao_month_raw = row.get("补缴月份", "").strip()
            amount_raw = row.get("补缴金额", "").strip()
            declare_date_raw = row.get("申报日期", "").strip()

            missing = []
            if not dan_hao:
                missing.append("单号")
            if not name:
                missing.append("姓名")
            if not id_number:
                missing.append("身份证号")
            if not unit_code:
                missing.append("单位编号")
            if not bujiao_month_raw:
                missing.append("补缴月份")
            if not amount_raw:
                missing.append("补缴金额")
            if not declare_date_raw:
                missing.append("申报日期")
            if missing:
                bad.append(
                    BadRecord(
                        category=BadDataCategory.MISSING_FIELD,
                        raw_line=raw_line,
                        detail=f"必填字段缺失: {', '.join(missing)}",
                        source_file=source_file,
                        source_line=line_num,
                    )
                )
                continue

            _validate_id_number(id_number)
            bujiao_month = _parse_bujiao_month(bujiao_month_raw)
            amount = _parse_amount(amount_raw)
            declare_date = _parse_date(declare_date_raw)

            records.append(
                BujiaoDan(
                    dan_hao=dan_hao,
                    name=name,
                    id_number=id_number,
                    unit_code=unit_code,
                    bujiao_month=bujiao_month,
                    amount=amount,
                    declare_date=declare_date,
                    source_file=source_file,
                    source_line=line_num,
                )
            )
        except ValueError as e:
            msg = str(e)
            cat = BadDataCategory.INVALID_DATE
            if "金额" in msg:
                cat = BadDataCategory.INVALID_AMOUNT
            elif "月份" in msg:
                cat = BadDataCategory.INVALID_MONTH
            elif "身份证" in msg:
                cat = BadDataCategory.PARSE_ERROR
            bad.append(
                BadRecord(
                    category=cat,
                    raw_line=raw_line,
                    detail=str(e),
                    source_file=source_file,
                    source_line=line_num,
                )
            )
        except Exception as e:
            bad.append(
                BadRecord(
                    category=BadDataCategory.PARSE_ERROR,
                    raw_line=raw_line,
                    detail=f"未知解析错误: {e}",
                    source_file=source_file,
                    source_line=line_num,
                )
            )
    return records, bad


def parse_can_bao_ren(
    source_file: str, f: TextIO
) -> tuple[list[CanBaoRen], list[BadRecord]]:
    records: list[CanBaoRen] = []
    bad: list[BadRecord] = []
    reader = csv.DictReader(f)
    for line_num, row in enumerate(reader, start=2):
        raw_line = ",".join(f"{k}={v}" for k, v in row.items())
        try:
            name = row.get("姓名", "").strip()
            id_number = row.get("身份证号", "").strip()
            unit_code = row.get("单位编号", "").strip()
            status = row.get("参保状态", "").strip()

            missing = []
            if not name:
                missing.append("姓名")
            if not id_number:
                missing.append("身份证号")
            if not unit_code:
                missing.append("单位编号")
            if missing:
                bad.append(
                    BadRecord(
                        category=BadDataCategory.MISSING_FIELD,
                        raw_line=raw_line,
                        detail=f"必填字段缺失: {', '.join(missing)}",
                        source_file=source_file,
                        source_line=line_num,
                    )
                )
                continue

            _validate_id_number(id_number)

            records.append(
                CanBaoRen(
                    name=name,
                    id_number=id_number,
                    unit_code=unit_code,
                    status=status or "未知",
                    source_file=source_file,
                    source_line=line_num,
                )
            )
        except Exception as e:
            bad.append(
                BadRecord(
                    category=BadDataCategory.PARSE_ERROR,
                    raw_line=raw_line,
                    detail=f"未知解析错误: {e}",
                    source_file=source_file,
                    source_line=line_num,
                )
            )
    return records, bad


def parse_dan_wei_hui_kuan(
    source_file: str, f: TextIO
) -> tuple[list[DanWeiHuiKuan], list[BadRecord]]:
    records: list[DanWeiHuiKuan] = []
    bad: list[BadRecord] = []
    reader = csv.DictReader(f)
    for line_num, row in enumerate(reader, start=2):
        raw_line = ",".join(f"{k}={v}" for k, v in row.items())
        try:
            unit_code = row.get("单位编号", "").strip()
            amount_raw = row.get("汇款金额", "").strip()
            remit_date_raw = row.get("汇款日期", "").strip()
            arrival_date_raw = row.get("到账日期", "").strip()
            remarks = row.get("备注", "").strip()

            missing = []
            if not unit_code:
                missing.append("单位编号")
            if not amount_raw:
                missing.append("汇款金额")
            if not remit_date_raw:
                missing.append("汇款日期")
            if missing:
                bad.append(
                    BadRecord(
                        category=BadDataCategory.MISSING_FIELD,
                        raw_line=raw_line,
                        detail=f"必填字段缺失: {', '.join(missing)}",
                        source_file=source_file,
                        source_line=line_num,
                    )
                )
                continue

            amount = _parse_amount(amount_raw)
            remit_date = _parse_date(remit_date_raw)
            arrival_date = _parse_date(arrival_date_raw) if arrival_date_raw else None

            records.append(
                DanWeiHuiKuan(
                    unit_code=unit_code,
                    amount=amount,
                    remit_date=remit_date,
                    arrival_date=arrival_date,
                    remarks=remarks,
                    source_file=source_file,
                    source_line=line_num,
                )
            )
        except ValueError as e:
            cat = BadDataCategory.INVALID_DATE
            if "金额" in str(e):
                cat = BadDataCategory.INVALID_AMOUNT
            bad.append(
                BadRecord(
                    category=cat,
                    raw_line=raw_line,
                    detail=str(e),
                    source_file=source_file,
                    source_line=line_num,
                )
            )
        except Exception as e:
            bad.append(
                BadRecord(
                    category=BadDataCategory.PARSE_ERROR,
                    raw_line=raw_line,
                    detail=f"未知解析错误: {e}",
                    source_file=source_file,
                    source_line=line_num,
                )
            )
    return records, bad

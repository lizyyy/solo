import os
import csv
from datetime import datetime, date
from typing import List, Dict, Any, TypeVar, Type, Tuple, Optional
from pathlib import Path

import pandas as pd

from ..models import (
    Player,
    Group,
    Material,
    Substitute,
    CheckinEvent,
    SourceLocation,
)

T = TypeVar("T")


class ParseResult:
    def __init__(self):
        self.data: List[Any] = []
        self.errors: List[Dict[str, Any]] = []

    def add_data(self, item: Any):
        self.data.append(item)

    def add_error(self, file_path: str, row_number: int, error_message: str, original_data: Dict[str, Any]):
        self.errors.append({
            "file_path": file_path,
            "row_number": row_number,
            "error_message": error_message,
            "original_data": original_data,
        })


class FileParser:
    def __init__(self, file_path: str):
        self.file_path = os.path.abspath(file_path)
        self.file_name = Path(file_path).name

    def read_file(self) -> Tuple[List[Dict[str, Any]], str]:
        ext = Path(self.file_path).suffix.lower()
        if ext == ".csv":
            return self._read_csv(), None
        elif ext in [".xlsx", ".xls"]:
            return self._read_excel()
        else:
            raise ValueError(f"不支持的文件格式: {ext}")

    def _read_csv(self) -> List[Dict[str, Any]]:
        rows = []
        with open(self.file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader, start=2):
                row["_row_number"] = i
                rows.append(row)
        return rows

    def _read_excel(self) -> Tuple[List[Dict[str, Any]], str]:
        all_rows = []
        sheet_name = None
        xl = pd.ExcelFile(self.file_path)
        for sheet in xl.sheet_names:
            sheet_name = sheet
            df = pd.read_excel(self.file_path, sheet_name=sheet)
            for i, (_, row) in enumerate(df.iterrows(), start=2):
                row_dict = row.to_dict()
                row_dict["_row_number"] = i
                row_dict["_sheet_name"] = sheet
                all_rows.append(row_dict)
        return all_rows, sheet_name


def parse_players(file_path: str) -> ParseResult:
    parser = FileParser(file_path)
    rows, sheet_name = parser.read_file()
    result = ParseResult()

    for row in rows:
        row_number = row.pop("_row_number")
        sheet_name = row.pop("_sheet_name", None)
        original_data = {k: v for k, v in row.items()}

        try:
            birth_date = _parse_date(row.get("birth_date"))
            player = Player(
                player_id=str(row.get("player_id", "")).strip(),
                name=str(row.get("name", "")).strip(),
                id_card=str(row.get("id_card", "")).strip() if row.get("id_card") else None,
                gender=str(row.get("gender", "")).strip() if row.get("gender") else None,
                birth_date=birth_date,
                group_id=str(row.get("group_id", "")).strip(),
                phone=str(row.get("phone", "")).strip() if row.get("phone") else None,
                email=str(row.get("email", "")).strip() if row.get("email") else None,
                source=SourceLocation(
                    file_path=file_path,
                    sheet_name=sheet_name,
                    row_number=row_number,
                    original_data=original_data,
                ),
            )
            result.add_data(player)
        except Exception as e:
            result.add_error(
                file_path=file_path,
                row_number=row_number,
                error_message=str(e),
                original_data=original_data,
            )

    return result


def parse_groups(file_path: str) -> ParseResult:
    parser = FileParser(file_path)
    rows, sheet_name = parser.read_file()
    result = ParseResult()

    for row in rows:
        row_number = row.pop("_row_number")
        sheet_name = row.pop("_sheet_name", None)
        original_data = {k: v for k, v in row.items()}

        try:
            require_materials = []
            if row.get("require_materials"):
                require_materials = [m.strip() for m in str(row.get("require_materials")).split(",")]

            group = Group(
                group_id=str(row.get("group_id", "")).strip(),
                group_name=str(row.get("group_name", "")).strip(),
                min_age=int(row.get("min_age")) if row.get("min_age") else None,
                max_age=int(row.get("max_age")) if row.get("max_age") else None,
                allowed_gender=str(row.get("allowed_gender", "")).strip() if row.get("allowed_gender") else None,
                max_players=int(row.get("max_players")) if row.get("max_players") else None,
                require_materials=require_materials,
                source=SourceLocation(
                    file_path=file_path,
                    sheet_name=sheet_name,
                    row_number=row_number,
                    original_data=original_data,
                ),
            )
            result.add_data(group)
        except Exception as e:
            result.add_error(
                file_path=file_path,
                row_number=row_number,
                error_message=str(e),
                original_data=original_data,
            )

    return result


def parse_materials(file_path: str) -> ParseResult:
    parser = FileParser(file_path)
    rows, sheet_name = parser.read_file()
    result = ParseResult()

    for row in rows:
        row_number = row.pop("_row_number")
        sheet_name = row.pop("_sheet_name", None)
        original_data = {k: v for k, v in row.items()}

        try:
            material = Material(
                player_id=str(row.get("player_id", "")).strip(),
                material_type=str(row.get("material_type", "")).strip(),
                material_status=str(row.get("material_status", "")).strip(),
                upload_date=_parse_date(row.get("upload_date")),
                expiry_date=_parse_date(row.get("expiry_date")),
                source=SourceLocation(
                    file_path=file_path,
                    sheet_name=sheet_name,
                    row_number=row_number,
                    original_data=original_data,
                ),
            )
            result.add_data(material)
        except Exception as e:
            result.add_error(
                file_path=file_path,
                row_number=row_number,
                error_message=str(e),
                original_data=original_data,
            )

    return result


def parse_substitutes(file_path: str) -> ParseResult:
    parser = FileParser(file_path)
    rows, sheet_name = parser.read_file()
    result = ParseResult()

    for row in rows:
        row_number = row.pop("_row_number")
        sheet_name = row.pop("_sheet_name", None)
        original_data = {k: v for k, v in row.items()}

        try:
            substitute = Substitute(
                player_id=str(row.get("player_id", "")).strip(),
                target_group_id=str(row.get("target_group_id", "")).strip(),
                priority=int(row.get("priority", 0)),
                substitute_reason=str(row.get("substitute_reason", "")).strip() if row.get("substitute_reason") else None,
                source=SourceLocation(
                    file_path=file_path,
                    sheet_name=sheet_name,
                    row_number=row_number,
                    original_data=original_data,
                ),
            )
            result.add_data(substitute)
        except Exception as e:
            result.add_error(
                file_path=file_path,
                row_number=row_number,
                error_message=str(e),
                original_data=original_data,
            )

    return result


def parse_checkins(file_path: str) -> ParseResult:
    parser = FileParser(file_path)
    rows, sheet_name = parser.read_file()
    result = ParseResult()

    for row in rows:
        row_number = row.pop("_row_number")
        sheet_name = row.pop("_sheet_name", None)
        original_data = {k: v for k, v in row.items()}

        try:
            checkin_time_str = str(row.get("checkin_time", ""))
            checkin_time = datetime.fromisoformat(checkin_time_str) if checkin_time_str else datetime.now()

            checkin = CheckinEvent(
                checkin_id=str(row.get("checkin_id", "")).strip(),
                player_id=str(row.get("player_id", "")).strip(),
                checkin_time=checkin_time,
                checkin_station=str(row.get("checkin_station", "")).strip() if row.get("checkin_station") else None,
                source=SourceLocation(
                    file_path=file_path,
                    sheet_name=sheet_name,
                    row_number=row_number,
                    original_data=original_data,
                ),
            )
            result.add_data(checkin)
        except Exception as e:
            result.add_error(
                file_path=file_path,
                row_number=row_number,
                error_message=str(e),
                original_data=original_data,
            )

    return result


def _parse_date(value: Any) -> Optional[date]:
    if value is None or value == "" or pd.isna(value):
        return None
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(str(value).split()[0], "%Y-%m-%d").date()
    except ValueError:
        try:
            return datetime.strptime(str(value).split()[0], "%Y/%m/%d").date()
        except ValueError:
            return None

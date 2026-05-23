from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import os
import io
import zipfile
import pandas as pd
from PIL import Image
import re

from ..models import MaterialType
from ..config import settings


class MaterialParseError(Exception):
    pass


class MaterialParser:
    @staticmethod
    def parse_material(
        material_type: MaterialType,
        file_path: str,
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        if not os.path.exists(file_path):
            raise MaterialParseError(f"File not found: {file_path}")

        parsers = {
            MaterialType.VISITOR_APPOINTMENT: MaterialParser._parse_visitor_appointment,
            MaterialType.GATE_RECORD: MaterialParser._parse_gate_record,
            MaterialType.LICENSE_PLATE_SCREENSHOT: MaterialParser._parse_license_plate,
            MaterialType.MANUAL_PRICE_ADJUSTMENT: MaterialParser._parse_price_adjustment,
            MaterialType.HISTORY_ARCHIVE: MaterialParser._parse_history_archive,
        }

        parser = parsers.get(material_type)
        if not parser:
            raise MaterialParseError(f"No parser for material type: {material_type}")

        return parser(file_path)

    @staticmethod
    def _parse_excel(file_path: str) -> pd.DataFrame:
        try:
            return pd.read_excel(file_path)
        except Exception as e:
            raise MaterialParseError(f"Failed to parse Excel: {str(e)}")

    @staticmethod
    def _parse_visitor_appointment(
        file_path: str,
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        df = MaterialParser._parse_excel(file_path)
        records = []
        metadata = {"total_rows": len(df), "columns": list(df.columns)}

        for _, row in df.iterrows():
            try:
                record = {
                    "visitor_name": str(row.get("访客姓名", "") or "").strip(),
                    "visitor_phone": str(row.get("联系电话", "") or "").strip(),
                    "id_card": str(row.get("身份证号", "") or "").strip(),
                    "license_plate": str(row.get("车牌号", "") or "").strip(),
                    "visit_date": MaterialParser._parse_date(row.get("访问日期")),
                    "expected_end_date": MaterialParser._parse_date(row.get("预计离开日期")),
                    "source": "visitor_appointment",
                    "metadata": {"row_index": _},
                }
                records.append(record)
            except Exception as e:
                continue

        return records, metadata

    @staticmethod
    def _parse_gate_record(
        file_path: str,
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        df = MaterialParser._parse_excel(file_path)
        records = []
        metadata = {"total_rows": len(df), "columns": list(df.columns)}

        for _, row in df.iterrows():
            try:
                license_plate = str(row.get("车牌号", "") or "").strip()
                gate_in = MaterialParser._parse_datetime(row.get("入场时间"))
                gate_out = MaterialParser._parse_datetime(row.get("出场时间"))
                is_overstay = False

                if gate_in and gate_out:
                    duration = (gate_out - gate_in).total_seconds() / 3600
                    is_overstay = duration > 24

                record = {
                    "license_plate": license_plate,
                    "visitor_name": str(row.get("访客姓名", "") or "").strip(),
                    "gate_in_time": gate_in,
                    "gate_out_time": gate_out,
                    "is_overstay": is_overstay,
                    "source": "gate_record",
                    "metadata": {"row_index": _},
                }
                records.append(record)
            except Exception as e:
                continue

        return records, metadata

    @staticmethod
    def _parse_license_plate(
        file_path: str,
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        try:
            img = Image.open(file_path)
            license_plate = MaterialParser._extract_license_plate_from_filename(
                os.path.basename(file_path)
            )

            record = {
                "license_plate": license_plate,
                "source": "license_plate_screenshot",
                "metadata": {
                    "file_name": os.path.basename(file_path),
                    "image_size": img.size,
                    "image_format": img.format,
                },
            }
            return [record], {"extracted_plate": license_plate}
        except Exception as e:
            raise MaterialParseError(f"Failed to parse image: {str(e)}")

    @staticmethod
    def _parse_price_adjustment(
        file_path: str,
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        df = MaterialParser._parse_excel(file_path)
        records = []
        metadata = {"total_rows": len(df), "columns": list(df.columns)}

        for _, row in df.iterrows():
            try:
                price_adj = row.get("调整金额")
                if isinstance(price_adj, str):
                    price_adj = float(re.sub(r"[^\d.-]", "", price_adj))

                record = {
                    "visitor_name": str(row.get("访客姓名", "") or "").strip(),
                    "license_plate": str(row.get("车牌号", "") or "").strip(),
                    "price_adjustment": float(price_adj) if price_adj is not None else None,
                    "review_comment": str(row.get("调整原因", "") or "").strip(),
                    "source": "manual_price_adjustment",
                    "metadata": {"row_index": _},
                }
                records.append(record)
            except Exception as e:
                continue

        return records, metadata

    @staticmethod
    def _parse_history_archive(
        file_path: str,
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        records = []
        metadata = {"files": []}

        try:
            with zipfile.ZipFile(file_path, "r") as zf:
                for name in zf.namelist():
                    metadata["files"].append(name)
                    
                    if name.lower().endswith((".xlsx", ".xls")):
                        with zf.open(name) as f:
                            content = f.read()
                            df = pd.read_excel(io.BytesIO(content))
                            
                            for _, row in df.iterrows():
                                try:
                                    record = {
                                        "visitor_name": str(row.get("访客姓名", row.get("姓名", "")) or "").strip(),
                                        "license_plate": str(row.get("车牌号", row.get("车牌", "")) or "").strip(),
                                        "visit_date": MaterialParser._parse_date(row.get("访问日期", row.get("日期"))),
                                        "source": "history_archive",
                                        "metadata": {"archive_file": name, "row_index": _},
                                    }
                                    if record["visitor_name"] or record["license_plate"]:
                                        records.append(record)
                                except Exception:
                                    continue
        except Exception as e:
            raise MaterialParseError(f"Failed to parse archive: {str(e)}")

        metadata["total_records"] = len(records)
        return records, metadata

    @staticmethod
    def _parse_date(value: Any) -> Optional[datetime]:
        if pd.isna(value):
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, pd.Timestamp):
            return value.to_pydatetime()
        try:
            return pd.to_datetime(value).to_pydatetime()
        except Exception:
            return None

    @staticmethod
    def _parse_datetime(value: Any) -> Optional[datetime]:
        return MaterialParser._parse_date(value)

    @staticmethod
    def _extract_license_plate_from_filename(filename: str) -> str:
        match = re.search(r"[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领A-Z]{1}[A-Z]{1}[A-Z0-9]{4}[A-Z0-9挂学警港澳]{1}", filename)
        if match:
            return match.group(0)
        name_without_ext = os.path.splitext(filename)[0]
        return name_without_ext

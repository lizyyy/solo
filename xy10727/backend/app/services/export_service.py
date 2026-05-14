from sqlalchemy.orm import Session
from typing import Optional, List
import pandas as pd
import json
from io import BytesIO

from app.models.database import AddressRecord


def export_records(
    db: Session,
    record_ids: Optional[List[int]] = None,
    status: Optional[str] = None,
    is_failed: Optional[bool] = None,
    format: str = "xlsx"
):
    query = db.query(AddressRecord)

    if record_ids:
        query = query.filter(AddressRecord.id.in_(record_ids))
    if status:
        query = query.filter(AddressRecord.status == status)
    if is_failed is not None:
        query = query.filter(AddressRecord.is_failed == is_failed)

    records = query.all()

    data = []
    for record in records:
        geocoding_parsed = ""
        if record.geocoding_result:
            try:
                geo = json.loads(record.geocoding_result)
                geocoding_parsed = f"lat: {geo.get('lat', '')}, lng: {geo.get('lng', '')}"
            except:
                geocoding_parsed = record.geocoding_result

        candidates_parsed = ""
        if record.candidate_coordinates:
            try:
                candidates = json.loads(record.candidate_coordinates)
                candidates_parsed = "; ".join([f"({c.get('lat', '')}, {c.get('lng', '')})" for c in candidates])
            except:
                candidates_parsed = record.candidate_coordinates

        data.append({
            "ID": record.id,
            "原始地址": record.original_address,
            "地理编码": geocoding_parsed,
            "候选坐标": candidates_parsed,
            "人工纠偏": record.manual_correction or "",
            "配送范围": record.delivery_range or "",
            "命中报告": record.hit_report or "",
            "状态": record.status,
            "是否失败": "是" if record.is_failed else "否",
            "失败原因": record.failure_reason or "",
            "地理编码版本": record.geocoding_version,
            "创建时间": record.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "更新时间": record.updated_at.strftime("%Y-%m-%d %H:%M:%S")
        })

    df = pd.DataFrame(data)

    if format == "csv":
        output = BytesIO()
        df.to_csv(output, index=False, encoding="utf-8-sig")
        output.seek(0)
        return output, "csv"
    else:
        output = BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="地址记录")
        output.seek(0)
        return output, "xlsx"

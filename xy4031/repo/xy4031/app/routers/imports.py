import uuid
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.database import get_db
from app.models import (
    BatteryPack, 
    ChargeRecord, 
    FlightRecord, 
    CellVoltageReading
)
from app.schemas import ImportResult
from app.services import (
    get_parser_for_type,
    RecordMerger,
    QuarantineService,
    CSVParseError
)

router = APIRouter(prefix="/import", tags=["数据导入"])


@router.post("/charger", response_model=ImportResult)
async def import_charger_csv(
    file: UploadFile = File(...),
    source_file_name: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    return await _import_csv(
        file=file,
        source_type="charger",
        source_file_name=source_file_name or file.filename,
        db=db
    )


@router.post("/flight", response_model=ImportResult)
async def import_flight_csv(
    file: UploadFile = File(...),
    source_file_name: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    return await _import_csv(
        file=file,
        source_type="flight",
        source_file_name=source_file_name or file.filename,
        db=db
    )


@router.post("/voltage", response_model=ImportResult)
async def import_voltage_csv(
    file: UploadFile = File(...),
    source_file_name: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    return await _import_csv(
        file=file,
        source_type="voltage",
        source_file_name=source_file_name or file.filename,
        db=db
    )


async def _import_csv(
    file: UploadFile,
    source_type: str,
    source_file_name: str,
    db: Session
) -> ImportResult:
    import_session_id = str(uuid.uuid4())
    
    parser = get_parser_for_type(source_type)
    if not parser:
        raise HTTPException(
            status_code=400,
            detail=f"未知的导入类型: {source_type}"
        )
    
    try:
        content = await file.read()
        file_content = content.decode('utf-8-sig')
    except UnicodeDecodeError:
        try:
            file_content = content.decode('gbk')
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=400,
                detail="无法解析文件编码，请确保是 UTF-8 或 GBK 编码"
            )
    
    parsed_rows, parse_errors = parser.parse_file(file_content)
    
    total_rows = len(parsed_rows) + len(parse_errors)
    imported_rows = 0
    duplicate_rows = 0
    quarantined_ids = []
    
    existing_batteries = {
        b.battery_id for b in db.query(BatteryPack).all()
    }
    
    grouped = RecordMerger.group_by_battery(parsed_rows)
    
    for battery_id, records in grouped.items():
        if battery_id not in existing_batteries:
            for idx, record in enumerate(records):
                row_number = idx + 2
                quarantine_record = QuarantineService.add_to_quarantine(
                    db=db,
                    import_session_id=import_session_id,
                    source_type=source_type,
                    source_file=source_file_name,
                    row_number=row_number,
                    raw_data=record.get('raw_row', {}),
                    error_type="battery_not_exist",
                    error_message=f"电池编号 {battery_id} 不存在于系统中，请先添加电池",
                    battery_id_extracted=battery_id,
                    timestamp_extracted=record.get('charge_start_time') or record.get('flight_date') or record.get('reading_time')
                )
                quarantined_ids.append(quarantine_record.id)
            continue
        
        for record in records:
            import_hash = RecordMerger.generate_unique_hash(record, source_type)
            
            if RecordMerger.check_duplicate(db, import_hash, source_type):
                duplicate_rows += 1
                continue
            
            if source_type == 'charger':
                db_record = ChargeRecord(
                    battery_id=battery_id,
                    charge_start_time=record.get('charge_start_time'),
                    charge_end_time=record.get('charge_end_time'),
                    start_voltage=record.get('start_voltage'),
                    end_voltage=record.get('end_voltage'),
                    charge_current=record.get('charge_current'),
                    capacity_charged_mah=record.get('capacity_charged_mah'),
                    cycle_count=record.get('cycle_count'),
                    charger_id=record.get('charger_id'),
                    import_source=source_file_name,
                    import_hash=import_hash
                )
            elif source_type == 'flight':
                db_record = FlightRecord(
                    battery_id=battery_id,
                    flight_date=record.get('flight_date'),
                    flight_duration_min=record.get('flight_duration_min'),
                    start_voltage=record.get('start_voltage'),
                    end_voltage=record.get('end_voltage'),
                    min_voltage=record.get('min_voltage'),
                    avg_current=record.get('avg_current'),
                    max_current=record.get('max_current'),
                    temperature_c=record.get('temperature_c'),
                    cycle_count=record.get('cycle_count'),
                    has_low_voltage_alert=record.get('has_low_voltage_alert', False),
                    low_voltage_alert_time=record.get('low_voltage_alert_time'),
                    low_voltage_alert_value=record.get('low_voltage_alert_value'),
                    drone_id=record.get('drone_id'),
                    mission_name=record.get('mission_name'),
                    import_source=source_file_name,
                    import_hash=import_hash
                )
            elif source_type == 'voltage':
                db_record = CellVoltageReading(
                    battery_id=battery_id,
                    reading_time=record.get('reading_time'),
                    cell_1_voltage=record.get('cell_1_voltage'),
                    cell_2_voltage=record.get('cell_2_voltage'),
                    cell_3_voltage=record.get('cell_3_voltage'),
                    cell_4_voltage=record.get('cell_4_voltage'),
                    cell_5_voltage=record.get('cell_5_voltage'),
                    cell_6_voltage=record.get('cell_6_voltage'),
                    cell_7_voltage=record.get('cell_7_voltage'),
                    cell_8_voltage=record.get('cell_8_voltage'),
                    cell_9_voltage=record.get('cell_9_voltage'),
                    cell_10_voltage=record.get('cell_10_voltage'),
                    cell_11_voltage=record.get('cell_11_voltage'),
                    cell_12_voltage=record.get('cell_12_voltage'),
                    total_voltage=record.get('total_voltage'),
                    max_cell_voltage=record.get('max_cell_voltage'),
                    min_cell_voltage=record.get('min_cell_voltage'),
                    voltage_diff=record.get('voltage_diff'),
                    reading_source=record.get('reading_source'),
                    import_hash=import_hash
                )
            else:
                continue
            
            db.add(db_record)
            imported_rows += 1
    
    for error in parse_errors:
        quarantine_record = QuarantineService.add_parse_error_to_quarantine(
            db=db,
            import_session_id=import_session_id,
            source_type=source_type,
            source_file=source_file_name,
            error=error
        )
        quarantined_ids.append(quarantine_record.id)
    
    db.commit()
    
    quarantined_rows = len(quarantined_ids)
    
    return ImportResult(
        success=True,
        message=f"导入完成: 成功 {imported_rows} 条, 重复 {duplicate_rows} 条, 隔离 {quarantined_rows} 条",
        total_rows=total_rows,
        imported_rows=imported_rows,
        duplicate_rows=duplicate_rows,
        quarantined_rows=quarantined_rows,
        import_session_id=import_session_id,
        quarantined_ids=quarantined_ids
    )

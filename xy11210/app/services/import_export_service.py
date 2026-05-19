from sqlalchemy.orm import Session
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime
import uuid
import hashlib
import pandas as pd
from io import BytesIO
from app.models.models import ImportRecord, InspectionRecord, InspectionResult
from app.schemas.schemas import InspectionRecordCreate
from app.services.inspection_service import InspectionService
from app.services.pump_room_service import PumpRoomService
from app.services.user_service import UserService
from app.utils.logger import logger


class ImportExportService:
    @staticmethod
    def generate_batch_no() -> str:
        date_str = datetime.now().strftime("%Y%m%d%H%M%S")
        uuid_str = str(uuid.uuid4())[:6].upper()
        return f"BATCH-{date_str}-{uuid_str}"
    
    @staticmethod
    def calculate_file_hash(file_content: bytes) -> str:
        return hashlib.md5(file_content).hexdigest()
    
    @staticmethod
    def check_duplicate_file(db: Session, file_hash: str) -> Optional[ImportRecord]:
        return db.query(ImportRecord).filter(
            ImportRecord.file_hash == file_hash,
            ImportRecord.status == "completed"
        ).first()
    
    @staticmethod
    def create_import_record(
        db: Session,
        file_name: str,
        file_hash: str,
        total_count: int,
        import_by: int
    ) -> ImportRecord:
        batch_no = ImportExportService.generate_batch_no()
        db_record = ImportRecord(
            batch_no=batch_no,
            file_name=file_name,
            file_hash=file_hash,
            total_count=total_count,
            success_count=0,
            failed_count=0,
            duplicate_count=0,
            import_by=import_by,
            status="processing"
        )
        db.add(db_record)
        db.commit()
        db.refresh(db_record)
        logger.info({"action": "create_import_record", "batch_no": batch_no, "total_count": total_count})
        return db_record
    
    @staticmethod
    def update_import_record(
        db: Session,
        import_record: ImportRecord,
        success_count: int,
        failed_count: int,
        duplicate_count: int,
        status: str = "completed",
        error_message: Optional[str] = None
    ) -> ImportRecord:
        import_record.success_count = success_count
        import_record.failed_count = failed_count
        import_record.duplicate_count = duplicate_count
        import_record.status = status
        import_record.error_message = error_message
        import_record.completed_at = datetime.utcnow()
        db.commit()
        db.refresh(import_record)
        logger.info({
            "action": "update_import_record",
            "batch_no": import_record.batch_no,
            "success_count": success_count,
            "failed_count": failed_count,
            "duplicate_count": duplicate_count
        })
        return import_record
    
    @staticmethod
    def parse_inspection_excel(file_content: bytes) -> List[Dict[str, Any]]:
        try:
            df = pd.read_excel(BytesIO(file_content))
            records = []
            
            for _, row in df.iterrows():
                record = {
                    "pump_room_code": str(row.get("泵房编号", "")).strip(),
                    "inspection_time": row.get("巡检时间"),
                    "water_pressure": row.get("水压"),
                    "water_level": row.get("水位"),
                    "pump_status": str(row.get("水泵状态", "")).strip(),
                    "valve_status": str(row.get("阀门状态", "")).strip(),
                    "pipe_status": str(row.get("管道状态", "")).strip(),
                    "electrical_status": str(row.get("电气状态", "")).strip(),
                    "temperature": row.get("温度"),
                    "humidity": row.get("湿度"),
                    "noise_level": row.get("噪音"),
                    "result": str(row.get("巡检结果", "pending")).strip().lower(),
                    "issues": str(row.get("问题描述", "")).strip(),
                    "remarks": str(row.get("备注", "")).strip(),
                    "inspector_username": str(row.get("巡检人", "")).strip(),
                    "import_id": str(row.get("唯一标识", "")).strip() or None
                }
                records.append(record)
            
            return records
        except Exception as e:
            logger.error({"action": "parse_excel_failed", "error": str(e)})
            raise ValueError(f"解析Excel文件失败: {str(e)}")
    
    @staticmethod
    def import_inspection_records(
        db: Session,
        file_content: bytes,
        file_name: str,
        import_by: int
    ) -> Tuple[ImportRecord, List[str]]:
        file_hash = ImportExportService.calculate_file_hash(file_content)
        
        duplicate_file = ImportExportService.check_duplicate_file(db, file_hash)
        if duplicate_file:
            logger.warning({"action": "import_duplicate_file", "batch_no": duplicate_file.batch_no})
            return duplicate_file, ["该文件已导入过，批次号: " + duplicate_file.batch_no]
        
        parsed_records = ImportExportService.parse_inspection_excel(file_content)
        total_count = len(parsed_records)
        
        import_record = ImportExportService.create_import_record(
            db, file_name, file_hash, total_count, import_by
        )
        
        success_count = 0
        failed_count = 0
        duplicate_count = 0
        errors = []
        
        for idx, record_data in enumerate(parsed_records, 1):
            try:
                pump_room = PumpRoomService.get_pump_room_by_code(db, record_data["pump_room_code"])
                if not pump_room:
                    errors.append(f"第{idx}行: 泵房编号 {record_data['pump_room_code']} 不存在")
                    failed_count += 1
                    continue
                
                inspector_id = None
                if record_data.get("inspector_username"):
                    user = UserService.get_user_by_username(db, record_data["inspector_username"])
                    if user:
                        inspector_id = user.id
                
                inspection_time = record_data["inspection_time"]
                if isinstance(inspection_time, str):
                    try:
                        inspection_time = datetime.fromisoformat(inspection_time)
                    except:
                        inspection_time = datetime.now()
                elif pd.isna(inspection_time):
                    inspection_time = datetime.now()
                
                is_duplicate = InspectionService.check_duplicate_import(
                    db,
                    pump_room_id=pump_room.id,
                    inspection_time=inspection_time,
                    import_id=record_data.get("import_id")
                )
                
                if is_duplicate:
                    duplicate_count += 1
                    errors.append(f"第{idx}行: 重复记录，已跳过")
                    continue
                
                result_map = {
                    "normal": InspectionResult.NORMAL,
                    "abnormal": InspectionResult.ABNORMAL,
                    "异常": InspectionResult.ABNORMAL,
                    "正常": InspectionResult.NORMAL,
                    "pending": InspectionResult.PENDING
                }
                result = result_map.get(record_data["result"], InspectionResult.PENDING)
                
                record_in = InspectionRecordCreate(
                    pump_room_id=pump_room.id,
                    inspection_time=inspection_time,
                    water_pressure=record_data["water_pressure"] if not pd.isna(record_data["water_pressure"]) else None,
                    water_level=record_data["water_level"] if not pd.isna(record_data["water_level"]) else None,
                    pump_status=record_data["pump_status"] or None,
                    valve_status=record_data["valve_status"] or None,
                    pipe_status=record_data["pipe_status"] or None,
                    electrical_status=record_data["electrical_status"] or None,
                    temperature=record_data["temperature"] if not pd.isna(record_data["temperature"]) else None,
                    humidity=record_data["humidity"] if not pd.isna(record_data["humidity"]) else None,
                    noise_level=record_data["noise_level"] if not pd.isna(record_data["noise_level"]) else None,
                    result=result,
                    issues=record_data["issues"] or None,
                    remarks=record_data["remarks"] or None,
                    import_id=record_data.get("import_id"),
                    import_batch=import_record.batch_no
                )
                
                InspectionService.create_inspection_record(db, record_in, inspector_id)
                success_count += 1
                
            except Exception as e:
                failed_count += 1
                errors.append(f"第{idx}行: {str(e)}")
                logger.error({"action": "import_record_failed", "row": idx, "error": str(e)})
        
        ImportExportService.update_import_record(
            db, import_record, success_count, failed_count, duplicate_count,
            "completed" if failed_count < total_count else "partial_failed",
            "; ".join(errors[:10]) if errors else None
        )
        
        return import_record, errors
    
    @staticmethod
    def export_inspection_records(
        db: Session,
        pump_room_id: Optional[int] = None,
        result: Optional[InspectionResult] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> bytes:
        records = InspectionService.get_inspection_records(
            db,
            pump_room_id=pump_room_id,
            result=result,
            start_date=start_date,
            end_date=end_date,
            limit=10000
        )
        
        data = []
        for record in records:
            data.append({
                "记录编号": record.record_no,
                "泵房编号": record.pump_room.code if record.pump_room else "",
                "泵房名称": record.pump_room.name if record.pump_room else "",
                "巡检时间": record.inspection_time.strftime("%Y-%m-%d %H:%M:%S") if record.inspection_time else "",
                "巡检人": record.inspector.real_name if record.inspector else "",
                "水压": record.water_pressure,
                "水位": record.water_level,
                "水泵状态": record.pump_status or "",
                "阀门状态": record.valve_status or "",
                "管道状态": record.pipe_status or "",
                "电气状态": record.electrical_status or "",
                "温度": record.temperature,
                "湿度": record.humidity,
                "噪音": record.noise_level,
                "巡检结果": record.result.value,
                "问题描述": record.issues or "",
                "备注": record.remarks or "",
                "导入批次": record.import_batch or ""
            })
        
        df = pd.DataFrame(data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="巡检记录")
        
        return output.getvalue()

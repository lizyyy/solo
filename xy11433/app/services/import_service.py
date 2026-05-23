import os
import uuid
import pandas as pd
from datetime import datetime
from typing import Dict, List, Any, Tuple, Optional
from sqlalchemy.orm import Session
from app.models import ConsumableRecord, ImportEvidence, DataSource, ConsumableStatus
from app.config import settings
from loguru import logger


class ImportService:
    def __init__(self, db: Session):
        self.db = db
        self._ensure_directories()

    def _ensure_directories(self):
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    def _generate_record_no(self) -> str:
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        unique_id = str(uuid.uuid4())[:8].upper()
        return f"CONS-{timestamp}-{unique_id}"

    def _generate_duplicate_key(self, data: Dict[str, Any]) -> str:
        key_parts = [
            str(data.get("consumable_name", "")).strip(),
            str(data.get("specification", "")).strip(),
            str(data.get("batch_no", "")).strip(),
            str(data.get("quantity", "")).strip(),
            str(data.get("data_source", "")).strip()
        ]
        return "|".join(key_parts)

    def _check_duplicate(self, data: Dict[str, Any]) -> Optional[ConsumableRecord]:
        duplicate_key = self._generate_duplicate_key(data)
        
        existing = self.db.query(ConsumableRecord).filter(
            ConsumableRecord.consumable_name == data.get("consumable_name"),
            ConsumableRecord.specification == data.get("specification"),
            ConsumableRecord.batch_no == data.get("batch_no"),
            ConsumableRecord.quantity == float(data.get("quantity", 0)),
            ConsumableRecord.is_duplicate == False
        ).first()
        
        return existing

    def _parse_excel_row(self, row: pd.Series, data_source: str) -> Dict[str, Any]:
        parsed = {
            "consumable_name": str(row.get("耗材名称", row.get("名称", ""))).strip(),
            "specification": str(row.get("规格型号", row.get("规格", ""))).strip(),
            "quantity": float(row.get("数量", 0) or 0),
            "unit": str(row.get("单位", "")).strip(),
            "batch_no": str(row.get("批号", row.get("批次", ""))).strip(),
            "supplier": str(row.get("供应商", row.get("供货方", ""))).strip(),
            "lab": str(row.get("实验室", row.get("所属实验室", ""))).strip(),
            "research_group": str(row.get("课题组", row.get("研究组", ""))).strip(),
            "data_source": data_source,
            "original_raw": row.to_dict()
        }
        
        expire_date = row.get("有效期", row.get("到期日期"))
        if expire_date and pd.notna(expire_date):
            if isinstance(expire_date, datetime):
                parsed["expire_date"] = expire_date
            else:
                try:
                    parsed["expire_date"] = pd.to_datetime(expire_date)
                except:
                    pass
        
        return parsed

    def import_from_excel(
        self,
        file_path: str,
        file_name: str,
        data_source: DataSource,
        imported_by: str
    ) -> Dict[str, Any]:
        result = {
            "success_count": 0,
            "duplicate_count": 0,
            "failed_count": 0,
            "failed_records": []
        }

        try:
            df = pd.read_excel(file_path)
            logger.info(f"开始导入文件: {file_name}, 共 {len(df)} 行数据")

            for idx, row in df.iterrows():
                row_number = idx + 2
                
                try:
                    parsed_data = self._parse_excel_row(row, data_source.value)
                    
                    if not parsed_data["consumable_name"]:
                        continue
                    
                    duplicate_record = self._check_duplicate(parsed_data)
                    
                    if duplicate_record:
                        result["duplicate_count"] += 1
                        self._create_duplicate_record(
                            parsed_data, duplicate_record,
                            file_name, row_number, imported_by
                        )
                        continue
                    
                    self._create_record_with_evidence(
                        parsed_data, file_name, file_path,
                        row_number, imported_by
                    )
                    result["success_count"] += 1

                except Exception as e:
                    result["failed_count"] += 1
                    result["failed_records"].append({
                        "row_number": row_number,
                        "error": str(e),
                        "data": row.to_dict()
                    })
                    logger.error(f"导入第 {row_number} 行失败: {str(e)}")

            self.db.commit()
            logger.info(f"导入完成: 成功 {result['success_count']}, 重复 {result['duplicate_count']}, 失败 {result['failed_count']}")

        except Exception as e:
            self.db.rollback()
            logger.error(f"导入文件失败: {str(e)}")
            raise

        return result

    def _create_record_with_evidence(
        self,
        parsed_data: Dict[str, Any],
        file_name: str,
        file_path: str,
        row_number: int,
        imported_by: str
    ) -> ConsumableRecord:
        record_no = self._generate_record_no()
        
        record = ConsumableRecord(
            record_no=record_no,
            consumable_name=parsed_data["consumable_name"],
            specification=parsed_data["specification"],
            quantity=parsed_data["quantity"],
            unit=parsed_data["unit"],
            batch_no=parsed_data["batch_no"],
            expire_date=parsed_data.get("expire_date"),
            supplier=parsed_data["supplier"],
            data_source=parsed_data["data_source"],
            lab=parsed_data["lab"],
            research_group=parsed_data["research_group"],
            current_status=ConsumableStatus.PENDING.value,
            is_duplicate=False,
            original_file_name=file_name,
            original_row_number=row_number,
            original_data=parsed_data.get("original_raw"),
            created_by=imported_by
        )
        
        self.db.add(record)
        self.db.flush()
        
        evidence = ImportEvidence(
            record_id=record.id,
            source_file_name=file_name,
            source_file_path=file_path,
            source_row_number=row_number,
            original_raw_value=parsed_data.get("original_raw"),
            parsed_standard_value={
                "consumable_name": parsed_data["consumable_name"],
                "specification": parsed_data["specification"],
                "quantity": parsed_data["quantity"],
                "unit": parsed_data["unit"],
                "batch_no": parsed_data["batch_no"],
                "supplier": parsed_data["supplier"]
            },
            imported_by=imported_by
        )
        
        self.db.add(evidence)
        
        return record

    def _create_duplicate_record(
        self,
        parsed_data: Dict[str, Any],
        original_record: ConsumableRecord,
        file_name: str,
        row_number: int,
        imported_by: str
    ) -> ConsumableRecord:
        record_no = self._generate_record_no()
        
        duplicate_record = ConsumableRecord(
            record_no=record_no,
            consumable_name=parsed_data["consumable_name"],
            specification=parsed_data["specification"],
            quantity=parsed_data["quantity"],
            unit=parsed_data["unit"],
            batch_no=parsed_data["batch_no"],
            expire_date=parsed_data.get("expire_date"),
            supplier=parsed_data["supplier"],
            data_source=parsed_data["data_source"],
            lab=parsed_data["lab"],
            research_group=parsed_data["research_group"],
            current_status=ConsumableStatus.PENDING.value,
            is_duplicate=True,
            duplicate_of=original_record.id,
            original_file_name=file_name,
            original_row_number=row_number,
            original_data=parsed_data.get("original_raw"),
            created_by=imported_by
        )
        
        self.db.add(duplicate_record)
        
        return duplicate_record

    def manual_correct_record(
        self,
        record_id: int,
        corrected_data: Dict[str, Any],
        operator: str,
        reason: str
    ) -> ConsumableRecord:
        record = self.db.query(ConsumableRecord).filter(
            ConsumableRecord.id == record_id
        ).first()
        
        if not record:
            raise ValueError(f"记录不存在: {record_id}")
        
        evidence = record.import_evidence
        if evidence:
            correction_history = evidence.correction_history or []
            correction_history.append({
                "operator": operator,
                "reason": reason,
                "before_data": evidence.parsed_standard_value,
                "after_data": corrected_data,
                "correction_time": datetime.now().isoformat()
            })
            evidence.correction_history = correction_history
            evidence.is_manual_corrected = True
            evidence.parsed_standard_value = corrected_data
        
        for key, value in corrected_data.items():
            if hasattr(record, key) and key != "id":
                setattr(record, key, value)
        
        self.db.commit()
        
        return record

    def import_single_record(
        self,
        record_data: Dict[str, Any],
        data_source: DataSource,
        imported_by: str,
        source_file_name: Optional[str] = None,
        source_row_number: Optional[int] = None
    ) -> Tuple[ConsumableRecord, bool]:
        record_data["data_source"] = data_source.value
        
        duplicate_record = self._check_duplicate(record_data)
        
        if duplicate_record:
            record = self._create_duplicate_record(
                record_data, duplicate_record,
                source_file_name or "manual",
                source_row_number or 0,
                imported_by
            )
            self.db.commit()
            return record, True
        
        record = self._create_record_with_evidence(
            record_data,
            source_file_name or "manual",
            "manual_input",
            source_row_number or 0,
            imported_by
        )
        self.db.commit()
        
        return record, False

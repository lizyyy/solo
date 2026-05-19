from typing import List, Dict, Tuple, Optional
from datetime import datetime
import pandas as pd
import hashlib
import json
from io import BytesIO
from sqlalchemy.orm import Session

from app.models.models import Batch, Medicine, Inventory
from app.models.enums import BatchStatus
from app.services.batch_service import BatchService
from app.repositories.medicine_repository import MedicineRepository
from app.repositories.batch_repository import BatchRepository
from app.repositories.inventory_repository import InventoryRepository
from app.core.security import mask_sensitive_data


class ImportExportService:
    def __init__(self):
        self.batch_service = BatchService()
        self.medicine_repo = MedicineRepository()
        self.batch_repo = BatchRepository()
        self.inventory_repo = InventoryRepository()

    def _generate_row_hash(self, row_data: Dict) -> str:
        data_str = json.dumps(row_data, sort_keys=True, ensure_ascii=False)
        return hashlib.md5(data_str.encode('utf-8')).hexdigest()

    def import_from_excel(
        self,
        db: Session,
        file_content: bytes,
        operator_id: int,
        ip_address: Optional[str] = None
    ) -> Tuple[List[Dict], int, int]:
        df = pd.read_excel(BytesIO(file_content))
        results = []
        success_count = 0
        skip_count = 0

        for _, row in df.iterrows():
            row_result = self._import_single_row(db, row, operator_id, ip_address)
            results.append(row_result)
            if row_result.get("status") == "success":
                success_count += 1
            elif row_result.get("status") == "skipped":
                skip_count += 1

        return results, success_count, skip_count

    def _import_single_row(
        self,
        db: Session,
        row: pd.Series,
        operator_id: int,
        ip_address: Optional[str] = None
    ) -> Dict:
        batch_no = str(row.get("批号", "")).strip()
        medicine_code = str(row.get("药品编码", "")).strip()
        quantity = int(row.get("数量", 0))
        arrival_temperature = float(row.get("到店温度")) if pd.notna(row.get("到店温度")) else None
        temperature_photo_path = str(row.get("温度照片路径", "")).strip() or None
        damage_photo_path = str(row.get("破损照片路径", "")).strip() or None
        damage_quantity = int(row.get("破损数量", 0)) if pd.notna(row.get("破损数量")) else 0
        damage_description = str(row.get("破损描述", "")).strip() or None

        production_date = None
        if pd.notna(row.get("生产日期")):
            if isinstance(row.get("生产日期"), datetime):
                production_date = row.get("生产日期")
            else:
                try:
                    production_date = pd.to_datetime(row.get("生产日期")).to_pydatetime()
                except:
                    pass

        expiry_date = None
        if pd.notna(row.get("有效期")):
            if isinstance(row.get("有效期"), datetime):
                expiry_date = row.get("有效期")
            else:
                try:
                    expiry_date = pd.to_datetime(row.get("有效期")).to_pydatetime()
                except:
                    pass

        unit = str(row.get("单位", "支")).strip()
        remarks = str(row.get("备注", "")).strip() or None

        if not batch_no or not medicine_code or quantity <= 0:
            return {
                "batch_no": batch_no,
                "status": "error",
                "reason": "缺少必要字段（批号、药品编码、数量）"
            }

        medicine = self.medicine_repo.get_by_code(db, medicine_code)
        if not medicine:
            return {
                "batch_no": batch_no,
                "status": "error",
                "reason": f"药品编码不存在: {medicine_code}"
            }

        row_hash_data = {
            "batch_no": batch_no,
            "medicine_code": medicine_code,
            "quantity": quantity,
            "arrival_temperature": arrival_temperature
        }
        row_hash = self._generate_row_hash(row_hash_data)
        existing_batch = self.batch_service.get_batch_by_hash(db, row_hash)

        if existing_batch:
            return {
                "batch_no": batch_no,
                "status": "skipped",
                "reason": "数据已存在，重复导入跳过",
                "batch_id": existing_batch.id
            }

        existing_by_batch_no = self.batch_repo.get_by_batch_no(db, batch_no)
        if existing_by_batch_no:
            return {
                "batch_no": batch_no,
                "status": "skipped",
                "reason": "批号已存在，跳过",
                "batch_id": existing_by_batch_no.id
            }

        batch, passed, blocked_reasons = self.batch_service.create_batch(
            db=db,
            batch_no=batch_no,
            medicine_id=medicine.id,
            quantity=quantity,
            arrival_temperature=arrival_temperature,
            temperature_photo_path=temperature_photo_path,
            damage_photo_path=damage_photo_path,
            damage_quantity=damage_quantity,
            damage_description=damage_description,
            production_date=production_date,
            expiry_date=expiry_date,
            unit=unit,
            remarks=remarks,
            operator_id=operator_id
        )

        if batch:
            batch.import_hash = row_hash
            db.commit()
            db.refresh(batch)

        return {
            "batch_no": batch_no,
            "status": "success" if passed else "warning",
            "batch_id": batch.id if batch else None,
            "blocked_reasons": blocked_reasons
        }

    def export_to_excel(
        self,
        db: Session,
        batch_ids: Optional[List[int]] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        status_filter: Optional[BatchStatus] = None,
        include_sensitive: bool = False
    ) -> bytes:
        query = db.query(Batch).join(Medicine)

        if batch_ids:
            query = query.filter(Batch.id.in_(batch_ids))
        if start_date:
            query = query.filter(Batch.created_at >= start_date)
        if end_date:
            query = query.filter(Batch.created_at <= end_date)
        if status_filter:
            query = query.filter(Batch.status == status_filter)

        batches = query.all()

        export_data = []
        for batch in batches:
            medicine = batch.medicine
            inventory = self.inventory_repo.get_by_batch(db, batch.id)

            row = {
                "批次ID": batch.id,
                "批号": batch.batch_no,
                "药品编码": medicine.code if medicine else "",
                "药品名称": medicine.name if medicine else "",
                "药品类型": medicine.type.value if medicine else "",
                "数量": batch.quantity,
                "单位": batch.unit,
                "到店温度": batch.arrival_temperature,
                "破损数量": batch.damage_quantity,
                "破损描述": batch.damage_description,
                "生产日期": batch.production_date.strftime("%Y-%m-%d") if batch.production_date else "",
                "有效期": batch.expiry_date.strftime("%Y-%m-%d") if batch.expiry_date else "",
                "状态": batch.status.value,
                "签收人ID": batch.receiver_id,
                "签收时间": batch.received_at.strftime("%Y-%m-%d %H:%M:%S") if batch.received_at else "",
                "复核人ID": batch.reviewer_id,
                "复核时间": batch.reviewed_at.strftime("%Y-%m-%d %H:%M:%S") if batch.reviewed_at else "",
                "库存总量": inventory.quantity if inventory else 0,
                "可用库存": inventory.available_quantity if inventory else 0,
                "锁定库存": inventory.locked_quantity if inventory else 0,
                "破损库存": inventory.damaged_quantity if inventory else 0,
                "备注": batch.remarks,
                "创建时间": batch.created_at.strftime("%Y-%m-%d %H:%M:%S") if batch.created_at else ""
            }

            if not include_sensitive:
                row = mask_sensitive_data(row)

            export_data.append(row)

        df = pd.DataFrame(export_data)

        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='批次数据')

            workbook = writer.book
            worksheet = writer.sheets['批次数据']

            for column in worksheet.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = min(max_length + 2, 50)
                worksheet.column_dimensions[column_letter].width = adjusted_width

        return output.getvalue()

    def export_operation_logs(
        self,
        db: Session,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        batch_id: Optional[int] = None
    ) -> bytes:
        from app.repositories.operation_log_repository import OperationLogRepository
        log_repo = OperationLogRepository()

        if batch_id:
            logs = log_repo.get_by_batch(db, batch_id)
        elif start_date and end_date:
            logs = log_repo.get_by_date_range(db, start_date, end_date)
        else:
            logs = log_repo.list_all(db, limit=1000)

        export_data = []
        for log in logs:
            row = {
                "日志ID": log.id,
                "操作类型": log.operation_type.value,
                "批次ID": log.batch_id,
                "操作人ID": log.operator_id,
                "变更前数据": log.before_data,
                "变更后数据": log.after_data,
                "变更原因": log.change_reason,
                "IP地址": log.ip_address,
                "操作时间": log.created_at.strftime("%Y-%m-%d %H:%M:%S") if log.created_at else ""
            }
            export_data.append(row)

        df = pd.DataFrame(export_data)

        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='操作日志')

        return output.getvalue()

    def export_monthly_reconciliation(
        self,
        db: Session,
        year: int,
        month: int
    ) -> bytes:
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)

        batches = db.query(Batch).filter(
            Batch.created_at >= start_date,
            Batch.created_at < end_date
        ).all()

        batch_data = []
        status_summary = {}
        total_quantity = 0
        total_damaged = 0

        for batch in batches:
            status_value = batch.status.value
            status_summary[status_value] = status_summary.get(status_value, 0) + 1

            inventory = self.inventory_repo.get_by_batch(db, batch.id)
            batch_quantity = inventory.quantity if inventory else batch.quantity
            batch_damaged = inventory.damaged_quantity if inventory else batch.damage_quantity

            total_quantity += batch_quantity
            total_damaged += batch_damaged

            batch_data.append({
                "批次ID": batch.id,
                "批号": batch.batch_no,
                "状态": batch.status.value,
                "总数量": batch_quantity,
                "破损数量": batch_damaged,
                "签收时间": batch.received_at.strftime("%Y-%m-%d %H:%M") if batch.received_at else "",
                "复核时间": batch.reviewed_at.strftime("%Y-%m-%d %H:%M") if batch.reviewed_at else ""
            })

        summary_data = [
            {"项目": "总批次数量", "数值": len(batches)},
            {"项目": "总药品数量", "数值": total_quantity},
            {"项目": "总破损数量", "数值": total_damaged},
        ]

        for status, count in status_summary.items():
            summary_data.append({"项目": f"{status}批次数量", "数值": count})

        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            pd.DataFrame(summary_data).to_excel(writer, index=False, sheet_name='月度汇总')
            pd.DataFrame(batch_data).to_excel(writer, index=False, sheet_name='批次明细')

        return output.getvalue()

import pandas as pd
import json
from datetime import datetime
from typing import List, Dict
from sqlalchemy.orm import Session
from app.models.models import RepairRecord, WorkOrder, MaterialBatch, MaterialTraceLog


class ImportService:
    def __init__(self, db: Session):
        self.db = db

    def import_repair_csv(self, file_content: bytes, filename: str) -> Dict:
        df = pd.read_csv(pd.io.common.BytesIO(file_content))
        imported_count = 0
        error_count = 0
        errors = []

        for idx, row in df.iterrows():
            try:
                repair_date = self._parse_date(row.get('repair_date', row.get('返修日期', '')))
                
                record = RepairRecord(
                    record_id=str(row.get('record_id', row.get('记录ID', f'REC_{datetime.now().timestamp()}_{idx}'))),
                    work_order_no=str(row.get('work_order_no', row.get('工单号', ''))),
                    product_sn=str(row.get('product_sn', row.get('产品序列号', ''))),
                    repair_date=repair_date,
                    defect_code=str(row.get('defect_code', row.get('缺陷代码', ''))),
                    defect_description=str(row.get('defect_description', row.get('缺陷描述', ''))),
                    repair_station=str(row.get('repair_station', row.get('返修工位', ''))),
                    repair_result=str(row.get('repair_result', row.get('返修结果', ''))),
                    material_batch_no=str(row.get('material_batch_no', row.get('物料批号', ''))),
                    operator=str(row.get('operator', row.get('操作员', ''))),
                    remarks=str(row.get('remarks', row.get('备注', ''))),
                    source_file=filename
                )
                
                existing = self.db.query(RepairRecord).filter(
                    RepairRecord.record_id == record.record_id
                ).first()
                
                if not existing:
                    self.db.add(record)
                    imported_count += 1
                else:
                    error_count += 1
                    errors.append(f"Row {idx+1}: Record ID {record.record_id} already exists")
                    
            except Exception as e:
                error_count += 1
                errors.append(f"Row {idx+1}: {str(e)}")

        self.db.commit()
        return {
            "imported": imported_count,
            "errors": error_count,
            "error_details": errors
        }

    def import_work_order_json(self, file_content: bytes, filename: str) -> Dict:
        data = json.loads(file_content)
        imported_count = 0
        error_count = 0
        errors = []

        orders = data if isinstance(data, list) else data.get('orders', [data])

        for idx, order in enumerate(orders):
            try:
                start_date = self._parse_date(order.get('start_date', order.get('开始日期', '')))
                end_date = self._parse_date(order.get('end_date', order.get('结束日期', '')))

                work_order = WorkOrder(
                    order_no=str(order.get('order_no', order.get('工单号', ''))),
                    product_model=str(order.get('product_model', order.get('产品型号', ''))),
                    planned_qty=int(order.get('planned_qty', order.get('计划数量', 0))),
                    actual_qty=int(order.get('actual_qty', order.get('实际数量', 0))),
                    start_date=start_date,
                    end_date=end_date,
                    production_line=str(order.get('production_line', order.get('生产线', ''))),
                    status=str(order.get('status', order.get('状态', ''))),
                    material_batch_no=str(order.get('material_batch_no', order.get('物料批号', ''))),
                    source_file=filename
                )

                existing = self.db.query(WorkOrder).filter(
                    WorkOrder.order_no == work_order.order_no
                ).first()

                if not existing:
                    self.db.add(work_order)
                    imported_count += 1
                else:
                    error_count += 1
                    errors.append(f"Order {idx+1}: Order No {work_order.order_no} already exists")

            except Exception as e:
                error_count += 1
                errors.append(f"Order {idx+1}: {str(e)}")

        self.db.commit()
        return {
            "imported": imported_count,
            "errors": error_count,
            "error_details": errors
        }

    def import_material_batch(self, batch_data: Dict) -> Dict:
        try:
            production_date = self._parse_date(batch_data.get('production_date', ''))
            received_date = self._parse_date(batch_data.get('received_date', ''))

            batch = MaterialBatch(
                batch_no=str(batch_data['batch_no']),
                material_code=str(batch_data.get('material_code', '')),
                material_name=str(batch_data.get('material_name', '')),
                supplier=str(batch_data.get('supplier', '')),
                production_date=production_date,
                received_date=received_date,
                total_qty=int(batch_data.get('total_qty', 0)),
                used_qty=int(batch_data.get('used_qty', 0)),
                defect_qty=int(batch_data.get('defect_qty', 0)),
                storage_location=str(batch_data.get('storage_location', '')),
                quality_status=str(batch_data.get('quality_status', 'PENDING')),
                remarks=str(batch_data.get('remarks', ''))
            )

            existing = self.db.query(MaterialBatch).filter(
                MaterialBatch.batch_no == batch.batch_no
            ).first()

            if not existing:
                self.db.add(batch)
                self.db.commit()
                return {"success": True, "batch_no": batch.batch_no}
            else:
                return {"success": False, "error": "Batch already exists"}

        except Exception as e:
            self.db.rollback()
            return {"success": False, "error": str(e)}

    def _parse_date(self, date_str: str) -> datetime:
        if not date_str or pd.isna(date_str):
            return datetime.now()
        
        date_formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d %H:%M',
            '%Y-%m-%d',
            '%Y/%m/%d %H:%M:%S',
            '%Y/%m/%d',
            '%m/%d/%Y',
            '%d-%m-%Y'
        ]
        
        for fmt in date_formats:
            try:
                return datetime.strptime(str(date_str).strip(), fmt)
            except ValueError:
                continue
        
        return datetime.now()

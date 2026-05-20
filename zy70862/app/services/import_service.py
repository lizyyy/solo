import pandas as pd
import json
from datetime import datetime
from typing import List, Dict
from sqlalchemy.orm import Session
from app.models.models import MaterialRequisition, VehicleMaterial, Inventory, BatchTrace


class ImportService:
    @staticmethod
    def import_requisitions_from_csv(db: Session, file_path: str) -> Dict:
        try:
            df = pd.read_csv(file_path)
            imported_count = 0
            error_count = 0
            errors = []

            for idx, row in df.iterrows():
                try:
                    requisition = MaterialRequisition(
                        requisition_no=str(row.get("领料单号", f"REQ{datetime.now().strftime('%Y%m%d')}_{idx}")),
                        repair_team=str(row.get("抢修队", "")),
                        vehicle_no=str(row.get("车牌号", "")),
                        requisition_date=pd.to_datetime(row.get("领料日期", datetime.now())).to_pydatetime(),
                        material_code=str(row.get("物资编码", "")),
                        material_name=str(row.get("物资名称", "")),
                        specification=str(row.get("规格型号", "")),
                        quantity=float(row.get("数量", 0)),
                        unit=str(row.get("单位", "")),
                        batch_no=str(row.get("批次号", "")),
                        is_emergency=bool(row.get("是否紧急", False)),
                        operator=str(row.get("操作员", "")),
                        status="pending"
                    )
                    db.add(requisition)
                    imported_count += 1

                    if requisition.batch_no:
                        batch_trace = BatchTrace(
                            batch_no=requisition.batch_no,
                            material_code=requisition.material_code,
                            material_name=requisition.material_name,
                            source_type="requisition",
                            source_id=requisition.id,
                            source_no=requisition.requisition_no,
                            action_type="out",
                            quantity=requisition.quantity,
                            operator=requisition.operator,
                            operation_date=requisition.requisition_date,
                            remark=f"领料单导入: {requisition.requisition_no}"
                        )
                        db.add(batch_trace)

                except Exception as e:
                    error_count += 1
                    errors.append(f"第{idx+2}行: {str(e)}")

            db.commit()
            return {
                "success": True,
                "imported_count": imported_count,
                "error_count": error_count,
                "errors": errors
            }
        except Exception as e:
            db.rollback()
            return {
                "success": False,
                "error": str(e)
            }

    @staticmethod
    def import_vehicle_materials_from_json(db: Session, file_path: str) -> Dict:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            if isinstance(data, dict) and "data" in data:
                data = data["data"]

            imported_count = 0
            error_count = 0
            errors = []

            for idx, item in enumerate(data):
                try:
                    vehicle_material = VehicleMaterial(
                        vehicle_no=str(item.get("车牌号", "")),
                        check_date=pd.to_datetime(item.get("盘点日期", datetime.now())).to_pydatetime(),
                        material_code=str(item.get("物资编码", "")),
                        material_name=str(item.get("物资名称", "")),
                        specification=str(item.get("规格型号", "")),
                        start_quantity=float(item.get("出车数量", 0)),
                        end_quantity=float(item.get("回车数量", 0)),
                        used_quantity=float(item.get("使用数量", 0)),
                        unit=str(item.get("单位", "")),
                        batch_no=str(item.get("批次号", "")),
                        checker=str(item.get("盘点人", ""))
                    )
                    db.add(vehicle_material)
                    imported_count += 1

                except Exception as e:
                    error_count += 1
                    errors.append(f"第{idx+1}条: {str(e)}")

            db.commit()
            return {
                "success": True,
                "imported_count": imported_count,
                "error_count": error_count,
                "errors": errors
            }
        except Exception as e:
            db.rollback()
            return {
                "success": False,
                "error": str(e)
            }

    @staticmethod
    def import_inventory_from_csv(db: Session, file_path: str) -> Dict:
        try:
            df = pd.read_csv(file_path)
            imported_count = 0
            updated_count = 0
            error_count = 0
            errors = []

            for idx, row in df.iterrows():
                try:
                    material_code = str(row.get("物资编码", ""))
                    existing = db.query(Inventory).filter(Inventory.material_code == material_code).first()

                    if existing:
                        existing.quantity = float(row.get("数量", 0))
                        existing.warehouse = str(row.get("仓库", ""))
                        existing.batch_no = str(row.get("批次号", ""))
                        existing.safety_stock = float(row.get("安全库存", 0))
                        updated_count += 1
                    else:
                        inventory = Inventory(
                            material_code=material_code,
                            material_name=str(row.get("物资名称", "")),
                            specification=str(row.get("规格型号", "")),
                            quantity=float(row.get("数量", 0)),
                            unit=str(row.get("单位", "")),
                            warehouse=str(row.get("仓库", "")),
                            batch_no=str(row.get("批次号", "")),
                            safety_stock=float(row.get("安全库存", 0))
                        )
                        db.add(inventory)
                        imported_count += 1

                except Exception as e:
                    error_count += 1
                    errors.append(f"第{idx+2}行: {str(e)}")

            db.commit()
            return {
                "success": True,
                "imported_count": imported_count,
                "updated_count": updated_count,
                "error_count": error_count,
                "errors": errors
            }
        except Exception as e:
            db.rollback()
            return {
                "success": False,
                "error": str(e)
            }

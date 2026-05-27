import pandas as pd
import json
import os
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import Order, MeterReading, Deduction
from app.schemas import ImportResult
from app.config import settings


class ImportService:
    def __init__(self, db: Session):
        self.db = db

    def import_meter_csv(self, file_path: str) -> ImportResult:
        try:
            df = pd.read_csv(file_path)
            errors = []
            imported = 0

            required_columns = ["order_no", "meter_type", "initial_reading", "final_reading"]
            missing_cols = [col for col in required_columns if col not in df.columns]
            if missing_cols:
                return ImportResult(
                    success=False,
                    message=f"缺少必要列: {', '.join(missing_cols)}",
                    errors=[f"CSV文件缺少必要列: {', '.join(missing_cols)}"]
                )

            for idx, row in df.iterrows():
                try:
                    order_no = str(row["order_no"]).strip()
                    order = self.db.query(Order).filter(Order.order_no == order_no).first()

                    if not order:
                        errors.append(f"第{idx+2}行: 订单号 {order_no} 不存在")
                        continue

                    meter_reading = MeterReading(
                        order_id=order.id,
                        meter_type=str(row["meter_type"]).strip(),
                        initial_reading=float(row["initial_reading"]),
                        final_reading=float(row["final_reading"]),
                        unit=str(row.get("unit", "kWh")).strip(),
                        photo_url=str(row.get("photo_url", "")).strip() or None,
                        reading_date=pd.to_datetime(row.get("reading_date", datetime.now()))
                    )
                    self.db.add(meter_reading)
                    imported += 1

                except Exception as e:
                    errors.append(f"第{idx+2}行: {str(e)}")

            self.db.commit()
            return ImportResult(
                success=True,
                message=f"成功导入 {imported} 条抄表记录",
                imported_count=imported,
                errors=errors
            )

        except Exception as e:
            return ImportResult(
                success=False,
                message=f"CSV导入失败: {str(e)}",
                errors=[str(e)]
            )

    def import_order_json(self, file_path: str) -> ImportResult:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            errors = []
            imported = 0

            if not isinstance(data, list):
                data = [data]

            for idx, order_data in enumerate(data):
                try:
                    order_no = str(order_data.get("order_no", "")).strip()
                    if not order_no:
                        errors.append(f"第{idx+1}条: 缺少订单号")
                        continue

                    existing_order = self.db.query(Order).filter(Order.order_no == order_no).first()
                    if existing_order:
                        errors.append(f"第{idx+1}条: 订单号 {order_no} 已存在")
                        continue

                    order = Order(
                        id=order_data.get("id", order_no),
                        order_no=order_no,
                        tenant_name=str(order_data.get("tenant_name", "")).strip(),
                        tenant_phone=str(order_data.get("tenant_phone", "")).strip() or None,
                        room_no=str(order_data.get("room_no", "")).strip(),
                        check_in_date=datetime.fromisoformat(order_data["check_in_date"]),
                        check_out_date=datetime.fromisoformat(order_data["check_out_date"]),
                        rental_amount=float(order_data.get("rental_amount", 0)),
                        deposit_amount=float(order_data.get("deposit_amount", settings.DEFAULT_DEPOSIT_AMOUNT)),
                        deposit_status=str(order_data.get("deposit_status", "pending")).strip()
                    )
                    self.db.add(order)
                    imported += 1

                except Exception as e:
                    errors.append(f"第{idx+1}条: {str(e)}")

            self.db.commit()
            return ImportResult(
                success=True,
                message=f"成功导入 {imported} 条订单记录",
                imported_count=imported,
                errors=errors
            )

        except Exception as e:
            return ImportResult(
                success=False,
                message=f"JSON导入失败: {str(e)}",
                errors=[str(e)]
            )

    def import_deduction_photo(self, order_id: str, photo_url: str, 
                               deduction_type: str, amount: float,
                               description: str = "") -> ImportResult:
        try:
            order = self.db.query(Order).filter(Order.id == order_id).first()
            if not order:
                return ImportResult(
                    success=False,
                    message=f"订单 {order_id} 不存在"
                )

            deduction = Deduction(
                order_id=order.id,
                deduction_type=deduction_type,
                amount=amount,
                description=description,
                evidence_url=photo_url
            )
            self.db.add(deduction)
            self.db.commit()

            return ImportResult(
                success=True,
                message="扣款记录导入成功",
                imported_count=1
            )

        except Exception as e:
            return ImportResult(
                success=False,
                message=f"扣款记录导入失败: {str(e)}",
                errors=[str(e)]
            )

    def import_deduction_batch(self, file_path: str) -> ImportResult:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            errors = []
            imported = 0

            if not isinstance(data, list):
                data = [data]

            for idx, ded_data in enumerate(data):
                try:
                    order_no = str(ded_data.get("order_no", "")).strip()
                    order = self.db.query(Order).filter(Order.order_no == order_no).first()

                    if not order:
                        errors.append(f"第{idx+1}条: 订单号 {order_no} 不存在")
                        continue

                    deduction = Deduction(
                        order_id=order.id,
                        deduction_type=str(ded_data.get("deduction_type", "")).strip(),
                        amount=float(ded_data.get("amount", 0)),
                        description=str(ded_data.get("description", "")).strip(),
                        evidence_url=str(ded_data.get("evidence_url", "")).strip() or None
                    )
                    self.db.add(deduction)
                    imported += 1

                except Exception as e:
                    errors.append(f"第{idx+1}条: {str(e)}")

            self.db.commit()
            return ImportResult(
                success=True,
                message=f"成功导入 {imported} 条扣款记录",
                imported_count=imported,
                errors=errors
            )

        except Exception as e:
            return ImportResult(
                success=False,
                message=f"扣款批量导入失败: {str(e)}",
                errors=[str(e)]
            )
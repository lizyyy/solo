from datetime import datetime, date
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import uuid
import csv
import io

from models import (
    WorkOrder, Operator, Tractor, Bill, BillItem, 
    ImportBatch, WorkOrderStatus, BillingType, ValidationLog
)
from billing_engine import BillingEngine
from validation_engine import ValidationEngine

class WorkOrderService:
    def __init__(self, db: Session):
        self.db = db
        self.billing_engine = BillingEngine()
        self.validation_engine = ValidationEngine(db)
    
    def create_work_order(self, data: Dict[str, Any], skip_duplicate: bool = False) -> Dict[str, Any]:
        work_order = WorkOrder(
            order_no=data.get("order_no", f"WO{datetime.now().strftime('%Y%m%d%H%M%S')}"),
            operator_id=data.get("operator_id"),
            tractor_id=data.get("tractor_id"),
            customer_name=data.get("customer_name"),
            customer_phone=data.get("customer_phone"),
            work_type=data.get("work_type"),
            start_time=data.get("start_time"),
            end_time=data.get("end_time"),
            work_area=data.get("work_area", 0),
            fuel_used=data.get("fuel_used", 0),
            billing_type=data.get("billing_type", BillingType.MIXED),
            hourly_rate=data.get("hourly_rate", 0),
            area_rate=data.get("area_rate", 0),
            fuel_price=data.get("fuel_price", 0),
            minimum_charge=data.get("minimum_charge", 0),
            status=WorkOrderStatus.IMPORTED
        )
        
        validation_result = self.validation_engine.validate(work_order, skip_duplicate=skip_duplicate)
        
        if validation_result.passed:
            work_order.status = WorkOrderStatus.VALID
            billing_result = self.billing_engine.calculate_work_order(work_order)
        else:
            work_order.status = WorkOrderStatus.INVALID
        
        self.db.add(work_order)
        self.db.flush()
        
        self.validation_engine.save_validation_logs(work_order.id, validation_result)
        
        self.db.commit()
        
        return {
            "success": validation_result.passed,
            "work_order_id": work_order.id,
            "order_no": work_order.order_no,
            "status": work_order.status.value,
            "validation": validation_result.to_dict(),
            "billing": billing_result.to_dict() if validation_result.passed else None
        }
    
    def get_work_order(self, work_order_id: int) -> Optional[Dict[str, Any]]:
        work_order = self.db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
        if not work_order:
            return None
        
        validation_logs = self.db.query(ValidationLog).filter(
            ValidationLog.work_order_id == work_order_id
        ).all()
        
        return {
            "id": work_order.id,
            "order_no": work_order.order_no,
            "operator_id": work_order.operator_id,
            "tractor_id": work_order.tractor_id,
            "customer_name": work_order.customer_name,
            "work_type": work_order.work_type,
            "start_time": work_order.start_time.isoformat() if work_order.start_time else None,
            "end_time": work_order.end_time.isoformat() if work_order.end_time else None,
            "work_hours": work_order.work_hours,
            "work_area": work_order.work_area,
            "fuel_used": work_order.fuel_used,
            "calculated_amount": work_order.calculated_amount,
            "final_amount": work_order.final_amount,
            "status": work_order.status.value,
            "validation_logs": [
                {
                    "check_name": log.check_name,
                    "passed": log.passed,
                    "message": log.message,
                    "severity": log.severity
                } for log in validation_logs
            ]
        }
    
    def calculate_work_order(self, work_order_id: int) -> Dict[str, Any]:
        work_order = self.db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
        if not work_order:
            return {"success": False, "error": "作业单不存在"}
        
        if work_order.status == WorkOrderStatus.BILLED:
            return {"success": False, "error": "作业单已结算，不可重新计算"}
        
        billing_result = self.billing_engine.calculate_work_order(work_order)
        work_order.status = WorkOrderStatus.VALID
        
        self.db.commit()
        
        return {
            "success": True,
            "work_order_id": work_order.id,
            "billing": billing_result.to_dict()
        }

class ImportService:
    def __init__(self, db: Session):
        self.db = db
        self.work_order_service = WorkOrderService(db)
    
    def parse_csv(self, csv_content: str) -> List[Dict[str, Any]]:
        rows = []
        reader = csv.DictReader(io.StringIO(csv_content))
        for row in reader:
            rows.append(row)
        return rows
    
    def parse_row_data(self, row: Dict[str, str], row_number: int) -> Dict[str, Any]:
        data = {}
        errors = []
        
        try:
            data["order_no"] = row.get("order_no", "").strip() or row.get("作业单号", "").strip()
            data["operator_id"] = int(row.get("operator_id", 0) or row.get("机手ID", 0) or 0)
            data["tractor_id"] = int(row.get("tractor_id", 0) or row.get("拖拉机ID", 0) or 0)
            data["customer_name"] = row.get("customer_name", "") or row.get("客户名称", "")
            data["work_type"] = row.get("work_type", "") or row.get("作业类型", "")
            
            start_time_str = row.get("start_time", "") or row.get("开始时间", "")
            if start_time_str:
                try:
                    data["start_time"] = datetime.fromisoformat(start_time_str)
                except:
                    try:
                        data["start_time"] = datetime.strptime(start_time_str, "%Y-%m-%d %H:%M:%S")
                    except:
                        errors.append(f"开始时间格式错误: {start_time_str}")
            
            end_time_str = row.get("end_time", "") or row.get("结束时间", "")
            if end_time_str:
                try:
                    data["end_time"] = datetime.fromisoformat(end_time_str)
                except:
                    try:
                        data["end_time"] = datetime.strptime(end_time_str, "%Y-%m-%d %H:%M:%S")
                    except:
                        errors.append(f"结束时间格式错误: {end_time_str}")
            
            data["work_area"] = float(row.get("work_area", 0) or row.get("作业面积", 0) or 0)
            data["fuel_used"] = float(row.get("fuel_used", 0) or row.get("耗油量", 0) or 0)
            data["hourly_rate"] = float(row.get("hourly_rate", 0) or row.get("小时单价", 0) or 0)
            data["area_rate"] = float(row.get("area_rate", 0) or row.get("亩单价", 0) or 0)
            data["fuel_price"] = float(row.get("fuel_price", 0) or row.get("油价", 0) or 0)
            data["minimum_charge"] = float(row.get("minimum_charge", 0) or row.get("最低收费", 0) or 0)
            
            billing_type_str = row.get("billing_type", "") or row.get("计费方式", "")
            if billing_type_str == "by_hour" or "小时" in billing_type_str:
                data["billing_type"] = BillingType.BY_HOUR
            elif billing_type_str == "by_area" or "亩" in billing_type_str:
                data["billing_type"] = BillingType.BY_AREA
            else:
                data["billing_type"] = BillingType.MIXED
        
        except Exception as e:
            errors.append(f"解析失败: {str(e)}")
        
        return data, errors
    
    def import_from_csv(self, csv_content: str, filename: str = "") -> Dict[str, Any]:
        batch_id = f"BATCH{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        batch = ImportBatch(
            batch_id=batch_id,
            filename=filename,
            total_rows=0,
            valid_rows=0,
            invalid_rows=0,
            status="processing"
        )
        self.db.add(batch)
        self.db.commit()
        
        rows = self.parse_csv(csv_content)
        batch.total_rows = len(rows)
        
        results = []
        valid_count = 0
        invalid_count = 0
        
        for i, row in enumerate(rows, 1):
            data, parse_errors = self.parse_row_data(row, i)
            
            if parse_errors:
                invalid_count += 1
                results.append({
                    "row": i,
                    "success": False,
                    "errors": parse_errors,
                    "data": data
                })
                continue
            
            data["import_batch_id"] = batch_id
            data["import_row_number"] = i
            
            result = self.work_order_service.create_work_order(data)
            
            if result["success"]:
                valid_count += 1
            else:
                invalid_count += 1
            
            result["row"] = i
            results.append(result)
        
        batch.valid_rows = valid_count
        batch.invalid_rows = invalid_count
        batch.status = "completed"
        batch.completed_at = datetime.now()
        self.db.commit()
        
        return {
            "batch_id": batch_id,
            "total_rows": batch.total_rows,
            "valid_rows": valid_count,
            "invalid_rows": invalid_count,
            "results": results
        }

class BillingService:
    def __init__(self, db: Session):
        self.db = db
        self.billing_engine = BillingEngine()
    
    def generate_bill(self, operator_id: int, start_date: date, end_date: date) -> Dict[str, Any]:
        existing_bill = self.db.query(Bill).filter(
            Bill.operator_id == operator_id,
            Bill.billing_period_start == datetime.combine(start_date, datetime.min.time()),
            Bill.billing_period_end == datetime.combine(end_date, datetime.max.time())
        ).first()
        
        if existing_bill:
            return {
                "success": True,
                "bill_id": existing_bill.id,
                "bill_no": existing_bill.bill_no,
                "total_amount": existing_bill.total_amount,
                "message": "账单已存在，返回已有账单"
            }
        
        work_orders = self.db.query(WorkOrder).filter(
            WorkOrder.operator_id == operator_id,
            WorkOrder.start_time >= datetime.combine(start_date, datetime.min.time()),
            WorkOrder.start_time <= datetime.combine(end_date, datetime.max.time()),
            WorkOrder.status == WorkOrderStatus.VALID
        ).all()
        
        if not work_orders:
            return {"success": False, "error": "该时间段内没有可结算的有效作业单"}
        
        bill_no = f"BILL{datetime.now().strftime('%Y%m%d%H%M%S')}"
        bill = Bill(
            bill_no=bill_no,
            operator_id=operator_id,
            billing_period_start=datetime.combine(start_date, datetime.min.time()),
            billing_period_end=datetime.combine(end_date, datetime.max.time())
        )
        
        total_hours = 0
        total_area = 0
        total_fuel = 0
        subtotal = 0
        
        bill_items = []
        for work_order in work_orders:
            billing_result = self.billing_engine.calculate_work_order(work_order)
            
            item = BillItem(
                work_order_id=work_order.id,
                work_hours=work_order.work_hours,
                work_area=work_order.work_area,
                fuel_used=work_order.fuel_used,
                hourly_amount=billing_result.hourly_amount,
                area_amount=billing_result.area_amount,
                fuel_amount=billing_result.fuel_amount,
                line_total=billing_result.final_amount
            )
            bill_items.append(item)
            
            total_hours += work_order.work_hours
            total_area += work_order.work_area
            total_fuel += work_order.fuel_used
            subtotal += billing_result.final_amount
            
            work_order.status = WorkOrderStatus.BILLED
        
        bill.total_hours = total_hours
        bill.total_area = total_area
        bill.total_fuel = total_fuel
        bill.subtotal = subtotal
        bill.total_amount = subtotal
        
        self.db.add(bill)
        self.db.flush()
        
        for item in bill_items:
            item.bill_id = bill.id
            self.db.add(item)
        
        self.db.commit()
        
        return {
            "success": True,
            "bill_id": bill.id,
            "bill_no": bill.bill_no,
            "total_hours": total_hours,
            "total_area": total_area,
            "total_fuel": total_fuel,
            "subtotal": subtotal,
            "total_amount": bill.total_amount,
            "work_order_count": len(work_orders)
        }
    
    def get_bill(self, bill_id: int) -> Optional[Dict[str, Any]]:
        bill = self.db.query(Bill).filter(Bill.id == bill_id).first()
        if not bill:
            return None
        
        items = self.db.query(BillItem).filter(BillItem.bill_id == bill_id).all()
        
        return {
            "id": bill.id,
            "bill_no": bill.bill_no,
            "operator_id": bill.operator_id,
            "billing_period_start": bill.billing_period_start.isoformat() if bill.billing_period_start else None,
            "billing_period_end": bill.billing_period_end.isoformat() if bill.billing_period_end else None,
            "total_hours": bill.total_hours,
            "total_area": bill.total_area,
            "total_fuel": bill.total_fuel,
            "subtotal": bill.subtotal,
            "deductions": bill.deductions,
            "total_amount": bill.total_amount,
            "status": bill.status,
            "items": [
                {
                    "work_order_id": item.work_order_id,
                    "work_hours": item.work_hours,
                    "work_area": item.work_area,
                    "fuel_used": item.fuel_used,
                    "hourly_amount": item.hourly_amount,
                    "area_amount": item.area_amount,
                    "fuel_amount": item.fuel_amount,
                    "line_total": item.line_total
                } for item in items
            ]
        }

class ReviewService:
    def __init__(self, db: Session):
        self.db = db
    
    def review_bill(self, bill_id: int, reviewer: str, notes: str = "") -> Dict[str, Any]:
        bill = self.db.query(Bill).filter(Bill.id == bill_id).first()
        if not bill:
            return {"success": False, "error": "账单不存在"}
        
        bill.status = "reviewed"
        bill.reviewed_by = reviewer
        bill.reviewed_at = datetime.now()
        bill.notes = notes
        
        items = self.db.query(BillItem).filter(BillItem.bill_id == bill_id).all()
        for item in items:
            work_order = self.db.query(WorkOrder).filter(WorkOrder.id == item.work_order_id).first()
            if work_order:
                work_order.status = WorkOrderStatus.REVIEWED
        
        self.db.commit()
        
        return {
            "success": True,
            "bill_id": bill.id,
            "bill_no": bill.bill_no,
            "reviewed_by": reviewer,
            "reviewed_at": bill.reviewed_at.isoformat()
        }

class HistoryService:
    def __init__(self, db: Session):
        self.db = db
    
    def get_work_order_history(self, operator_id: int = None, start_date: date = None, end_date: date = None, status: str = None):
        query = self.db.query(WorkOrder)
        
        if operator_id:
            query = query.filter(WorkOrder.operator_id == operator_id)
        
        if start_date:
            query = query.filter(WorkOrder.start_time >= datetime.combine(start_date, datetime.min.time()))
        
        if end_date:
            query = query.filter(WorkOrder.start_time <= datetime.combine(end_date, datetime.max.time()))
        
        if status:
            query = query.filter(WorkOrder.status == status)
        
        work_orders = query.order_by(WorkOrder.start_time.desc()).all()
        
        return [
            {
                "id": wo.id,
                "order_no": wo.order_no,
                "operator_id": wo.operator_id,
                "tractor_id": wo.tractor_id,
                "start_time": wo.start_time.isoformat() if wo.start_time else None,
                "work_hours": wo.work_hours,
                "work_area": wo.work_area,
                "final_amount": wo.final_amount,
                "status": wo.status.value
            }
            for wo in work_orders
        ]
    
    def get_bill_history(self, operator_id: int = None, start_date: date = None, end_date: date = None):
        query = self.db.query(Bill)
        
        if operator_id:
            query = query.filter(Bill.operator_id == operator_id)
        
        if start_date:
            query = query.filter(Bill.created_at >= datetime.combine(start_date, datetime.min.time()))
        
        if end_date:
            query = query.filter(Bill.created_at <= datetime.combine(end_date, datetime.max.time()))
        
        bills = query.order_by(Bill.created_at.desc()).all()
        
        return [
            {
                "id": bill.id,
                "bill_no": bill.bill_no,
                "operator_id": bill.operator_id,
                "billing_period_start": bill.billing_period_start.isoformat() if bill.billing_period_start else None,
                "total_amount": bill.total_amount,
                "status": bill.status,
                "created_at": bill.created_at.isoformat()
            }
            for bill in bills
        ]
    
    def get_import_batches(self, batch_id: str = None):
        query = self.db.query(ImportBatch)
        if batch_id:
            query = query.filter(ImportBatch.batch_id == batch_id)
        
        batches = query.order_by(ImportBatch.created_at.desc()).all()
        
        return [
            {
                "batch_id": batch.batch_id,
                "filename": batch.filename,
                "total_rows": batch.total_rows,
                "valid_rows": batch.valid_rows,
                "invalid_rows": batch.invalid_rows,
                "status": batch.status,
                "created_at": batch.created_at.isoformat()
            }
            for batch in batches
        ]

class MasterDataService:
    def __init__(self, db: Session):
        self.db = db
    
    def create_operator(self, name: str, phone: str = "", id_card: str = "", hourly_rate: float = 0):
        operator = Operator(
            name=name,
            phone=phone,
            id_card=id_card,
            hourly_rate=hourly_rate
        )
        self.db.add(operator)
        self.db.commit()
        return {"id": operator.id, "name": operator.name}
    
    def create_tractor(self, plate_number: str, model: str = "", horsepower: int = 0, hourly_rate: float = 0, area_rate: float = 0):
        tractor = Tractor(
            plate_number=plate_number,
            model=model,
            horsepower=horsepower,
            hourly_rate=hourly_rate,
            area_rate=area_rate
        )
        self.db.add(tractor)
        self.db.commit()
        return {"id": tractor.id, "plate_number": tractor.plate_number}
    
    def get_all_operators(self):
        operators = self.db.query(Operator).all()
        return [{"id": o.id, "name": o.name, "phone": o.phone, "hourly_rate": o.hourly_rate} for o in operators]
    
    def get_all_tractors(self):
        tractors = self.db.query(Tractor).all()
        return [{"id": t.id, "plate_number": t.plate_number, "model": t.model, "hourly_rate": t.hourly_rate, "area_rate": t.area_rate} for t in tractors]

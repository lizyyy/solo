import csv
import json
from datetime import datetime
from typing import List, Dict, Any
from io import StringIO

from sqlalchemy.orm import Session

from app.models.models import (
    TellerPayment, SortingLog, BundleTag, ATMPlan, ErrorRemark, AuditLog
)


class ImportService:
    @staticmethod
    def parse_teller_payment_csv(content: str, filename: str, business_date: str) -> List[Dict[str, Any]]:
        results = []
        try:
            reader = csv.DictReader(StringIO(content))
            for row in reader:
                payment = {
                    "teller_no": row.get("柜员号", row.get("teller_no", "")),
                    "teller_name": row.get("柜员姓名", row.get("teller_name", "")),
                    "business_date": business_date,
                    "currency": row.get("币种", row.get("currency", "CNY")),
                    "denomination": int(row.get("面额", row.get("denomination", 100))),
                    "quantity": int(row.get("数量", row.get("quantity", 100))),
                    "amount": float(row.get("金额", row.get("amount", 0))),
                    "bundle_no": row.get("扎把编号", row.get("bundle_no", "")),
                    "source_file": filename
                }
                if row.get("缴款时间", row.get("payment_time")):
                    try:
                        payment["payment_time"] = datetime.strptime(
                            row.get("缴款时间", row.get("payment_time")),
                            "%Y-%m-%d %H:%M:%S"
                        )
                    except:
                        payment["payment_time"] = datetime.utcnow()
                results.append(payment)
        except Exception as e:
            raise ValueError(f"解析柜员缴款CSV失败: {str(e)}")
        return results

    @staticmethod
    def parse_sorting_log_csv(content: str, filename: str, business_date: str) -> List[Dict[str, Any]]:
        results = []
        try:
            reader = csv.DictReader(StringIO(content))
            for row in reader:
                log = {
                    "business_date": business_date,
                    "machine_no": row.get("清分机号", row.get("machine_no", "")),
                    "operator": row.get("操作员", row.get("operator", "")),
                    "serial_number": row.get("冠字号", row.get("serial_number", "")),
                    "denomination": int(row.get("面额", row.get("denomination", 100))),
                    "version": row.get("版本", row.get("version", "")),
                    "bundle_no": row.get("扎把编号", row.get("bundle_no", "")),
                    "sort_result": row.get("清分结果", row.get("sort_result", "正常")),
                    "source_file": filename
                }
                results.append(log)
        except Exception as e:
            raise ValueError(f"解析清分机日志CSV失败: {str(e)}")
        return results

    @staticmethod
    def parse_bundle_tag_json(content: str, filename: str, business_date: str) -> List[Dict[str, Any]]:
        results = []
        try:
            data = json.loads(content)
            tags = data.get("tags", data) if isinstance(data, dict) else data
            for item in tags:
                tag = {
                    "business_date": business_date,
                    "bundle_no": item.get("bundle_no", item.get("扎把编号", "")),
                    "denomination": int(item.get("denomination", item.get("面额", 100))),
                    "quantity": int(item.get("quantity", item.get("数量", 100))),
                    "amount": float(item.get("amount", item.get("金额", 0))),
                    "operator": item.get("operator", item.get("操作员", "")),
                    "start_serial": item.get("start_serial", item.get("起始冠字号", "")),
                    "end_serial": item.get("end_serial", item.get("结束冠字号", "")),
                    "source_file": filename
                }
                if item.get("bundle_time", item.get("扎把时间")):
                    try:
                        tag["bundle_time"] = datetime.strptime(
                            item.get("bundle_time", item.get("扎把时间")),
                            "%Y-%m-%d %H:%M:%S"
                        )
                    except:
                        tag["bundle_time"] = datetime.utcnow()
                results.append(tag)
        except Exception as e:
            raise ValueError(f"解析扎把标签JSON失败: {str(e)}")
        return results

    @staticmethod
    def parse_atm_plan_csv(content: str, filename: str, business_date: str) -> List[Dict[str, Any]]:
        results = []
        try:
            reader = csv.DictReader(StringIO(content))
            for row in reader:
                plan = {
                    "business_date": business_date,
                    "atm_no": row.get("ATM编号", row.get("atm_no", "")),
                    "atm_location": row.get("ATM位置", row.get("atm_location", "")),
                    "box_no": row.get("钞箱编号", row.get("box_no", "")),
                    "denomination": int(row.get("面额", row.get("denomination", 100))),
                    "plan_quantity": int(row.get("计划数量", row.get("plan_quantity", 0))),
                    "plan_amount": float(row.get("计划金额", row.get("plan_amount", 0))),
                    "bundle_nos": row.get("扎把编号", row.get("bundle_nos", "")),
                    "source_file": filename
                }
                results.append(plan)
        except Exception as e:
            raise ValueError(f"解析ATM加钞计划CSV失败: {str(e)}")
        return results

    @staticmethod
    def parse_error_remark_csv(content: str, filename: str, business_date: str) -> List[Dict[str, Any]]:
        results = []
        try:
            reader = csv.DictReader(StringIO(content))
            for row in reader:
                remark = {
                    "business_date": business_date,
                    "error_type": row.get("差错类型", row.get("error_type", "")),
                    "reference_id": row.get("关联ID", row.get("reference_id", "")),
                    "amount": float(row.get("差错金额", row.get("amount", 0))) if row.get("差错金额", row.get("amount")) else None,
                    "description": row.get("差错描述", row.get("description", "")),
                    "operator": row.get("操作人", row.get("operator", "")),
                    "is_resolved": row.get("是否解决", row.get("is_resolved", "否")) in ["是", "true", "True", "1"],
                    "source_file": filename
                }
                results.append(remark)
        except Exception as e:
            raise ValueError(f"解析差错备注CSV失败: {str(e)}")
        return results

    @staticmethod
    def import_teller_payments(db: Session, data: List[Dict], business_date: str, operator: str = "system") -> int:
        count = 0
        for item in data:
            existing = db.query(TellerPayment).filter(
                TellerPayment.bundle_no == item.get("bundle_no"),
                TellerPayment.business_date == business_date
            ).first()
            if existing:
                continue
            payment = TellerPayment(**item)
            db.add(payment)
            count += 1
        db.commit()
        audit = AuditLog(
            operation_type="import_teller_payments",
            operator=operator,
            business_date=business_date,
            details=f"导入柜员缴款记录 {count} 条"
        )
        db.add(audit)
        db.commit()
        return count

    @staticmethod
    def import_sorting_logs(db: Session, data: List[Dict], business_date: str, operator: str = "system") -> int:
        count = 0
        for item in data:
            log = SortingLog(**item)
            db.add(log)
            count += 1
        db.commit()
        audit = AuditLog(
            operation_type="import_sorting_logs",
            operator=operator,
            business_date=business_date,
            details=f"导入清分机日志 {count} 条"
        )
        db.add(audit)
        db.commit()
        return count

    @staticmethod
    def import_bundle_tags(db: Session, data: List[Dict], business_date: str, operator: str = "system") -> int:
        count = 0
        for item in data:
            existing = db.query(BundleTag).filter(
                BundleTag.bundle_no == item.get("bundle_no")
            ).first()
            if existing:
                continue
            tag = BundleTag(**item)
            db.add(tag)
            count += 1
        db.commit()
        audit = AuditLog(
            operation_type="import_bundle_tags",
            operator=operator,
            business_date=business_date,
            details=f"导入扎把标签 {count} 条"
        )
        db.add(audit)
        db.commit()
        return count

    @staticmethod
    def import_atm_plans(db: Session, data: List[Dict], business_date: str, operator: str = "system") -> int:
        count = 0
        for item in data:
            existing = db.query(ATMPlan).filter(
                ATMPlan.atm_no == item.get("atm_no"),
                ATMPlan.box_no == item.get("box_no"),
                ATMPlan.business_date == business_date
            ).first()
            if existing:
                continue
            plan = ATMPlan(**item)
            db.add(plan)
            count += 1
        db.commit()
        audit = AuditLog(
            operation_type="import_atm_plans",
            operator=operator,
            business_date=business_date,
            details=f"导入ATM加钞计划 {count} 条"
        )
        db.add(audit)
        db.commit()
        return count

    @staticmethod
    def import_error_remarks(db: Session, data: List[Dict], business_date: str, operator: str = "system") -> int:
        count = 0
        for item in data:
            remark = ErrorRemark(**item)
            db.add(remark)
            count += 1
        db.commit()
        audit = AuditLog(
            operation_type="import_error_remarks",
            operator=operator,
            business_date=business_date,
            details=f"导入差错备注 {count} 条"
        )
        db.add(audit)
        db.commit()
        return count

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models import (
    Resident, Bill, BillHistory, ReminderStrategy, Reminder,
    DeductionRecord, SupplyStatus, Complaint, ReminderReport, Session
)


class BillingService:
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def get_or_create_resident(self, name: str, address: str, phone: str = None, bank_account: str = None):
        resident = self.db.query(Resident).filter_by(name=name, address=address).first()
        if not resident:
            resident = Resident(name=name, address=address, phone=phone, bank_account=bank_account)
            self.db.add(resident)
            self.db.commit()
            self.db.refresh(resident)
        return resident
    
    def create_bill(self, resident_id: int, bill_month: str, utility_type: str, 
                    amount: float, due_date: datetime = None):
        existing_bill = self.db.query(Bill).filter_by(
            resident_id=resident_id,
            bill_month=bill_month,
            utility_type=utility_type
        ).first()
        
        if existing_bill:
            return {
                "status": "warning",
                "message": f"{bill_month}月份{utility_type}账单已存在，无需重复创建",
                "bill_id": existing_bill.id
            }
        
        if not due_date:
            year, month = map(int, bill_month.split('-'))
            due_date = datetime(year, month, 25)
        
        bill = Bill(
            resident_id=resident_id,
            bill_month=bill_month,
            utility_type=utility_type,
            amount=amount,
            status='unpaid',
            due_date=due_date
        )
        self.db.add(bill)
        self.db.commit()
        self.db.refresh(bill)
        
        self._record_history(bill.id, '创建账单', None, 'unpaid', '系统自动创建', '系统')
        
        resident = self.db.query(Resident).get(resident_id)
        return {
            "status": "success",
            "message": f"已为住户「{resident.name}」创建{bill_month}月份{utility_type}账单，金额{amount}元，缴费截止日{due_date.strftime('%Y-%m-%d')}",
            "bill_id": bill.id
        }
    
    def get_unpaid_bills(self, utility_type: str = None):
        query = self.db.query(Bill).filter_by(status='unpaid')
        if utility_type:
            query = query.filter_by(utility_type=utility_type)
        return query.all()
    
    def update_bill_status(self, bill_id: int, new_status: str, note: str, operator: str = '系统'):
        bill = self.db.query(Bill).get(bill_id)
        if not bill:
            return {"status": "error", "message": f"账单ID {bill_id} 不存在"}
        
        old_status = bill.status
        bill.status = new_status
        self.db.commit()
        
        self._record_history(bill.id, '状态变更', old_status, new_status, note, operator)
        
        return {
            "status": "success",
            "message": f"账单状态已从「{old_status}」更新为「{new_status}」",
            "bill_id": bill.id
        }
    
    def _record_history(self, bill_id: int, action: str, old_status: str, new_status: str, 
                        note: str, operator: str):
        history = BillHistory(
            bill_id=bill_id,
            action=action,
            old_status=old_status,
            new_status=new_status,
            note=note,
            operator=operator
        )
        self.db.add(history)
        self.db.commit()
    
    def withdraw_bill(self, bill_id: int, reason: str, operator: str):
        bill = self.db.query(Bill).get(bill_id)
        if not bill:
            return {"status": "error", "message": f"账单ID {bill_id} 不存在"}
        
        if bill.status == 'withdrawn':
            return {"status": "warning", "message": "该账单已撤回，无需重复操作"}
        
        old_status = bill.status
        bill.status = 'withdrawn'
        self.db.commit()
        
        self._record_history(bill.id, '撤回账单', old_status, 'withdrawn', reason, operator)
        
        resident = bill.resident
        return {
            "status": "success",
            "message": f"已撤回住户「{resident.name}」的{bill.bill_month}月份{bill.utility_type}账单，撤回原因：{reason}",
            "bill_id": bill.id
        }
    
    def get_bill_history(self, bill_id: int):
        history = self.db.query(BillHistory).filter_by(bill_id=bill_id).order_by(BillHistory.created_at).all()
        if not history:
            return {"status": "info", "message": "该账单暂无历史记录"}
        
        result = []
        for h in history:
            result.append({
                "时间": h.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                "操作": h.action,
                "状态变化": f"{h.old_status or '无'} → {h.new_status or '无'}",
                "备注": h.note,
                "操作人": h.operator
            })
        
        return {
            "status": "success",
            "history": result
        }


class ReminderService:
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def setup_strategies(self):
        strategies = [
            {
                "name": "水费逾期3天短信提醒",
                "utility_type": "水费",
                "days_after_due": 3,
                "channel": "短信",
                "message_template": "【温馨提醒】{住户姓名}您好，您{账单月份}的水费{金额}元已逾期3天，请尽快缴费，以免影响正常用水。",
                "max_reminders": 2
            },
            {
                "name": "水费逾期7天上门提醒",
                "utility_type": "水费",
                "days_after_due": 7,
                "channel": "上门",
                "message_template": "【上门通知】{住户姓名}，您{账单月份}的水费{金额}元已逾期7天，物业工作人员已上门告知，请尽快到物业处缴费。",
                "max_reminders": 1
            },
            {
                "name": "水费逾期15天停水通知",
                "utility_type": "水费",
                "days_after_due": 15,
                "channel": "正式通知",
                "message_template": "【停水通知】{住户姓名}，您{账单月份}的水费{金额}元已逾期15天，将于3个工作日内停止供水，请立即缴费。",
                "max_reminders": 1
            },
            {
                "name": "电费逾期5天短信提醒",
                "utility_type": "电费",
                "days_after_due": 5,
                "channel": "短信",
                "message_template": "【温馨提醒】{住户姓名}您好，您{账单月份}的电费{金额}元已逾期5天，请尽快缴费，以免影响正常用电。",
                "max_reminders": 2
            },
            {
                "name": "电费逾期10天上门提醒",
                "utility_type": "电费",
                "days_after_due": 10,
                "channel": "上门",
                "message_template": "【上门通知】{住户姓名}，您{账单月份}的电费{金额}元已逾期10天，物业工作人员已上门告知，请尽快到物业处缴费。",
                "max_reminders": 1
            },
            {
                "name": "电费逾期20天停电通知",
                "utility_type": "电费",
                "days_after_due": 20,
                "channel": "正式通知",
                "message_template": "【停电通知】{住户姓名}，您{账单月份}的电费{金额}元已逾期20天，将于3个工作日内停止供电，请立即缴费。",
                "max_reminders": 1
            }
        ]
        
        created_count = 0
        for s in strategies:
            existing = self.db.query(ReminderStrategy).filter_by(
                utility_type=s["utility_type"],
                days_after_due=s["days_after_due"],
                channel=s["channel"]
            ).first()
            
            if not existing:
                strategy = ReminderStrategy(**s)
                self.db.add(strategy)
                created_count += 1
        
        self.db.commit()
        return {"status": "success", "message": f"已初始化催缴策略，新增 {created_count} 条策略"}
    
    def _is_complaint_shielded(self, resident_id: int):
        complaints = self.db.query(Complaint).filter_by(
            resident_id=resident_id,
            shield_reminders=True
        ).all()
        
        for c in complaints:
            if c.shield_until and c.shield_until > datetime.now():
                return True, c
            if not c.shield_until and c.status == 'open':
                return True, c
        
        return False, None
    
    def _get_strategy_reminder_count(self, bill_id: int, strategy_id: int):
        return self.db.query(Reminder).filter_by(
            bill_id=bill_id,
            strategy_id=strategy_id
        ).count()
    
    def run_reminder_batch(self, current_date: datetime = None):
        if not current_date:
            current_date = datetime.now()
        
        billing_service = BillingService(self.db)
        unpaid_bills = billing_service.get_unpaid_bills()
        
        results = []
        total_sent = 0
        total_skipped = 0
        skipped_reasons = {"投诉屏蔽": 0, "已达催缴上限": 0, "未到催缴时间": 0}
        
        for bill in unpaid_bills:
            if not bill.due_date:
                continue
            
            is_shielded, complaint = self._is_complaint_shielded(bill.resident_id)
            if is_shielded:
                total_skipped += 1
                skipped_reasons["投诉屏蔽"] += 1
                results.append({
                    "住户": bill.resident.name,
                    "账单": f"{bill.bill_month} {bill.utility_type}",
                    "状态": "跳过",
                    "原因": f"投诉屏蔽中（投诉ID：{complaint.id}）"
                })
                continue
            
            days_overdue = (current_date - bill.due_date).days
            if days_overdue <= 0:
                total_skipped += 1
                skipped_reasons["未到催缴时间"] += 1
                results.append({
                    "住户": bill.resident.name,
                    "账单": f"{bill.bill_month} {bill.utility_type}",
                    "状态": "跳过",
                    "原因": f"尚未逾期（还剩{-days_overdue}天）"
                })
                continue
            
            strategies = self.db.query(ReminderStrategy).filter_by(
                utility_type=bill.utility_type,
                is_active=True
            ).order_by(ReminderStrategy.days_after_due).all()
            
            bill_reminded = False
            for strategy in strategies:
                if days_overdue < strategy.days_after_due:
                    continue
                
                existing_count = self._get_strategy_reminder_count(bill.id, strategy.id)
                if existing_count >= strategy.max_reminders:
                    continue
                
                message = strategy.message_template.format(
                    住户姓名=bill.resident.name,
                    账单月份=bill.bill_month,
                    金额=f"{bill.amount:.2f}"
                )
                
                reminder = Reminder(
                    bill_id=bill.id,
                    strategy_id=strategy.id,
                    reminder_count=existing_count + 1,
                    channel=strategy.channel,
                    message=message,
                    status='sent'
                )
                self.db.add(reminder)
                
                total_sent += 1
                bill_reminded = True
                
                results.append({
                    "住户": bill.resident.name,
                    "账单": f"{bill.bill_month} {bill.utility_type}",
                    "状态": "已催缴",
                    "渠道": strategy.channel,
                    "策略": strategy.name,
                    "逾期天数": days_overdue
                })
                
                break
            
            if not bill_reminded:
                total_skipped += 1
                skipped_reasons["已达催缴上限"] += 1
                results.append({
                    "住户": bill.resident.name,
                    "账单": f"{bill.bill_month} {bill.utility_type}",
                    "状态": "跳过",
                    "原因": "已达到该阶段催缴上限"
                })
        
        self.db.commit()
        
        summary = {
            "处理日期": current_date.strftime('%Y-%m-%d'),
            "总处理账单数": len(unpaid_bills),
            "已发送催缴": total_sent,
            "跳过数量": total_skipped,
            "跳过原因": skipped_reasons,
            "详细结果": results
        }
        
        return {
            "status": "success",
            "summary": summary
        }


class DeductionService:
    def __init__(self, db_session: Session):
        self.db = db_session
        self.billing_service = BillingService(self.db)
    
    def _mock_bank_deduction(self, bank_account: str, amount: float):
        if not bank_account:
            return False, "住户未绑定银行账户"
        
        if len(bank_account) < 10:
            return False, "银行账户格式不正确"
        
        if amount > 500:
            return False, "单次扣款金额超限"
        
        transaction_id = f"TXN{datetime.now().strftime('%Y%m%d%H%M%S')}"
        return True, transaction_id
    
    def process_deduction(self, bill_id: int):
        bill = self.db.query(Bill).get(bill_id)
        if not bill:
            return {"status": "error", "message": f"账单ID {bill_id} 不存在"}
        
        if bill.status == 'paid':
            return {"status": "warning", "message": f"账单已结清，无需重复扣款"}
        
        if bill.status == 'withdrawn':
            return {"status": "error", "message": f"账单已撤回，无法扣款"}
        
        existing_pending = self.db.query(DeductionRecord).filter_by(
            bill_id=bill_id,
            status='pending'
        ).first()
        
        if existing_pending:
            return {"status": "warning", "message": "该账单已有扣款处理中，请稍后再试"}
        
        resident = bill.resident
        success, result = self._mock_bank_deduction(resident.bank_account, bill.amount)
        
        deduction = DeductionRecord(
            bill_id=bill_id,
            amount=bill.amount,
            status='success' if success else 'failed',
            bank_transaction_id=result if success else None,
            failed_reason=result if not success else None
        )
        self.db.add(deduction)
        self.db.commit()
        
        if success:
            self.billing_service.update_bill_status(
                bill.id, 
                'paid', 
                f"银行代扣成功，交易号：{result}",
                '银行系统'
            )
            return {
                "status": "success",
                "message": f"已从住户「{resident.name}」银行账户成功代扣{bill.amount}元，{bill.bill_month}月份{bill.utility_type}账单已结清",
                "transaction_id": result,
                "bill_id": bill.id
            }
        else:
            return {
                "status": "failed",
                "message": f"住户「{resident.name}」银行代扣失败：{result}",
                "bill_id": bill.id
            }
    
    def batch_process_deductions(self, utility_type: str = None):
        billing_service = BillingService(self.db)
        unpaid_bills = billing_service.get_unpaid_bills(utility_type)
        
        results = []
        success_count = 0
        failed_count = 0
        
        for bill in unpaid_bills:
            result = self.process_deduction(bill.id)
            results.append(result)
            if result["status"] == "success":
                success_count += 1
            elif result["status"] == "failed":
                failed_count += 1
        
        summary = {
            "总处理数": len(unpaid_bills),
            "代扣成功": success_count,
            "代扣失败": failed_count,
            "详细结果": results
        }
        
        return {
            "status": "success",
            "summary": summary
        }


class SupplyService:
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def get_supply_status(self, resident_id: int, utility_type: str):
        status = self.db.query(SupplyStatus).filter_by(
            resident_id=resident_id,
            utility_type=utility_type
        ).order_by(SupplyStatus.changed_at.desc()).first()
        
        if not status:
            return {"status": "active", "message": "供水/供电状态正常"}
        
        return {
            "status": status.status,
            "message": f"当前{utility_type}状态：{status.status}，变更原因：{status.reason}",
            "changed_at": status.changed_at.strftime('%Y-%m-%d %H:%M:%S')
        }
    
    def cut_supply(self, resident_id: int, utility_type: str, reason: str, operator: str):
        resident = self.db.query(Resident).get(resident_id)
        if not resident:
            return {"status": "error", "message": "住户不存在"}
        
        current_status = self.get_supply_status(resident_id, utility_type)
        if current_status["status"] == "cut":
            return {"status": "warning", "message": f"住户「{resident.name}」的{utility_type}已处于停用状态"}
        
        new_status = SupplyStatus(
            resident_id=resident_id,
            utility_type=utility_type,
            status='cut',
            reason=reason,
            changed_by=operator
        )
        self.db.add(new_status)
        self.db.commit()
        
        return {
            "status": "success",
            "message": f"已停止住户「{resident.name}」的{utility_type}供应，原因：{reason}",
            "changed_at": new_status.changed_at.strftime('%Y-%m-%d %H:%M:%S')
        }
    
    def restore_supply(self, resident_id: int, utility_type: str, reason: str, operator: str):
        resident = self.db.query(Resident).get(resident_id)
        if not resident:
            return {"status": "error", "message": "住户不存在"}
        
        current_status = self.get_supply_status(resident_id, utility_type)
        if current_status["status"] == "active":
            return {"status": "warning", "message": f"住户「{resident.name}」的{utility_type}已处于正常供应状态"}
        
        new_status = SupplyStatus(
            resident_id=resident_id,
            utility_type=utility_type,
            status='active',
            reason=reason,
            changed_by=operator
        )
        self.db.add(new_status)
        self.db.commit()
        
        return {
            "status": "success",
            "message": f"已恢复住户「{resident.name}」的{utility_type}供应，原因：{reason}",
            "changed_at": new_status.changed_at.strftime('%Y-%m-%d %H:%M:%S')
        }


class ComplaintService:
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def record_complaint(self, resident_id: int, complaint_type: str, description: str, 
                         shield_reminders: bool = False, shield_days: int = 7):
        resident = self.db.query(Resident).get(resident_id)
        if not resident:
            return {"status": "error", "message": "住户不存在"}
        
        shield_until = None
        if shield_reminders and shield_days > 0:
            shield_until = datetime.now() + timedelta(days=shield_days)
        
        complaint = Complaint(
            resident_id=resident_id,
            complaint_type=complaint_type,
            description=description,
            shield_reminders=shield_reminders,
            shield_until=shield_until
        )
        self.db.add(complaint)
        self.db.commit()
        self.db.refresh(complaint)
        
        message = f"已记录住户「{resident.name}」的投诉：{description}"
        if shield_reminders:
            message += f"，催缴通知已屏蔽至{shield_until.strftime('%Y-%m-%d')}"
        
        return {
            "status": "success",
            "message": message,
            "complaint_id": complaint.id
        }
    
    def resolve_complaint(self, complaint_id: int, resolution: str):
        complaint = self.db.query(Complaint).get(complaint_id)
        if not complaint:
            return {"status": "error", "message": f"投诉ID {complaint_id} 不存在"}
        
        if complaint.status == 'resolved':
            return {"status": "warning", "message": "该投诉已处理完毕"}
        
        complaint.status = 'resolved'
        complaint.shield_reminders = False
        complaint.resolved_at = datetime.now()
        self.db.commit()
        
        resident = self.db.query(Resident).get(complaint.resident_id)
        return {
            "status": "success",
            "message": f"已处理住户「{resident.name}」的投诉（ID：{complaint_id}），处理结果：{resolution}，催缴屏蔽已解除"
        }


class ReportService:
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def generate_monthly_report(self, report_month: str, utility_type: str):
        existing_report = self.db.query(ReminderReport).filter_by(
            report_month=report_month,
            utility_type=utility_type
        ).first()
        
        if existing_report:
            return {
                "status": "warning",
                "message": f"{report_month}月份{utility_type}催缴报表已存在，重复生成结果一致",
                "report": self._format_report(existing_report)
            }
        
        total_bills = self.db.query(Bill).filter_by(
            bill_month=report_month,
            utility_type=utility_type
        ).count()
        
        unpaid_bills = self.db.query(Bill).filter_by(
            bill_month=report_month,
            utility_type=utility_type,
            status='unpaid'
        ).count()
        
        reminders_sent = self.db.query(Reminder).join(Bill).filter(
            Bill.bill_month == report_month,
            Bill.utility_type == utility_type
        ).count()
        
        successful_deductions = self.db.query(DeductionRecord).join(Bill).filter(
            DeductionRecord.status == 'success',
            Bill.bill_month == report_month,
            Bill.utility_type == utility_type
        ).count()
        
        complaints_received = self.db.query(Complaint).filter(
            Complaint.created_at.like(f"{report_month}%")
        ).count()
        
        supply_cut_count = self.db.query(SupplyStatus).filter(
            SupplyStatus.status == 'cut',
            SupplyStatus.utility_type == utility_type,
            SupplyStatus.changed_at.like(f"{report_month}%")
        ).count()
        
        report = ReminderReport(
            report_month=report_month,
            utility_type=utility_type,
            total_bills=total_bills,
            unpaid_bills=unpaid_bills,
            reminders_sent=reminders_sent,
            successful_deductions=successful_deductions,
            complaints_received=complaints_received,
            supply_cut_count=supply_cut_count
        )
        self.db.add(report)
        self.db.commit()
        
        return {
            "status": "success",
            "message": f"{report_month}月份{utility_type}催缴报表已生成",
            "report": self._format_report(report)
        }
    
    def _format_report(self, report):
        return {
            "报表月份": report.report_month,
            "费用类型": report.utility_type,
            "账单总数": report.total_bills,
            "未结清账单": report.unpaid_bills,
            "已发送催缴": report.reminders_sent,
            "银行代扣成功": report.successful_deductions,
            "收到投诉": report.complaints_received,
            "停供数量": report.supply_cut_count,
            "生成时间": report.created_at.strftime('%Y-%m-%d %H:%M:%S')
        }


class SampleDataService:
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def load_sample_data(self):
        billing = BillingService(self.db)
        
        residents_data = [
            {"name": "张三", "address": "1号楼1单元101室", "phone": "13800138001", "bank_account": "6222021234567890123"},
            {"name": "李四", "address": "1号楼1单元201室", "phone": "13800138002", "bank_account": "6222021234567890456"},
            {"name": "王五", "address": "1号楼2单元101室", "phone": "13800138003", "bank_account": "SHORT"},
            {"name": "赵六", "address": "2号楼1单元301室", "phone": "13800138004", "bank_account": None},
            {"name": "钱七", "address": "2号楼2单元201室", "phone": "13800138005", "bank_account": "6222021234567890789"}
        ]
        
        created_residents = []
        for data in residents_data:
            resident = billing.get_or_create_resident(**data)
            created_residents.append(resident)
        
        bills_data = [
            {"resident_name": "张三", "bill_month": "2026-04", "utility_type": "水费", "amount": 45.50, "days_overdue": 20},
            {"resident_name": "张三", "bill_month": "2026-04", "utility_type": "电费", "amount": 120.30, "days_overdue": 15},
            {"resident_name": "李四", "bill_month": "2026-04", "utility_type": "水费", "amount": 38.20, "days_overdue": 8},
            {"resident_name": "李四", "bill_month": "2026-04", "utility_type": "电费", "amount": 85.60, "days_overdue": 3},
            {"resident_name": "王五", "bill_month": "2026-04", "utility_type": "水费", "amount": 52.80, "days_overdue": 5},
            {"resident_name": "王五", "bill_month": "2026-04", "utility_type": "电费", "amount": 250.00, "days_overdue": 12},
            {"resident_name": "赵六", "bill_month": "2026-04", "utility_type": "水费", "amount": 33.40, "days_overdue": 10},
            {"resident_name": "赵六", "bill_month": "2026-04", "utility_type": "电费", "amount": 95.20, "days_overdue": 18},
            {"resident_name": "钱七", "bill_month": "2026-04", "utility_type": "水费", "amount": 28.60, "days_overdue": -5},
            {"resident_name": "钱七", "bill_month": "2026-04", "utility_type": "电费", "amount": 68.90, "days_overdue": -5}
        ]
        
        created_bills = []
        for bill_data in bills_data:
            resident = self.db.query(Resident).filter_by(name=bill_data["resident_name"]).first()
            if resident:
                due_date = datetime(2026, 4, 25) - timedelta(days=bill_data["days_overdue"])
                result = billing.create_bill(
                    resident_id=resident.id,
                    bill_month=bill_data["bill_month"],
                    utility_type=bill_data["utility_type"],
                    amount=bill_data["amount"],
                    due_date=due_date
                )
                created_bills.append(result)
        
        reminder_service = ReminderService(self.db)
        reminder_service.setup_strategies()
        
        return {
            "status": "success",
            "message": "样例数据已加载成功",
            "住户数量": len(created_residents),
            "账单数量": len([b for b in created_bills if b.get("status") == "success"])
        }

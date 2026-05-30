from datetime import datetime, timedelta
from models import Rental, Reminder, Anomaly
from app import db
import hashlib

class ReminderService:
    @staticmethod
    def generate_idempotency_key(rental_id, reminder_type, date_str=None):
        if date_str is None:
            date_str = datetime.now().strftime('%Y%m%d')
        key = f"{rental_id}_{reminder_type}_{date_str}"
        return hashlib.md5(key.encode()).hexdigest()

    @staticmethod
    def check_idempotency(rental_id, reminder_type):
        idempotency_key = ReminderService.generate_idempotency_key(rental_id, reminder_type)
        existing = Reminder.query.filter_by(idempotency_key=idempotency_key).first()
        return existing is not None, idempotency_key

    @staticmethod
    def create_reminder(rental_id, reminder_type, message):
        exists, idempotency_key = ReminderService.check_idempotency(rental_id, reminder_type)
        if exists:
            return None
        
        reminder = Reminder(
            rental_id=rental_id,
            type=reminder_type,
            message=message,
            idempotency_key=idempotency_key
        )
        db.session.add(reminder)
        db.session.commit()
        return reminder

    @staticmethod
    def generate_due_date_reminders(days_before=3):
        reminders = []
        now = datetime.now()
        target_date = now + timedelta(days=days_before)
        
        rentals = Rental.query.filter(
            Rental.return_date == None,
            Rental.due_date >= now.date(),
            Rental.due_date <= target_date.date()
        ).all()
        
        for rental in rentals:
            days_remaining = (rental.due_date.date() - now.date()).days
            
            if days_remaining == 0:
                reminder_type = 'due_today'
                message = f"【今日到期提醒】{rental.student.name if rental.student else '学生'} 租赁的 {rental.equipment.name if rental.equipment else '设备'} 今日到期，请及时归还"
            elif days_remaining == 1:
                reminder_type = 'due_tomorrow'
                message = f"【明日到期提醒】{rental.student.name if rental.student else '学生'} 租赁的 {rental.equipment.name if rental.equipment else '设备'} 明日到期，请提醒归还"
            else:
                reminder_type = f'due_in_{days_remaining}_days'
                message = f"【{days_remaining}天后到期提醒】{rental.student.name if rental.student else '学生'} 租赁的 {rental.equipment.name if rental.equipment else '设备'} 将在 {days_remaining} 天后到期"
            
            reminder = ReminderService.create_reminder(rental.id, reminder_type, message)
            if reminder:
                reminders.append(reminder)
        
        return reminders

    @staticmethod
    def generate_overdue_reminders():
        reminders = []
        now = datetime.now()
        
        overdue_rentals = Rental.query.filter(
            Rental.return_date == None,
            Rental.due_date < now.date()
        ).all()
        
        for rental in overdue_rentals:
            overdue_days = (now.date() - rental.due_date.date()).days
            
            if overdue_days == 1:
                reminder_type = 'overdue_1d'
                message = f"【超期1天提醒】{rental.student.name if rental.student else '学生'} 租赁的 {rental.equipment.name if rental.equipment else '设备'} 已超期1天，请联系催还"
            elif overdue_days == 7:
                reminder_type = 'overdue_7d'
                message = f"【超期7天严重提醒】{rental.student.name if rental.student else '学生'} 租赁的 {rental.equipment.name if rental.equipment else '设备'} 已超期7天，请立即联系处理"
            elif overdue_days == 30:
                reminder_type = 'overdue_30d'
                message = f"【超期30天警告】{rental.student.name if rental.student else '学生'} 租赁的 {rental.equipment.name if rental.equipment else '设备'} 已超期30天，建议启动押金抵扣流程"
            elif overdue_days > 0 and overdue_days % 7 == 0:
                reminder_type = f'overdue_{overdue_days}d'
                message = f"【超期{overdue_days}天定期提醒】{rental.student.name if rental.student else '学生'} 租赁的 {rental.equipment.name if rental.equipment else '设备'} 已超期{overdue_days}天"
            else:
                reminder_type = None
            
            if reminder_type:
                reminder = ReminderService.create_reminder(rental.id, reminder_type, message)
                if reminder:
                    reminders.append(reminder)
        
        return reminders

    @staticmethod
    def generate_deposit_refund_reminders():
        reminders = []
        
        completed_rentals = Rental.query.filter(
            Rental.return_date != None,
            Rental.deposit_paid > 0
        ).all()
        
        for rental in completed_rentals:
            total_charges = rental.rental_fee + rental.damage_fee
            expected_refund = rental.deposit_paid - total_charges
            actual_refund = rental.deposit_refunded
            
            if expected_refund > actual_refund + 0.01:
                refund_due = expected_refund - actual_refund
                reminder_type = 'deposit_refund_pending'
                message = f"【押金待退提醒】{rental.student.name if rental.student else '学生'} 租赁单 {rental.rental_number or rental.id} 应退押金 {refund_due:.2f} 元，尚未完成退款"
                
                reminder = ReminderService.create_reminder(rental.id, reminder_type, message)
                if reminder:
                    reminders.append(reminder)
        
        return reminders

    @staticmethod
    def generate_all_reminders():
        all_reminders = []
        all_reminders.extend(ReminderService.generate_due_date_reminders(1))
        all_reminders.extend(ReminderService.generate_due_date_reminders(3))
        all_reminders.extend(ReminderService.generate_due_date_reminders(7))
        all_reminders.extend(ReminderService.generate_overdue_reminders())
        all_reminders.extend(ReminderService.generate_deposit_refund_reminders())
        return all_reminders

    @staticmethod
    def acknowledge_reminder(reminder_id, acknowledged_by):
        reminder = Reminder.query.get(reminder_id)
        if not reminder:
            return {'success': False, 'error': '提醒记录不存在'}
        
        reminder.acknowledged = True
        reminder.acknowledged_by = acknowledged_by
        reminder.acknowledged_at = datetime.now()
        db.session.commit()
        
        return {'success': True, 'reminder': reminder}

    @staticmethod
    def get_pending_reminders(limit=50):
        return Reminder.query.filter_by(acknowledged=False).order_by(Reminder.created_at.desc()).limit(limit).all()

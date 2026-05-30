from datetime import datetime, date
from models import db, Reminder, RepairOrder, Performance, SparePartOrder


class ReminderService:
    @staticmethod
    def create_reminder(entity_type, entity_id, reminder_type, title, content,
                        priority="普通", due_date=None):
        reminder = Reminder(
            entity_type=entity_type,
            entity_id=entity_id,
            reminder_type=reminder_type,
            title=title,
            content=content,
            priority=priority,
            due_date=due_date,
            is_read=False,
            created_at=datetime.now()
        )
        db.session.add(reminder)
        db.session.flush()
        return reminder

    @staticmethod
    def mark_read(reminder_id, read_by=None):
        reminder = Reminder.query.get(reminder_id)
        if reminder:
            reminder.is_read = True
            reminder.read_at = datetime.now()
            reminder.read_by = read_by
            db.session.flush()
        return reminder

    @staticmethod
    def check_and_create_return_deadline_reminders():
        today = date.today()
        orders = RepairOrder.query.filter(
            RepairOrder.status.notin_(["已归还", "已取消"]),
            RepairOrder.return_deadline.isnot(None)
        ).all()

        for order in orders:
            deadline = order.return_deadline
            days_left = (deadline - today).days

            if days_left == 3:
                existing = Reminder.query.filter_by(
                    entity_type="RepairOrder",
                    entity_id=order.id,
                    reminder_type="归还期限提醒",
                    title=f"乐器归还提醒-还剩3天"
                ).first()
                if not existing:
                    ReminderService.create_reminder(
                        entity_type="RepairOrder",
                        entity_id=order.id,
                        reminder_type="归还期限提醒",
                        title=f"乐器归还提醒-还剩3天",
                        content=f"乐器【{order.instrument.name}】需在 {deadline} 前归还，距离演出还有 {days_left} 天",
                        priority="高",
                        due_date=deadline
                    )
            elif days_left == 1:
                existing = Reminder.query.filter_by(
                    entity_type="RepairOrder",
                    entity_id=order.id,
                    reminder_type="归还期限提醒",
                    title=f"紧急：乐器明日需归还"
                ).first()
                if not existing:
                    ReminderService.create_reminder(
                        entity_type="RepairOrder",
                        entity_id=order.id,
                        reminder_type="归还期限提醒",
                        title=f"紧急：乐器明日需归还",
                        content=f"乐器【{order.instrument.name}】明日（{deadline}）必须归还！演出临近，请加紧处理",
                        priority="紧急",
                        due_date=deadline
                    )
            elif days_left < 0:
                existing = Reminder.query.filter_by(
                    entity_type="RepairOrder",
                    entity_id=order.id,
                    reminder_type="归还逾期提醒",
                    title=f"逾期：乐器已超期未归还"
                ).first()
                if not existing:
                    ReminderService.create_reminder(
                        entity_type="RepairOrder",
                        entity_id=order.id,
                        reminder_type="归还逾期提醒",
                        title=f"逾期：乐器已超期未归还",
                        content=f"乐器【{order.instrument.name}】应于 {deadline} 归还，已逾期 {abs(days_left)} 天！",
                        priority="紧急",
                        due_date=deadline
                    )

    @staticmethod
    def check_and_create_spare_arrival_reminders():
        today = date.today()
        orders = SparePartOrder.query.filter(
            SparePartOrder.status.in_(["已下单", "运输中"]),
            SparePartOrder.expected_arrival_date.isnot(None)
        ).all()

        for order in orders:
            expected = order.expected_arrival_date
            days_late = (today - expected).days

            if days_late >= 1:
                existing = Reminder.query.filter_by(
                    entity_type="SparePartOrder",
                    entity_id=order.id,
                    reminder_type="备件到货提醒",
                    title=f"备件已延误 {days_late} 天"
                ).first()
                if not existing:
                    ReminderService.create_reminder(
                        entity_type="SparePartOrder",
                        entity_id=order.id,
                        reminder_type="备件到货提醒",
                        title=f"备件已延误 {days_late} 天",
                        content=f"备件【{order.spare_part.name}】订单 {order.order_no} 应于 {expected} 到货，已延误 {days_late} 天",
                        priority="高",
                        due_date=expected
                    )

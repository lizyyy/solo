from datetime import datetime, timedelta
from app import app, db
from models import Student, Equipment, Rental, DamageRecord

def create_test_data():
    with app.app_context():
        db.create_all()
        
        students = [
            Student(name='张三', student_id='S2024001', phone='13800138001'),
            Student(name='李四', student_id='S2024002', phone='13800138002'),
            Student(name='王五', student_id='S2024003', phone='13800138003'),
            Student(name='赵六', student_id='S2024004', phone='13800138004'),
            Student(name='', student_id='S2024005', phone='13800138005'),
        ]
        
        equipment = [
            Equipment(serial_number='GIT001', name='雅马哈吉他', type='吉他', brand='Yamaha', model='F310', deposit_amount=500, daily_rate=20, status='available'),
            Equipment(serial_number='GIT002', name='卡马吉他', type='吉他', brand='Kepma', model='D1C', deposit_amount=800, daily_rate=30, status='available'),
            Equipment(serial_number='GIT001', name='重复编号吉他', type='吉他', brand='Test', deposit_amount=500, daily_rate=25, status='available'),
            Equipment(serial_number='KEY001', name='罗兰键盘', type='键盘', brand='Roland', model='FP-30', deposit_amount=1500, daily_rate=50, status='available'),
            Equipment(serial_number='KEY002', name='雅马哈电子琴', type='键盘', brand='Yamaha', model='PSR-E373', deposit_amount=600, daily_rate=25, status='available'),
            Equipment(serial_number='AMP001', name='橘子音箱', type='音箱', brand='Orange', model='Crush 20', deposit_amount=400, daily_rate=15, status='available'),
            Equipment(serial_number='', name='无编号设备', type='音箱', deposit_amount=300, daily_rate=10, status='available'),
        ]
        
        db.session.add_all(students)
        db.session.add_all(equipment)
        db.session.commit()
        
        base_date = datetime.now()
        
        rentals = [
            Rental(
                student_id=1, equipment_id=1,
                rent_date=base_date - timedelta(days=5),
                due_date=base_date + timedelta(days=10),
                deposit_paid=500,
                status='active'
            ),
            Rental(
                student_id=2, equipment_id=2,
                rent_date=base_date - timedelta(days=15),
                due_date=base_date - timedelta(days=5),
                deposit_paid=800,
                status='overdue'
            ),
            Rental(
                student_id=3, equipment_id=4,
                rent_date=base_date - timedelta(days=10),
                due_date=base_date - timedelta(days=2),
                return_date=base_date - timedelta(days=1),
                deposit_paid=1500,
                deposit_refunded=1000,
                rental_fee=500,
                damage_fee=0,
                status='completed'
            ),
            Rental(
                student_id=4, equipment_id=5,
                rent_date=base_date - timedelta(days=7),
                due_date=base_date - timedelta(days=35),
                return_date=base_date - timedelta(days=30),
                deposit_paid=600,
                deposit_refunded=500,
                rental_fee=175,
                damage_fee=0,
                status='completed'
            ),
            Rental(
                student_id=1, equipment_id=6,
                rent_date=base_date - timedelta(days=3),
                due_date=base_date + timedelta(days=4),
                deposit_paid=0,
                status='active'
            ),
            Rental(
                student_id=2, equipment_id=1,
                rent_date=base_date - timedelta(days=2),
                due_date=base_date + timedelta(days=5),
                deposit_paid=-100,
                rental_fee=-50,
                status='active'
            ),
            Rental(
                student_id=3, equipment_id=4,
                rent_date=base_date - timedelta(days=1),
                due_date=base_date - timedelta(days=10),
                return_date=base_date - timedelta(days=5),
                deposit_paid=1500,
                deposit_refunded=0,
                rental_fee=50,
                status='completed'
            ),
        ]
        
        db.session.add_all(rentals)
        db.session.commit()
        
        damage_records = [
            DamageRecord(
                rental_id=3, equipment_id=4,
                description='键盘边角有轻微划痕',
                severity='minor',
                repair_cost=0, fee_charged=0,
                reported_by='管理员A',
                resolved=True,
                resolved_date=base_date - timedelta(days=1)
            ),
        ]
        
        db.session.add_all(damage_records)
        db.session.commit()
        
        print("测试数据创建完成！")
        print(f"学生数: {Student.query.count()}")
        print(f"设备数: {Equipment.query.count()}")
        print(f"租赁单数: {Rental.query.count()}")

if __name__ == '__main__':
    create_test_data()

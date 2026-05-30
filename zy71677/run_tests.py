from app import app, db
from models import Student, Rental
from anomaly_detector import AnomalyDetector
from reminder_service import ReminderService
from rental_service import RentalService

def run_system_tests():
    with app.app_context():
        print("=" * 60)
        print("乐器租赁押金追踪系统 - 边界测试")
        print("=" * 60)
        
        print("\n1. 运行异常检测...")
        anomalies = AnomalyDetector.run_all_checks()
        print(f"   发现异常数: {len(anomalies)}")
        
        anomaly_types = {}
        for a in anomalies:
            anomaly_types[a.type] = anomaly_types.get(a.type, 0) + 1
        
        for t, c in anomaly_types.items():
            print(f"   - {t}: {c} 个")
        
        print("\n2. 异常详情:")
        for a in anomalies:
            severity = a.severity.upper()
            print(f"   [{severity}] {a.type}: {a.description}")
            if a.suggested_action:
                print(f"      💡 建议: {a.suggested_action}")
        
        print("\n3. 押金退款测试 - 测试漏退和超额:")
        from models import Rental
        rentals = Rental.query.filter(Rental.return_date != None).all()
        for r in rentals[:3]:
            expected = r.deposit_paid - r.rental_fee - r.damage_fee
            actual = r.deposit_refunded
            diff = expected - actual
            if abs(diff) > 0.01:
                status = "漏退" if diff > 0 else "超额"
                print(f"   租赁单 {r.id}: {status} ¥{abs(diff):.2f} (应退 ¥{expected:.2f}, 实退 ¥{actual:.2f})")
        
        print("\n4. 设备串号测试 - 重复和空值:")
        from models import Equipment
        serials = {}
        for eq in Equipment.query.all():
            sn = eq.serial_number.strip() if eq.serial_number else ''
            if not sn:
                print(f"   设备 {eq.id}: 空设备编号")
            elif sn in serials:
                print(f"   重复编号 '{sn}': 设备 {serials[sn]} 和 {eq.id}")
            else:
                serials[sn] = eq.id
        
        print("\n5. 生成提醒...")
        reminders = ReminderService.generate_all_reminders()
        print(f"   生成提醒数: {len(reminders)}")
        
        reminder_types = {}
        for r in reminders:
            reminder_types[r.type] = reminder_types.get(r.type, 0) + 1
        
        for t, c in reminder_types.items():
            print(f"   - {t}: {c} 条")
        
        print("\n6. 测试幂等性 - 再次生成提醒...")
        reminders2 = ReminderService.generate_all_reminders()
        print(f"   第二次生成提醒数: {len(reminders2)} (应为0表示幂等生效)")
        
        print("\n7. 边界值测试结果:")
        print(f"   - 负押金: {sum(1 for r in Rental.query.all() if r.deposit_paid < 0)} 个")
        print(f"   - 负租金: {sum(1 for r in Rental.query.all() if r.rental_fee < 0)} 个")
        print(f"   - 0押金活跃单: {sum(1 for r in Rental.query.all() if r.deposit_paid == 0 and r.status == 'active')} 个")
        print(f"   - 超期未还: {sum(1 for r in Rental.query.all() if r.status == 'overdue')} 个")
        print(f"   - 空学生姓名: {sum(1 for s in db.session.query(Student).filter((Student.name == '') | (Student.name == None)).all())} 个")
        
        print("\n" + "=" * 60)
        print("测试完成！")
        print("=" * 60)

if __name__ == '__main__':
    run_system_tests()

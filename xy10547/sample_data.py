from app import create_app, db
from app.models import (
    Resident, Nurse, Prescription, MedicationPlan,
    MedicationInventory, MedicationType, PrescriptionStatus, DoseStatus
)
from datetime import date, time, datetime, timedelta


def init_sample_data():
    app = create_app()
    
    with app.app_context():
        db.drop_all()
        db.create_all()
        
        print("正在创建样例数据...")
        
        nurses = [
            Nurse(id='N001', name='张护士', role='护士长', phone='13800138001'),
            Nurse(id='N002', name='李护士', role='护理员', phone='13800138002'),
            Nurse(id='N003', name='王护士', role='护理员', phone='13800138003'),
        ]
        for n in nurses:
            db.session.add(n)
        
        residents = [
            Resident(
                id='R001', name='陈大爷', gender='男', age=78,
                room_number='101室', bed_number='1床',
                admission_date=date(2024, 1, 15),
                notes='高血压病史10年，糖尿病5年'
            ),
            Resident(
                id='R002', name='李奶奶', gender='女', age=82,
                room_number='102室', bed_number='1床',
                admission_date=date(2024, 3, 20),
                notes='心脏病史，需定期监测心率'
            ),
            Resident(
                id='R003', name='王爷爷', gender='男', age=85,
                room_number='103室', bed_number='2床',
                admission_date=date(2024, 5, 10),
                notes='阿尔茨海默症早期，记忆力减退'
            ),
        ]
        for r in residents:
            db.session.add(r)
        
        prescriptions = [
            Prescription(
                id='P001', resident_id='R001',
                medication_name='硝苯地平缓释片', medication_type=MedicationType.ORAL,
                dosage='1片/次', frequency='每日2次',
                start_date=date(2024, 1, 15),
                status=PrescriptionStatus.ACTIVE,
                prescribed_by='王医生',
                notes='早8点、晚8点各1片'
            ),
            Prescription(
                id='P002', resident_id='R001',
                medication_name='二甲双胍片', medication_type=MedicationType.ORAL,
                dosage='1片/次', frequency='每日3次',
                start_date=date(2024, 2, 1),
                status=PrescriptionStatus.ACTIVE,
                prescribed_by='李医生',
                notes='三餐后服用'
            ),
            Prescription(
                id='P003', resident_id='R002',
                medication_name='阿司匹林肠溶片', medication_type=MedicationType.ORAL,
                dosage='1片/次', frequency='每日1次',
                start_date=date(2024, 3, 20),
                status=PrescriptionStatus.ACTIVE,
                prescribed_by='张医生',
                notes='晨起空腹服用'
            ),
            Prescription(
                id='P004', resident_id='R003',
                medication_name='多奈哌齐片', medication_type=MedicationType.ORAL,
                dosage='1片/次', frequency='每日1次',
                start_date=date(2024, 5, 15),
                status=PrescriptionStatus.DISCONTINUED,
                prescribed_by='刘医生',
                notes='已停用，换用其他药物'
            ),
            Prescription(
                id='P005', resident_id='R003',
                medication_name='美金刚片', medication_type=MedicationType.ORAL,
                dosage='1片/次', frequency='每日2次',
                start_date=date(2024, 6, 1),
                status=PrescriptionStatus.ACTIVE,
                prescribed_by='刘医生',
                notes='替代多奈哌齐'
            ),
        ]
        for p in prescriptions:
            db.session.add(p)
        
        today = date.today()
        yesterday = today - timedelta(days=1)
        tomorrow = today + timedelta(days=1)
        
        medication_plans = [
            MedicationPlan(
                id='PLAN-001', resident_id='R001', prescription_id='P001',
                dose_date=yesterday, dose_time=time(8, 0),
                dosage='1片/次', status=DoseStatus.CONFIRMED
            ),
            MedicationPlan(
                id='PLAN-002', resident_id='R001', prescription_id='P002',
                dose_date=yesterday, dose_time=time(12, 0),
                dosage='1片/次', status=DoseStatus.CONFIRMED
            ),
            MedicationPlan(
                id='PLAN-003', resident_id='R001', prescription_id='P001',
                dose_date=yesterday, dose_time=time(20, 0),
                dosage='1片/次', status=DoseStatus.MISSED
            ),
            MedicationPlan(
                id='PLAN-004', resident_id='R002', prescription_id='P003',
                dose_date=today, dose_time=time(7, 0),
                dosage='1片/次', status=DoseStatus.SCHEDULED
            ),
            MedicationPlan(
                id='PLAN-005', resident_id='R001', prescription_id='P001',
                dose_date=today, dose_time=time(8, 0),
                dosage='1片/次', status=DoseStatus.SCHEDULED
            ),
            MedicationPlan(
                id='PLAN-006', resident_id='R001', prescription_id='P002',
                dose_date=today, dose_time=time(12, 0),
                dosage='1片/次', status=DoseStatus.SCHEDULED
            ),
            MedicationPlan(
                id='PLAN-007', resident_id='R003', prescription_id='P005',
                dose_date=today, dose_time=time(9, 0),
                dosage='1片/次', status=DoseStatus.SCHEDULED
            ),
            MedicationPlan(
                id='PLAN-008', resident_id='R001', prescription_id='P001',
                dose_date=today, dose_time=time(20, 0),
                dosage='1片/次', status=DoseStatus.SCHEDULED
            ),
            MedicationPlan(
                id='PLAN-009', resident_id='R003', prescription_id='P005',
                dose_date=today, dose_time=time(21, 0),
                dosage='1片/次', status=DoseStatus.SCHEDULED
            ),
            MedicationPlan(
                id='PLAN-010', resident_id='R002', prescription_id='P003',
                dose_date=tomorrow, dose_time=time(7, 0),
                dosage='1片/次', status=DoseStatus.SCHEDULED
            ),
        ]
        for p in medication_plans:
            db.session.add(p)
        
        inventories = [
            MedicationInventory(
                id='INV-001', medication_name='硝苯地平缓释片',
                batch_number='B2024001', quantity=50, unit='片',
                expiry_date=date(2025, 6, 1), location='A区-药柜1'
            ),
            MedicationInventory(
                id='INV-002', medication_name='二甲双胍片',
                batch_number='B2024002', quantity=100, unit='片',
                expiry_date=date(2025, 8, 1), location='A区-药柜1'
            ),
            MedicationInventory(
                id='INV-003', medication_name='阿司匹林肠溶片',
                batch_number='B2024003', quantity=2, unit='片',
                expiry_date=date(2025, 3, 1), location='A区-药柜2'
            ),
            MedicationInventory(
                id='INV-004', medication_name='多奈哌齐片',
                batch_number='B2024004', quantity=0, unit='片',
                expiry_date=date(2025, 1, 1), location='B区-药柜1'
            ),
            MedicationInventory(
                id='INV-005', medication_name='美金刚片',
                batch_number='B2024005', quantity=30, unit='片',
                expiry_date=date(2025, 10, 1), location='B区-药柜1'
            ),
        ]
        for i in inventories:
            db.session.add(i)
        
        db.session.commit()
        
        print("=" * 60)
        print("样例数据创建完成！")
        print("=" * 60)
        print(f"护理员: {len(nurses)} 人")
        print(f"老人档案: {len(residents)} 人")
        print(f"医嘱: {len(prescriptions)} 条")
        print(f"用药计划: {len(medication_plans)} 条")
        print(f"库存: {len(inventories)} 种")
        print("=" * 60)
        print("老人列表:")
        for r in residents:
            print(f"  {r.id}: {r.name} ({r.gender}, {r.age}岁)")
        print("=" * 60)
        print("护理员列表:")
        for n in nurses:
            print(f"  {n.id}: {n.name} ({n.role})")
        print("=" * 60)
        print("用药计划分布:")
        print(f"  昨日: {yesterday}")
        print(f"  今日: {today}")
        print(f"  明日: {tomorrow}")
        print("=" * 60)
        print("库存预警（<=5片）:")
        for i in inventories:
            if i.quantity <= 5:
                print(f"  ⚠️  {i.medication_name}: {i.quantity} {i.unit}")
        print("=" * 60)


if __name__ == '__main__':
    init_sample_data()

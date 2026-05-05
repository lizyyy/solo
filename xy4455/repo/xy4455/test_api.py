#!/usr/bin/env python3
"""
测试宠物医院术后监护交接API
"""
import json
import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.database import SessionLocal, Base, engine
from app.models.models import (
    AnesthesiaRecord, InfusionPumpLog, CageSensor, MedicationPlan,
    HandoffRecord, AuditLog, PatientStatus
)
from app.services.import_service import ImportService
from app.services.anomaly_service import AnomalyDetectionService
from app.services.status_service import StatusJudgmentService
from app.services.export_service import ExportService
from app.schemas.schemas import DataSource

def create_test_data(db):
    """创建测试数据"""
    print("=" * 60)
    print("1. 创建测试数据")
    print("=" * 60)
    
    patient_id_1 = "P001"
    patient_id_2 = "P002"
    patient_id_3 = "P003"
    
    anesthesia_1 = AnesthesiaRecord(
        patient_id=patient_id_1,
        patient_name="小咪",
        species="猫",
        breed="英国短毛猫",
        anesthesia_start_time=datetime.now() - timedelta(hours=5),
        anesthesia_end_time=datetime.now() - timedelta(hours=3),
        awakening_time=datetime.now() - timedelta(hours=2, minutes=30),
        anesthetic_type="异氟烷",
        dosage=1.5,
        heart_rate=120,
        respiratory_rate=25,
        temperature=38.2,
        spo2=98,
        notes="手术顺利"
    )
    db.add(anesthesia_1)
    
    anesthesia_2 = AnesthesiaRecord(
        patient_id=patient_id_2,
        patient_name="旺财",
        species="犬",
        breed="金毛寻回犬",
        anesthesia_start_time=datetime.now() - timedelta(hours=8),
        anesthesia_end_time=datetime.now() - timedelta(hours=6),
        awakening_time=None,
        anesthetic_type="七氟烷",
        dosage=2.0,
        heart_rate=85,
        respiratory_rate=18,
        temperature=37.8,
        spo2=95,
        notes="术后未苏醒"
    )
    db.add(anesthesia_2)
    
    anesthesia_3 = AnesthesiaRecord(
        patient_id=patient_id_3,
        patient_name="豆豆",
        species="兔",
        breed="垂耳兔",
        anesthesia_start_time=datetime.now() - timedelta(hours=2),
        anesthesia_end_time=datetime.now() - timedelta(hours=1),
        awakening_time=datetime.now() - timedelta(minutes=45),
        anesthetic_type="异氟烷",
        dosage=1.2,
        heart_rate=180,
        respiratory_rate=45,
        temperature=38.5,
        spo2=97,
        notes="苏醒良好"
    )
    db.add(anesthesia_3)
    
    infusion_1 = InfusionPumpLog(
        patient_id=patient_id_1,
        log_time=datetime.now() - timedelta(hours=2),
        drug_name="复方氯化钠",
        concentration="0.9%",
        infusion_rate=10.0,
        volume_infused=200.0,
        volume_remaining=300.0,
        is_interrupted=False,
        pump_status="运行中"
    )
    db.add(infusion_1)
    
    infusion_2 = InfusionPumpLog(
        patient_id=patient_id_2,
        log_time=datetime.now() - timedelta(hours=1),
        drug_name="乳酸林格氏液",
        concentration="标准",
        infusion_rate=15.0,
        volume_infused=150.0,
        volume_remaining=350.0,
        is_interrupted=True,
        interruption_reason="管路堵塞",
        interruption_start_time=datetime.now() - timedelta(hours=1, minutes=15),
        interruption_end_time=None,
        pump_status="暂停"
    )
    db.add(infusion_2)
    
    sensor_1 = CageSensor(
        patient_id=patient_id_1,
        cage_number="A-01",
        reading_time=datetime.now() - timedelta(minutes=15),
        temperature=38.0,
        temperature_min=36.0,
        temperature_max=39.0,
        oxygen_level=96.0,
        oxygen_min=90.0,
        oxygen_max=100.0,
        humidity=55.0,
        is_temperature_abnormal=False,
        is_oxygen_abnormal=False
    )
    db.add(sensor_1)
    
    sensor_2 = CageSensor(
        patient_id=patient_id_2,
        cage_number="A-02",
        reading_time=datetime.now() - timedelta(minutes=15),
        temperature=35.5,
        temperature_min=36.0,
        temperature_max=39.0,
        oxygen_level=88.0,
        oxygen_min=90.0,
        oxygen_max=100.0,
        humidity=60.0,
        is_temperature_abnormal=True,
        is_oxygen_abnormal=True
    )
    db.add(sensor_2)
    
    sensor_3 = CageSensor(
        patient_id=patient_id_3,
        cage_number="B-01",
        reading_time=datetime.now() - timedelta(minutes=15),
        temperature=38.3,
        temperature_min=36.0,
        temperature_max=39.0,
        oxygen_level=97.0,
        oxygen_min=90.0,
        oxygen_max=100.0,
        humidity=50.0,
        is_temperature_abnormal=False,
        is_oxygen_abnormal=False
    )
    db.add(sensor_3)
    
    med_1 = MedicationPlan(
        patient_id=patient_id_1,
        drug_name="头孢氨苄",
        generic_name="头孢菌素类",
        dosage="25mg/kg",
        dosage_value=25.0,
        dosage_unit="mg/kg",
        route="口服",
        frequency="每日2次",
        start_time=datetime.now(),
        end_time=datetime.now() + timedelta(days=7),
        prescribing_vet="张医生",
        notes="术后抗感染"
    )
    db.add(med_1)
    
    med_2 = MedicationPlan(
        patient_id=patient_id_2,
        drug_name="芬太尼",
        generic_name="阿片类药物",
        dosage="5mcg/kg",
        dosage_value=5.0,
        dosage_unit="mcg/kg",
        route="静脉",
        frequency="持续输注",
        start_time=datetime.now(),
        end_time=datetime.now() + timedelta(hours=12),
        prescribing_vet="李医生",
        notes="术后镇痛"
    )
    db.add(med_2)
    
    med_2b = MedicationPlan(
        patient_id=patient_id_2,
        drug_name="地西泮",
        generic_name="苯二氮卓类",
        dosage="0.5mg/kg",
        dosage_value=0.5,
        dosage_unit="mg/kg",
        route="静脉",
        frequency="必要时",
        start_time=datetime.now(),
        end_time=datetime.now() + timedelta(hours=24),
        prescribing_vet="李医生",
        notes="镇静"
    )
    db.add(med_2b)
    
    med_3 = MedicationPlan(
        patient_id=patient_id_3,
        drug_name="恩诺沙星",
        generic_name="抗生素",
        dosage="10mg/kg",
        dosage_value=10.0,
        dosage_unit="mg/kg",
        route="皮下",
        frequency="每日1次",
        start_time=datetime.now(),
        end_time=datetime.now() + timedelta(days=5),
        prescribing_vet="王医生",
        notes="预防感染"
    )
    db.add(med_3)
    
    db.commit()
    print(f"✓ 成功创建测试数据: 3个患者记录")
    print(f"  - P001: 小咪 (猫, 指标正常)")
    print(f"  - P002: 旺财 (犬, 苏醒超时+输液中断+温氧异常+用药冲突)")
    print(f"  - P003: 豆豆 (兔, 指标正常)")

def test_anomaly_detection(db):
    """测试异常检测"""
    print("\n" + "=" * 60)
    print("2. 测试异常检测")
    print("=" * 60)
    
    service = AnomalyDetectionService(db)
    
    patients = ["P001", "P002", "P003"]
    
    for patient_id in patients:
        print(f"\n--- 患者 {patient_id} ---")
        results = service.check_all_anomalies(patient_id)
        
        awakening_text = "⚠️ 是" if results['awakening_timeout']['has_timeout'] else "✓ 否"
        infusion_text = "⚠️ 是" if results['infusion_interruption']['has_interruption'] else "✓ 否"
        temp_text = "⚠️ 是" if results['temp_oxygen_abnormal']['has_abnormal'] else "✓ 否"
        med_text = "⚠️ 是" if results['medication_conflicts']['has_conflict'] else "✓ 否"
        overall_text = "⚠️ 存在异常" if results['has_any_anomaly'] else "✓ 无异常"
        print(f"苏醒超时: {awakening_text}")
        print(f"输液中断: {infusion_text}")
        print(f"温氧异常: {temp_text}")
        print(f"用药冲突: {med_text}")
        print(f"总体异常: {overall_text}")

def test_status_judgment(db):
    """测试状态判断"""
    print("\n" + "=" * 60)
    print("3. 测试状态判断")
    print("=" * 60)
    
    service = StatusJudgmentService(db)
    
    patients = ["P001", "P002", "P003"]
    
    for patient_id in patients:
        print(f"\n--- 患者 {patient_id} ---")
        result = service.determine_patient_status(patient_id)
        
        status_display = {
            PatientStatus.NORMAL_CARE: "🟢 转普通护理",
            PatientStatus.NEED_REVIEW: "🟡 需要复查",
            PatientStatus.ALERT: "🔴 必须报警"
        }
        
        print(f"判定状态: {status_display.get(result['status'], result['status'])}")
        print(f"判定原因: {result['status_reason']}")
        print(f"高风险异常数: {result['high_risk_count']}")
        print(f"中风险异常数: {result['medium_risk_count']}")

def test_handoff_creation(db):
    """测试创建交接记录"""
    print("\n" + "=" * 60)
    print("4. 测试创建交接记录")
    print("=" * 60)
    
    service = StatusJudgmentService(db)
    
    handoffs = []
    patients = ["P001", "P002", "P003"]
    
    for patient_id in patients:
        handoff = service.create_handoff_record(
            patient_id=patient_id,
            shift_date=datetime.now(),
            nurse_name="李护士",
            review_notes="夜班监护结束"
        )
        handoffs.append(handoff)
        print(f"✓ 患者 {patient_id}: 交接编号 {handoff.handoff_id}, 状态 {handoff.status.value}")
    
    return handoffs

def test_export(db, handoffs):
    """测试导出功能"""
    print("\n" + "=" * 60)
    print("5. 测试导出功能")
    print("=" * 60)
    
    service = ExportService(db)
    
    if handoffs:
        handoff_id = handoffs[0].handoff_id
        
        print(f"\n--- Markdown导出 (交接记录: {handoff_id}) ---")
        markdown = service.generate_markdown_handoff(handoff_id)
        if markdown:
            print(f"✓ Markdown导出成功")
            print("\nMarkdown内容预览 (前500字符):")
            print(markdown[:500] + "..." if len(markdown) > 500 else markdown)
            
            md_file = f"test_handoff_{handoff_id}.md"
            with open(md_file, 'w', encoding='utf-8') as f:
                f.write(markdown)
            print(f"\n✓ Markdown已保存到: {md_file}")
        else:
            print("✗ Markdown导出失败")
        
        print(f"\n--- JSON审计包导出 (交接记录: {handoff_id}) ---")
        audit = service.generate_audit_package(handoff_id)
        if audit:
            print(f"✓ JSON审计包导出成功")
            print(f"  包含: {len(audit.get('audit_trail', []))} 条审计记录")
            
            json_file = f"test_audit_{handoff_id}.json"
            with open(json_file, 'w', encoding='utf-8') as f:
                json.dump(audit, f, ensure_ascii=False, indent=2, default=str)
            print(f"✓ JSON审计包已保存到: {json_file}")
        else:
            print("✗ JSON审计包导出失败")

def test_status_change(db, handoffs):
    """测试状态改判"""
    print("\n" + "=" * 60)
    print("6. 测试状态改判")
    print("=" * 60)
    
    service = StatusJudgmentService(db)
    
    if handoffs:
        handoff_id = handoffs[1].handoff_id
        
        print(f"\n--- 改判前 ---")
        handoff = service.get_handoff_record(handoff_id)
        print(f"交接编号: {handoff_id}")
        print(f"初始状态: {handoff.status.value}")
        print(f"复核状态: {'已复核' if handoff.is_reviewed else '未复核'}")
        
        updated = service.update_handoff_status(
            handoff_id=handoff_id,
            new_status=PatientStatus.ALERT,
            review_notes="患者苏醒超时情况复杂，需紧急处理",
            reviewed_by="王医生"
        )
        
        print(f"\n--- 改判后 ---")
        print(f"最终状态: {updated.final_status.value}")
        print(f"复核状态: {'已复核' if updated.is_reviewed else '未复核'}")
        print(f"复核人: {updated.reviewed_by}")
        print(f"复核时间: {updated.reviewed_at}")
        print(f"复核备注: {updated.nurse_review_notes}")

def main():
    """主测试函数"""
    print("=" * 60)
    print("宠物医院术后监护交接API - 测试脚本")
    print("=" * 60)
    
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        create_test_data(db)
        
        test_anomaly_detection(db)
        
        test_status_judgment(db)
        
        handoffs = test_handoff_creation(db)
        
        test_export(db, handoffs)
        
        test_status_change(db, handoffs)
        
        print("\n" + "=" * 60)
        print("测试完成!")
        print("=" * 60)
        
    finally:
        db.close()

if __name__ == "__main__":
    main()

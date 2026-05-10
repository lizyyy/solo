from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta
from app.database import SessionLocal, engine, Base
from app.models import Patient, WardRule, Caregiver, CareCertificate, ReplacementRequest, OperationLog


def init_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        print("开始初始化数据...")
        
        if db.query(WardRule).count() == 0:
            wards = [
                WardRule(ward_name="内科病区", max_caregivers=1, default_validity_days=7, description="普通内科病区，限1名陪护"),
                WardRule(ward_name="外科病区", max_caregivers=2, default_validity_days=7, description="外科病区，限2名陪护"),
                WardRule(ward_name="ICU", max_caregivers=1, default_validity_days=3, description="重症监护室，限1名陪护，有效期3天"),
                WardRule(ward_name="儿科", max_caregivers=2, default_validity_days=14, description="儿科病区，限2名陪护"),
                WardRule(ward_name="妇产科", max_caregivers=2, default_validity_days=7, description="妇产科病区，限2名陪护"),
            ]
            db.add_all(wards)
            db.commit()
            print(f"已创建 {len(wards)} 个病区规则")
        
        if db.query(Patient).count() == 0:
            today = date.today()
            patients = [
                Patient(
                    patient_id="P202605001",
                    name="张三",
                    gender="男",
                    age=45,
                    id_card="110101198001011234",
                    ward="内科病区",
                    bed_no="A-101",
                    admission_date=today - timedelta(days=5),
                    diagnosis="高血压",
                    contact_phone="13800138001",
                    is_discharged=False
                ),
                Patient(
                    patient_id="P202605002",
                    name="李四",
                    gender="女",
                    age=32,
                    id_card="110101199202022345",
                    ward="外科病区",
                    bed_no="B-205",
                    admission_date=today - timedelta(days=3),
                    diagnosis="骨折",
                    contact_phone="13800138002",
                    is_discharged=False
                ),
                Patient(
                    patient_id="P202605003",
                    name="王五",
                    gender="男",
                    age=78,
                    id_card="110101194803033456",
                    ward="ICU",
                    bed_no="C-003",
                    admission_date=today - timedelta(days=10),
                    diagnosis="重症肺炎",
                    contact_phone="13800138003",
                    is_discharged=False
                ),
                Patient(
                    patient_id="P202605004",
                    name="赵六",
                    gender="女",
                    age=5,
                    id_card="110101202104044567",
                    ward="儿科",
                    bed_no="D-102",
                    admission_date=today - timedelta(days=2),
                    diagnosis="肺炎",
                    contact_phone="13800138004",
                    is_discharged=False
                ),
                Patient(
                    patient_id="P202605005",
                    name="钱七",
                    gender="女",
                    age=28,
                    id_card="110101199605055678",
                    ward="妇产科",
                    bed_no="E-301",
                    admission_date=today - timedelta(days=1),
                    diagnosis="待产",
                    contact_phone="13800138005",
                    is_discharged=False
                ),
                Patient(
                    patient_id="P202605006",
                    name="孙八",
                    gender="男",
                    age=55,
                    id_card="110101197106066789",
                    ward="内科病区",
                    bed_no="A-108",
                    admission_date=today - timedelta(days=14),
                    discharge_date=today - timedelta(days=1),
                    diagnosis="糖尿病",
                    contact_phone="13800138006",
                    is_discharged=True
                ),
            ]
            db.add_all(patients)
            db.commit()
            print(f"已创建 {len(patients)} 个患者")
        
        if db.query(Caregiver).count() == 0:
            caregivers = [
                Caregiver(
                    caregiver_id="CG00000001",
                    name="张妻",
                    gender="女",
                    id_card="110101198207077890",
                    relation_to_patient="配偶",
                    phone="13900139001"
                ),
                Caregiver(
                    caregiver_id="CG00000002",
                    name="李父",
                    gender="男",
                    id_card="110101196508088901",
                    relation_to_patient="父亲",
                    phone="13900139002"
                ),
                Caregiver(
                    caregiver_id="CG00000003",
                    name="李母",
                    gender="女",
                    id_card="110101196709099012",
                    relation_to_patient="母亲",
                    phone="13900139003"
                ),
                Caregiver(
                    caregiver_id="CG00000004",
                    name="王子",
                    gender="男",
                    id_card="110101199010100123",
                    relation_to_patient="儿子",
                    phone="13900139004"
                ),
                Caregiver(
                    caregiver_id="CG00000005",
                    name="赵母",
                    gender="女",
                    id_card="110101199511111234",
                    relation_to_patient="母亲",
                    phone="13900139005"
                ),
                Caregiver(
                    caregiver_id="CG00000006",
                    name="钱夫",
                    gender="男",
                    id_card="110101199412122345",
                    relation_to_patient="配偶",
                    phone="13900139006"
                ),
            ]
            db.add_all(caregivers)
            db.commit()
            print(f"已创建 {len(caregivers)} 个陪护人")
        
        if db.query(CareCertificate).count() == 0:
            today = date.today()
            certificates = [
                CareCertificate(
                    certificate_no=f"PHZ-{today.strftime('%Y%m%d')}-00000001",
                    patient_id="P202605001",
                    caregiver_id="CG00000001",
                    issue_date=today - timedelta(days=5),
                    expiry_date=today + timedelta(days=2),
                    status="active",
                    source_file="住院登记单_张三.pdf",
                    notes="正常办理"
                ),
                CareCertificate(
                    certificate_no=f"PHZ-{today.strftime('%Y%m%d')}-00000002",
                    patient_id="P202605002",
                    caregiver_id="CG00000002",
                    issue_date=today - timedelta(days=3),
                    expiry_date=today + timedelta(days=4),
                    status="active",
                    source_file="住院登记单_李四.pdf",
                    notes="骨折术后需要陪护"
                ),
                CareCertificate(
                    certificate_no=f"PHZ-{today.strftime('%Y%m%d')}-00000003",
                    patient_id="P202605002",
                    caregiver_id="CG00000003",
                    issue_date=today - timedelta(days=3),
                    expiry_date=today + timedelta(days=4),
                    status="active",
                    source_file="住院登记单_李四.pdf",
                    notes="外科病区允许2人陪护"
                ),
                CareCertificate(
                    certificate_no=f"PHZ-{today.strftime('%Y%m%d')}-00000004",
                    patient_id="P202605003",
                    caregiver_id="CG00000004",
                    issue_date=today - timedelta(days=10),
                    expiry_date=today - timedelta(days=1),
                    status="active",
                    source_file="ICU探视申请_王五.pdf",
                    notes="ICU证件已过期"
                ),
                CareCertificate(
                    certificate_no=f"PHZ-{today.strftime('%Y%m%d')}-00000005",
                    patient_id="P202605004",
                    caregiver_id="CG00000005",
                    issue_date=today - timedelta(days=2),
                    expiry_date=today + timedelta(days=12),
                    status="active",
                    source_file="儿科住院同意书_赵六.pdf",
                    notes="儿科证件"
                ),
                CareCertificate(
                    certificate_no=f"PHZ-{today.strftime('%Y%m%d')}-00000006",
                    patient_id="P202605006",
                    caregiver_id="CG00000006",
                    issue_date=today - timedelta(days=14),
                    expiry_date=today - timedelta(days=7),
                    status="cancelled",
                    source_file="住院登记单_孙八.pdf",
                    notes="患者已出院，证件注销"
                ),
            ]
            db.add_all(certificates)
            db.commit()
            print(f"已创建 {len(certificates)} 个陪护证")
        
        if db.query(OperationLog).count() == 0:
            logs = [
                OperationLog(
                    operation_type="PATIENT_REGISTER",
                    patient_id="P202605001",
                    operator="系统初始化",
                    action="登记患者: 张三",
                    result="success",
                    new_value="病区: 内科病区, 床号: A-101"
                ),
                OperationLog(
                    operation_type="CERTIFICATE_ISSUE",
                    patient_id="P202605001",
                    certificate_id=1,
                    operator="系统初始化",
                    action="为患者 张三 办理陪护证",
                    result="success",
                    new_value=f"证件号: PHZ-{today.strftime('%Y%m%d')}-00000001, 陪护人: 张妻",
                    source_file="住院登记单_张三.pdf"
                ),
            ]
            db.add_all(logs)
            db.commit()
            print(f"已创建操作日志")
        
        print("\n数据初始化完成！")
        print("\n示例数据说明:")
        print("1. 张三 (内科病区) - 证件即将过期 (剩余2天)")
        print("2. 李四 (外科病区) - 2名陪护人，正常状态")
        print("3. 王五 (ICU) - 证件已过期 (过期1天)")
        print("4. 赵六 (儿科) - 正常状态，有效期12天")
        print("5. 钱七 (妇产科) - 未办理证件，可测试新办")
        print("6. 孙八 (内科病区) - 已出院，证件已注销，测试出院拦截")
        
    finally:
        db.close()


if __name__ == "__main__":
    init_database()

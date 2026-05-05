from datetime import datetime, date, timedelta
from app import create_app, db
from app.models import (
    Student, Instructor, Certificate, MedicalRecord,
    Cylinder, CylinderFillRecord, DiveSite, WeatherForecast,
    CourseSchedule, CourseParticipation
)

app = create_app()

def init_sample_data():
    with app.app_context():
        print("正在初始化示例数据...")
        
        print("清理现有数据...")
        CourseParticipation.query.delete()
        RiskAssessment = db.metadata.tables.get('risk_assessment')
        if RiskAssessment is not None:
            db.session.execute(RiskAssessment.delete())
        WeatherForecast.query.delete()
        CourseSchedule.query.delete()
        CylinderFillRecord.query.delete()
        Cylinder.query.delete()
        Certificate.query.delete()
        MedicalRecord.query.delete()
        Student.query.delete()
        Instructor.query.delete()
        DiveSite.query.delete()
        ReviewRecord = db.metadata.tables.get('review_record')
        if ReviewRecord is not None:
            db.session.execute(ReviewRecord.delete())
        db.session.commit()
        
        print("创建潜点...")
        site1 = DiveSite(
            name="蜈支洲岛东礁",
            location="海南省三亚市海棠湾",
            max_depth_meters=30,
            difficulty_level="中级",
            description="蜈支洲岛东礁，珊瑚丰富，能见度佳"
        )
        site2 = DiveSite(
            name="分界洲岛沉船",
            location="海南省陵水县",
            max_depth_meters=25,
            difficulty_level="初级",
            description="分界洲岛沉船潜点，适合新手训练"
        )
        site3 = DiveSite(
            name="亚龙湾珊瑚礁",
            location="海南省三亚市亚龙湾",
            max_depth_meters=18,
            difficulty_level="初级",
            description="亚龙湾浅水区珊瑚礁保护区"
        )
        db.session.add_all([site1, site2, site3])
        db.session.commit()
        
        print("创建教练...")
        instructor1 = Instructor(
            name="张教练",
            id_number="310101198501011234",
            phone="13800138001",
            email="zhang@dive.com",
            license_number="PADI-2015-00123",
            license_expiry=date(2026, 12, 31),
            max_students_per_dive=4
        )
        instructor2 = Instructor(
            name="李教练",
            id_number="310101198602022345",
            phone="13800138002",
            email="li@dive.com",
            license_number="PADI-2016-00456",
            license_expiry=date(2024, 6, 30),
            max_students_per_dive=3
        )
        db.session.add_all([instructor1, instructor2])
        db.session.commit()
        
        print("创建气瓶...")
        today = date.today()
        cylinder1 = Cylinder(
            serial_number="SCUBA-2023-001",
            capacity_liters=12.0,
            material="钢",
            manufacture_date=date(2020, 3, 15),
            last_inspection_date=date(2024, 1, 10),
            next_inspection_date=date(2025, 1, 10),
            status="available"
        )
        cylinder2 = Cylinder(
            serial_number="SCUBA-2023-002",
            capacity_liters=12.0,
            material="铝",
            manufacture_date=date(2021, 5, 20),
            last_inspection_date=date(2023, 6, 5),
            next_inspection_date=date(2024, 6, 5),
            status="available"
        )
        cylinder3 = Cylinder(
            serial_number="SCUBA-2023-003",
            capacity_liters=11.0,
            material="钢",
            manufacture_date=date(2019, 8, 10),
            last_inspection_date=date(2023, 2, 1),
            next_inspection_date=date(2024, 2, 1),
            status="available"
        )
        cylinder4 = Cylinder(
            serial_number="SCUBA-2023-004",
            capacity_liters=12.0,
            material="钢",
            manufacture_date=date(2022, 1, 5),
            last_inspection_date=date(2024, 3, 20),
            next_inspection_date=date(2025, 3, 20),
            status="available"
        )
        db.session.add_all([cylinder1, cylinder2, cylinder3, cylinder4])
        db.session.commit()
        
        print("创建充气记录...")
        fill1 = CylinderFillRecord(
            cylinder_id=cylinder1.id,
            pressure_bar=200,
            gas_type="Air",
            filler_name="王充气"
        )
        fill2 = CylinderFillRecord(
            cylinder_id=cylinder2.id,
            pressure_bar=190,
            gas_type="Air",
            filler_name="王充气"
        )
        db.session.add_all([fill1, fill2])
        db.session.commit()
        
        print("创建学员...")
        student1 = Student(
            name="王明",
            id_number="320101199001011234",
            phone="13900139001",
            email="wang@email.com"
        )
        student2 = Student(
            name="李华",
            id_number="320101199102022345",
            phone="13900139002",
            email="li@email.com"
        )
        student3 = Student(
            name="张芳",
            id_number="320101199203033456",
            phone="13900139003",
            email="zhang@email.com"
        )
        student4 = Student(
            name="陈伟",
            id_number="320101198904044567",
            phone="13900139004",
            email="chen@email.com"
        )
        student5 = Student(
            name="刘洋",
            id_number="320101199305055678",
            phone="13900139005",
            email="liu@email.com"
        )
        student6 = Student(
            name="赵新",
            id_number="320101199406066789",
            phone="13900139006",
            email="zhao@email.com"
        )
        db.session.add_all([student1, student2, student3, student4, student5, student6])
        db.session.commit()
        
        print("创建证书记录...")
        cert1 = Certificate(
            student_id=student1.id,
            cert_type="OW",
            cert_number="PADI-OW-2023-001",
            issue_date=date(2023, 5, 10),
            expiry_date=date(2026, 5, 10),
            issuing_organization="PADI"
        )
        cert2 = Certificate(
            student_id=student2.id,
            cert_type="AOW",
            cert_number="PADI-AOW-2022-002",
            issue_date=date(2022, 8, 15),
            expiry_date=date(2025, 8, 15),
            issuing_organization="PADI"
        )
        cert3 = Certificate(
            student_id=student3.id,
            cert_type="OW",
            cert_number="SSI-OW-2024-001",
            issue_date=date(2024, 1, 20),
            expiry_date=date(2024, 5, 20),
            issuing_organization="SSI"
        )
        cert4 = Certificate(
            student_id=student4.id,
            cert_type="OW",
            cert_number="PADI-OW-2021-003",
            issue_date=date(2021, 6, 1),
            expiry_date=date(2024, 6, 1),
            issuing_organization="PADI"
        )
        cert5 = Certificate(
            student_id=student6.id,
            cert_type="OW",
            cert_number="PADI-OW-2024-002",
            issue_date=date(2024, 2, 10),
            expiry_date=date(2027, 2, 10),
            issuing_organization="PADI"
        )
        db.session.add_all([cert1, cert2, cert3, cert4, cert5])
        db.session.commit()
        
        print("创建体检记录...")
        medical1 = MedicalRecord(
            student_id=student1.id,
            exam_date=date(2024, 1, 15),
            expiry_date=date(2025, 1, 15),
            doctor_name="王医生",
            hospital="三亚市人民医院",
            fit_for_diving=True
        )
        medical2 = MedicalRecord(
            student_id=student2.id,
            exam_date=date(2023, 6, 10),
            expiry_date=date(2024, 6, 10),
            doctor_name="李医生",
            hospital="三亚市人民医院",
            fit_for_diving=True
        )
        medical3 = MedicalRecord(
            student_id=student3.id,
            exam_date=date(2023, 3, 5),
            expiry_date=date(2024, 3, 5),
            doctor_name="张医生",
            hospital="三亚市中医院",
            fit_for_diving=True
        )
        medical4 = MedicalRecord(
            student_id=student4.id,
            exam_date=date(2024, 2, 1),
            expiry_date=date(2025, 2, 1),
            doctor_name="刘医生",
            hospital="301医院海南分院",
            fit_for_diving=False,
            notes="有哮喘病史，不建议深潜"
        )
        medical6 = MedicalRecord(
            student_id=student6.id,
            exam_date=date(2024, 3, 10),
            expiry_date=date(2025, 3, 10),
            doctor_name="王医生",
            hospital="三亚市人民医院",
            fit_for_diving=True
        )
        db.session.add_all([medical1, medical2, medical3, medical4, medical6])
        db.session.commit()
        
        print("创建海况预报...")
        forecast1 = WeatherForecast(
            dive_site_id=site1.id,
            forecast_date=date.today(),
            wind_speed_kmh=15,
            wind_direction="东北风",
            wave_height_m=0.8,
            water_temp_c=26,
            visibility_m=15,
            current_strength="弱",
            forecast_source="海南省海洋预报台"
        )
        forecast2 = WeatherForecast(
            dive_site_id=site2.id,
            forecast_date=date.today(),
            wind_speed_kmh=35,
            wind_direction="东风",
            wave_height_m=2.0,
            water_temp_c=25,
            visibility_m=8,
            current_strength="中等",
            forecast_source="海南省海洋预报台"
        )
        forecast3 = WeatherForecast(
            dive_site_id=site3.id,
            forecast_date=date.today(),
            wind_speed_kmh=25,
            wind_direction="东南风",
            wave_height_m=1.2,
            water_temp_c=27,
            visibility_m=12,
            current_strength="弱",
            forecast_source="海南省海洋预报台"
        )
        tomorrow = date.today() + timedelta(days=1)
        forecast4 = WeatherForecast(
            dive_site_id=site1.id,
            forecast_date=tomorrow,
            wind_speed_kmh=20,
            wind_direction="东北风",
            wave_height_m=1.0,
            water_temp_c=26,
            visibility_m=18,
            current_strength="弱",
            forecast_source="海南省海洋预报台"
        )
        db.session.add_all([forecast1, forecast2, forecast3, forecast4])
        db.session.commit()
        
        print("创建课程排班...")
        course1 = CourseSchedule(
            course_name="OW 开放水域训练第1课",
            course_date=date.today(),
            start_time=datetime.strptime("09:00", "%H:%M").time(),
            end_time=datetime.strptime("12:00", "%H:%M").time(),
            instructor_id=instructor1.id,
            dive_site_id=site1.id,
            max_students=4,
            status="scheduled",
            notes="第一次开放水域训练"
        )
        course2 = CourseSchedule(
            course_name="AOW 深潜专长训练",
            course_date=date.today(),
            start_time=datetime.strptime("14:00", "%H:%M").time(),
            end_time=datetime.strptime("17:00", "%H:%M").time(),
            instructor_id=instructor1.id,
            dive_site_id=site2.id,
            max_students=4,
            status="scheduled",
            notes="深潜到30米训练"
        )
        course3 = CourseSchedule(
            course_name="复习潜水",
            course_date=date.today(),
            start_time=datetime.strptime("08:30", "%H:%M").time(),
            end_time=datetime.strptime("11:30", "%H:%M").time(),
            instructor_id=instructor2.id,
            dive_site_id=site3.id,
            max_students=3,
            status="scheduled",
            notes="老学员复习"
        )
        course4 = CourseSchedule(
            course_name="OW 理论课程",
            course_date=tomorrow,
            start_time=datetime.strptime("10:00", "%H:%M").time(),
            end_time=datetime.strptime("13:00", "%H:%M").time(),
            instructor_id=instructor1.id,
            dive_site_id=site1.id,
            max_students=4,
            status="scheduled",
            notes="理论课程+平静水域"
        )
        db.session.add_all([course1, course2, course3, course4])
        db.session.commit()
        
        print("创建学员报名...")
        p1 = CourseParticipation(course_id=course1.id, student_id=student1.id, cylinder_id=cylinder1.id, status='registered')
        p2 = CourseParticipation(course_id=course1.id, student_id=student2.id, cylinder_id=cylinder2.id, status='registered')
        p3 = CourseParticipation(course_id=course1.id, student_id=student6.id, cylinder_id=cylinder4.id, status='registered')
        
        p4 = CourseParticipation(course_id=course2.id, student_id=student2.id, cylinder_id=cylinder2.id, status='registered')
        p5 = CourseParticipation(course_id=course2.id, student_id=student3.id, cylinder_id=cylinder3.id, status='registered')
        
        p6 = CourseParticipation(course_id=course3.id, student_id=student4.id, cylinder_id=cylinder1.id, status='registered')
        p7 = CourseParticipation(course_id=course3.id, student_id=student5.id, status='registered')
        
        p8 = CourseParticipation(course_id=course4.id, student_id=student6.id, status='registered')
        
        db.session.add_all([p1, p2, p3, p4, p5, p6, p7, p8])
        db.session.commit()
        
        print("")
        print("=" * 50)
        print("示例数据初始化完成！")
        print("=" * 50)
        print("")
        print("数据说明:")
        print("")
        print("【课程1: OW 开放水域训练第1课】")
        print("  - 日期: 今天")
        print("  - 潜点: 蜈支洲岛东礁")
        print("  - 海况: 风速15km/h, 浪高0.8m (正常)")
        print("  - 学员:")
        print("    * 王明 (证书有效, 体检有效, 气瓶SCUBA-2023-001)")
        print("    * 李华 (证书有效, 体检即将过期, 气瓶SCUBA-2023-002)")
        print("    * 赵新 (证书有效, 体检有效, 气瓶SCUBA-2023-004)")
        print("  - 预期评估: pending_review (有警告项)")
        print("")
        print("【课程2: AOW 深潜专长训练】")
        print("  - 日期: 今天")
        print("  - 潜点: 分界洲岛沉船")
        print("  - 海况: 风速35km/h(超限), 浪高2.0m(超限)")
        print("  - 学员:")
        print("    * 李华 (证书有效)")
        print("    * 张芳 (证书即将过期)")
        print("  - 预期评估: denied (海况超限, 证书问题)")
        print("")
        print("【课程3: 复习潜水】")
        print("  - 日期: 今天")
        print("  - 潜点: 亚龙湾珊瑚礁")
        print("  - 教练: 李教练 (证书即将过期, 最大带3人)")
        print("  - 海况: 风速25km/h, 浪高1.2m (正常)")
        print("  - 学员:")
        print("    * 陈伟 (体检: 不适宜潜水)")
        print("    * 刘洋 (无证书, 无体检)")
        print("  - 气瓶:")
        print("    * SCUBA-2023-003 (复检已过期)")
        print("  - 预期评估: denied (多项风险)")
        print("")
        print("【课程4: OW 理论课程】")
        print("  - 日期: 明天")
        print("  - 潜点: 蜈支洲岛东礁")
        print("  - 学员: 赵新 (证书有效)")
        print("  - 预期评估: 需查看明天具体海况")
        print("")
        print("提示风险场景:")
        print("  - 海况超限: 课程2 (风速35>30, 浪高2.0>1.5)")
        print("  - 证书过期: 张芳(5月20日), 李教练(6月30日)")
        print("  - 体检问题: 陈伟(不适宜), 李华(即将过期)")
        print("  - 气瓶问题: SCUBA-2023-003 (复检已过期)")
        print("  - 学员缺失: 刘洋(无证书, 无体检)")
        print("")

if __name__ == '__main__':
    init_sample_data()

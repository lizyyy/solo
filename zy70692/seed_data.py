from datetime import date, time, timedelta
from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
import schemas
import crud

models.Base.metadata.create_all(bind=engine)


def seed_data():
    db = SessionLocal()
    try:
        print("开始初始化数据...")
        
        doctors_data = [
            {"name": "张医生", "department": "口腔科", "title": "主任医师", "phone": "13800138001"},
            {"name": "李医生", "department": "正畸科", "title": "副主任医师", "phone": "13800138002"},
            {"name": "王医生", "department": "种植科", "title": "主治医师", "phone": "13800138003"},
        ]
        
        doctors = []
        for doc_data in doctors_data:
            doc = crud.create_doctor(db, schemas.DoctorCreate(**doc_data))
            doctors.append(doc)
            print(f"已创建医生: {doc.name}")
        
        patients_data = [
            {"name": "患者A", "phone": "13900139001", "email": "a@example.com", "age": 35, "gender": "男"},
            {"name": "患者B", "phone": "13900139002", "email": "b@example.com", "age": 28, "gender": "女"},
            {"name": "患者C", "phone": "13900139003", "email": "c@example.com", "age": 45, "gender": "男"},
            {"name": "患者D", "phone": "13900139004", "email": "d@example.com", "age": 52, "gender": "女"},
        ]
        
        patients = []
        for pat_data in patients_data:
            pat = crud.create_patient(db, schemas.PatientCreate(**pat_data))
            patients.append(pat)
            print(f"已创建患者: {pat.name}")
        
        today = date.today()
        for i, doc in enumerate(doctors):
            for day_offset in range(1, 8):
                schedule_date = today + timedelta(days=day_offset)
                schedule_data = {
                    "doctor_id": doc.id,
                    "schedule_date": schedule_date,
                    "start_time": time(9 + i, 0),
                    "end_time": time(12 + i, 0),
                    "max_patients": 10,
                    "is_available": True
                }
                try:
                    schedule = crud.create_doctor_schedule(db, schemas.DoctorScheduleCreate(**schedule_data))
                    print(f"已创建排班: {doc.name} {schedule_date}")
                except:
                    pass
        
        treatment_plans_data = [
            {
                "patient_id": patients[0].id,
                "doctor_id": doctors[0].id,
                "treatment_name": "根管治疗后复查",
                "treatment_description": "根管治疗完成后一周复查",
                "next_revisit_date": today + timedelta(days=3),
                "revisit_type": "常规复查"
            },
            {
                "patient_id": patients[1].id,
                "doctor_id": doctors[1].id,
                "treatment_name": "牙齿矫正复诊",
                "treatment_description": "牙套调整，检查矫正进度",
                "next_revisit_date": today + timedelta(days=5),
                "revisit_type": "矫正复诊"
            },
            {
                "patient_id": patients[2].id,
                "doctor_id": doctors[2].id,
                "treatment_name": "种植牙术后检查",
                "treatment_description": "种植牙手术后一周检查愈合情况",
                "next_revisit_date": today + timedelta(days=7),
                "revisit_type": "术后复查"
            },
            {
                "patient_id": patients[3].id,
                "doctor_id": doctors[0].id,
                "treatment_name": "牙周治疗维护",
                "treatment_description": "牙周治疗后定期维护",
                "next_revisit_date": today + timedelta(days=2),
                "revisit_type": "维护复诊"
            },
        ]
        
        plans = []
        for plan_data in treatment_plans_data:
            plan = crud.create_treatment_plan(db, schemas.TreatmentPlanCreate(**plan_data))
            plans.append(plan)
            print(f"已创建治疗计划: {plan.treatment_name}")
        
        print("\n数据初始化完成!")
        print(f"\n总计:")
        print(f"  医生: {len(doctors)} 名")
        print(f"  患者: {len(patients)} 名")
        print(f"  治疗计划: {len(plans)} 个")
        print(f"  排班: {db.query(models.DoctorSchedule).count()} 个")
        
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()

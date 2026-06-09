import os
import csv
import sys

import config
from models import init_db, Pet, WeightSchedule, MedicalRecord


def import_pets(session, csv_path):
    count = 0
    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            existing = session.query(Pet).filter(Pet.pet_id == row["宠物ID"]).first()
            if existing:
                continue
            pet = Pet(
                pet_id=row["宠物ID"],
                name=row["宠物名称"],
                species=row.get("物种", ""),
                breed=row.get("品种", ""),
                gender=row.get("性别", ""),
                birth_date=row.get("出生日期", ""),
                owner_name=row.get("主人姓名", ""),
                owner_phone=row.get("主人电话", ""),
            )
            session.add(pet)
            count += 1
    session.commit()
    print(f"[导入] 宠物基础信息: 新增 {count} 条")


def import_schedules(session, csv_path):
    count = 0
    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            pet = session.query(Pet).filter(Pet.pet_id == row["宠物ID"]).first()
            if pet is None:
                continue
            existing = session.query(WeightSchedule).filter(
                WeightSchedule.pet_id == row["宠物ID"],
                WeightSchedule.plan_date == row["计划日期"],
            ).first()
            if existing:
                continue
            sched = WeightSchedule(
                pet_id=row["宠物ID"],
                plan_date=row["计划日期"],
                current_weight_kg=float(row["当前体重(kg)"]),
                target_weight_kg=float(row["目标体重(kg)"]),
                weight_loss_target=float(row["减重目标(kg)"]),
                exercise_plan=row.get("运动计划", ""),
                diet_plan=row.get("饮食计划", ""),
                medication_reminder=row.get("用药提醒", ""),
                trainer=row.get("训练师", "阿岑"),
            )
            session.add(sched)
            count += 1
    session.commit()
    print(f"[导入] 减重排程: 新增 {count} 条")


def import_medical_records(session, csv_path):
    count = 0
    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            existing = session.query(MedicalRecord).filter(
                MedicalRecord.record_id == row["记录ID"]
            ).first()
            if existing:
                continue
            med = row.get("已给药", "")
            med_remark = row.get("用药备注", "")
            medication_given = med
            if med and med_remark:
                medication_given = f"{med} ({med_remark})"
            mr = MedicalRecord(
                record_id=row["记录ID"],
                handwritten_name=row["手写宠物名"],
                record_date=row["看诊日期"],
                raw_weight=row["手写体重"],
                medication_given=medication_given,
                medication_remark=med_remark,
                medical_summary=row.get("病历摘要", ""),
                vet_name=row.get("兽医签字", ""),
            )
            session.add(mr)
            count += 1
    session.commit()
    print(f"[导入] 病历手写单: 新增 {count} 条（含叫法对不上旧记录与体重混写记录）")


def main():
    session = init_db()
    print("=" * 50)
    print("宠物减重排程对账 - 样例数据导入")
    print("=" * 50)

    samples = [
        ("宠物基础信息", os.path.join(config.SAMPLE_DIR, "宠物基础信息.csv"), import_pets),
        ("减重排程表", os.path.join(config.SAMPLE_DIR, "减重排程表.csv"), import_schedules),
        ("病历手写单", os.path.join(config.SAMPLE_DIR, "病历手写单_20260608.csv"), import_medical_records),
    ]

    for name, path, fn in samples:
        if not os.path.exists(path):
            print(f"[跳过] {name}: 文件不存在 {path}")
            continue
        fn(session, path)

    print("=" * 50)
    print("样例数据导入完成！可继续执行 `python run_pipeline.py` 跑对账主流程。")
    session.close()


if __name__ == "__main__":
    main()

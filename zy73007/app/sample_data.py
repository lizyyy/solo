from datetime import date, datetime, timedelta
from .models import BoardingRegister, VaccineSchedule


def build_sample_registers() -> list[BoardingRegister]:
    today = date.today()
    registers: list[BoardingRegister] = []

    registers.append(BoardingRegister(
        reg_id="REG-2026-0001",
        dog_name="豆豆",
        owner_name="王芳",
        owner_phone="138****1234",
        checkin_date=today - timedelta(days=3),
        checkout_date=today + timedelta(days=4),
        vaccine_last_date=date(2025, 10, 15),
        vaccine_next_due=date(2026, 4, 15),
        vaccine_type_old="六联",
        owner_supplement="主人说上次疫苗是2025-10-15打的六联，和店里旧本一致。",
        supplement_vaccine_date=date(2025, 10, 15),
        supplement_vaccine_type="六联",
        remark="标准行：主人补充与旧记录完全一致",
        created_by="老周",
        created_at=datetime.combine(today - timedelta(days=3), datetime.min.time())
    ))

    registers.append(BoardingRegister(
        reg_id="REG-2026-0002",
        dog_name="旺财",
        owner_name="李强",
        owner_phone="139****5678",
        checkin_date=today - timedelta(days=2),
        checkout_date=today + timedelta(days=5),
        vaccine_last_date=date(2025, 8, 1),
        vaccine_next_due=date(2026, 2, 1),
        vaccine_type_old="八联",
        owner_supplement="主人临时补充：去年9月20号刚打的进口八联，疫苗本忘带了，回头补照片。",
        supplement_vaccine_date=date(2025, 9, 20),
        supplement_vaccine_type="八联",
        remark="主人补充日期(2025-09-20)与旧记录(2025-08-01)对不上，且待补疫苗本照片",
        created_by="老周",
        created_at=datetime.combine(today - timedelta(days=2), datetime.min.time())
    ))

    registers.append(BoardingRegister(
        reg_id="REG-2026-0003",
        dog_name="雪球",
        owner_name="赵敏",
        owner_phone="137****9012",
        checkin_date=today - timedelta(days=5),
        checkout_date=today + timedelta(days=2),
        vaccine_last_date=None,
        vaccine_next_due=None,
        vaccine_type_old=None,
        owner_supplement="主人说疫苗具体哪天打的记不清了，就记得是去年秋天，反正没过期。",
        supplement_vaccine_date=None,
        supplement_vaccine_type="四联",
        remark="疫苗日期缺失：旧记录空、主人也说不出具体日期",
        created_by="老周",
        created_at=datetime.combine(today - timedelta(days=5), datetime.min.time())
    ))

    registers.append(BoardingRegister(
        reg_id="REG-2026-0004",
        dog_name="来福",
        owner_name="孙刚",
        owner_phone="136****3456",
        checkin_date=today - timedelta(days=1),
        checkout_date=today + timedelta(days=6),
        vaccine_last_date=date(2025, 5, 10),
        vaccine_next_due=date(2026, 5, 10),
        vaccine_type_old="狂犬+六联",
        owner_supplement="主人补充：今年3月15号带狗在老家宠物医院打过狂犬和六联，有小票（已现场验票）。",
        supplement_vaccine_date=date(2026, 3, 15),
        supplement_vaccine_type="狂犬+六联",
        remark="人工改判行：旧记录下次应接种是2026-05-10，但主人3月15号提前在外地接种，现场验过小票，老周手动改判为已确认",
        created_by="老周",
        created_at=datetime.combine(today - timedelta(days=1), datetime.min.time())
    ))

    registers.append(BoardingRegister(
        reg_id="REG-2026-0005",
        dog_name="毛球",
        owner_name="周丽",
        owner_phone="135****7890",
        checkin_date=today - timedelta(days=4),
        checkout_date=today + timedelta(days=1),
        vaccine_last_date=date(2025, 11, 20),
        vaccine_next_due=date(2026, 5, 20),
        vaccine_type_old="六联",
        owner_supplement="主人说上次就是去年11月打的，其他记不清了，和店里登记的对得上。",
        supplement_vaccine_date=date(2025, 11, 20),
        supplement_vaccine_type="六联",
        remark="标准行：一致，但下次排程(2026-05-20)已超期，需要在寄养期间补打",
        created_by="老周",
        created_at=datetime.combine(today - timedelta(days=4), datetime.min.time())
    ))

    return registers


def build_sample_schedules(registers: list[BoardingRegister]) -> list[VaccineSchedule]:
    schedules: list[VaccineSchedule] = []
    today = date.today()

    schedules.append(VaccineSchedule(
        schedule_id="SCH-0001",
        reg_id="REG-2026-0001",
        dog_name="豆豆",
        plan_date=date(2026, 4, 15),
        actual_date=None,
        vaccine_type="六联",
        source="旧记录",
        source_line_no=1
    ))

    schedules.append(VaccineSchedule(
        schedule_id="SCH-0002",
        reg_id="REG-2026-0002",
        dog_name="旺财",
        plan_date=date(2026, 2, 1),
        actual_date=None,
        vaccine_type="八联",
        source="旧记录",
        source_line_no=2
    ))

    schedules.append(VaccineSchedule(
        schedule_id="SCH-0003",
        reg_id="REG-2026-0003",
        dog_name="雪球",
        plan_date=None,
        actual_date=None,
        vaccine_type="四联",
        source="主人补充（日期缺失）",
        source_line_no=3
    ))

    schedules.append(VaccineSchedule(
        schedule_id="SCH-0004",
        reg_id="REG-2026-0004",
        dog_name="来福",
        plan_date=date(2026, 5, 10),
        actual_date=date(2026, 3, 15),
        vaccine_type="狂犬+六联",
        source="人工改判",
        source_line_no=4
    ))

    schedules.append(VaccineSchedule(
        schedule_id="SCH-0005",
        reg_id="REG-2026-0005",
        dog_name="毛球",
        plan_date=date(2026, 5, 20),
        actual_date=today,
        vaccine_type="六联",
        source="旧记录（寄养期间补打）",
        source_line_no=5
    ))

    return schedules


MANUAL_OVERRIDE_RECORDS = {
    "REG-2026-0004": {
        "override_reason": "主人现场出示2026-03-15外地接种小票，照片已存档。旧记录下次应接种日期(2026-05-10)作废，按实际接种日期3月15日认定。",
        "handler": "老周",
        "handled_at": datetime.combine(today := date.today(), datetime.min.time()) + timedelta(hours=14, minutes=30)
    }
}

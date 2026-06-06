from models import EquipmentRecord, RecordStatus


def create_demo_records():
    records = []

    records.append(
        EquipmentRecord(
            id="EQ-2026-001",
            equipment_name="Neumann U87 话筒套装",
            borrower="星光乐队",
            authorized_cities=["上海", "杭州", "南京"],
            actual_cities=["上海", "杭州", "南京"],
            authorized_start="2026-05-01",
            authorized_end="2026-06-30",
            actual_use_date="2026-05-15",
            hours_used=8.0,
            tuner_message=None,
            status=RecordStatus.NORMAL,
        )
    )

    records.append(
        EquipmentRecord(
            id="EQ-2026-002",
            equipment_name="Soundcraft Vi3000 调音台",
            borrower="彩虹乐团",
            authorized_cities=["北京", "天津"],
            actual_cities=["北京", "天津", "石家庄"],
            authorized_start="2026-04-01",
            authorized_end="2026-05-31",
            actual_use_date="2026-05-10",
            hours_used=12.0,
            tuner_message=None,
            status=RecordStatus.NORMAL,
        )
    )

    records.append(
        EquipmentRecord(
            id="EQ-2026-003",
            equipment_name="Shure PSM1000 耳返系统",
            borrower="流年歌手",
            authorized_cities=["广州", "深圳"],
            actual_cities=["广州", "深圳", "佛山"],
            authorized_start="2026-03-01",
            authorized_end="2026-04-30",
            actual_use_date="2026-04-20",
            hours_used=10.0,
            tuner_message="3月25日晚调音师留言：佛山站按旧口径补录，非黄金时段，另外加时2小时",
            status=RecordStatus.NORMAL,
        )
    )

    return records


def create_step1_imported_records():
    records = create_demo_records()
    for r in records:
        r.tuner_message = None
    return records


def create_step2_with_tuner_messages():
    records = create_step1_imported_records()
    records[2].tuner_message = "3月25日晚调音师留言：佛山站按旧口径补录，非黄金时段，另外加时2小时。补充佛山授权"
    return records

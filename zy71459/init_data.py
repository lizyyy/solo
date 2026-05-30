from app.database import SessionLocal, init_db
from app.repositories import (
    RoomRepository, EquipmentRepository, BandRepository,
    BookingRequestRepository, ExamWeekRepository
)
from app import schemas
from datetime import date, timedelta


def init_sample_data():
    init_db()
    db = SessionLocal()

    try:
        eq_repo = EquipmentRepository(db)
        piano = eq_repo.create(schemas.EquipmentCreate(
            name="三角钢琴",
            category="键盘乐器",
            total_quantity=3,
            description="专业演奏用三角钢琴"
        ))
        guitar = eq_repo.create(schemas.EquipmentCreate(
            name="电吉他",
            category="弦乐器",
            total_quantity=5,
            description="电吉他及音箱"
        ))
        drum = eq_repo.create(schemas.EquipmentCreate(
            name="架子鼓",
            category="打击乐器",
            total_quantity=2,
            description="全套架子鼓"
        ))
        microphone = eq_repo.create(schemas.EquipmentCreate(
            name="麦克风套装",
            category="音响设备",
            total_quantity=4,
            description="人声和乐器麦克风"
        ))
        print(f"创建设备: 钢琴(id={piano.id}), 吉他(id={guitar.id}), 架子鼓(id={drum.id}), 麦克风(id={microphone.id})")

        room_repo = RoomRepository(db)
        room1 = room_repo.create(schemas.RoomCreate(
            name="A101 大排练室",
            capacity=30,
            location="主楼一层",
            description="大型乐队排练室",
            equipment=[
                schemas.RoomEquipmentCreate(equipment_id=piano.id, quantity=1, source_note="房间标配"),
                schemas.RoomEquipmentCreate(equipment_id=drum.id, quantity=1, source_note="房间标配"),
                schemas.RoomEquipmentCreate(equipment_id=microphone.id, quantity=2, source_note="房间标配")
            ]
        ))
        room2 = room_repo.create(schemas.RoomCreate(
            name="B202 中型排练室",
            capacity=15,
            location="副楼二层",
            description="中型乐队排练室",
            equipment=[
                schemas.RoomEquipmentCreate(equipment_id=piano.id, quantity=1, source_note="房间标配"),
                schemas.RoomEquipmentCreate(equipment_id=guitar.id, quantity=2, source_note="房间标配")
            ]
        ))
        room3 = room_repo.create(schemas.RoomCreate(
            name="C301 小型练习室",
            capacity=6,
            location="副楼三层",
            description="小组练习室"
        ))
        print(f"创建房间: {room1.name}(id={room1.id}), {room2.name}(id={room2.id}), {room3.name}(id={room3.id})")

        band_repo = BandRepository(db)
        band1 = band_repo.create(schemas.BandCreate(
            name="交响乐团A团",
            member_count=45,
            contact_person="张老师",
            contact_phone="13800138001"
        ))
        band2 = band_repo.create(schemas.BandCreate(
            name="爵士乐队",
            member_count=8,
            contact_person="李老师",
            contact_phone="13800138002"
        ))
        band3 = band_repo.create(schemas.BandCreate(
            name="民乐小组",
            member_count=5,
            contact_person="王老师",
            contact_phone="13800138003"
        ))
        print(f"创建乐队: {band1.name}(id={band1.id}), {band2.name}(id={band2.id}), {band3.name}(id={band3.id})")

        booking_repo = BookingRequestRepository(db)
        tomorrow = date.today() + timedelta(days=1)
        booking1 = booking_repo.create(schemas.BookingRequestCreate(
            band_id=band1.id,
            title="交响乐团周五排练",
            purpose="日常排练",
            preferred_date=tomorrow,
            start_time="14:00",
            end_time="17:00",
            participant_count=25,
            priority="high",
            submitted_by="张老师",
            equipment=[
                schemas.BookingEquipmentCreate(equipment_id=piano.id, quantity=1, source_note="钢琴协奏"),
                schemas.BookingEquipmentCreate(equipment_id=microphone.id, quantity=1, source_note="首席用")
            ]
        ))
        booking2 = booking_repo.create(schemas.BookingRequestCreate(
            band_id=band2.id,
            title="爵士乐队周末练习",
            purpose="演出前彩排",
            preferred_date=tomorrow,
            start_time="15:00",
            end_time="18:00",
            participant_count=8,
            priority="normal",
            submitted_by="李老师",
            equipment=[
                schemas.BookingEquipmentCreate(equipment_id=drum.id, quantity=1, source_note="爵士鼓"),
                schemas.BookingEquipmentCreate(equipment_id=guitar.id, quantity=1, source_note="主音吉他")
            ]
        ))
        booking3 = booking_repo.create(schemas.BookingRequestCreate(
            band_id=band3.id,
            title="民乐器乐课",
            purpose="教学",
            preferred_date=tomorrow,
            start_time="09:00",
            end_time="11:00",
            participant_count=5,
            priority="normal",
            submitted_by="王老师"
        ))
        print(f"创建预约: {booking1.title}(id={booking1.id}), {booking2.title}(id={booking2.id}), {booking3.title}(id={booking3.id})")

        exam_repo = ExamWeekRepository(db)
        exam_start = date.today() + timedelta(days=30)
        exam_end = exam_start + timedelta(days=7)
        exam_week = exam_repo.create(schemas.ExamWeekCreate(
            start_date=exam_start,
            end_date=exam_end,
            semester="2024春季学期",
            description="期末考试周"
        ))
        print(f"创建考试周: {exam_week.semester} ({exam_start} ~ {exam_end})")

        print("\n=== 样本数据初始化完成 ===")
        print(f"预约申请ID列表: [{booking1.id}, {booking2.id}, {booking3.id}]")
        print("可以使用这些ID调用 /scheduling/run 接口测试排期功能")

    finally:
        db.close()


if __name__ == "__main__":
    init_sample_data()

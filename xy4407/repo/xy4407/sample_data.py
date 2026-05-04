from datetime import datetime, date, time, timedelta
from sqlalchemy.orm import Session

from database import SessionLocal, init_db
from models import (
    Auditorium, Film, KDM, Schedule, Event,
    AuditoriumStatus, ScheduleStatus, EventStatus,
    EventType, EventPriority, KDMSource
)
from risk_detection import RiskDetector


def create_sample_data():
    db: Session = SessionLocal()
    
    try:
        print("正在初始化数据库...")
        init_db()
        
        print("正在创建示例影厅数据...")
        auditoriums = [
            Auditorium(
                name="1号厅",
                server_id="SVR-001",
                serial_number="SN-2024-001",
                location="一楼东侧",
                status=AuditoriumStatus.ACTIVE
            ),
            Auditorium(
                name="2号厅",
                server_id="SVR-002",
                serial_number="SN-2024-002",
                location="一楼西侧",
                status=AuditoriumStatus.ACTIVE
            ),
            Auditorium(
                name="3号厅",
                server_id="SVR-003",
                serial_number="SN-2024-003",
                location="二楼北侧",
                status=AuditoriumStatus.ACTIVE
            ),
            Auditorium(
                name="4号厅",
                server_id="SVR-004",
                serial_number="SN-2024-004",
                location="二楼南侧",
                status=AuditoriumStatus.MAINTENANCE
            ),
        ]
        
        for aud in auditoriums:
            existing = db.query(Auditorium).filter(
                Auditorium.server_id == aud.server_id
            ).first()
            if not existing:
                db.add(aud)
        
        db.commit()
        
        print("正在创建示例影片数据...")
        films = [
            Film(
                title="星际穿越",
                cpl_id="CPL-INT-2024-001",
                duration=169,
                language="英语/中文字幕",
                version="2D"
            ),
            Film(
                title="盗梦空间",
                cpl_id="CPL-INCEP-2024-001",
                duration=148,
                language="英语/中文字幕",
                version="2D"
            ),
            Film(
                title="阿凡达：水之道",
                cpl_id="CPL-AVATAR-2024-001",
                duration=192,
                language="英语/中文字幕",
                version="3D"
            ),
            Film(
                title="流浪地球2",
                cpl_id="CPL-WANDER-2024-001",
                duration=173,
                language="普通话",
                version="2D IMAX"
            ),
        ]
        
        for film in films:
            existing = db.query(Film).filter(Film.cpl_id == film.cpl_id).first()
            if not existing:
                db.add(film)
        
        db.commit()
        
        auditoriums = db.query(Auditorium).all()
        films = db.query(Film).all()
        
        aud_map = {a.name: a for a in auditoriums}
        film_map = {f.title: f for f in films}
        
        print("正在创建示例KDM密钥数据...")
        
        now = datetime.utcnow()
        today = date.today()
        
        kdms = [
            KDM(
                film_id=film_map["星际穿越"].id,
                auditorium_id=aud_map["1号厅"].id,
                cpl_id=film_map["星际穿越"].cpl_id,
                valid_from=now - timedelta(days=30),
                valid_to=now + timedelta(hours=12),
                source=KDMSource.MANUAL,
                notes="密钥即将过期，需要申请新密钥"
            ),
            KDM(
                film_id=film_map["盗梦空间"].id,
                auditorium_id=aud_map["2号厅"].id,
                cpl_id=film_map["盗梦空间"].cpl_id,
                valid_from=now - timedelta(days=15),
                valid_to=now + timedelta(days=15),
                source=KDMSource.UPLOADED
            ),
            KDM(
                film_id=film_map["阿凡达：水之道"].id,
                auditorium_id=aud_map["1号厅"].id,
                cpl_id=film_map["阿凡达：水之道"].cpl_id,
                valid_from=now - timedelta(days=5),
                valid_to=now + timedelta(days=25),
                source=KDMSource.UPLOADED
            ),
            KDM(
                film_id=film_map["阿凡达：水之道"].id,
                auditorium_id=aud_map["3号厅"].id,
                cpl_id=film_map["阿凡达：水之道"].cpl_id,
                valid_from=now - timedelta(days=5),
                valid_to=now + timedelta(days=25),
                source=KDMSource.UPLOADED
            ),
        ]
        
        for kdm in kdms:
            db.add(kdm)
        
        db.commit()
        
        print("正在创建示例排片数据...")
        
        schedules = [
            Schedule(
                film_id=film_map["星际穿越"].id,
                auditorium_id=aud_map["1号厅"].id,
                show_date=today,
                start_time=time(14, 0),
                end_time=time(16, 49),
                status=ScheduleStatus.SCHEDULED,
                notes="下午场 - 密钥即将过期"
            ),
            Schedule(
                film_id=film_map["盗梦空间"].id,
                auditorium_id=aud_map["2号厅"].id,
                show_date=today,
                start_time=time(14, 0),
                end_time=time(16, 28),
                status=ScheduleStatus.SCHEDULED
            ),
            Schedule(
                film_id=film_map["星际穿越"].id,
                auditorium_id=aud_map["1号厅"].id,
                show_date=today,
                start_time=time(14, 30),
                end_time=time(17, 19),
                status=ScheduleStatus.SCHEDULED,
                notes="时间冲突排片"
            ),
            Schedule(
                film_id=film_map["阿凡达：水之道"].id,
                auditorium_id=aud_map["2号厅"].id,
                show_date=today,
                start_time=time(19, 0),
                end_time=time(22, 12),
                status=ScheduleStatus.SCHEDULED,
                notes="晚场 - 服务器不匹配"
            ),
            Schedule(
                film_id=film_map["流浪地球2"].id,
                auditorium_id=aud_map["3号厅"].id,
                show_date=today + timedelta(days=1),
                start_time=time(10, 0),
                end_time=time(12, 53),
                status=ScheduleStatus.SCHEDULED,
                notes="无KDM密钥"
            ),
            Schedule(
                film_id=film_map["盗梦空间"].id,
                auditorium_id=aud_map["1号厅"].id,
                show_date=today + timedelta(days=2),
                start_time=time(15, 0),
                end_time=time(17, 28),
                status=ScheduleStatus.SCHEDULED
            ),
        ]
        
        for schedule in schedules:
            db.add(schedule)
        
        db.commit()
        
        print("正在运行风险检测...")
        detector = RiskDetector(db)
        events = detector.check_all_upcoming(days=7)
        
        print(f"\n=== 示例数据创建完成 ===")
        print(f"影厅数量: {len(auditoriums)}")
        print(f"影片数量: {len(films)}")
        print(f"KDM密钥数量: {len(kdms)}")
        print(f"排片数量: {len(schedules)}")
        print(f"检测到的风险事件数量: {len(events)}")
        
        if events:
            print(f"\n检测到的风险事件:")
            for event in events:
                print(f"  - [{event.priority}] {event.title}: {event.description[:80]}...")
        
        print(f"\n=== 数据创建成功 ===")
        
    finally:
        db.close()


if __name__ == "__main__":
    create_sample_data()

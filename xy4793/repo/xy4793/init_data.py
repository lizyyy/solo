from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import random
from database import SessionLocal, engine, Base
from models import Room, Session as SessionModel, Event

def init_rooms(db: Session):
    rooms_data = [
        {"name": "恐怖主题房", "capacity": 6},
        {"name": "古风主题房", "capacity": 7},
        {"name": "现代主题房", "capacity": 5},
        {"name": "科幻主题房", "capacity": 6},
        {"name": "沉浸主题房", "capacity": 8},
    ]
    
    for room_data in rooms_data:
        existing = db.query(Room).filter(Room.name == room_data["name"]).first()
        if not existing:
            room = Room(**room_data)
            db.add(room)
    
    db.commit()
    print("✓ 房间数据初始化完成")

def init_sessions(db: Session):
    rooms = db.query(Room).all()
    if not rooms:
        print("⚠️ 没有找到房间，请先初始化房间数据")
        return
    
    scripts = [
        "《死者在幻夜中醒来》",
        "《年轮》",
        "《漓川怪谈簿》",
        "《持斧奥夫》",
        "《马丁内斯死在惊奇馆》",
        "《月光下的持刀者》",
        "《来电》",
        "《病娇男孩的精分日记》",
    ]
    
    dms = ["小明", "小红", "小李", "小张", "小王"]
    player_counts = [5, 6, 7, 8]
    
    today = datetime.now().date()
    start_hours = [10, 14, 15, 19, 20]
    
    for i, room in enumerate(rooms[:3]):
        hour = start_hours[i % len(start_hours)]
        scheduled_time = datetime.combine(today, datetime.min.time()) + timedelta(hours=hour + random.randint(0, 2))
        
        session = SessionModel(
            room_id=room.id,
            script_name=random.choice(scripts),
            dm_name=random.choice(dms),
            player_count=random.choice(player_counts),
            scheduled_time=scheduled_time,
            status="scheduled"
        )
        db.add(session)
    
    db.commit()
    print("✓ 今日场次数据初始化完成")

def init_sample_completed_session(db: Session):
    rooms = db.query(Room).all()
    if not rooms:
        return
    
    room = rooms[0]
    
    yesterday = datetime.now().date() - timedelta(days=1)
    start_time = datetime.combine(yesterday, datetime.min.time()) + timedelta(hours=14)
    end_time = start_time + timedelta(hours=4, minutes=30)
    
    session = SessionModel(
        room_id=room.id,
        script_name="《年轮》",
        dm_name="小明",
        player_count=6,
        scheduled_time=start_time,
        actual_start_time=start_time,
        actual_end_time=end_time,
        status="ended"
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    events = [
        {"event_type": "start", "sender": "dm", "content": "场次开始", "created_at": start_time},
        {"event_type": "notification", "sender": "front_desk", "content": "大家好，祝游戏愉快！", "created_at": start_time + timedelta(minutes=5), "is_acknowledged": True, "acknowledged_by": "dm", "acknowledged_at": start_time + timedelta(minutes=6)},
        {"event_type": "help", "sender": "dm", "content": "需要玩家资料补充", "created_at": start_time + timedelta(hours=1, minutes=20), "is_acknowledged": True, "acknowledged_by": "前台", "acknowledged_at": start_time + timedelta(hours=1, minutes=22)},
        {"event_type": "change_props", "sender": "dm", "content": "需要替换道具：破损的怀表", "created_at": start_time + timedelta(hours=2, minutes=15), "is_acknowledged": True, "acknowledged_by": "前台", "acknowledged_at": start_time + timedelta(hours=2, minutes=18)},
        {"event_type": "pause", "sender": "dm", "content": "中场休息15分钟", "created_at": start_time + timedelta(hours=2, minutes=45)},
        {"event_type": "resume", "sender": "dm", "content": "游戏继续", "created_at": start_time + timedelta(hours=3)},
        {"event_type": "notification", "sender": "front_desk", "content": "还有30分钟结束，请把控时间", "created_at": start_time + timedelta(hours=4), "is_acknowledged": True, "acknowledged_by": "dm", "acknowledged_at": start_time + timedelta(hours=4, minutes=1)},
        {"event_type": "end", "sender": "dm", "content": "本场结束，耗时4小时30分钟", "created_at": end_time},
    ]
    
    for event_data in events:
        event = Event(
            session_id=session.id,
            event_type=event_data["event_type"],
            sender=event_data["sender"],
            content=event_data["content"],
            is_acknowledged=event_data.get("is_acknowledged", False),
            acknowledged_by=event_data.get("acknowledged_by"),
            acknowledged_at=event_data.get("acknowledged_at"),
            created_at=event_data["created_at"]
        )
        db.add(event)
    
    db.commit()
    print("✓ 示例完成场次数据初始化完成")

def main():
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        print("开始初始化示例数据...")
        init_rooms(db)
        init_sessions(db)
        init_sample_completed_session(db)
        print("\n✅ 所有数据初始化完成！")
        
        rooms = db.query(Room).all()
        sessions = db.query(SessionModel).all()
        print(f"\n📊 当前数据统计：")
        print(f"  - 房间数: {len(rooms)}")
        print(f"  - 场次总数: {len(sessions)}")
        for status in ["scheduled", "in_progress", "paused", "ended"]:
            count = db.query(SessionModel).filter(SessionModel.status == status).count()
            print(f"  - {status}: {count}")
        
    except Exception as e:
        print(f"❌ 初始化失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()

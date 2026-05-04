import asyncio
from datetime import date, datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import async_session_maker, init_db
from app.models import Work, KilnSession, KilnLoading, DrynessStatus, FiringResult


async def create_sample_data():
    await init_db()
    
    async with async_session_maker() as session:
        print("正在创建示例数据...")
        
        today = date.today()
        
        works_data = [
            {
                "student_name": "张三",
                "work_description": "手工茶杯",
                "dryness_status": DrynessStatus.DRY,
                "glaze_type": "lead_based",
                "expected_pickup_date": today + timedelta(days=3),
                "temperature_zone": "mid"
            },
            {
                "student_name": "李四",
                "work_description": "花瓶摆件",
                "dryness_status": DrynessStatus.DRY,
                "glaze_type": "copper_based",
                "expected_pickup_date": today + timedelta(days=5),
                "temperature_zone": "high"
            },
            {
                "student_name": "王五",
                "work_description": "陶艺盘子",
                "dryness_status": DrynessStatus.PARTIALLY_DRY,
                "glaze_type": "manganese_based",
                "expected_pickup_date": today + timedelta(days=7),
                "temperature_zone": "mid"
            },
            {
                "student_name": "赵六",
                "work_description": "雕塑作品",
                "dryness_status": DrynessStatus.NOT_DRY,
                "glaze_type": "zinc_based",
                "expected_pickup_date": today + timedelta(days=10),
                "temperature_zone": "high"
            },
            {
                "student_name": "钱七",
                "work_description": "茶宠小摆件",
                "dryness_status": DrynessStatus.DRY,
                "glaze_type": "alkali_based",
                "expected_pickup_date": today + timedelta(days=2),
                "temperature_zone": "low"
            },
            {
                "student_name": "孙八",
                "work_description": "公道杯",
                "dryness_status": DrynessStatus.DRY,
                "glaze_type": "lead_based",
                "expected_pickup_date": today - timedelta(days=3),
                "temperature_zone": "mid"
            },
            {
                "student_name": "周九",
                "work_description": "盖碗套装",
                "dryness_status": DrynessStatus.DRY,
                "glaze_type": "copper_based",
                "expected_pickup_date": today - timedelta(days=1),
                "temperature_zone": "high"
            },
        ]
        
        for work_data in works_data:
            work = Work(**work_data)
            session.add(work)
        
        await session.commit()
        
        result = await session.execute(
            Work.__table__.select().order_by(Work.id)
        )
        works = result.fetchall()
        work_ids = [w.id for w in works]
        
        sessions_data = [
            {
                "session_name": "2026-05-05-中温窑",
                "target_temperature_zone": "mid",
                "scheduled_firing_date": today + timedelta(days=1),
                "max_capacity": 50
            },
            {
                "session_name": "2026-05-06-高温窑",
                "target_temperature_zone": "high",
                "scheduled_firing_date": today + timedelta(days=2),
                "max_capacity": 50
            },
            {
                "session_name": "2026-05-07-低温窑",
                "target_temperature_zone": "low",
                "scheduled_firing_date": today + timedelta(days=3),
                "max_capacity": 30
            },
        ]
        
        for session_data in sessions_data:
            kiln_session = KilnSession(**session_data)
            session.add(kiln_session)
        
        await session.commit()
        
        session_result = await session.execute(
            KilnSession.__table__.select().order_by(KilnSession.id)
        )
        sessions = session_result.fetchall()
        session_ids = [s.id for s in sessions]
        
        loadings_data = [
            {"work_id": work_ids[0], "kiln_session_id": session_ids[0], "loading_order": 1},
            {"work_id": work_ids[4], "kiln_session_id": session_ids[2], "loading_order": 1},
        ]
        
        for loading_data in loadings_data:
            loading = KilnLoading(**loading_data)
            session.add(loading)
        
        await session.commit()
        
        fired_session = KilnSession(
            session_name="2026-05-03-中温窑(已完成)",
            target_temperature_zone="mid",
            scheduled_firing_date=today - timedelta(days=1),
            max_capacity=50,
            is_fired=True,
            firing_start_time=datetime.now() - timedelta(hours=24),
            firing_end_time=datetime.now() - timedelta(hours=12),
            firing_result=FiringResult.SUCCESS,
            notes="本次烧成效果良好，釉面光泽度佳"
        )
        session.add(fired_session)
        await session.commit()
        
        print("\n示例数据创建完成！")
        print(f"\n创建了 {len(works_data)} 个作品")
        print(f"创建了 {len(sessions_data) + 1} 个窑次")
        print(f"\n作品列表:")
        for i, work in enumerate(works):
            print(f"  ID: {work.id}, 学员: {work.student_name}, 温区: {work.temperature_zone}, 干燥: {work.dryness_status.value}")
        
        print(f"\n窑次列表:")
        all_sessions = await session.execute(
            KilnSession.__table__.select().order_by(KilnSession.id)
        )
        for s in all_sessions.fetchall():
            status = "已完成" if s.is_fired else "待安排"
            print(f"  ID: {s.id}, 名称: {s.session_name}, 状态: {status}")


if __name__ == "__main__":
    asyncio.run(create_sample_data())

from datetime import date, datetime
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import ColdStorageBay, InspectionWindow, StorageStatus


def init_basic_data():
    db = SessionLocal()
    try:
        existing_bays = db.query(ColdStorageBay).count()
        if existing_bays > 0:
            print("基础数据已存在，跳过初始化")
            return
        
        bays_data = [
            {"bay_code": "FREEZE-001", "bay_name": "冷冻区1号仓位", "zone": "冷冻区", "temperature_zone": "冷冻(-18°C以下", "capacity_cubic_meters": 100.0, "status": StorageStatus.AVAILABLE},
            {"bay_code": "FREEZE-002", "bay_name": "冷冻区2号仓位", "zone": "冷冻区", "temperature_zone": "冷冻(-18°C以下)", "capacity_cubic_meters": 100.0, "status": StorageStatus.AVAILABLE},
            {"bay_code": "FREEZE-003", "bay_name": "冷冻区3号仓位", "zone": "冷冻区", "temperature_zone": "冷冻(-18°C以下)", "capacity_cubic_meters": 80.0, "status": StorageStatus.AVAILABLE},
            {"bay_code": "COLD-001", "bay_name": "冷藏区1号仓位", "zone": "冷藏区", "temperature_zone": "冷藏(0-4°C", "capacity_cubic_meters": 100.0, "status": StorageStatus.AVAILABLE},
            {"bay_code": "COLD-002", "bay_name": "冷藏区2号仓位", "zone": "冷藏区", "temperature_zone": "冷藏(0-4°C", "capacity_cubic_meters": 100.0, "status": StorageStatus.AVAILABLE},
            {"bay_code": "COLD-003", "bay_name": "冷藏区3号仓位", "zone": "冷藏区", "temperature_zone": "冷藏(0-4°C)", "capacity_cubic_meters": 80.0, "status": StorageStatus.AVAILABLE},
            {"bay_code": "VEG-001", "bay_name": "恒温区1号仓位", "zone": "恒温区", "temperature_zone": "恒温(10-15°C)", "capacity_cubic_meters": 120.0, "status": StorageStatus.AVAILABLE},
            {"bay_code": "VEG-002", "bay_name": "恒温区2号仓位", "zone": "恒温区", "temperature_zone": "恒温(10-15°C)", "capacity_cubic_meters": 120.0, "status": StorageStatus.AVAILABLE}
        ]
        
        for bay in bays_data:
            db.add(ColdStorageBay(**bay))
        
        windows_data = [
            {"window_code": "INSP-001", "window_name": "1号检测窗口", "capacity_per_hour": 5, "is_active": True},
            {"window_code": "INSP-002", "window_name": "2号检测窗口", "capacity_per_hour": 5, "is_active": True},
            {"window_code": "INSP-003", "window_name": "3号检测窗口", "capacity_per_hour": 8, "is_active": True}
        ]
        
        for window in windows_data:
            db.add(InspectionWindow(**window))
        
        db.commit()
        print("基础数据初始化完成！")
        print(f"已创建 {len(bays_data)} 个仓位")
        print(f"已创建 {len(windows_data)} 个检测窗口")
        
    except Exception as e:
        print(f"初始化失败: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    from app.database import Base, engine
    Base.metadata.create_all(bind=engine)
    init_basic_data()

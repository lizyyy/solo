"""init 子命令：初始化样例数据"""

import click
from ..models import (
    RainGarden, RainfallRecord, PondingRecord, 
    PlantStatus, InspectionSchedule, DataStore
)
from ..utils import (
    load_data_store, save_data_store, get_now_str,
    generate_id, print_header, print_status
)


@click.command("init")
@click.option("--force", "-f", is_flag=True, help="强制覆盖现有数据")
def init_cmd(force):
    """初始化样例数据

    创建雨水花园点位、降雨记录、积水记录、植物状态和巡查安排的样例数据。
    """
    print_header("初始化样例数据")
    
    store = load_data_store()
    
    if store.gardens and not force:
        print_status("数据已存在，使用 --force 参数强制覆盖", "WARNING")
        return
    
    if force:
        store = DataStore()
        print_status("已清除现有数据", "INFO")
    
    garden1 = RainGarden(
        id="garden-001",
        name="阳光花园雨水花园",
        location="阳光社区东南角",
        area=50.5,
        plant_types=["芦苇", "香蒲", "千屈菜"],
        created_at="2024-01-15",
        is_active=True,
        last_inspection="2024-05-10"
    )
    
    garden2 = RainGarden(
        id="garden-002",
        name="绿景小区雨水花园",
        location="绿景小区中心绿地",
        area=80.0,
        plant_types=["鸢尾", "梭鱼草", "再力花"],
        created_at="2024-02-20",
        is_active=True,
        last_inspection="2024-05-08"
    )
    
    garden3 = RainGarden(
        id="garden-003",
        name="和谐广场雨水花园",
        location="和谐广场北侧",
        area=120.0,
        plant_types=["荷花", "睡莲", "菖蒲"],
        created_at="2024-03-10",
        is_active=False,
        last_inspection="2024-04-15"
    )
    
    store.gardens[garden1.id] = garden1
    store.gardens[garden2.id] = garden2
    store.gardens[garden3.id] = garden3
    
    rainfall1 = RainfallRecord(
        id=generate_id("rain-"),
        garden_id="garden-001",
        date="2024-05-05",
        rainfall=35.2,
        source="气象局数据",
        import_time=get_now_str(),
        is_verified=True
    )
    
    rainfall2 = RainfallRecord(
        id=generate_id("rain-"),
        garden_id="garden-002",
        date="2024-05-05",
        rainfall=35.2,
        source="气象局数据",
        import_time=get_now_str(),
        is_verified=True
    )
    
    rainfall3 = RainfallRecord(
        id=generate_id("rain-"),
        garden_id="garden-001",
        date="2024-05-10",
        rainfall=18.5,
        source="志愿者上报",
        import_time=get_now_str(),
        is_verified=False
    )
    
    store.rainfall_records[rainfall1.id] = rainfall1
    store.rainfall_records[rainfall2.id] = rainfall2
    store.rainfall_records[rainfall3.id] = rainfall3
    
    ponding1 = PondingRecord(
        id=generate_id("pond-"),
        garden_id="garden-001",
        date="2024-05-05",
        depth=8.5,
        duration=120.0,
        location="东北角落",
        recorder="张三",
        photo_reference="photo_001.jpg",
        is_matched=True
    )
    
    ponding2 = PondingRecord(
        id=generate_id("pond-"),
        garden_id="garden-002",
        date="2024-05-05",
        depth=5.0,
        duration=60.0,
        location="中心区域",
        recorder="李四",
        photo_reference="photo_002.jpg",
        is_matched=False
    )
    
    ponding3 = PondingRecord(
        id=generate_id("pond-"),
        garden_id="garden-001",
        date="2024-05-10",
        depth=3.0,
        duration=30.0,
        location="边缘区域",
        recorder="王五",
        is_matched=False
    )
    
    store.ponding_records[ponding1.id] = ponding1
    store.ponding_records[ponding2.id] = ponding2
    store.ponding_records[ponding3.id] = ponding3
    
    plant1 = PlantStatus(
        id=generate_id("plant-"),
        garden_id="garden-001",
        date="2024-05-10",
        plant_type="芦苇",
        health_status="良好",
        growth_rate=1.2,
        notes="生长旺盛",
        inspector="张三"
    )
    
    plant2 = PlantStatus(
        id=generate_id("plant-"),
        garden_id="garden-001",
        date="2024-05-10",
        plant_type="香蒲",
        health_status="一般",
        growth_rate=0.8,
        notes="部分叶片发黄",
        inspector="张三"
    )
    
    plant3 = PlantStatus(
        id=generate_id("plant-"),
        garden_id="garden-002",
        date="2024-05-08",
        plant_type="鸢尾",
        health_status="良好",
        growth_rate=1.5,
        notes="花期已过",
        inspector="李四"
    )
    
    store.plant_status[plant1.id] = plant1
    store.plant_status[plant2.id] = plant2
    store.plant_status[plant3.id] = plant3
    
    schedule1 = InspectionSchedule(
        id=generate_id("sch-"),
        garden_id="garden-001",
        scheduled_date="2024-05-15",
        volunteer="张三",
        status="待执行",
        notes="检查植物生长情况"
    )
    
    schedule2 = InspectionSchedule(
        id=generate_id("sch-"),
        garden_id="garden-002",
        scheduled_date="2024-05-12",
        volunteer="李四",
        status="已完成",
        completed_date="2024-05-12",
        notes="完成巡查"
    )
    
    schedule3 = InspectionSchedule(
        id=generate_id("sch-"),
        garden_id="garden-003",
        scheduled_date="2024-05-20",
        volunteer="王五",
        status="已取消",
        notes="花园暂时关闭"
    )
    
    store.inspection_schedules[schedule1.id] = schedule1
    store.inspection_schedules[schedule2.id] = schedule2
    store.inspection_schedules[schedule3.id] = schedule3
    
    save_data_store(store)
    
    print_status(f"已创建 {len(store.gardens)} 个雨水花园点位", "SUCCESS")
    print_status(f"已创建 {len(store.rainfall_records)} 条降雨记录", "SUCCESS")
    print_status(f"已创建 {len(store.ponding_records)} 条积水记录", "SUCCESS")
    print_status(f"已创建 {len(store.plant_status)} 条植物状态记录", "SUCCESS")
    print_status(f"已创建 {len(store.inspection_schedules)} 条巡查安排", "SUCCESS")
    print_status("样例数据初始化完成！", "SUCCESS")

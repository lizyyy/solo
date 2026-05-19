from datetime import datetime, timedelta
from database import init_db, SessionLocal
from models import HazardStatus, HazardLevel
from schemas import (
    HazardCreate, ResponsiblePersonCreate, RectificationCreate,
    RecheckCreate, HazardPhotoCreate, HazardFilter
)
from services import HazardService, BatchOperationService, ExportService


def main():
    print("=" * 60)
    print("隐患闭环管理系统 - 功能演示")
    print("=" * 60)
    
    init_db()
    db = SessionLocal()
    
    try:
        print("\n1. 创建责任人")
        person_repo = db
        from repositories import ResponsiblePersonRepository
        person_repo = ResponsiblePersonRepository(db)
        person = person_repo.create(ResponsiblePersonCreate(
            name="张三",
            phone="13800138000",
            department="安全管理部",
            position="安全主管"
        ))
        print(f"   已创建责任人: {person.name} ({person.department})")
        
        print("\n2. 创建单个隐患")
        hazard_service = HazardService(db)
        hazard = hazard_service.create_hazard(HazardCreate(
            title="消防栓被遮挡",
            description="生产车间A区3号消防栓被货物遮挡",
            location="生产车间A区",
            location_detail="3号消防栓位置",
            level=HazardLevel.HIGH,
            discoverer="安全员小王",
            deadline=datetime.utcnow() + timedelta(days=3),
            department="生产部",
            team="甲班",
            responsible_person_id=person.id,
            photos=[
                HazardPhotoCreate(
                    file_path="/photos/20240115_001.jpg",
                    file_name="消防栓遮挡.jpg",
                    photo_type="discovery",
                    description="现场照片"
                )
            ]
        ), operator="系统管理员")
        print(f"   已创建隐患: {hazard.hazard_code} - {hazard.title}")
        print(f"   当前状态: {hazard.status.value}")
        print(f"   规则检查结果: {len(hazard.rule_check_results)} 条")
        
        print("\n3. 开始整改")
        hazard = hazard_service.start_rectification(hazard.id)
        print(f"   状态更新为: {hazard.status.value}")
        
        print("\n4. 提交整改")
        hazard = hazard_service.submit_rectification(
            hazard.id,
            RectificationCreate(
                rectifier="张三",
                description="已移走遮挡货物",
                measures="1. 将货物移至指定堆放区\n2. 设置警示标识\n3. 通知班组注意保持通道畅通",
                photos=[
                    {"file_path": "/photos/rect_20240115_001.jpg", "file_name": "整改后.jpg", "description": "整改后现场照片"}
                ]
            ),
            operator="张三"
        )
        print(f"   状态更新为: {hazard.status.value}")
        print(f"   整改记录数: {len(hazard.rectifications)}")
        
        print("\n5. 提交复查")
        hazard = hazard_service.submit_recheck(
            hazard.id,
            RecheckCreate(
                rechecker="安全主管",
                result=True,
                description="整改合格，消防通道畅通",
                suggestion="建议每周巡检一次，确保通道持续畅通",
                photos=[
                    {"file_path": "/photos/recheck_20240115_001.jpg", "file_name": "复查.jpg", "description": "复查照片"}
                ]
            ),
            operator="安全主管"
        )
        print(f"   复查记录数: {len(hazard.rechecks)}")
        print(f"   当前状态: {hazard.status.value}")
        
        print("\n6. 批量导入隐患")
        batch_service = BatchOperationService(db)
        import_data = [
            {
                "title": "安全出口指示灯不亮",
                "description": "二楼安全出口指示灯故障",
                "location": "二楼西侧",
                "responsible_person": "李四",
                "level": "medium",
                "department": "维修部",
                "photos": [{"file_path": "/photos/batch1.jpg"}]
            },
            {
                "title": "灭火器压力不足",
                "location": "仓库区",
                "responsible_person": "王五",
                "level": "high",
                "photos": [{"file_path": "/photos/batch2.jpg"}]
            },
            {
                "title": "地面湿滑未警示",
                "location": "食堂门口",
                "responsible_person": "赵六",
            }
        ]
        batch_result = batch_service.import_hazards(import_data, operator="批量导入员")
        print(f"   批次号: {batch_result.batch_no}")
        print(f"   总数: {batch_result.total_count}")
        print(f"   成功: {batch_result.success_count}")
        print(f"   失败: {batch_result.failed_count}")
        print(f"   批次状态: {batch_result.status.value}")
        
        for item in batch_result.items:
            status = "✓" if item.success else "✗"
            code = item.hazard_code or "N/A"
            print(f"     {status} 行{item.row_index}: {code} - {item.error_message or '成功'}")
        
        print("\n7. 筛选查询隐患")
        filter_params = HazardFilter(
            department="生产部",
            level=HazardLevel.HIGH
        )
        hazards = hazard_service.list_hazards(filter_params)
        print(f"   符合条件的隐患数: {len(hazards)}")
        for h in hazards:
            print(f"     - {h.hazard_code}: {h.title} ({h.status.value})")
        
        print("\n8. 统计数据")
        export_service = ExportService(db)
        stats = export_service.get_statistics()
        print(f"   隐患总数: {stats['total']}")
        print(f"   已闭环: {stats['closed']}")
        print(f"   未闭环: {stats['open']}")
        print(f"   闭环率: {stats['closed_rate']}%")
        print("   状态分布:")
        for status, count in stats['status_distribution'].items():
            print(f"     - {status}: {count}")
        
        print("\n9. 导出Excel")
        excel_path = "隐患导出示例.xlsx"
        export_service.export_to_excel(output_path=excel_path)
        print(f"   已导出到: {excel_path}")
        
        print("\n" + "=" * 60)
        print("功能演示完成！")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()

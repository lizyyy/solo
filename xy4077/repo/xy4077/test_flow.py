#!/usr/bin/env python3
"""测试展箱震动温湿度复核员的完整流程"""

import os
import sys
import tempfile
from datetime import datetime
from pathlib import Path

project_root = Path(__file__).parent
src_path = project_root / "src"
sys.path.insert(0, str(src_path))

from exhibit_inspector.models import (
    TransportConfig, ThresholdSettings,
    SensorRecord, RouteBook, RouteNode,
    BoxInfo, PhotoRecord,
    IssueSeverity, SessionMetadata, AuditPackage,
)
from exhibit_inspector.parsers import (
    parse_sensor_csv,
    parse_route_csv,
    parse_box_csv,
    parse_photo_csv,
)
from exhibit_inspector.rules import (
    ShockDetector,
    TempHumidDetector,
    MissingSampleDetector,
    MissingPhotoDetector,
)
from exhibit_inspector.reports import (
    generate_markdown_report,
    export_issues_csv,
    export_json_audit,
)
from exhibit_inspector import __version__


def create_test_sensor_csv(file_path: Path):
    """创建测试用的传感器CSV"""
    csv_content = """时间,箱号,传感器ID,X轴(g),Y轴(g),Z轴(g),温度(°C),湿度(%),设备型号
2024-01-15 08:00:00,EX001,S001,0.05,0.03,0.02,20.0,50.0,MSR165
2024-01-15 08:05:00,EX001,S001,0.04,0.02,0.03,20.2,50.5,MSR165
2024-01-15 08:10:00,EX001,S001,2.5,0.8,1.2,20.1,50.2,MSR165
2024-01-15 08:15:00,EX001,S001,3.2,0.5,0.9,20.3,50.8,MSR165
2024-01-15 08:20:00,EX001,S001,0.06,0.04,0.03,20.0,50.1,MSR165
2024-01-15 08:30:00,EX001,S001,0.05,0.03,0.02,26.0,55.0,MSR165
2024-01-15 08:35:00,EX001,S001,0.04,0.02,0.03,26.5,56.0,MSR165
2024-01-15 08:40:00,EX001,S001,0.03,0.01,0.02,27.0,57.0,MSR165
2024-01-15 08:45:00,EX001,S001,0.05,0.03,0.02,26.8,56.5,MSR165
2024-01-15 08:50:00,EX001,S001,0.04,0.02,0.03,25.0,53.0,MSR165
2024-01-15 09:00:00,EX001,S001,0.05,0.03,0.02,20.0,40.0,MSR165
2024-01-15 09:05:00,EX001,S001,0.04,0.02,0.03,20.2,38.0,MSR165
2024-01-15 09:10:00,EX001,S001,0.03,0.01,0.02,20.1,35.0,MSR165
2024-01-15 09:15:00,EX001,S001,0.05,0.03,0.02,20.0,36.0,MSR165
2024-01-15 09:20:00,EX001,S001,0.04,0.02,0.03,20.1,45.0,MSR165
"""
    file_path.write_text(csv_content, encoding="utf-8")


def create_test_route_csv(file_path: Path):
    """创建测试用的路书CSV"""
    csv_content = """序号,地点,阶段,计划开始时间,计划结束时间,联系人,备注
1,库房,departure,2024-01-15 08:00:00,2024-01-15 08:10:00,张三,准备装载
2,高速公路,transit,2024-01-15 08:10:00,2024-01-15 09:00:00,李四,运输中
3,博物馆,arrival,2024-01-15 09:00:00,2024-01-15 09:30:00,王五,卸载交接
"""
    file_path.write_text(csv_content, encoding="utf-8")


def create_test_box_csv(file_path: Path):
    """创建测试用的展箱清单CSV"""
    csv_content = """箱号,箱名,传感器编号,尺寸,重量(kg),展品,备注
EX001,主展箱,S001,80x60x20,15,《蒙娜丽莎》复制品,重要展品
EX002,副展箱,S002,60x50x15,10,《星空》复制品,次要展品
"""
    file_path.write_text(csv_content, encoding="utf-8")


def create_test_photo_csv(file_path: Path):
    """创建测试用的照片清单CSV"""
    csv_content = """文件名,拍摄时间,箱号,照片类型,拍摄人,备注
EX001_loading_01.jpg,2024-01-15 08:05:00,EX001,loading_photo,张三,装载前
EX001_transit_01.jpg,2024-01-15 08:30:00,EX001,transit_photo,李四,运输中
"""
    file_path.write_text(csv_content, encoding="utf-8")


def test_full_flow():
    """测试完整流程"""
    print("=" * 60)
    print("展箱震动温湿度复核员 - 完整流程测试")
    print("=" * 60)
    
    with tempfile.TemporaryDirectory(prefix="exhibit_test_") as temp_dir:
        temp_path = Path(temp_dir)
        
        print("\n1. 初始化配置...")
        now = datetime.now().isoformat()
        config = TransportConfig(
            shipment_id="TEST_20240115",
            shipment_name="测试运输任务",
            origin="始发博物馆",
            destination="测试博物馆",
            carrier="测试运输公司",
            transport_mode="road",
            thresholds=ThresholdSettings(
                shock_threshold_g=1.5,
                temp_max_celsius=25.0,
                temp_min_celsius=15.0,
                humidity_max_pct=60.0,
                humidity_min_pct=40.0,
                temp_duration_minutes=5.0,
                humidity_duration_minutes=5.0,
            ),
            created_at=now,
            updated_at=now,
        )
        print(f"   运输ID: {config.shipment_id}")
        print(f"   冲击阈值: {config.thresholds.shock_threshold_g}g")
        print(f"   温度范围: {config.thresholds.temp_min_celsius}°C - {config.thresholds.temp_max_celsius}°C")
        print(f"   湿度范围: {config.thresholds.humidity_min_pct}% - {config.thresholds.humidity_max_pct}%")
        
        print("\n2. 创建测试数据...")
        sensor_csv = temp_path / "sensor_data.csv"
        route_csv = temp_path / "route_book.csv"
        box_csv = temp_path / "box_list.csv"
        photo_csv = temp_path / "photo_list.csv"
        
        create_test_sensor_csv(sensor_csv)
        create_test_route_csv(route_csv)
        create_test_box_csv(box_csv)
        create_test_photo_csv(photo_csv)
        print(f"   传感器数据: {sensor_csv}")
        print(f"   路书数据: {route_csv}")
        print(f"   展箱清单: {box_csv}")
        print(f"   照片清单: {photo_csv}")
        
        print("\n3. 解析传感器数据...")
        sensor_result = parse_sensor_csv(sensor_csv)
        print(f"   总行数: {sensor_result.total_rows}")
        print(f"   有效行数: {sensor_result.valid_rows}")
        print(f"   错误数: {len(sensor_result.errors)}")
        
        if sensor_result.valid_rows > 0:
            first_record = sensor_result.data[0]
            print(f"\n   第一条记录:")
            print(f"     时间: {first_record.timestamp}")
            print(f"     箱号: {first_record.box_id}")
            print(f"     传感器: {first_record.sensor_id}")
            print(f"     X轴加速度: {first_record.x_accel_g}g")
            print(f"     Y轴加速度: {first_record.y_accel_g}g")
            print(f"     Z轴加速度: {first_record.z_accel_g}g")
            print(f"     温度: {first_record.temperature_celsius}°C")
            print(f"     湿度: {first_record.humidity_pct}%")
        
        print("\n4. 解析路书...")
        route_result = parse_route_csv(route_csv, "TEST_20240115")
        print(f"   总行数: {route_result.total_rows}")
        print(f"   有效行数: {route_result.valid_rows}")
        print(f"   错误数: {len(route_result.errors)}")
        for error in route_result.errors:
            print(f"     错误: {error.message}")
        
        route_book = None
        if route_result.data:
            route_book = route_result.data[0]
            print(f"   路书ID: {route_book.route_id}")
            print(f"   节点数量: {len(route_book.nodes)}")
            for node in route_book.nodes:
                print(f"     - [{node.phase.value}] {node.location} ({node.planned_start_time} - {node.planned_end_time})")
        
        print("\n5. 解析展箱清单...")
        box_result = parse_box_csv(box_csv, "TEST_20240115")
        print(f"   有效箱数: {box_result.valid_rows}")
        for box in box_result.data:
            print(f"     - {box.box_id}: {box.box_name} (展品: {', '.join(box.contents)})")
        
        print("\n6. 解析照片清单...")
        photo_result = parse_photo_csv(photo_csv)
        print(f"   有效照片数: {photo_result.valid_rows}")
        for photo in photo_result.data:
            print(f"     - {photo.filename}: {photo.photo_type}")
        
        print("\n" + "=" * 60)
        print("7. 规则引擎检测...")
        print("=" * 60)
        
        all_issues = []
        
        print("\n   7.1 冲击峰值检测...")
        shock_detector = ShockDetector(config.thresholds)
        shock_result = shock_detector.execute(sensor_result.data)
        print(f"   检测到冲击峰值问题: {len(shock_result.issues)}")
        for issue in shock_result.issues:
            print(f"     - [{issue.severity.value}] {issue.description}")
        all_issues.extend(shock_result.issues)
        
        print("\n   7.2 温湿度超限检测...")
        temp_humid_detector = TempHumidDetector(config.thresholds)
        temp_humid_result = temp_humid_detector.execute(sensor_result.data)
        print(f"   检测到温湿度问题: {len(temp_humid_result.issues)}")
        for issue in temp_humid_result.issues:
            print(f"     - [{issue.severity.value}] {issue.description}")
        all_issues.extend(temp_humid_result.issues)
        
        print("\n   7.3 缺采样检测...")
        missing_sample_detector = MissingSampleDetector(
            expected_interval_minutes=5.0,
            max_gap_minutes=15.0,
        )
        sample_result = missing_sample_detector.execute(sensor_result.data)
        print(f"   检测到缺采样问题: {len(sample_result.issues)}")
        for issue in sample_result.issues:
            print(f"     - [{issue.severity.value}] {issue.description}")
        all_issues.extend(sample_result.issues)
        
        if route_book and photo_result.data:
            print("\n   7.4 照片缺失检测...")
            missing_photo_detector = MissingPhotoDetector(
                required_photo_types=["loading_photo", "unloading_photo", "seal_photo"]
            )
            photo_issues_result = missing_photo_detector.execute({
                "photos": photo_result.data,
                "route_book": route_book,
            })
            print(f"   检测到照片缺失问题: {len(photo_issues_result.issues)}")
            for issue in photo_issues_result.issues:
                print(f"     - [{issue.severity.value}] {issue.description}")
            all_issues.extend(photo_issues_result.issues)
        
        print("\n" + "=" * 60)
        print("8. 生成报告...")
        print("=" * 60)
        
        output_dir = temp_path / "output"
        output_dir.mkdir(exist_ok=True)
        
        metadata = SessionMetadata(
            session_id="TEST_SESSION_001",
            shipment_id=config.shipment_id,
            created_at=now,
            updated_at=now,
            tool_version=__version__,
            operator="测试用户",
        )
        
        audit = AuditPackage(
            metadata=metadata,
            config=config,
            route_book=route_book,
            boxes=box_result.data,
            photos=photo_result.data,
            sensor_record_count=len(sensor_result.data),
            issues=all_issues,
            reviews=[],
        )
        
        markdown_path = output_dir / "review_report.md"
        generate_markdown_report(audit, str(markdown_path))
        print(f"   Markdown报告: {markdown_path}")
        
        csv_path = output_dir / "issues.csv"
        export_issues_csv(audit, str(csv_path))
        print(f"   CSV问题清单: {csv_path}")
        
        json_path = output_dir / "audit_package.json"
        export_json_audit(audit, str(json_path))
        print(f"   JSON审计包: {json_path}")
        
        print("\n" + "=" * 60)
        print("报告内容预览:")
        print("=" * 60)
        
        with open(markdown_path, "r", encoding="utf-8") as f:
            content = f.read()
            lines = content.split("\n")
            for line in lines[:100]:
                print(f"   {line}")
        
        print("\n" + "=" * 60)
        print("测试完成!")
        print("=" * 60)
        print(f"\n测试目录: {temp_path}")
        print(f"输出目录: {output_dir}")
        
        return True


if __name__ == "__main__":
    try:
        success = test_full_flow()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

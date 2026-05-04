import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime
from models import (
    Device, Schedule, Detour, Template, Release,
    ReleaseStatus, ValidationIssueType, ValidationSeverity,
    generate_id
)
from parsers import CSVParser, JSONParser
from validators import ReleaseValidator
from exporters import MarkdownExporter, JSONAuditExporter
from storage import release_store

def test_models():
    print("=== 测试数据模型 ===")
    
    device = Device(
        device_id="EP001",
        station_name="阳光花园东门",
        station_id="S001",
        is_online=True,
        template_id="template_standard"
    )
    print(f"设备模型: {device.to_dict()}")
    
    schedule = Schedule(
        schedule_id=generate_id(),
        route_name="1路公交",
        route_id="R001",
        station_name="阳光花园东门",
        station_id="S001",
        departure_time="06:30",
        direction="往火车站"
    )
    print(f"时刻表模型: {schedule.to_dict()}")
    
    detour = Detour(
        detour_id="DT001",
        route_id="R001",
        route_name="1路公交",
        effective_from=datetime.now(),
        effective_to=datetime.now(),
        affected_stations=["阳光花园东门"],
        detour_stations=["临时站A"],
        reason="道路施工"
    )
    print(f"绕行模型: {detour.to_dict()}")
    
    template = Template(
        template_id="template_standard",
        template_name="标准模板",
        required_fields=["route_name", "station_name", "departure_time", "direction"],
        description="标准时刻表模板"
    )
    print(f"模板模型: {template.to_dict()}")
    
    print("模型测试通过!\n")
    return True

def test_parsers():
    print("=== 测试解析器 ===")
    
    devices_csv = """device_id,station_name,station_id,is_online,template_id
EP001,阳光花园东门,S001,true,template_standard
EP002,人民广场南,S002,false,template_standard
"""
    devices = CSVParser.parse_devices(devices_csv)
    print(f"解析设备CSV: {len(devices)} 台设备")
    for d in devices:
        print(f"  - {d.device_id}: {d.station_name} (在线: {d.is_online})")
    
    schedules_csv = """route_name,route_id,station_name,station_id,departure_time,direction
1路公交,R001,阳光花园东门,S001,06:30,往火车站
1路公交,R001,阳光花园东门,S001,07:00,往火车站
"""
    schedules = CSVParser.parse_schedules(schedules_csv)
    print(f"解析时刻表CSV: {len(schedules)} 条记录")
    for s in schedules:
        print(f"  - {s.route_name} {s.departure_time}")
    
    detours_json = """{
        "detours": [
            {
                "detour_id": "DT001",
                "route_id": "R001",
                "route_name": "1路公交",
                "effective_from": "2026-05-01T00:00:00",
                "effective_to": "2026-05-10T23:59:59",
                "affected_stations": ["阳光花园东门"],
                "detour_stations": ["临时站A"],
                "reason": "道路施工"
            }
        ]
    }"""
    detours = JSONParser.parse_detours(detours_json)
    print(f"解析绕行JSON: {len(detours)} 条绕行")
    for d in detours:
        print(f"  - {d.route_name}: {d.reason}")
    
    templates_json = """{
        "templates": [
            {
                "template_id": "template_standard",
                "template_name": "标准模板",
                "required_fields": ["route_name", "station_name", "departure_time", "direction"],
                "description": "标准模板"
            }
        ]
    }"""
    templates, _ = JSONParser.parse_template_package(templates_json)
    print(f"解析模板JSON: {len(templates)} 个模板")
    for t in templates:
        print(f"  - {t.template_name}: 必填字段 {t.required_fields}")
    
    print("解析器测试通过!\n")
    return True

def test_validators():
    print("=== 测试校验器 ===")
    
    devices = [
        Device(device_id="EP001", station_name="阳光花园东门", station_id="S001", is_online=True, template_id="template_standard"),
        Device(device_id="EP002", station_name="人民广场南", station_id="S002", is_online=False, template_id="template_standard"),
        Device(device_id="EP003", station_name="科技园北门", station_id="S003", is_online=False, template_id="template_detour"),
    ]
    
    schedules = [
        Schedule(schedule_id="s1", route_name="1路公交", route_id="R001", station_name="阳光花园东门", station_id="S001", departure_time="06:30", direction="往火车站", device_id="EP001"),
        Schedule(schedule_id="s2", route_name="1路公交", route_id="R001", station_name="阳光花园东门", station_id="S001", departure_time="06:30", direction="往火车站", device_id="EP001"),
        Schedule(schedule_id="s3", route_name="1路公交", route_id="R001", station_name="科技园北门", station_id="S003", departure_time="07:00", direction="往火车站", device_id="EP003"),
    ]
    
    detours = [
        Detour(
            detour_id="DT001",
            route_id="R001",
            route_name="1路公交",
            effective_from=datetime.now(),
            effective_to=datetime.now(),
            affected_stations=["阳光花园东门"],
            detour_stations=["临时站A"],
            reason="道路施工"
        )
    ]
    
    templates = [
        Template(
            template_id="template_standard",
            template_name="标准模板",
            required_fields=["route_name", "station_name", "departure_time", "direction"],
            description="标准模板"
        ),
        Template(
            template_id="template_detour",
            template_name="绕行模板",
            required_fields=["route_name", "station_name", "departure_time", "direction", "detour_info"],
            description="绕行模板"
        )
    ]
    
    release = Release(
        release_id="test_release",
        release_name="测试发布批次",
        created_at=datetime.now(),
        created_by="测试用户",
        status=ReleaseStatus.DRAFT,
        devices=devices,
        schedules=schedules,
        detours=detours,
        templates=templates
    )
    
    issues = ReleaseValidator.validate_all(release)
    
    print(f"校验完成，共发现 {len(issues)} 个问题:")
    
    summary = ReleaseValidator.get_issue_summary(issues)
    print(f"  错误: {summary['errors']}, 警告: {summary['warnings']}, 可审批: {summary['can_approve']}")
    
    for issue in issues:
        icon = "🔴" if issue.severity == ValidationSeverity.ERROR else "🟡"
        print(f"  {icon} [{issue.issue_type.value}] {issue.message}")
        if issue.affected_devices:
            print(f"     影响设备: {issue.affected_devices}")
    
    print(f"\n生成发布清单: {len(release.release_items)} 条")
    for item in release.release_items:
        detour_flag = "[绕行]" if item.has_detour else ""
        print(f"  - {item.device_id}: {item.route_name} {item.schedule_time} {detour_flag}")
    
    print("校验器测试通过!\n")
    return True

def test_exporters():
    print("=== 测试导出器 ===")
    
    devices = [
        Device(device_id="EP001", station_name="阳光花园东门", station_id="S001", is_online=True, template_id="template_standard"),
        Device(device_id="EP002", station_name="人民广场南", station_id="S002", is_online=False, template_id="template_standard"),
    ]
    
    schedules = [
        Schedule(schedule_id="s1", route_name="1路公交", route_id="R001", station_name="阳光花园东门", station_id="S001", departure_time="06:30", direction="往火车站", device_id="EP001"),
    ]
    
    templates = [
        Template(
            template_id="template_standard",
            template_name="标准模板",
            required_fields=["route_name", "station_name", "departure_time", "direction"],
            description="标准模板"
        )
    ]
    
    release = Release(
        release_id="test_export",
        release_name="测试导出批次",
        created_at=datetime.now(),
        created_by="测试用户",
        status=ReleaseStatus.DRAFT,
        devices=devices,
        schedules=schedules,
        templates=templates
    )
    
    release.release_items = ReleaseValidator.generate_release_items(devices, schedules, [])
    
    markdown = MarkdownExporter.export_handover_note(release)
    print("Markdown交接单导出成功!")
    print(f"内容预览 (前500字符):\n{markdown[:500]}...")
    
    audit = JSONAuditExporter.export_audit_package(release)
    print(f"\nJSON审计包导出成功!")
    print(f"审计信息: {audit['audit_info']}")
    print(f"摘要: {audit['summary']}")
    
    print("导出器测试通过!\n")
    return True

def test_storage():
    print("=== 测试存储 ===")
    
    release = release_store.create_release(
        release_name="存储测试批次",
        created_by="测试用户"
    )
    print(f"创建发布批次: {release.release_id}")
    
    loaded = release_store.load_release(release.release_id)
    if loaded:
        print(f"加载发布批次成功: {loaded.release_name}")
    else:
        print("加载失败!")
        return False
    
    releases = release_store.load_all_releases()
    print(f"所有发布批次数量: {len(releases)}")
    
    deleted = release_store.delete_release(release.release_id)
    print(f"删除发布批次: {'成功' if deleted else '失败'}")
    
    print("存储测试通过!\n")
    return True

def main():
    print("=" * 50)
    print("开始测试公交电子墨水屏发布校验服务")
    print("=" * 50 + "\n")
    
    tests = [
        ("数据模型", test_models),
        ("解析器", test_parsers),
        ("校验器", test_validators),
        ("导出器", test_exporters),
        ("存储", test_storage),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            success = test_func()
            results.append((name, success))
        except Exception as e:
            print(f"\n❌ {name}测试失败: {e}")
            import traceback
            traceback.print_exc()
            results.append((name, False))
    
    print("=" * 50)
    print("测试结果汇总")
    print("=" * 50)
    
    all_passed = True
    for name, success in results:
        status = "✅ 通过" if success else "❌ 失败"
        print(f"{name}: {status}")
        if not success:
            all_passed = False
    
    print("=" * 50)
    if all_passed:
        print("🎉 所有测试通过! 服务可以正常使用。")
        print("\n使用方法:")
        print("  1. 启动服务: python app.py")
        print("  2. 访问: http://localhost:5000/api/health")
        print("  3. 查看 README.md 获取完整API文档")
    else:
        print("⚠️ 部分测试失败，请检查代码。")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    exit(main())

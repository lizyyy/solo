"""小而真的演示数据 - 方便园区运维小陶给新人讲流程"""
from .models import LayoutProject, Handler
from .data_import import import_safety_radius_json, import_routes_json
from .origin_manager import set_coordinate_origin
from .route_calculator import detect_route_issues, update_route_manual_length
from .workflow import manual_fix_issue, rerun_issue


def create_demo_project() -> LayoutProject:
    """
    创建演示项目
    包含：
    - 安全半径表（5个危化品柜）
    - 坐标原点说明
    - 3条路线（其中1条是补录的，故意不重算）
    - 一次人工修正
    - 一次重跑
    """
    project = LayoutProject(project_id="DEMO-001", project_name="实验室危化品柜布局")

    safety_radius_data = [
        {
            "cabinet_id": "C-001",
            "cabinet_name": "易燃品存储柜",
            "x": 5.0, "y": 5.0,
            "safety_radius": 3.0,
            "chemical_type": "易燃液体",
            "hazard_level": "高"
        },
        {
            "cabinet_id": "C-002",
            "cabinet_name": "氧化剂柜",
            "x": 12.0, "y": 5.0,
            "safety_radius": 2.5,
            "chemical_type": "氧化性物质",
            "hazard_level": "高"
        },
        {
            "cabinet_id": "C-003",
            "cabinet_name": "腐蚀品柜",
            "x": 19.0, "y": 5.0,
            "safety_radius": 2.0,
            "chemical_type": "腐蚀性物质",
            "hazard_level": "中等"
        },
        {
            "cabinet_id": "C-004",
            "cabinet_name": "毒性品柜",
            "x": 5.0, "y": 12.0,
            "safety_radius": 3.5,
            "chemical_type": "毒性物质",
            "hazard_level": "高"
        },
        {
            "cabinet_id": "C-005",
            "cabinet_name": "压缩气体柜",
            "x": 19.0, "y": 12.0,
            "safety_radius": 4.0,
            "chemical_type": "压缩气体",
            "hazard_level": "高"
        }
    ]

    import_safety_radius_json(safety_radius_data, project)

    set_coordinate_origin(
        project=project,
        origin_point=(0.0, 0.0),
        description="以实验室西南墙角为坐标原点，X轴向东，Y轴向北，使用全站仪校准，误差±0.02米。基准点编号LAB-2024-ORIGIN-001",
        calibration_date="2024-01-15",
        calibrated_by="园区运维小陶",
        notes="本坐标系统适用于本次危化品柜布局评估，所有路线测量均基于此原点。如有坐标变更需重新校准。"
    )

    routes_data = [
        {
            "route_id": "R-001",
            "route_name": "主疏散通道",
            "start_x": 2.0, "start_y": 8.5,
            "end_x": 22.0, "end_y": 8.5,
            "via_points": [],
            "calculated_length": 20.0,
            "manual_input_length": None,
            "is_supplementary": False
        },
        {
            "route_id": "R-002",
            "route_name": "北侧应急通道",
            "start_x": 2.0, "start_y": 15.0,
            "end_x": 22.0, "end_y": 15.0,
            "via_points": [(12.0, 15.0)],
            "calculated_length": 20.0,
            "manual_input_length": None,
            "is_supplementary": False
        },
        {
            "route_id": "R-003",
            "route_name": "C-004到安全出口补录路线",
            "start_x": 5.0, "start_y": 12.0,
            "end_x": 2.0, "end_y": 8.5,
            "via_points": [(3.5, 10.0)],
            "calculated_length": None,
            "manual_input_length": 5.8,
            "is_supplementary": True
        }
    ]

    import_routes_json(routes_data, project)

    detect_route_issues(project)

    if project.issues:
        first_issue = project.issues[0]
        manual_fix_issue(
            project=project,
            issue_id=first_issue.issue_id,
            fix_notes="已核对现场测量记录，人工录入值5.8米为现场实际步测值。坐标原点说明已确认无误，下一步重跑系统计算后请展陈客户复核。",
            operator=Handler.PARK_OPS_XT,
            corrected_value=5.8
        )

        rerun_issue(project, first_issue.issue_id, Handler.PARK_OPS_XT)

    project.add_log(
        operator=Handler.SYSTEM,
        action="演示数据初始化",
        details="DEMO项目创建完成，包含5个危化品柜、3条路线、1个补录问题。流程：导入→检测→人工修正→重跑→待客户复核"
    )

    return project


def get_demo_process_steps() -> list:
    """获取演示流程步骤说明 - 方便园区运维小陶给新人讲流程"""
    return [
        {
            "step": 1,
            "title": "安全半径表第一次导入",
            "description": "导入5个危化品柜的位置、安全半径、化学品类型等数据",
            "actor": "系统",
            "key_output": "生成危化品柜布局图"
        },
        {
            "step": 2,
            "title": "园区运维小陶补看坐标原点说明",
            "description": "确认坐标原点校准记录、测量基准、影响范围说明",
            "actor": "园区运维小陶",
            "key_output": "确认坐标系统有效性"
        },
        {
            "step": 3,
            "title": "导入路线数据（含补录）",
            "description": "导入3条路线，其中R-003是补录路线，只填了人工录入长度，没触发系统重算",
            "actor": "系统",
            "key_output": "路线数据入库"
        },
        {
            "step": 4,
            "title": "检测到补录路线未重新计算长度",
            "description": "系统自动检测到R-003是补录但计算长度为空，创建问题记录",
            "actor": "系统",
            "key_output": "问题ISS-001生成，状态：待展陈客户复核"
        },
        {
            "step": 5,
            "title": "园区运维小陶人工修正",
            "description": "小陶核对测量记录，确认人工录入值有效，填写修正说明",
            "actor": "园区运维小陶",
            "key_output": "问题状态变为：已人工修正"
        },
        {
            "step": 6,
            "title": "重跑计算",
            "description": "系统重新计算R-003路线长度，但不自动标记为已解决",
            "actor": "系统",
            "key_output": "问题状态变为：已重跑，仍需展陈客户复核"
        },
        {
            "step": 7,
            "title": "导出截图更新",
            "description": "导出最新的布局分析报告，截图中说明问题原因、缺什么材料、下一步找谁",
            "actor": "系统",
            "key_output": "带标注的分析报告截图"
        },
        {
            "step": 8,
            "title": "展陈客户复核",
            "description": "展陈客户确认重跑结果，通过后问题才算解决",
            "actor": "展陈客户",
            "key_output": "问题最终闭环"
        }
    ]


def get_demo_csv_samples(output_dir: str) -> dict:
    """生成演示用的CSV样本文件"""
    import os
    import csv

    os.makedirs(output_dir, exist_ok=True)

    safety_file = os.path.join(output_dir, "demo_safety_radius.csv")
    with open(safety_file, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerow(['柜号', '柜名', 'X坐标', 'Y坐标', '安全半径', '化学品类型', '危险等级'])
        writer.writerow(['C-001', '易燃品存储柜', '5.0', '5.0', '3.0', '易燃液体', '高'])
        writer.writerow(['C-002', '氧化剂柜', '12.0', '5.0', '2.5', '氧化性物质', '高'])
        writer.writerow(['C-003', '腐蚀品柜', '19.0', '5.0', '2.0', '腐蚀性物质', '中等'])
        writer.writerow(['C-004', '毒性品柜', '5.0', '12.0', '3.5', '毒性物质', '高'])
        writer.writerow(['C-005', '压缩气体柜', '19.0', '12.0', '4.0', '压缩气体', '高'])

    routes_file = os.path.join(output_dir, "demo_routes.csv")
    with open(routes_file, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerow(['路线ID', '路线名称', '起点X', '起点Y', '终点X', '终点Y', '途经点', '计算长度', '人工录入长度', '是否补录'])
        writer.writerow(['R-001', '主疏散通道', '2.0', '8.5', '22.0', '8.5', '', '20.0', '', '否'])
        writer.writerow(['R-002', '北侧应急通道', '2.0', '15.0', '22.0', '15.0', '12.0,15.0', '20.0', '', '否'])
        writer.writerow(['R-003', 'C-004到安全出口补录路线', '5.0', '12.0', '2.0', '8.5', '3.5,10.0', '', '5.8', '是'])

    return {
        "safety_radius_csv": safety_file,
        "routes_csv": routes_file
    }

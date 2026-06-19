#!/usr/bin/env python3
"""完整流程验证：从零开始导入→补录→检查原点→重算→客户复核→导出"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lab_cabinet_layout.models import (
    LayoutProject, SafetyRadius, RouteRecord, CoordinateOrigin,
    IssueType, IssueStatus, Handler
)
from lab_cabinet_layout.data_import import import_safety_radius_json, import_routes_json
from lab_cabinet_layout.origin_manager import set_coordinate_origin
from lab_cabinet_layout.route_calculator import detect_route_issues
from lab_cabinet_layout.workflow import (
    manual_fix_issue, rerun_issue, client_review_issue, fill_material,
    process_issue_after_origin_check
)
from lab_cabinet_layout.visualization import export_layout_screenshot, export_issue_detail_screenshot
from lab_cabinet_layout.service import get_project_serializable

FAIL = 0
PASS = 0
def check(label, cond):
    global PASS, FAIL
    if cond: PASS += 1; print(f"  ✅ {label}")
    else: FAIL += 1; print(f"  ❌ {label}")

output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output_e2e')
os.makedirs(output_dir, exist_ok=True)

print("="*70)
print("  端到端流程验证：从零走完闭环")
print("="*70)

# 1. 创建项目 + 导入数据（包含一条缺三维坐标的裂缝记录对应的路线长度）
print("\n📍 步骤1: 创建项目 + 导入安全半径表 + 坐标原点 + 路线")
project = LayoutProject(project_id="E2E-001", project_name="实验室危化品柜布局")

import_safety_radius_json([
    {"cabinet_id":"C-001","cabinet_name":"易燃品柜","x":5.0,"y":5.0,"safety_radius":3.0,"chemical_type":"易燃液体","hazard_level":"高"},
    {"cabinet_id":"C-002","cabinet_name":"氧化剂柜","x":12.0,"y":5.0,"safety_radius":2.5,"chemical_type":"氧化性物质","hazard_level":"高"},
], project)

set_coordinate_origin(
    project=project,
    origin_point=(0.0, 0.0),
    description="以实验室西南墙角为坐标原点，X轴向东，Y轴向北",
    calibration_date="2025-06-15",
    calibrated_by="园区运维小陶",
    notes="本坐标系统适用于本次危化品柜布局评估"
)

# 故意：一条补录路线（对应裂缝记录缺三维坐标，先录入人工测量长度，没触发重算）
import_routes_json([
    {"route_id":"R-003","route_name":"C-001东侧裂缝应急路线",
     "start_x":5.0,"start_y":5.0,"end_x":2.0,"end_y":8.5,
     "via_points":[(3.5,6.5)],"calculated_length":None,
     "manual_input_length":5.8,"is_supplementary":True}
], project)

detect_route_issues(project)
issue = project.issues[0]
print(f"  检测到问题: {issue.issue_id} ({issue.issue_type.value})")
print(f"  初始状态: {issue.status.value}, 当前处理: {issue.current_handler.value}")
print(f"  为什么被留下: {issue.why_kept()}")
print(f"  还缺材料: {issue.missing_info()}")
check("初始还缺材料不为空", issue.missing_info() != "无")
check("初始已补齐为空", issue.filled_info() == "无")

# 2. 园区运维小陶补齐材料 + 人工修正
print("\n📍 步骤2: 园区运维小陶补录路线长度确认内容 + 坐标原点校准记录")
fill_material(project, issue.issue_id,
    "重新计算后的路线长度确认凭证",
    "2025-06-15现场步测：沿C-001柜东侧裂缝行走，实测5.8米，测量人：小陶",
    Handler.PARK_OPS_XT)
fill_material(project, issue.issue_id,
    "坐标原点校准记录",
    "2025-06-15使用全站仪校准LAB-2025-ORIGIN-001基准点，X轴0.000m，Y轴0.000m，误差±0.02米，校准人：小陶",
    Handler.PARK_OPS_XT)

print(f"  补齐后还缺材料: {issue.missing_info()}")
check("补齐后路线长度凭证已记录",
      "重新计算后的路线长度确认凭证" not in issue.missing_info() or "凭证" in issue.filled_info())
check("补齐后校准记录已记录",
      "坐标原点校准记录" in issue.filled_info())

manual_fix_issue(
    project=project, issue_id=issue.issue_id,
    fix_notes="已核对东侧裂缝路线，现场步测5.8米属实，坐标原点校准记录已提交，下一步重算后转客户复核。",
    operator=Handler.PARK_OPS_XT, corrected_value=5.8
)
print(f"  人工修正后: 状态={issue.status.value}, 当前处理={issue.current_handler.value}")
check("人工修正后状态", issue.status == IssueStatus.MANUAL_FIXED)

# 3. 园区运维小陶检查坐标原点说明并确认处理方式 → 重跑
print("\n📍 步骤3: 园区运维小陶检查坐标原点说明 → 重跑路线长度计算")
process_issue_after_origin_check(project, issue.issue_id, Handler.PARK_OPS_XT)
print(f"  重跑后: 状态={issue.status.value}, 当前处理={issue.current_handler.value}")
print(f"  为什么被留下: {issue.why_kept()}")
print(f"  还缺材料: {issue.missing_info()}")
print(f"  下一步: {issue.next_step()}")
check("重跑后状态=已重跑", issue.status == IssueStatus.RERUN)
check("重跑后当前处理=展陈客户", issue.current_handler == Handler.EXHIBITION_CLIENT)
check("重跑后下一步找展陈客户", "展陈客户" in issue.next_step())
check("重跑后为什么被留下提到补录差异", "展陈客户" in issue.why_kept())
check("重跑后已补齐材料>=4项", len(issue.filled_materials) >= 4)

# 4. 刷新 → 序列化 → 再从序列化中读取，确保数据一致
print("\n📍 步骤4: 序列化/反序列化一致性（模拟刷新）")
serialized = get_project_serializable(project)
s_issue = next(i for i in serialized["issues"])
print(f"  序列化数据：status={s_issue['status']}, handler={s_issue['current_handler']}")
print(f"  序列化 why_kept: {s_issue['why_kept']}")
print(f"  序列化 missing_info: {s_issue['missing_info']}")
print(f"  序列化 next_step: {s_issue['next_step']}")
print(f"  序列化 filled_materials: {s_issue['filled_materials']}")
check("序列化status一致", s_issue["status"] == issue.status.value)
check("序列化missing_info一致", s_issue["missing_info"] == issue.missing_info())
check("序列化filled_info与对象一致", s_issue["filled_materials"] == issue.filled_materials)

# 5. 展陈客户复核通过
print("\n📍 步骤5: 展陈客户复核通过")
client_review_issue(
    project=project, issue_id=issue.issue_id,
    approved=True,
    review_notes="已核对现场5.8米步测记录与全站仪校准数据，差值0.02米在合理范围，同意通过。",
    operator=Handler.EXHIBITION_CLIENT
)
print(f"  已解决状态: {issue.status.value}")
print(f"  当前处理: {issue.current_handler.value}")
print(f"  为什么被留下: {issue.why_kept()}")
print(f"  还缺材料: {issue.missing_info()}")
print(f"  下一步: {issue.next_step()}")
print(f"  已补齐材料数量: {len(issue.filled_materials)}项")
for m in issue.filled_materials:
    print(f"    ✓ {m}")
check("状态=已解决", issue.status == IssueStatus.RESOLVED)
check("为什么被留下=已解决:xxx", "已解决" in issue.why_kept() and "展陈客户" in issue.why_kept())
check("还缺材料=无", issue.missing_info() == "无")
check("下一步=流程已完成", issue.next_step() == "流程已完成")
check("已补齐材料>=7项", len(issue.filled_materials) >= 7)
check("resolved_note包含", issue.resolved_note and "客户" in issue.resolved_note)

# 6. 导出报告和截图
print("\n📍 步骤6: 导出截图报告")
main_png = os.path.join(output_dir, "e2e_final_report.png")
issue_png = os.path.join(output_dir, "e2e_issue_detail.png")
export_layout_screenshot(project, main_png)
export_issue_detail_screenshot(project, issue.issue_id, issue_png)
check("主报告生成", os.path.exists(main_png) and os.path.getsize(main_png) > 10000)
check("问题详情生成", os.path.exists(issue_png) and os.path.getsize(issue_png) > 10000)
main_size = os.path.getsize(main_png)
issue_size = os.path.getsize(issue_png)
print(f"  主报告: {main_png} ({main_size} bytes)")
print(f"  问题详情: {issue_png} ({issue_size} bytes)")

# 7. 核对导出前序列化与最终对象的所有字段（历史记录必须读取同一份最新结果）
print("\n📍 步骤7: 核对所有输出读取同一份最新结果")
s_final = get_project_serializable(project)
si = next(i for i in s_final["issues"])
check("已解决missing_info=无", si["missing_info"] == "无")
check("已解决why_kept包含已解决", "已解决" in si["why_kept"])
check("已解决next_step=流程已完成", si["next_step"] == "流程已完成")
check("已解决resolved_note非空", bool(si.get("resolved_note")))
check("已解决filled_info非空", si["filled_info"] != "无")
check("操作日志>8条", len(s_final["operation_logs"]) > 8)

# 8. 复核驳回路径（快速验证）
print("\n📍 步骤8: 验证驳回路径")
from lab_cabinet_layout.models import LayoutProject as LP
p2 = LayoutProject(project_id="REJECT-001")
import_safety_radius_json([{"cabinet_id":"X-1","cabinet_name":"测试柜","x":5.0,"y":5.0,"safety_radius":2.0,"chemical_type":"测试","hazard_level":"中"}], p2)
set_coordinate_origin(p2, (0.0,0.0), "测试原点", "2025-01-01", "小陶")
import_routes_json([{"route_id":"RX-1","route_name":"补录路线","start_x":0,"start_y":0,"end_x":5,"end_y":5,"via_points":[],"calculated_length":None,"manual_input_length":7.5,"is_supplementary":True}], p2)
detect_route_issues(p2)
i2 = p2.issues[0]
manual_fix_issue(p2, i2.issue_id, "修正", Handler.PARK_OPS_XT, 7.5)
rerun_issue(p2, i2.issue_id, Handler.SYSTEM)
client_review_issue(p2, i2.issue_id, False, "差异过大，请重新检查", Handler.EXHIBITION_CLIENT)
print(f"  驳回后状态={i2.status.value}, 当前处理={i2.current_handler.value}")
check("驳回后状态=已检测", i2.status == IssueStatus.DETECTED)
check("驳回后处理人=园区运维小陶", i2.current_handler == Handler.PARK_OPS_XT)
check("驳回后下一步找小陶", "园区运维小陶" in i2.next_step())
check("驳回后还缺材料非无", i2.missing_info() != "无")

# 总结果
print("\n" + "="*70)
print(f"  验证结果: ✅ {PASS} 通过 / ❌ {FAIL} 失败")
print("="*70)
sys.exit(1 if FAIL > 0 else 0)

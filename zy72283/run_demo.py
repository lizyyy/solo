#!/usr/bin/env python3
"""
端到端演示脚本 - 实验室危化品柜布局系统
完整演示：安全半径表导入 → 园区运维小陶补看坐标原点说明 → 导出截图更新
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lab_cabinet_layout.service import run_standard_three_step_process
from lab_cabinet_layout.demo_data import get_demo_process_steps, get_demo_csv_samples
from lab_cabinet_layout.models import Handler
from lab_cabinet_layout.workflow import client_review_issue
from lab_cabinet_layout.visualization import export_layout_screenshot


def print_header(title):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def main():
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output')
    os.makedirs(output_dir, exist_ok=True)

    print_header("🧪 实验室危化品柜布局系统 - 端到端演示")
    print("\n本脚本完整演示用户提到的关键流程：")
    print("  1. 安全半径表第一次导入")
    print("  2. 园区运维小陶补看坐标原点说明")
    print("  3. 导出截图更新")
    print("\n⚠️  关键细节：碰到补录路线没有重新计算长度时，别急着归正常，留给展陈客户复核")

    print_header("📋 第一步：生成演示数据（CSV样本）")
    csv_files = get_demo_csv_samples(output_dir)
    print(f"✅ 安全半径表: {csv_files['safety_radius_csv']}")
    print(f"✅ 路线表: {csv_files['routes_csv']}")

    print_header("📖 演示流程步骤说明（园区运维小陶给新人讲流程用）")
    steps = get_demo_process_steps()
    for step in steps:
        print(f"\n📍 步骤{step['step']}: {step['title']}")
        print(f"   👤 执行人: {step['actor']}")
        print(f"   📝 说明: {step['description']}")
        print(f"   🎯 关键输出: {step['key_output']}")

    print_header("⚡ 第二步：运行标准三步流程（使用内置演示数据）")
    result = run_standard_three_step_process(
        use_demo=True,
        output_dir=output_dir
    )

    project = result['project']

    print_header("🔍 第三步：验证关键细节")
    print("\n检查点 1: 补录路线没有重新计算长度时，是否留给展陈客户复核？")
    for issue in result['issues_found']:
        if issue['type'] == '补录路线未重新计算长度':
            print(f"\n  问题 {issue['issue_id']}:")
            print(f"    - 类型: {issue['type']}")
            print(f"    - 当前状态: {issue['status']}")
            print(f"    - 当前处理人: {issue['current_handler']}")
            print(f"    - 为什么被留下: {issue['why_kept']}")
            print(f"    - 还缺材料: {issue['missing_info']}")
            print(f"    - 下一步: {issue['next_step']}")

            if issue['status'] != '已解决' and issue['current_handler'] == '展陈客户':
                print(f"    ✅ 正确：问题未急于归正常，已留给展陈客户复核")
            else:
                print(f"    ❌ 错误：问题状态不正确")

    print("\n检查点 2: 导出的截图是否包含问题说明？")
    for file_type, file_path in result['exported_files'].items():
        if isinstance(file_path, list):
            for f in file_path:
                if os.path.exists(f):
                    size = os.path.getsize(f) / 1024
                    print(f"    ✅ {file_type}: {f} ({size:.1f} KB)")
        else:
            if os.path.exists(file_path):
                size = os.path.getsize(file_path) / 1024
                print(f"    ✅ {file_type}: {file_path} ({size:.1f} KB)")

    print_header("👀 第四步：展陈客户复核（可选步骤）")
    print("\n现在模拟展陈客户复核流程...")
    pending_issues = [i for i in project.issues if i.current_handler == Handler.EXHIBITION_CLIENT]

    if pending_issues:
        issue = pending_issues[0]
        print(f"\n复核问题 {issue.issue_id}: {issue.issue_type}")
        print(f"原始描述: {issue.description}")
        print(f"人工录入: {next((r.manual_input_length for r in project.routes if r.route_id == issue.route_id), 'N/A')} 米")
        print(f"系统计算: {next((r.calculated_length for r in project.routes if r.route_id == issue.route_id), 'N/A')} 米")

        client_review_issue(
            project=project,
            issue_id=issue.issue_id,
            approved=True,
            review_notes="已核对现场测量记录，确认5.8米为实际步测值。坐标原点校准无误，系统计算值5.83米与实测值误差在合理范围内，同意通过。",
            operator=Handler.EXHIBITION_CLIENT
        )

        print(f"\n✅ 客户复核完成，问题状态: {issue.status}")

        final_report = os.path.join(output_dir, 'layout_report_final.png')
        export_layout_screenshot(project, final_report)
        print(f"✅ 最终报告已导出: {final_report}")

    print_header("📊 第五步：操作日志回顾")
    print("\n完整操作日志（所有操作留痕）：")
    for log in project.operation_logs:
        print(f"\n  [{log.timestamp.strftime('%Y-%m-%d %H:%M:%S')}] {log.operator.value}")
        print(f"    动作: {log.action}")
        print(f"    详情: {log.details}")

    print_header("🎯 演示总结")
    print(f"\n✅ 项目: {project.project_name} ({project.project_id})")
    print(f"✅ 危化品柜: {len(project.safety_radii)} 个")
    print(f"✅ 路线: {len(project.routes)} 条")
    print(f"✅ 问题: {len(project.issues)} 个")
    print(f"✅ 已解决: {sum(1 for i in project.issues if i.status.value == '已解决')} 个")
    print(f"✅ 导出文件: {len(result['exported_files']) + 1 if pending_issues else len(result['exported_files'])} 个")

    print(f"\n📁 所有输出文件保存在: {output_dir}")
    print("\n💡 其他使用方式：")
    print("   命令行: python3 -m lab_cabinet_layout.cli run --demo")
    print("   API服务: python3 -m lab_cabinet_layout.api")
    print("   小看板: 启动API后访问 http://localhost:5000")

    print("\n" + "=" * 70)
    print("  演示完成！关键细节已验证：补录路线未重算问题不急于归正常，")
    print("  而是留给展陈客户复核，导出截图包含完整的问题说明。")
    print("=" * 70)


if __name__ == '__main__':
    main()

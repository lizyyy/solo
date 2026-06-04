from models import ProjectState, WorkflowStage, NextContact
from datetime import datetime


class ReportRenderer:
    def __init__(self, state: ProjectState):
        self.state = state

    def render_full_report(self) -> str:
        if not self.state.handover_report:
            return "尚未生成交接报告，请先完成数据导入。"

        report = self.state.handover_report
        lines = []

        lines.append("=" * 80)
        lines.append("           降落伞开伞冲击试验 交接报告")
        lines.append("=" * 80)
        lines.append(f"报告编号: {report.report_id}")
        lines.append(f"生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"当前阶段: {report.workflow_stage.value}")
        lines.append("-" * 80)

        lines.append(f"\n📊 数据概览")
        lines.append(f"  总数据点数: {report.total_data_points}")
        lines.append(f"  温度单位混用点: {report.mixed_unit_count} 个")
        lines.append(f"  已关联校准记录: {report.calibration_count} 份")
        lines.append(f"  待处理事项: {len(report.pending_actions)} 项")

        lines.append(f"\n📝 待办清单")
        for i, action in enumerate(report.pending_actions, 1):
            lines.append(f"  {i}. {action}")

        lines.append(f"\n{'=' * 80}")
        lines.append("  🎯 训练教练 收")
        lines.append("-" * 80)
        lines.append(report.summary_for_coach)

        lines.append(f"\n{'=' * 80}")
        lines.append("  🔬 实验老师林老师 收")
        lines.append("-" * 80)
        lines.append(report.summary_for_lin)

        lines.append(f"\n{'=' * 80}")
        lines.append("  📋 逐条数据留存说明")
        lines.append("-" * 80)

        for note in report.retention_notes:
            point = self.state.shock_data[note.data_point_id]
            marker = "⚠️" if point.has_mixed_units else "✓"
            priority_flag = "🔴" if note.priority == "高" else "🟡"

            lines.append(f"\n{marker} 数据点 {note.data_point_id:>3}  {priority_flag} 优先级:{note.priority}")
            lines.append(f"   ├─ 冲击值: {point.acceleration_g:.2f}g   高度: {point.altitude_m:.1f}m   速度: {point.velocity_m_s:.1f}m/s")

            if point.temperature_reading:
                temp = point.temperature_reading
                lines.append(f"   ├─ 温度采样: {temp.value}{temp.unit.value}  (原始记录第{temp.source_line}行: {temp.raw_text})")

            if point.linked_calibration_id:
                lines.append(f"   ├─ 校准记录: {point.linked_calibration_id} ✓")
            elif point.has_mixed_units:
                lines.append(f"   ├─ 校准记录: ❌ 缺失，待林老师补录")

            lines.append(f"   ├─ 留存原因: {note.reason_kept}")

            if note.missing_materials:
                lines.append(f"   ├─ 缺失材料: {', '.join(note.missing_materials)}")

            lines.append(f"   └─ 下一步对接: → {note.next_contact.value}")

        lines.append(f"\n{'=' * 80}")
        lines.append("  💡 使用提示")
        lines.append("-" * 80)
        lines.append("  • 查看3D图表: 执行 chart 3d")
        lines.append("  • 点击混用点: 执行 click <点号> 可回溯采样间隔说明和校准记录")
        lines.append("  • 林老师补录校准: 执行 calibrate <点号>")
        lines.append("  • 教练复核后更新报告: 执行 update")
        lines.append("=" * 80)

        return "\n".join(lines)

    def render_stage_banner(self) -> str:
        stage = self.state.current_stage
        banners = {
            WorkflowStage.STEP1_IMPORTED: """
┌─────────────────────────────────────────────────────────┐
│  ✅ 第一步完成：采样间隔说明已导入                       │
│                                                         │
│  已完成温度采样解析，{mixed_count} 个点存在摄氏度/开尔文混用    │
│  系统未做自动归一化，保留原始数据供训练教练复核          │
└─────────────────────────────────────────────────────────┘
            """,
            WorkflowStage.STEP2_LIN_REVIEWED: """
┌─────────────────────────────────────────────────────────┐
│  ✅ 第二步完成：林老师已补看温度校准记录                 │
│                                                         │
│  已录入 {cal_count} 份校准记录，{remaining_count} 个点仍待补录     │
│  交接报告已更新，请训练教练继续复核                      │
└─────────────────────────────────────────────────────────┘
            """,
            WorkflowStage.STEP3_REPORT_UPDATED: """
┌─────────────────────────────────────────────────────────┐
│  ✅ 第三步完成：交接报告已更新                           │
│                                                         │
│  所有数据留存说明、缺失材料、对接人均已明确              │
│  报告可交付训练教练或林老师                              │
└─────────────────────────────────────────────────────────┘
            """,
            WorkflowStage.COACH_REVIEW_PENDING: """
┌─────────────────────────────────────────────────────────┐
│  ⚠️  待训练教练复核：发现温度单位混用                     │
│                                                         │
│  {mixed_count} 个数据点标记为红色⚠️，点击可回溯原始记录        │
│  请先确认单位混用情况，再决定是否需要林老师补充校准        │
└─────────────────────────────────────────────────────────┘
            """
        }

        mixed_count = self.state.handover_report.mixed_unit_count if self.state.handover_report else 0
        cal_count = len(self.state.calibration_records)
        remaining_count = sum(
            1 for p in self.state.shock_data
            if p.has_mixed_units and not p.linked_calibration_id
        )

        template = banners.get(stage, banners[WorkflowStage.STEP1_IMPORTED])
        return template.format(
            mixed_count=mixed_count,
            cal_count=cal_count,
            remaining_count=remaining_count
        ).strip()

    def render_click_result(self, click_result: dict) -> str:
        if not click_result.get("found"):
            return click_result.get("message", "")

        lines = ["\n" + "─" * 80]
        lines.append(f"📍 点击数据点 {click_result['point_idx']}")
        lines.append(f"   {click_result['warning']}")
        lines.append("─" * 80)
        lines.append(f"💬 {click_result['explanation']}")
        lines.append("\n🔗 可回溯到：")

        for opt in click_result["navigate_options"]:
            if opt["type"] == "采样间隔说明":
                lines.append(f"\n   📄 {opt['type']}")
                lines.append(f"      文件: {opt['file']}")
                lines.append(f"      行号: 第 {opt['line']} 行")
                lines.append(f"      原文: \"{opt['raw_text']}\"")
                lines.append(f"      单位: {opt['unit']}")
            elif opt["type"] == "温度校准记录":
                if opt.get("status") == "缺失":
                    lines.append(f"\n   📋 {opt['type']}: ❌ {opt['status']}")
                    lines.append(f"      👉 {opt['action']}")
                else:
                    lines.append(f"\n   📋 {opt['type']}: ✓ 已录入")
                    lines.append(f"      编号: {opt['record_id']}")
                    lines.append(f"      记录人: {opt['recorded_by']}")
                    lines.append(f"      时间: {opt['recorded_at']}")
                    lines.append(f"      备注: {opt['remarks']}")

        lines.append("\n" + "─" * 80)
        lines.append("💡 操作建议:")
        lines.append("   • 如确认单位无误，可执行 update 推进到下一阶段")
        lines.append("   • 如需补充校准记录，请林老师执行 calibrate 命令")
        lines.append("─" * 80)
        return "\n".join(lines)

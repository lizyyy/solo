import json
from datetime import datetime
from models import Application


class ExportService:
    @staticmethod
    def generate_handover_report(applications, target_date):
        """
        生成值班交接单 Markdown 文档
        :param applications: 当天已确认的申请列表
        :param target_date: 目标日期
        :return: Markdown 字符串
        """
        lines = []
        
        # 标题
        lines.append(f"# 社区共享厨房值班交接单")
        lines.append(f"## 日期: {target_date.strftime('%Y年%m月%d日')}")
        lines.append("")
        
        # 概览
        lines.append("### 今日概览")
        lines.append(f"- 确认活动数: {len(applications)}")
        lines.append(f"- 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        if not applications:
            lines.append("#### 今日无已确认的活动")
            lines.append("")
        else:
            # 活动详情
            lines.append("### 活动详情")
            lines.append("")
            
            for i, app in enumerate(applications, 1):
                lines.append(f"#### {i}. {app.activity_name}")
                lines.append("")
                
                # 基本信息
                lines.append("**基本信息:**")
                lines.append(f"- 申请人: {app.applicant_name}")
                if app.applicant_phone:
                    lines.append(f"- 联系电话: {app.applicant_phone}")
                lines.append(f"- 参与人数: {app.participant_count} 人")
                lines.append(f"- 活动时段: {app.start_time.strftime('%H:%M')} - {app.end_time.strftime('%H:%M')}")
                
                if app.activity_description:
                    lines.append(f"- 活动描述: {app.activity_description}")
                lines.append("")
                
                # 负责人信息
                if app.volunteer:
                    lines.append("**负责人信息:**")
                    lines.append(f"- 姓名: {app.volunteer.name}")
                    lines.append(f"- 资质类型: {app.volunteer.qualification_type}")
                    lines.append(f"- 资质有效期: {app.volunteer.qualification_valid_from.strftime('%Y-%m-%d')} 至 {app.volunteer.qualification_valid_until.strftime('%Y-%m-%d')}")
                    if app.volunteer.phone:
                        lines.append(f"- 联系电话: {app.volunteer.phone}")
                    lines.append("")
                
                # 设备使用
                if app.equipment_ids:
                    equipment_ids = json.loads(app.equipment_ids)
                    if equipment_ids:
                        lines.append("**使用设备:**")
                        for eq_id in equipment_ids:
                            from models import Equipment
                            eq = Equipment.query.get(eq_id)
                            if eq:
                                lines.append(f"- {eq.name} ({eq.type})")
                        lines.append("")
                
                # 冷藏格使用
                if app.fridge_usage:
                    fridge_usage = json.loads(app.fridge_usage)
                    if fridge_usage:
                        lines.append("**冷藏格使用:**")
                        for usage in fridge_usage:
                            from models import Fridge
                            fridge = Fridge.query.get(usage.get('fridge_id'))
                            if fridge:
                                lines.append(f"- {fridge.name} ({fridge.type}): 使用 {usage.get('usage_capacity', 0)} 升")
                        lines.append("")
                
                # 风控信息
                if app.risk_level or app.risk_notes:
                    lines.append("**风控信息:**")
                    if app.risk_level:
                        risk_level_text = {
                            'low': '低风险',
                            'medium': '中风险',
                            'high': '高风险'
                        }.get(app.risk_level, app.risk_level)
                        lines.append(f"- 风险等级: {risk_level_text}")
                    if app.risk_notes:
                        lines.append(f"- 风控备注: {app.risk_notes}")
                    lines.append("")
                
                # 审核信息
                if app.reviewer_name:
                    lines.append("**审核信息:**")
                    lines.append(f"- 审核人: {app.reviewer_name}")
                    if app.review_notes:
                        lines.append(f"- 审核备注: {app.review_notes}")
                    lines.append("")
                
                lines.append("---")
                lines.append("")
        
        # 注意事项
        lines.append("### 注意事项")
        lines.append("")
        lines.append("1. 请提前检查设备状态，确保设备正常运行")
        lines.append("2. 请提前与负责人沟通，确认活动细节")
        lines.append("3. 活动结束后，请检查设备使用情况和冷藏格清理情况")
        lines.append("4. 如遇紧急情况，请立即联系管理员")
        lines.append("")
        
        # 交接记录
        lines.append("### 交接记录")
        lines.append("")
        lines.append("| 项目 | 内容 |")
        lines.append("|------|------|")
        lines.append("| 交班人 | _______________ |")
        lines.append("| 接班人 | _______________ |")
        lines.append("| 交班时间 | _______________ |")
        lines.append("| 备注 | _______________ |")
        lines.append("")
        
        return "\n".join(lines)

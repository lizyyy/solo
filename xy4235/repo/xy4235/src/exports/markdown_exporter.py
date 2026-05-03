from typing import Optional
from datetime import datetime, timedelta

from models.case import Case
from models.risk import RiskStatus
from .base_exporter import BaseExporter, ExportResult


class MarkdownExporter(BaseExporter):
    """
    Markdown复盘报告导出器
    生成完整的麻醉监护复盘报告
    """
    
    def __init__(self):
        super().__init__()
    
    def export(self, case: Case, output_path: str = None) -> ExportResult:
        """
        导出Markdown报告
        
        Args:
            case: 病例对象
            output_path: 输出文件路径
            
        Returns:
            导出结果
        """
        self.result = ExportResult()
        
        try:
            # 生成默认文件名
            if output_path is None:
                output_path = self._generate_default_filename(case, "md")
            
            # 确保输出目录存在
            output_path_obj = self._ensure_output_dir(output_path)
            
            # 生成Markdown内容
            markdown_content = self._generate_markdown(case)
            
            # 写入文件
            with open(output_path_obj, 'w', encoding='utf-8') as f:
                f.write(markdown_content)
            
            # 设置结果
            self.result.file_path = str(output_path_obj)
            self.result.file_size = self._get_file_size(str(output_path_obj))
            
        except Exception as e:
            self.result.add_error(f"导出Markdown报告失败: {str(e)}")
        
        return self.result
    
    def _generate_markdown(self, case: Case) -> str:
        """
        生成Markdown内容
        """
        lines = []
        
        # 标题
        lines.append("# 麻醉监护复盘报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # 病例基本信息
        lines.append("## 1. 病例基本信息")
        lines.append("")
        lines.append("| 项目 | 内容 |")
        lines.append("|------|------|")
        lines.append(f"| 病例ID | {case.case_id} |")
        lines.append(f"| 患者姓名 | {case.patient_name or '未记录'} |")
        lines.append(f"| 患者ID | {case.patient_id or '未记录'} |")
        lines.append(f"| 物种 | {case.species or '未记录'} |")
        lines.append(f"| 品种 | {case.breed or '未记录'} |")
        lines.append(f"| 年龄 | {case.age or '未记录'} |")
        lines.append(f"| 体重 | {case.weight or '未记录'} kg |")
        lines.append(f"| 手术/操作 | {case.procedure or '未记录'} |")
        lines.append(f"| 麻醉医师 | {case.anesthesiologist or '未记录'} |")
        lines.append(f"| 病例状态 | {case.status.value if case.status else '未知'} |")
        lines.append("")
        
        # 时间范围
        start_time, end_time = case.get_time_range()
        if start_time and end_time:
            duration = end_time - start_time
            lines.append(f"**麻醉时间**: {start_time.strftime('%Y-%m-%d %H:%M:%S')} - {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append(f"**持续时间**: {self._format_duration(duration)}")
            lines.append("")
        
        # 风险摘要
        lines.append("## 2. 风险摘要")
        lines.append("")
        
        total_risks = len(case.risks)
        pending = len(case.get_risks_by_status(RiskStatus.PENDING))
        confirmed = len(case.get_risks_by_status(RiskStatus.CONFIRMED))
        dismissed = len(case.get_risks_by_status(RiskStatus.DISMISSED))
        
        lines.append(f"**总风险数**: {total_risks}")
        lines.append(f"- 待复核: {pending}")
        lines.append(f"- 已确认: {confirmed}")
        lines.append(f"- 已驳回: {dismissed}")
        lines.append("")
        
        # 详细风险列表
        if case.risks:
            lines.append("## 3. 风险详情")
            lines.append("")
            
            # 按类型分组
            risks_by_type = {}
            for risk in case.risks:
                risk_type = risk.risk_type.value
                if risk_type not in risks_by_type:
                    risks_by_type[risk_type] = []
                risks_by_type[risk_type].append(risk)
            
            for risk_type, risks in risks_by_type.items():
                lines.append(f"### 3.{list(risks_by_type.keys()).index(risk_type) + 1} {risk_type}")
                lines.append("")
                
                for i, risk in enumerate(risks, 1):
                    lines.append(f"#### 风险 {i}")
                    lines.append("")
                    lines.append(f"**风险ID**: {risk.risk_id}")
                    lines.append(f"**严重程度**: {risk.severity.value}")
                    lines.append(f"**状态**: {risk.status.value}")
                    lines.append("")
                    lines.append(f"**描述**: {risk.description}")
                    lines.append("")
                    lines.append(f"**建议**: {risk.recommendation}")
                    lines.append("")
                    
                    # 风险片段
                    if risk.segments:
                        lines.append("**风险片段**:")
                        lines.append("")
                        lines.append("| 开始时间 | 结束时间 | 持续时间 | 最小值 | 最大值 | 平均值 | 触发阈值 |")
                        lines.append("|----------|----------|----------|--------|--------|--------|----------|")
                        
                        for seg in risk.segments:
                            duration = seg.get_duration()
                            lines.append(f"| {seg.start_time.strftime('%H:%M:%S')} | {seg.end_time.strftime('%H:%M:%S')} | {self._format_duration(duration)} | {seg.min_value or '-'} | {seg.max_value or '-'} | {seg.avg_value or '-'} | {seg.trigger_value or '-'} |")
                        
                        lines.append("")
                    
                    # 复核信息
                    if risk.reviewed_at:
                        lines.append("**复核信息**:")
                        lines.append(f"- 复核时间: {risk.reviewed_at.strftime('%Y-%m-%d %H:%M:%S')}")
                        lines.append(f"- 复核人: {risk.reviewed_by or '未记录'}")
                        if risk.review_notes:
                            lines.append(f"- 复核备注: {risk.review_notes}")
                        lines.append("")
                    
                    lines.append("---")
                    lines.append("")
        
        # 给药记录
        if case.medication and case.medication.records:
            lines.append("## 4. 给药记录")
            lines.append("")
            lines.append("| 时间 | 药物名称 | 剂量 | 单位 | 途径 | 类型 | 给药人 | 备注 |")
            lines.append("|------|----------|------|------|------|------|--------|------|")
            
            for record in case.medication.records:
                time_str = record.timestamp.strftime('%H:%M:%S') if record.timestamp else '-'
                lines.append(f"| {time_str} | {record.medication_name} | {record.dose} | {record.unit} | {record.route.value} | {record.medication_type.value} | {record.administered_by or '-'} | {record.notes or '-'} |")
            
            lines.append("")
        
        # 复核历史
        if case.review and case.review.records:
            lines.append("## 5. 复核历史")
            lines.append("")
            lines.append("| 时间 | 操作 | 风险ID | 复核人 | 备注 |")
            lines.append("|------|------|--------|--------|------|")
            
            for record in case.review.records:
                time_str = record.timestamp.strftime('%Y-%m-%d %H:%M:%S') if record.timestamp else '-'
                lines.append(f"| {time_str} | {record.action.value} | {record.risk_id} | {record.reviewer or '-'} | {record.notes or '-'} |")
            
            lines.append("")
        
        # 人工备注
        if case.notes:
            lines.append("## 6. 人工备注")
            lines.append("")
            lines.append(case.notes)
            lines.append("")
        
        # 报告尾注
        lines.append("---")
        lines.append("")
        lines.append("*此报告由麻醉监护复盘板自动生成*")
        lines.append(f"*病例创建时间: {case.created_at.strftime('%Y-%m-%d %H:%M:%S') if case.created_at else '未知'}*")
        lines.append(f"*病例最后更新时间: {case.updated_at.strftime('%Y-%m-%d %H:%M:%S') if case.updated_at else '未知'}*")
        
        return "\n".join(lines)
    
    def _format_duration(self, duration: timedelta) -> str:
        """
        格式化持续时间
        """
        total_seconds = int(duration.total_seconds())
        
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        
        if hours > 0:
            return f"{hours}小时{minutes}分钟"
        elif minutes > 0:
            return f"{minutes}分钟{seconds}秒"
        else:
            return f"{seconds}秒"

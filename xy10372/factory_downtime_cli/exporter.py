"""
报告导出模块
"""

import csv
from datetime import datetime, date
from pathlib import Path
from typing import List, Dict, Any

from .models import MachineDailyReport
from .utils import format_minutes, format_efficiency


class ReportExporter:
    """报告导出器"""
    
    STATISTICS_CALIBER = """
统计口径说明：

1. 【计划停机】- 换模时间
   - 包含所有状态为"有效"的换模记录
   - 计算：结束时间 - 开始时间
   - 注意：重复记录、结束早于开始、时间重叠的记录不计入

2. 【异常停机】- 设备故障等非正常停机
   - 包含所有状态为"有效"的异常停机记录
   - 计算：结束时间 - 开始时间
   - 注意：重复记录、结束早于开始、时间重叠的记录不计入

3. 【有效产出】- 实际生产数量
   - 包含所有状态为"有效"的产量记录
   - 产量记录必须匹配到对应的生产计划
   - 注意：重复记录、无对应计划的产量不计入

4. 【有效生产时间】
   - 计算：24小时 - 计划停机 - 异常停机
   - 效率 = 有效生产时间 / 24小时 × 100%

5. 【记录状态说明】
   - 有效：正常计入统计
   - 重复：与已有记录完全一致，已被忽略
   - 时间无效：结束时间早于或等于开始时间，待复核
   - 时间重叠：与其他有效记录时间重叠，待复核
   - 无对应计划：产量记录无法匹配生产计划，待复核
   - 待复核：以上所有异常状态统称

重要提示：
- 所有"待复核"状态的记录都不会计入统计数据
- 请使用"人工修正"命令处理异常记录后重新核算
- 报告中会列出所有计入统计的停机来源，方便追溯
"""
    
    def export_daily_report_csv(self, reports: List[MachineDailyReport], 
                                 output_file: Path, target_date: date) -> bool:
        """导出日报CSV"""
        try:
            with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                
                writer.writerow(["工厂换模停机统计日报"])
                writer.writerow([f"统计日期: {target_date.strftime('%Y-%m-%d')}"])
                writer.writerow([f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"])
                writer.writerow([])
                
                writer.writerow(["统计口径说明"])
                for line in self.STATISTICS_CALIBER.strip().split('\n'):
                    writer.writerow([line])
                writer.writerow([])
                
                writer.writerow(["汇总统计"])
                writer.writerow([
                    "机台ID", "总时间(分钟)", "计划停机(分钟)", 
                    "异常停机(分钟)", "有效生产时间(分钟)", 
                    "实际产量", "效率(%)"
                ])
                
                total_planned = 0.0
                total_abnormal = 0.0
                total_effective = 0.0
                total_output = 0
                
                for report in reports:
                    total_planned += report.planned_downtime_minutes
                    total_abnormal += report.abnormal_downtime_minutes
                    total_effective += report.effective_production_minutes
                    total_output += report.actual_output
                    
                    writer.writerow([
                        report.machine_id,
                        f"{report.total_minutes:.1f}",
                        f"{report.planned_downtime_minutes:.1f}",
                        f"{report.abnormal_downtime_minutes:.1f}",
                        f"{report.effective_production_minutes:.1f}",
                        report.actual_output,
                        f"{report.efficiency:.2f}"
                    ])
                
                if reports:
                    avg_efficiency = total_effective / (len(reports) * 24 * 60) * 100
                    writer.writerow([
                        "合计/平均",
                        f"{len(reports) * 24 * 60:.1f}",
                        f"{total_planned:.1f}",
                        f"{total_abnormal:.1f}",
                        f"{total_effective:.1f}",
                        total_output,
                        f"{avg_efficiency:.2f}"
                    ])
                
                writer.writerow([])
                writer.writerow(["=" * 100])
                writer.writerow([])
                
                for report in reports:
                    self._write_machine_detail(writer, report)
                
            return True
        except Exception as e:
            print(f"导出失败: {e}")
            return False
    
    def _write_machine_detail(self, writer, report: MachineDailyReport):
        """写入单台机台明细"""
        writer.writerow([f"机台: {report.machine_id}"])
        writer.writerow([
            "总时间", "计划停机", "异常停机", "有效生产时间", "实际产量", "效率"
        ])
        writer.writerow([
            format_minutes(report.total_minutes),
            format_minutes(report.planned_downtime_minutes),
            format_minutes(report.abnormal_downtime_minutes),
            format_minutes(report.effective_production_minutes),
            report.actual_output,
            format_efficiency(report.efficiency)
        ])
        writer.writerow([])
        
        if report.planned_downtime_sources:
            writer.writerow(["【计划停机来源明细】(计入统计)"])
            for source in report.planned_downtime_sources:
                writer.writerow([f"  - {source}"])
            writer.writerow([])
        
        if report.abnormal_downtime_sources:
            writer.writerow(["【异常停机来源明细】(计入统计)"])
            for source in report.abnormal_downtime_sources:
                writer.writerow([f"  - {source}"])
            writer.writerow([])
        
        if report.exceptions:
            writer.writerow(["【异常记录】(不计入统计，待复核)"])
            for exc in report.exceptions:
                writer.writerow([f"  - {exc}"])
            writer.writerow([])
        
        writer.writerow(["-" * 80])
        writer.writerow([])

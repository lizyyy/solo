import os
from datetime import datetime
from typing import List, Optional, Dict
from .models import RecordStatus, STATUS_DISPLAY
from .storage import Database


class ReportService:
    def __init__(self, db: Database):
        self.db = db

    def generate_patrol_report(self, file_path: str,
                               start_time: Optional[str] = None,
                               end_time: Optional[str] = None,
                               operator: str = "") -> Dict:
        filters = {}
        if start_time:
            filters["start_time"] = start_time
        if end_time:
            filters["end_time"] = end_time

        records = self.db.get_records(filters)
        records = [r for r in records if r.status != RecordStatus.WITHDRAWN]

        confirmed = [r for r in records if r.status == RecordStatus.CONFIRMED]
        supplement = [r for r in records if r.status == RecordStatus.SUPPLEMENT]
        revised = [r for r in records if r.is_manual_modified and r.status != RecordStatus.WITHDRAWN]

        stats = self.db._get_conn() if False else None
        report_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        period = self._format_period(start_time, end_time)

        content = []
        content.append("=" * 70)
        content.append("桥梁位移报警巡检报告")
        content.append("=" * 70)
        content.append(f"生成时间: {report_time}")
        content.append(f"统计周期: {period}")
        content.append(f"生成人: {operator if operator else '系统'}")
        content.append("")

        content.append("-" * 70)
        content.append("一、总体统计")
        content.append("-" * 70)
        content.append(f"记录总数: {len(records)}")
        content.append(f"  已确认: {len(confirmed)} 条")
        content.append(f"  待补: {len(supplement)} 条")
        content.append(f"  人工改过: {len(revised)} 条")
        content.append(f"  待处理: {len([r for r in records if r.status == RecordStatus.PENDING])} 条")
        content.append("")

        content.append("-" * 70)
        content.append("二、处理口径说明")
        content.append("-" * 70)
        content.append("1. 已确认: 设备工程师现场核实后确认无误的报警记录")
        content.append("2. 待补: 信息不全或需补充资料的记录，需补齐后再确认")
        content.append("3. 人工改过: 对原始数据进行过人工修正的记录")
        content.append("   - 修正原因、修改前后数值、操作人均可在记录详情中追溯")
        content.append("4. 待处理: 刚导入尚未处理的记录")
        content.append("5. 已撤回: 标注为误报或作废的记录，默认不在报告中显示")
        content.append("")

        if confirmed:
            content.append("-" * 70)
            content.append(f"三、已确认记录 ({len(confirmed)} 条)")
            content.append("-" * 70)
            content.append(f"{'编号':<10}{'桥梁':<12}{'位置':<10}{'位移':<10}{'等级':<8}{'操作人':<10}{'时间':<20}")
            content.append("-" * 70)
            for r in confirmed:
                content.append(f"{r.record_no:<10}{r.bridge_name:<12}{r.position:<10}"
                             f"{r.displacement:<10.2f}{r.threshold_level:<8}"
                             f"{r.operator:<10}{r.alarm_time.strftime('%Y-%m-%d %H:%M'):<20}")
            content.append("")

        if supplement:
            content.append("-" * 70)
            content.append(f"四、待补记录 ({len(supplement)} 条) - 需重点跟进")
            content.append("-" * 70)
            content.append(f"{'编号':<10}{'桥梁':<12}{'位置':<10}{'位移':<10}{'待补原因':<30}{'操作人':<10}")
            content.append("-" * 70)
            for r in supplement:
                content.append(f"{r.record_no:<10}{r.bridge_name:<12}{r.position:<10}"
                             f"{r.displacement:<10.2f}{r.pending_reason:<30}{r.operator:<10}")
            content.append("")

        if revised:
            content.append("-" * 70)
            content.append(f"五、人工改过记录 ({len(revised)} 条) - 已复核")
            content.append("-" * 70)
            content.append(f"{'编号':<10}{'桥梁':<12}{'位置':<10}{'原位移':<10}{'现位移':<10}"
                         f"{'状态':<10}{'最后操作人':<12}{'更新时间':<20}")
            content.append("-" * 70)
            for r in revised:
                old_disp = self._get_old_displacement(r.id)
                content.append(f"{r.record_no:<10}{r.bridge_name:<12}{r.position:<10}"
                             f"{old_disp:<10}{r.displacement:<10.2f}"
                             f"{STATUS_DISPLAY[r.status]:<10}{r.operator:<12}"
                             f"{r.updated_at.strftime('%Y-%m-%d %H:%M'):<20}")
            content.append("")

        content.append("-" * 70)
        content.append("六、复核说明")
        content.append("-" * 70)
        content.append("导出巡检报告前请按以下步骤复核:")
        content.append("  1. 检查'待补记录'是否已全部补充完整")
        content.append("  2. 核对'人工改过记录'的修改原因和数值是否合理")
        content.append("  3. 确认'待处理记录'是否应已处理完毕")
        content.append("  4. 如包含已撤回记录，请在导出时勾选'包含已撤回'")
        content.append("")
        content.append(f"报告生成完毕，共 {len(records)} 条有效记录。")
        content.append("=" * 70)

        dir_path = os.path.dirname(file_path)
        if dir_path and not os.path.exists(dir_path):
            os.makedirs(dir_path)

        with open(file_path, "w", encoding="utf-8") as f:
            f.write("\n".join(content))

        return {
            "file_path": os.path.abspath(file_path),
            "report_time": report_time,
            "period": period,
            "total_count": len(records),
            "confirmed_count": len(confirmed),
            "supplement_count": len(supplement),
            "revised_count": len(revised),
            "pending_count": len([r for r in records if r.status == RecordStatus.PENDING]),
        }

    def _get_old_displacement(self, record_id: int) -> str:
        logs = self.db.get_operation_logs(record_id)
        for log in logs:
            if log.field_name == "displacement" and log.action == "field_edit":
                return log.old_value
        return "-"

    def _format_period(self, start_time: Optional[str], end_time: Optional[str]) -> str:
        if start_time and end_time:
            return f"{start_time} 至 {end_time}"
        elif start_time:
            return f"{start_time} 至今"
        elif end_time:
            return f"截至 {end_time}"
        else:
            return "全部历史数据"

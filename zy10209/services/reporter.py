from typing import Dict, List, Any
from tabulate import tabulate
from database.db import Database


class Reporter:
    def __init__(self, db: Database):
        self.db = db
    
    def get_uncollected_report(self) -> Dict[str, Any]:
        uncollected = self.db.get_uncollected_tests()
        return {
            "title": "漏回收检验单名单",
            "count": len(uncollected),
            "data": uncollected,
            "headers": ["采样编号", "姓名", "电话", "采样日期", "采样类型"]
        }
    
    def get_abnormal_tracking_report(self) -> Dict[str, Any]:
        tracking = self.db.get_abnormal_tracking()
        return {
            "title": "异常检验结果追踪进度",
            "count": len(tracking),
            "data": tracking,
            "headers": ["采样编号", "姓名", "电话", "检验日期", "检验状态", "通知次数", "复查预约数", "异常指标"]
        }
    
    def get_summary_report(self) -> Dict[str, Any]:
        stats = self.db.get_summary_stats()
        
        summary_data = [
            ["总采样数", stats["total_samplings"]],
            ["已回收检验单", stats["collected"]],
            ["未回收检验单", stats["uncollected"]],
            ["回收率", f"{stats['collection_rate']}%"],
            ["有异常指标", stats["with_abnormal"]],
            ["异常未通知", stats["abnormal_not_notified"]],
            ["已完成处理", stats["completed"]],
            ["完成率", f"{stats['completion_rate']}%"],
            ["待处理复查", stats["pending_followup"]]
        ]
        
        return {
            "title": "社区义诊检验单回收汇总表",
            "data": summary_data,
            "headers": ["指标", "数值"],
            "stats": stats
        }
    
    def format_table(self, report: Dict[str, Any]) -> str:
        lines = [f"\n=== {report['title']} ==="]
        lines.append(f"共 {report['count']} 条记录\n" if 'count' in report else "")
        
        if report['data']:
            table_data = []
            for item in report['data']:
                if isinstance(item, dict):
                    row = []
                    for h in report['headers']:
                        key_map = {
                            "采样编号": "sampling_no",
                            "姓名": "resident_name",
                            "电话": "resident_phone",
                            "采样日期": "sampling_date",
                            "采样类型": "sampling_type",
                            "检验日期": "test_date",
                            "检验状态": "test_status",
                            "通知次数": "notify_count",
                            "复查预约数": "followup_count",
                            "异常指标": "abnormal_items"
                        }
                        key = key_map.get(h, h.lower())
                        row.append(item.get(key, ''))
                    table_data.append(row)
                else:
                    table_data.append(item)
            
            lines.append(tabulate(table_data, headers=report['headers'], tablefmt='grid'))
        else:
            lines.append("（无数据）")
        
        return "\n".join(lines)
    
    def format_summary(self, report: Dict[str, Any]) -> str:
        lines = [f"\n{'='*50}"]
        lines.append(f"     {report['title']}")
        lines.append(f"{'='*50}")
        lines.append(tabulate(report['data'], headers=report['headers'], tablefmt='fancy_grid'))
        
        stats = report['stats']
        lines.append("\n关键提示:")
        if stats['uncollected'] > 0:
            lines.append(f"  ⚠️  有 {stats['uncollected']} 份检验单尚未回收")
        if stats['abnormal_not_notified'] > 0:
            lines.append(f"  ⚠️  有 {stats['abnormal_not_notified']} 份异常结果尚未通知")
        if stats['pending_followup'] > 0:
            lines.append(f"  📅 有 {stats['pending_followup']} 个复查预约待确认")
        
        return "\n".join(lines)

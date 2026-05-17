#!/usr/bin/env python3
"""
报告导出模块
支持机器可读JSON和人读文本报告
"""

import json
from datetime import datetime
from typing import Dict, Any
from pathlib import Path
from tracker import ClothingTracker, DataStore


class ReportExporter:
    """报告导出器"""
    
    def __init__(self, tracker: ClothingTracker):
        self.tracker = tracker
    
    def export_batch_report_json(self, batch_id: str, output_dir: str = "./reports") -> str:
        """导出批次报告为JSON（机器可读）"""
        Path(output_dir).mkdir(exist_ok=True)
        
        report = self.tracker.generate_sort_report(batch_id)
        validation = self.tracker.validate_batch_consistency(batch_id)
        
        batch = self.tracker.store.get_batch(batch_id)
        items = self.tracker.store.list_items(batch_id=batch_id)
        disinfect_records = self.tracker.store.get_disinfect_records(batch_id=batch_id)
        donate_records = self.tracker.store.get_donate_records(batch_id=batch_id)
        eliminate_records = self.tracker.store.get_eliminate_records(batch_id=batch_id)
        
        full_report = {
            "report_type": "batch_sort_report",
            "version": "1.0",
            "generated_at": report.generated_at,
            "batch": batch,
            "summary": {
                "total_items": report.total_items,
                "sorted_items": report.sorted_items,
                "disinfected_items": report.disinfected_items,
                "donated_items": report.donated_items,
                "eliminated_items": report.eliminated_items
            },
            "category_statistics": report.category_stats,
            "status_statistics": report.status_stats,
            "eliminate_reason_statistics": report.eliminate_reason_stats,
            "items": items,
            "disinfect_records": disinfect_records,
            "donate_records": donate_records,
            "eliminate_records": eliminate_records,
            "validation": validation
        }
        
        filename = f"{output_dir}/batch_{batch_id}_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(full_report, f, ensure_ascii=False, indent=2)
        
        return filename
    
    def export_batch_report_text(self, batch_id: str, output_dir: str = "./reports") -> str:
        """导出批次报告为文本（人读）"""
        Path(output_dir).mkdir(exist_ok=True)
        
        report = self.tracker.generate_sort_report(batch_id)
        validation = self.tracker.validate_batch_consistency(batch_id)
        batch = self.tracker.store.get_batch(batch_id)
        
        lines = []
        lines.append("=" * 70)
        lines.append("           衣 物 分 拣 消 毒 转 赠 追 踪 报 告")
        lines.append("=" * 70)
        lines.append("")
        
        lines.append("【基本信息】")
        lines.append(f"  批次编号: {batch_id}")
        lines.append(f"  捐赠人: {batch.get('donor_name', 'N/A')}")
        lines.append(f"  联系方式: {batch.get('donor_contact', 'N/A')}")
        lines.append(f"  接收日期: {batch.get('receive_date', 'N/A')}")
        lines.append(f"  申报数量: {batch.get('total_count', 0)}件")
        lines.append(f"  实际入库: {report.total_items}件")
        lines.append("")
        
        lines.append("【统计摘要】")
        lines.append(f"  ┌─────────────────────┬────────┐")
        lines.append(f"  │ 状态                │ 数量   │")
        lines.append(f"  ├─────────────────────┼────────┤")
        lines.append(f"  │ 已分拣              │ {report.sorted_items:>4}件  │")
        lines.append(f"  │ 已消毒              │ {report.disinfected_items:>4}件  │")
        lines.append(f"  │ 已转赠              │ {report.donated_items:>4}件  │")
        lines.append(f"  │ 已淘汰              │ {report.eliminated_items:>4}件  │")
        lines.append(f"  └─────────────────────┴────────┘")
        lines.append("")
        
        lines.append("【分类统计】")
        if report.category_stats:
            lines.append(f"  ┌─────────────────────┬────────┐")
            lines.append(f"  │ 分类                │ 数量   │")
            lines.append(f"  ├─────────────────────┼────────┤")
            for cat, count in sorted(report.category_stats.items()):
                lines.append(f"  │ {cat:<19} │ {count:>4}件  │")
            lines.append(f"  └─────────────────────┴────────┘")
        else:
            lines.append("  (无分类数据)")
        lines.append("")
        
        lines.append("【状态分布】")
        if report.status_stats:
            lines.append(f"  ┌─────────────────────┬────────┐")
            lines.append(f"  │ 状态                │ 数量   │")
            lines.append(f"  ├─────────────────────┼────────┤")
            for status, count in sorted(report.status_stats.items()):
                lines.append(f"  │ {status:<19} │ {count:>4}件  │")
            lines.append(f"  └─────────────────────┴────────┘")
        else:
            lines.append("  (无状态数据)")
        lines.append("")
        
        lines.append("【淘汰原因统计】")
        if report.eliminate_reason_stats:
            lines.append(f"  ┌─────────────────────┬────────┐")
            lines.append(f"  │ 淘汰原因            │ 数量   │")
            lines.append(f"  ├─────────────────────┼────────┤")
            for reason, count in sorted(report.eliminate_reason_stats.items()):
                lines.append(f"  │ {reason:<19} │ {count:>4}件  │")
            lines.append(f"  └─────────────────────┴────────┘")
        else:
            lines.append("  (无淘汰记录)")
        lines.append("")
        
        lines.append("【数据一致性验证】")
        if validation["valid"]:
            lines.append("  ✓ 数据验证通过，所有状态与记录一致")
        else:
            lines.append("  ✗ 发现以下问题:")
            for issue in validation.get("issues", []):
                lines.append(f"    - {issue}")
        lines.append("")
        
        lines.append("【衣物明细清单】")
        items = self.tracker.store.list_items(batch_id=batch_id)
        if items:
            lines.append(f"  {'物品ID':<14} {'分类':<10} {'品牌':<12} {'尺码':<8} {'颜色':<8} {'状态':<12}")
            lines.append("  " + "-" * 64)
            for item in items:
                lines.append(f"  {item['item_id']:<14} {item['category']:<10} {item['brand']:<12} {item['size']:<8} {item['color']:<8} {item['status']:<12}")
        else:
            lines.append("  (无衣物记录)")
        lines.append("")
        
        lines.append("=" * 70)
        lines.append(f"报告生成时间: {report.generated_at}")
        lines.append(f"报告版本: 1.0")
        lines.append("=" * 70)
        
        filename = f"{output_dir}/batch_{batch_id}_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        with open(filename, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        
        return filename
    
    def export_item_trace_json(self, item_id: str, output_dir: str = "./reports") -> str:
        """导出单物品追踪报告JSON"""
        Path(output_dir).mkdir(exist_ok=True)
        
        history = self.tracker.get_item_full_history(item_id)
        
        report = {
            "report_type": "item_trace_report",
            "version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "item_id": item_id,
            "history": history
        }
        
        filename = f"{output_dir}/item_{item_id}_trace_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        return filename
    
    def export_item_trace_text(self, item_id: str, output_dir: str = "./reports") -> str:
        """导出单物品追踪报告文本"""
        Path(output_dir).mkdir(exist_ok=True)
        
        history = self.tracker.get_item_full_history(item_id)
        item = history.get("item", {})
        
        lines = []
        lines.append("=" * 70)
        lines.append("              衣 物 全 流 程 追 踪 报 告")
        lines.append("=" * 70)
        lines.append("")
        
        lines.append("【物品基本信息】")
        if item:
            lines.append(f"  物品ID: {item_id}")
            lines.append(f"  所属批次: {item.get('batch_id', 'N/A')}")
            lines.append(f"  分类: {item.get('category', 'N/A')}")
            lines.append(f"  描述: {item.get('description', 'N/A')}")
            lines.append(f"  品牌: {item.get('brand', 'N/A')}")
            lines.append(f"  尺码: {item.get('size', 'N/A')}")
            lines.append(f"  颜色: {item.get('color', 'N/A')}")
            lines.append(f"  当前状态: {item.get('status', 'N/A')}")
            lines.append(f"  分拣时间: {item.get('sort_time', 'N/A')}")
            lines.append(f"  分拣人: {item.get('sort_operator', 'N/A')}")
        else:
            lines.append("  (未找到该物品记录)")
        lines.append("")
        
        lines.append("【消毒记录】")
        disinfects = history.get("disinfect_records", [])
        if disinfects:
            for i, rec in enumerate(disinfects, 1):
                lines.append(f"  记录{i}:")
                lines.append(f"    消毒方式: {rec.get('method', 'N/A')}")
                lines.append(f"    操作人: {rec.get('operator', 'N/A')}")
                lines.append(f"    消毒时间: {rec.get('disinfect_time', 'N/A')}")
                lines.append(f"    持续时间: {rec.get('duration_minutes', 0)}分钟")
                if rec.get('temperature'):
                    lines.append(f"    温度: {rec['temperature']}℃")
                if rec.get('notes'):
                    lines.append(f"    备注: {rec['notes']}")
                lines.append("")
        else:
            lines.append("  (无消毒记录)")
        lines.append("")
        
        lines.append("【转赠记录】")
        donates = history.get("donate_records", [])
        if donates:
            for i, rec in enumerate(donates, 1):
                lines.append(f"  记录{i}:")
                lines.append(f"    转赠机构: {rec.get('organization_name', 'N/A')}")
                lines.append(f"    机构ID: {rec.get('organization_id', 'N/A')}")
                lines.append(f"    操作人: {rec.get('operator', 'N/A')}")
                lines.append(f"    转赠时间: {rec.get('donate_time', 'N/A')}")
                if rec.get('receiver'):
                    lines.append(f"    接收人: {rec['receiver']}")
                if rec.get('notes'):
                    lines.append(f"    备注: {rec['notes']}")
                lines.append("")
        else:
            lines.append("  (无转赠记录)")
        lines.append("")
        
        lines.append("【淘汰记录】")
        eliminates = history.get("eliminate_records", [])
        if eliminates:
            for i, rec in enumerate(eliminates, 1):
                lines.append(f"  记录{i}:")
                lines.append(f"    淘汰原因: {rec.get('reason', 'N/A')}")
                lines.append(f"    操作人: {rec.get('operator', 'N/A')}")
                lines.append(f"    淘汰时间: {rec.get('eliminate_time', 'N/A')}")
                if rec.get('notes'):
                    lines.append(f"    备注: {rec['notes']}")
                lines.append("")
        else:
            lines.append("  (无淘汰记录)")
        lines.append("")
        
        lines.append("=" * 70)
        lines.append(f"报告生成时间: {datetime.now().isoformat()}")
        lines.append("=" * 70)
        
        filename = f"{output_dir}/item_{item_id}_trace_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        with open(filename, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        
        return filename
    
    def verify_report_consistency(self, json_file: str, text_file: str) -> Dict[str, Any]:
        """验证JSON和文本报告的一致性"""
        with open(json_file, 'r', encoding='utf-8') as f:
            json_data = json.load(f)
        
        with open(text_file, 'r', encoding='utf-8') as f:
            text_content = f.read()
        
        result = {
            "consistent": True,
            "mismatches": [],
            "verified_fields": []
        }
        
        if "summary" in json_data:
            summary = json_data["summary"]
            for key, value in summary.items():
                if str(value) in text_content:
                    result["verified_fields"].append(f"summary.{key}={value}")
                else:
                    result["consistent"] = False
                    result["mismatches"].append(f"摘要字段不匹配: {key}={value}")
        
        if "batch" in json_data:
            batch = json_data["batch"]
            if batch.get("batch_id") and batch["batch_id"] in text_content:
                result["verified_fields"].append("batch.batch_id")
            if batch.get("donor_name") and batch["donor_name"] in text_content:
                result["verified_fields"].append("batch.donor_name")
        
        item_count = str(json_data.get("summary", {}).get("total_items", 0))
        if item_count not in text_content:
            result["consistent"] = False
            result["mismatches"].append(f"物品总数不匹配: {item_count}")
        
        return result

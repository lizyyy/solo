from typing import List
from data_schema import CostAttributionRecord, DisposalType, RiskLevel
from datetime import datetime


class AttributionProcessor:
    
    def step1_import_gray_batch(self, records: List[CostAttributionRecord]) -> str:
        output = []
        output.append("=" * 60)
        output.append("【第一步】灰度批次导入")
        output.append("=" * 60)
        for rec in records:
            output.append(f"\n记录ID: {rec.record_id}")
            output.append(f"  内容预览: {rec.content_preview}")
            output.append(f"  灰度批次: {rec.gray_batch_name}")
            output.append(f"  导入时间: {rec.first_import_time.strftime('%Y-%m-%d %H:%M:%S')}")
            if rec.batch_runs:
                first_run = rec.batch_runs[0]
                output.append(f"  模型初判: {first_run.risk_level.value} (置信度 {first_run.confidence})")
                output.append(f"  模型版本: {first_run.model_version}")
        output.append("\n→ 第一步完成：所有灰度批次记录已导入系统，初始模型判定结果已落库")
        return "\n".join(output)
    
    def step2_review_annotator_messages(self, records: List[CostAttributionRecord]) -> str:
        output = []
        output.append("\n" + "=" * 60)
        output.append("【第二步】算法运营老唐补看标注员留言")
        output.append("=" * 60)
        for rec in records:
            output.append(f"\n记录ID: {rec.record_id}")
            if rec.annotation_messages:
                for msg in rec.annotation_messages:
                    output.append(f"  标注员 {msg.annotator_name} 留言:")
                    output.append(f"    → {msg.message}")
                    if msg.is_old_caliber:
                        output.append(f"    ⚠️  【标记】涉及旧口径，需追溯确认")
                output.append(f"  老唐处理: 已补看留言，追溯旧口径文档后确认处理方式")
            else:
                output.append(f"  无标注员留言")
        output.append("\n→ 第二步完成：标注员留言已补看，旧口径线索已关联")
        return "\n".join(output)
    
    def step3_update_evaluation_report(self, records: List[CostAttributionRecord]) -> str:
        output = []
        output.append("\n" + "=" * 60)
        output.append("【第三步】评测报告更新")
        output.append("=" * 60)
        
        for rec in records:
            output.append(f"\n记录ID: {rec.record_id}")
            output.append(f"  处理类型: {rec.disposal_type.value if rec.disposal_type else '未分类'}")
            
            if rec.needs_security_review:
                output.append(f"  ⚠️  状态: 待安全审核复核")
                output.append(f"  复核说明: {rec.review_note}")
            else:
                output.append(f"  最终风险: {rec.final_risk_level.value if rec.final_risk_level else '未定'}")
            
            if rec.manual_corrections and len(rec.batch_runs) >= 2:
                output.append(f"  注意: 存在人工改判被后续批跑覆盖的情况")
        
        output.append("\n→ 第三步完成：评测报告已更新，待复核项已标记")
        return "\n".join(output)
    
    def generate_evaluation_report(self, records: List[CostAttributionRecord]) -> str:
        report = []
        report.append("\n" + "╔" + "═" * 70 + "╗")
        report.append("║" + " " * 20 + "模 型 输 出 成 本 归 因 评 测 报 告" + " " * 13 + "║")
        report.append("╚" + "═" * 70 + "╝")
        report.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"记录总数: {len(records)}")
        report.append("")
        
        by_type = {}
        for rec in records:
            t = rec.disposal_type.value if rec.disposal_type else "未分类"
            by_type[t] = by_type.get(t, 0) + 1
        
        report.append("【处理类型分布】")
        for t, cnt in by_type.items():
            report.append(f"  - {t}: {cnt} 条")
        
        pending_count = sum(1 for r in records if r.needs_security_review)
        report.append(f"\n【待安全审核复核】: {pending_count} 条")
        
        report.append("\n" + "-" * 70)
        report.append("【明细记录】")
        
        for i, rec in enumerate(records, 1):
            report.append(f"\n[{i}] 记录ID: {rec.record_id}")
            report.append(f"    内容: {rec.content_preview}")
            report.append(f"    处理类型: {rec.disposal_type.value if rec.disposal_type else '-'}")
            
            report.append(f"    批跑记录:")
            for j, run in enumerate(rec.batch_runs, 1):
                report.append(f"      {j}. {run.batch_name} → {run.risk_level.value} (置信度{run.confidence})")
            
            if rec.manual_corrections:
                report.append(f"    人工修正:")
                for corr in rec.manual_corrections:
                    report.append(f"      - {corr.operator_name}: {corr.original_risk.value} → {corr.corrected_risk.value}")
                    report.append(f"        理由: {corr.reason}")
            
            if rec.annotation_messages:
                report.append(f"    标注员留言:")
                for msg in rec.annotation_messages:
                    tag = "【旧口径】" if msg.is_old_caliber else ""
                    report.append(f"      - {msg.annotator_name}{tag}: {msg.message}")
            
            if rec.needs_security_review:
                report.append(f"    ⚠️  待复核: {rec.review_note}")
            else:
                report.append(f"    最终判定: {rec.final_risk_level.value if rec.final_risk_level else '-'}")
        
        report.append("\n" + "=" * 70)
        report.append("【三种处理结果区分说明】")
        report.append("  1. 顺利记录 → 模型判读与人工一致，无异议，直接归档")
        report.append("  2. 人工改判被批跑覆盖 → 先别急着归正常，留给安全审核同事复核")
        report.append("  3. 标注员留言补录旧口径 → 从历史留言里挖出的旧口径，补录后更新评测")
        report.append("=" * 70)
        
        return "\n".join(report)
    
    def generate_history_report(self, records: List[CostAttributionRecord]) -> str:
        output = []
        output.append("\n" + "╔" + "═" * 70 + "╗")
        output.append("║" + " " * 25 + "历 史 操 作 追 踪 记 录" + " " * 22 + "║")
        output.append("╚" + "═" * 70 + "╝")
        
        for rec in records:
            output.append(f"\n记录ID: {rec.record_id}")
            output.append(f"内容预览: {rec.content_preview}")
            output.append("操作轨迹:")
            for event in rec.history:
                output.append(f"  {event}")
        
        return "\n".join(output)

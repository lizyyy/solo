import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

from config import OUTPUT_DIR
from risk_fusion import FusionResult, TimeConflict
from storage import SessionState, ReviewRecord


class Exporter:
    def __init__(self, output_dir: Optional[Path] = None):
        self.output_dir = output_dir or OUTPUT_DIR
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def export_markdown_report(
        self,
        results: Dict[str, FusionResult],
        time_conflicts: List[TimeConflict],
        pending_callbacks: List[Dict],
        session: Optional[SessionState] = None,
        filename: Optional[str] = None
    ) -> str:
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"督导报告_{timestamp}.md"
        
        filepath = self.output_dir / filename
        
        high_risk_cases = [r for r in results.values() if r.final_risk_level >= 3]
        missed_high_risk = [r for r in results.values() if r.is_missed_high_risk]
        template_issues = [r for r in results.values() if r.has_template_issue]
        
        report_lines = []
        report_lines.append("# 倾听记录质检督导报告")
        report_lines.append("")
        report_lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("")
        
        report_lines.append("## 一、质检概览")
        report_lines.append("")
        report_lines.append("| 指标 | 数量 |")
        report_lines.append("|------|------|")
        report_lines.append(f"| 总通话记录数 | {len(results)} |")
        report_lines.append(f"| 高/极高风险案例 | {len(high_risk_cases)} |")
        report_lines.append(f"| 漏标高风险案例 | {len(missed_high_risk)} |")
        report_lines.append(f"| 模板话术问题 | {len(template_issues)} |")
        report_lines.append(f"| 回访时间冲突 | {len(time_conflicts)} |")
        report_lines.append(f"| 待回访清单 | {len(pending_callbacks)} |")
        report_lines.append("")
        
        if missed_high_risk:
            report_lines.append("## 二、⚠️ 漏标高风险案例")
            report_lines.append("")
            report_lines.append("> 以下案例系统检测为高风险或极高风险，但原始标签为低/中风险，请重点复核！")
            report_lines.append("")
            
            for result in missed_high_risk:
                original_risk = result.original_tag.risk_level if result.original_tag else "无标签"
                report_lines.append(f"### 通话ID: {result.call_id}")
                report_lines.append("")
                report_lines.append(f"- **系统判定风险**: {result.final_risk} (置信度: {result.confidence*100:.1f}%)")
                report_lines.append(f"- **原始标签风险**: {original_risk}")
                report_lines.append("")
                
                if result.keyword_evidences:
                    report_lines.append("#### 关键词证据:")
                    report_lines.append("")
                    for ev in result.keyword_evidences:
                        if ev.category != "模板话术":
                            report_lines.append(f"- **[{ev.category}]** {ev.keyword} (出现 {ev.count} 次)")
                    report_lines.append("")
                
                if result.model_result and result.model_result.probabilities:
                    report_lines.append("#### 模型预测概率:")
                    report_lines.append("")
                    for risk, prob in sorted(result.model_result.probabilities.items(), 
                                            key=lambda x: x[1], reverse=True):
                        report_lines.append(f"- {risk}: {prob*100:.1f}%")
                    report_lines.append("")
                
                report_lines.append("---")
                report_lines.append("")
        
        report_lines.append("## 三、高风险案例详情")
        report_lines.append("")
        
        if high_risk_cases:
            for result in sorted(high_risk_cases, key=lambda x: x.final_risk_level, reverse=True):
                report_lines.append(f"### 通话ID: {result.call_id}")
                report_lines.append("")
                report_lines.append(f"- **风险等级**: {result.final_risk}")
                report_lines.append(f"- **置信度**: {result.confidence*100:.1f}%")
                report_lines.append(f"- **判定来源**: {result.risk_source.value if result.risk_source else '未知'}")
                
                if result.manual_override:
                    report_lines.append(f"- **人工改判**: 是")
                    report_lines.append(f"- **改判原因**: {result.override_reason}")
                
                report_lines.append("")
                
                if result.keyword_evidences:
                    report_lines.append("#### 关键词证据:")
                    report_lines.append("")
                    for ev in result.keyword_evidences:
                        report_lines.append(f"- **[{ev.category}]** {ev.keyword} (出现 {ev.count} 次)")
                    report_lines.append("")
                
                if result.callback:
                    report_lines.append("#### 回访信息:")
                    report_lines.append("")
                    if result.callback.callback_time:
                        report_lines.append(f"- **回访时间**: {result.callback.callback_time.strftime('%Y-%m-%d %H:%M')}")
                    if result.callback.assigned_volunteer:
                        report_lines.append(f"- **分配志愿者**: {result.callback.assigned_volunteer}")
                    report_lines.append(f"- **优先级**: {result.callback.priority}")
                    report_lines.append(f"- **状态**: {result.callback.status}")
                    report_lines.append("")
                
                report_lines.append("---")
                report_lines.append("")
        else:
            report_lines.append("本次质检未发现高风险案例。")
            report_lines.append("")
        
        if template_issues:
            report_lines.append("## 四、模板话术问题")
            report_lines.append("")
            report_lines.append("> 以下通话中检测到较多模板化话术，可能影响服务质量。")
            report_lines.append("")
            
            for result in template_issues:
                report_lines.append(f"### 通话ID: {result.call_id}")
                report_lines.append("")
                report_lines.append(f"- **模板话术占比**: {result.template_issue_score*100:.1f}%")
                report_lines.append("")
                
                template_evidences = [e for e in result.keyword_evidences if e.category == "模板话术"]
                if template_evidences:
                    report_lines.append("#### 检测到的模板话术:")
                    report_lines.append("")
                    for ev in template_evidences:
                        report_lines.append(f"- {ev.keyword} (出现 {ev.count} 次)")
                    report_lines.append("")
                
                report_lines.append("---")
                report_lines.append("")
        
        if time_conflicts:
            report_lines.append("## 五、回访时间冲突")
            report_lines.append("")
            report_lines.append("> 以下回访安排存在时间冲突（间隔小于30分钟），请及时调整。")
            report_lines.append("")
            
            for conflict in time_conflicts:
                report_lines.append("### 冲突详情")
                report_lines.append("")
                report_lines.append(f"- **通话ID 1**: {conflict.call_id_1}")
                report_lines.append(f"- **通话ID 2**: {conflict.call_id_2}")
                time1_str = conflict.time_1.strftime('%Y-%m-%d %H:%M') if conflict.time_1 else "未知"
                time2_str = conflict.time_2.strftime('%Y-%m-%d %H:%M') if conflict.time_2 else "未知"
                report_lines.append(f"- **时间 1**: {time1_str}")
                report_lines.append(f"- **时间 2**: {time2_str}")
                if conflict.volunteer:
                    report_lines.append(f"- **志愿者**: {conflict.volunteer}")
                report_lines.append(f"- **冲突类型**: {conflict.conflict_type}")
                report_lines.append("")
                report_lines.append("---")
                report_lines.append("")
        
        if pending_callbacks:
            report_lines.append("## 六、待回访清单")
            report_lines.append("")
            report_lines.append("> 按风险优先级排序的待回访清单。")
            report_lines.append("")
            report_lines.append("| 通话ID | 风险等级 | 回访时间 | 志愿者 | 优先级 | 漏标提醒 |")
            report_lines.append("|--------|----------|----------|--------|--------|----------|")
            
            for cb in pending_callbacks:
                time_str = cb['callback_time'].strftime('%Y-%m-%d %H:%M') if cb['callback_time'] else "未安排"
                volunteer = cb['assigned_volunteer'] or "未分配"
                missed_flag = "⚠️ 是" if cb['is_high_risk_missed'] else "否"
                report_lines.append(f"| {cb['call_id']} | {cb['risk_level']} | {time_str} | {volunteer} | {cb['priority']} | {missed_flag} |")
            
            report_lines.append("")
        
        report_lines.append("## 七、风险等级说明")
        report_lines.append("")
        report_lines.append("| 风险等级 | 说明 | 建议行动 |")
        report_lines.append("|----------|------|----------|")
        report_lines.append("| 极高风险 | 存在明确自杀/自伤意图或计划 | 立即启动危机干预流程，24小时内必须回访 |")
        report_lines.append("| 高风险 | 存在较强自杀意念或严重心理危机 | 24小时内优先回访，密切关注 |")
        report_lines.append("| 中风险 | 存在情绪困扰或心理问题，需关注 | 48小时内回访，提供支持 |")
        report_lines.append("| 低风险 | 一般情绪倾诉，无明显危机迹象 | 按常规流程处理 |")
        report_lines.append("")
        
        report_lines.append("---")
        report_lines.append("")
        report_lines.append(f"*本报告由倾听记录质检员自动生成*")
        
        content = '\n'.join(report_lines)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return str(filepath)
    
    def export_csv_issues(
        self,
        results: Dict[str, FusionResult],
        time_conflicts: List[TimeConflict],
        filename: Optional[str] = None
    ) -> str:
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"问题清单_{timestamp}.csv"
        
        filepath = self.output_dir / filename
        
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow(["问题类型", "通话ID", "风险等级", "置信度", "关键词证据", "原始标签", "状态", "备注"])
            
            for result in results.values():
                if result.is_missed_high_risk:
                    keywords = "; ".join([
                        f"{e.keyword}({e.count}次)" 
                        for e in result.keyword_evidences 
                        if e.category != "模板话术"
                    ])
                    original_risk = result.original_tag.risk_level if result.original_tag else "无标签"
                    writer.writerow([
                        "漏标高风险",
                        result.call_id,
                        result.final_risk,
                        f"{result.confidence*100:.1f}%",
                        keywords,
                        original_risk,
                        "待复核",
                        ""
                    ])
            
            for result in results.values():
                if result.has_template_issue:
                    template_keywords = "; ".join([
                        f"{e.keyword}({e.count}次)" 
                        for e in result.keyword_evidences 
                        if e.category == "模板话术"
                    ])
                    writer.writerow([
                        "模板话术",
                        result.call_id,
                        result.final_risk,
                        f"{result.template_issue_score*100:.1f}%",
                        template_keywords,
                        "",
                        "待关注",
                        ""
                    ])
            
            for conflict in time_conflicts:
                time1_str = conflict.time_1.strftime('%Y-%m-%d %H:%M') if conflict.time_1 else "未知"
                time2_str = conflict.time_2.strftime('%Y-%m-%d %H:%M') if conflict.time_2 else "未知"
                writer.writerow([
                    "时间冲突",
                    conflict.call_id_1,
                    "",
                    "",
                    f"与{conflict.call_id_2}冲突: {time1_str} vs {time2_str}",
                    "",
                    "待调整",
                    conflict.volunteer or ""
                ])
        
        return str(filepath)
    
    def export_json_audit(
        self,
        results: Dict[str, FusionResult],
        time_conflicts: List[TimeConflict],
        session: Optional[SessionState] = None,
        filename: Optional[str] = None
    ) -> str:
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"审计包_{timestamp}.json"
        
        filepath = self.output_dir / filename
        
        audit_data = {
            "audit_info": {
                "generated_at": datetime.now().isoformat(),
                "version": "1.0.0"
            },
            "summary": {
                "total_calls": len(results),
                "high_risk_count": len([r for r in results.values() if r.final_risk_level >= 3]),
                "missed_high_risk_count": len([r for r in results.values() if r.is_missed_high_risk]),
                "template_issue_count": len([r for r in results.values() if r.has_template_issue]),
                "time_conflict_count": len(time_conflicts)
            },
            "results": {},
            "time_conflicts": [],
            "reviews": {}
        }
        
        for call_id, result in results.items():
            audit_data["results"][call_id] = {
                "call_id": result.call_id,
                "final_risk": result.final_risk,
                "final_risk_level": result.final_risk_level,
                "risk_source": result.risk_source.value if result.risk_source else None,
                "confidence": result.confidence,
                "is_missed_high_risk": result.is_missed_high_risk,
                "has_template_issue": result.has_template_issue,
                "template_issue_score": result.template_issue_score,
                "manual_override": result.manual_override,
                "override_reason": result.override_reason,
                "keyword_evidences": [
                    {
                        "keyword": e.keyword,
                        "count": e.count,
                        "category": e.category
                    }
                    for e in result.keyword_evidences
                ],
                "original_risk": result.original_tag.risk_level if result.original_tag else None,
                "model_probabilities": result.model_result.probabilities if result.model_result else None
            }
        
        for conflict in time_conflicts:
            audit_data["time_conflicts"].append({
                "call_id_1": conflict.call_id_1,
                "call_id_2": conflict.call_id_2,
                "time_1": conflict.time_1.isoformat() if conflict.time_1 else None,
                "time_2": conflict.time_2.isoformat() if conflict.time_2 else None,
                "volunteer": conflict.volunteer,
                "conflict_type": conflict.conflict_type
            })
        
        if session and session.reviewed_calls:
            for call_id, review in session.reviewed_calls.items():
                audit_data["reviews"][call_id] = {
                    "review_id": review.review_id,
                    "call_id": review.call_id,
                    "original_risk": review.original_risk,
                    "new_risk": review.new_risk,
                    "reviewer": review.reviewer,
                    "review_time": review.review_time.isoformat() if review.review_time else None,
                    "reason": review.reason,
                    "notes": review.notes
                }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(audit_data, f, ensure_ascii=False, indent=2)
        
        return str(filepath)
    
    def export_all(
        self,
        results: Dict[str, FusionResult],
        time_conflicts: List[TimeConflict],
        pending_callbacks: List[Dict],
        session: Optional[SessionState] = None
    ) -> Dict[str, str]:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        md_path = self.export_markdown_report(
            results, time_conflicts, pending_callbacks, session,
            filename=f"督导报告_{timestamp}.md"
        )
        
        csv_path = self.export_csv_issues(
            results, time_conflicts,
            filename=f"问题清单_{timestamp}.csv"
        )
        
        json_path = self.export_json_audit(
            results, time_conflicts, session,
            filename=f"审计包_{timestamp}.json"
        )
        
        return {
            "markdown_report": md_path,
            "csv_issues": csv_path,
            "json_audit": json_path
        }

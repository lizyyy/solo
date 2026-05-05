from typing import List, Dict, Any, Optional
from io import StringIO
import csv
from datetime import datetime
from app.ranking_service import RankedContestant, RankingService, ContestantScore


class ReportService:
    @staticmethod
    def export_ranking_csv(ranked_contestants: List[RankedContestant]) -> str:
        output = StringIO()
        writer = csv.writer(output)
        
        headers = [
            'Rank', 'Rank Display', 'Contestant ID', 'Name', 
            'Final Score', 'Category', 'Is Promoted', 
            'Promotion Status', 'Appeal Impact'
        ]
        writer.writerow(headers)
        
        for contestant in ranked_contestants:
            row = [
                contestant.rank,
                contestant.rank_display,
                contestant.contestant_id,
                contestant.name,
                f"{contestant.final_score:.3f}",
                contestant.category or '',
                'Yes' if contestant.is_promoted else 'No',
                contestant.promotion_status or '',
                contestant.appeal_impact or ''
            ]
            writer.writerow(row)
        
        return output.getvalue()
    
    @staticmethod
    def generate_review_report(
        ranked_contestants: List[RankedContestant],
        rules: Dict[str, Any],
        contestant_scores: List[ContestantScore],
        appeals_data: List[Dict[str, Any]]
    ) -> str:
        promoted_count = sum(1 for c in ranked_contestants if c.is_promoted)
        total_count = len(ranked_contestants)
        
        boundary_cases = []
        cross_line_cases = []
        tie_at_boundary_cases = []
        
        for c in ranked_contestants:
            if c.promotion_status == 'exactly_boundary':
                boundary_cases.append(c)
            elif c.promotion_status == 'cross_line_after_appeal':
                cross_line_cases.append(c)
            elif c.promotion_status == 'tie_at_boundary':
                tie_at_boundary_cases.append(c)
        
        report_lines = []
        
        report_lines.append("# 赛事评分排名复核报告")
        report_lines.append("")
        report_lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("")
        report_lines.append("---")
        report_lines.append("")
        
        report_lines.append("## 1. 排名规则概览")
        report_lines.append("")
        report_lines.append(f"- **规则名称**: {rules.get('rule_name', 'default')}")
        report_lines.append(f"- **去掉最高分数量**: {rules.get('drop_highest', 0)}")
        report_lines.append(f"- **去掉最低分数量**: {rules.get('drop_lowest', 0)}")
        report_lines.append(f"- **排名模式**: {'竞赛排名 (1,2,2,4)' if rules.get('ranking_mode') == 'competition' else '密集排名 (1,2,2,3)'}")
        
        if rules.get('promotion_threshold'):
            report_lines.append(f"- **晋级名额**: 前 {rules['promotion_threshold']} 名")
        if rules.get('promotion_score'):
            report_lines.append(f"- **晋级分数线**: {rules['promotion_score']} 分")
        
        report_lines.append("")
        
        report_lines.append("## 2. 排名统计概要")
        report_lines.append("")
        report_lines.append(f"- **总参赛人数**: {total_count}")
        report_lines.append(f"- **晋级人数**: {promoted_count}")
        report_lines.append(f"- **未晋级人数**: {total_count - promoted_count}")
        report_lines.append("")
        
        if rules.get('promotion_threshold') or rules.get('promotion_score'):
            report_lines.append("## 3. 关键边界情况分析")
            report_lines.append("")
            
            if boundary_cases:
                report_lines.append("### 3.1 刚好等于边界分的选手")
                report_lines.append("")
                for c in boundary_cases:
                    report_lines.append(f"- **{c.name}** ({c.contestant_id}): 分数 {c.final_score:.3f}, 排名 {c.rank_display}")
                report_lines.append("")
            
            if tie_at_boundary_cases:
                report_lines.append("### 3.2 晋级线附近同分的选手")
                report_lines.append("")
                for c in tie_at_boundary_cases:
                    report_lines.append(f"- **{c.name}** ({c.contestant_id}): 分数 {c.final_score:.3f}, 排名 {c.rank_display}")
                report_lines.append("")
            
            if cross_line_cases:
                report_lines.append("### 3.3 申诉改分后跨线的选手")
                report_lines.append("")
                for c in cross_line_cases:
                    report_lines.append(f"- **{c.name}** ({c.contestant_id}): 分数 {c.final_score:.3f}, 排名 {c.rank_display}")
                    if c.appeal_impact:
                        report_lines.append(f"  - 影响说明: {c.appeal_impact}")
                report_lines.append("")
            
            if not boundary_cases and not tie_at_boundary_cases and not cross_line_cases:
                report_lines.append("> 无特殊边界情况。")
                report_lines.append("")
        
        if appeals_data:
            report_lines.append("## 4. 申诉处理记录")
            report_lines.append("")
            
            pending_count = sum(1 for a in appeals_data if a.get('status') == 'pending')
            approved_count = sum(1 for a in appeals_data if a.get('status') == 'approved')
            rejected_count = sum(1 for a in appeals_data if a.get('status') == 'rejected')
            
            report_lines.append(f"- **待处理**: {pending_count}")
            report_lines.append(f"- **已通过**: {approved_count}")
            report_lines.append(f"- **已驳回**: {rejected_count}")
            report_lines.append("")
            
            if approved_count > 0:
                report_lines.append("### 4.1 已通过的申诉")
                report_lines.append("")
                for appeal in appeals_data:
                    if appeal.get('status') == 'approved':
                        contestant_name = appeal.get('contestant_name', 'Unknown')
                        report_lines.append(f"- **{contestant_name}** ({appeal.get('contestant_id')}):")
                        report_lines.append(f"  - 评委: {appeal.get('judge_id', 'N/A')}")
                        report_lines.append(f"  - 原分数: {appeal.get('original_score')} -> 新分数: {appeal.get('new_score')}")
                        if appeal.get('reason'):
                            report_lines.append(f"  - 申诉原因: {appeal.get('reason')}")
                        report_lines.append("")
        
        report_lines.append("## 5. 完整排名列表")
        report_lines.append("")
        
        current_rank = None
        for contestant in ranked_contestants:
            if contestant.rank != current_rank:
                current_rank = contestant.rank
                report_lines.append(f"### 第 {contestant.rank_display} 名")
                report_lines.append("")
            
            promotion_marker = ""
            if contestant.is_promoted:
                promotion_marker = " **[晋级]**"
            if contestant.promotion_status == 'tie_at_boundary':
                promotion_marker += " *(同分边界)*"
            elif contestant.promotion_status == 'exactly_boundary':
                promotion_marker += " *(刚好达标)*"
            elif contestant.promotion_status == 'cross_line_after_appeal':
                promotion_marker += " *(申诉后跨线)*"
            
            report_lines.append(f"1. **{contestant.name}** ({contestant.contestant_id}){promotion_marker}")
            report_lines.append(f"   - 最终分数: {contestant.final_score:.3f}")
            if contestant.category:
                report_lines.append(f"   - 组别: {contestant.category}")
            if contestant.appeal_impact:
                report_lines.append(f"   - 申诉影响: {contestant.appeal_impact}")
            report_lines.append("")
        
        report_lines.append("---")
        report_lines.append("")
        report_lines.append("*报告由赛事评分排名复核系统自动生成*")
        
        return "\n".join(report_lines)
    
    @staticmethod
    def get_rankings_by_category(
        ranked_contestants: List[RankedContestant]
    ) -> Dict[str, List[RankedContestant]]:
        categories = {}
        for c in ranked_contestants:
            cat = c.category or '未分组'
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(c)
        
        return categories

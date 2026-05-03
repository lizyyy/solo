"""
Report Generators Module
Generates three types of output:
1. mismatch_cases.csv - Detailed mismatch cases
2. bias_review.md - Detailed review report in markdown
3. HTML overview - Interactive visual overview
"""

import csv
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

from resume_matcher.matcher.bias_reviewer import (
    BiasReviewer,
    MismatchCase,
    CandidateReviewResult,
    MismatchType
)


class CSVReporter:
    """Generates mismatch_cases.csv report"""

    @staticmethod
    def generate(
        reviewer: BiasReviewer,
        output_path: str
    ) -> str:
        """
        Generate CSV report of all mismatch cases.

        Columns:
        candidate_id,job_id,mismatch_type,severity,description,model_score,
        model_rank,interview_outcome,technical_rating,recommendation,details_json
        """
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        fieldnames = [
            'candidate_id',
            'job_id',
            'mismatch_type',
            'severity',
            'description',
            'model_score',
            'model_rank',
            'interview_outcome',
            'technical_rating',
            'recommendation',
            'details_json'
        ]

        with open(path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for mismatch in reviewer.mismatch_cases:
                row = {
                    'candidate_id': mismatch.candidate_id,
                    'job_id': mismatch.job_id,
                    'mismatch_type': mismatch.mismatch_type.value,
                    'severity': mismatch.severity,
                    'description': mismatch.description,
                    'model_score': f"{mismatch.model_score:.4f}" if mismatch.model_score is not None else '',
                    'model_rank': mismatch.model_rank if mismatch.model_rank is not None else '',
                    'interview_outcome': mismatch.interview_outcome or '',
                    'technical_rating': f"{mismatch.technical_rating:.2f}" if mismatch.technical_rating is not None else '',
                    'recommendation': mismatch.recommendation,
                    'details_json': json.dumps(mismatch.details, ensure_ascii=False)
                }
                writer.writerow(row)

        return str(path)


class MarkdownReporter:
    """Generates bias_review.md report"""

    @staticmethod
    def generate(
        reviewer: BiasReviewer,
        output_path: str,
        generated_at: Optional[str] = None
    ) -> str:
        """Generate detailed markdown report"""
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        if generated_at is None:
            generated_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        stats = reviewer.get_summary_statistics()

        content = []

        content.append(f"# 简历岗位匹配偏差复核报告")
        content.append(f"")
        content.append(f"**生成时间**: {generated_at}")
        content.append(f"**岗位ID**: {stats['job_id']}")
        content.append(f"**岗位名称**: {stats['job_title']}")
        content.append(f"")
        content.append(f"---")
        content.append(f"")

        content.append(f"## 一、概览统计")
        content.append(f"")
        content.append(f"| 指标 | 数值 |")
        content.append(f"|------|------|")
        content.append(f"| 总候选人数 | {stats['total_candidates']} |")
        content.append(f"| 发现不匹配数 | {stats['total_mismatches']} |")
        content.append(f"| 存在不匹配的候选人数 | {stats['candidates_with_mismatches']} |")
        content.append(f"")

        content.append(f"### 1.1 不匹配类型分布")
        content.append(f"")
        for mtype, count in stats['mismatch_type_counts'].items():
            content.append(f"- **{mtype}**: {count} 例")
        content.append(f"")

        content.append(f"### 1.2 严重程度分布")
        content.append(f"")
        for severity, count in stats['severity_counts'].items():
            content.append(f"- **{severity}**: {count} 例")
        content.append(f"")

        content.append(f"---")
        content.append(f"")

        content.append(f"## 二、详细不匹配案例分析")
        content.append(f"")

        mismatch_types_to_show = [
            (MismatchType.HIGH_SCORE_BUT_REJECTED, "模型高分但面试淘汰"),
            (MismatchType.SKILL_ALIAS_MISMATCH, "技能别名不匹配"),
            (MismatchType.EXPERIENCE_BOUNDARY, "年限边界案例"),
            (MismatchType.LOW_SCORE_BUT_PASSED, "模型低分但面试通过"),
            (MismatchType.SKILL_GAP, "技能差距"),
            (MismatchType.EXPERIENCE_GAP, "经验差距"),
        ]

        for mismatch_type, display_name in mismatch_types_to_show:
            mismatches = reviewer.get_mismatches_by_type(mismatch_type)
            if not mismatches:
                continue

            content.append(f"### 2.{list(MismatchType).index(mismatch_type) + 1} {display_name}")
            content.append(f"")
            content.append(f"**总计**: {len(mismatches)} 例")
            content.append(f"")

            high_severity = [m for m in mismatches if m.severity == 'high']
            if high_severity:
                content.append(f"#### 高优先级案例")
                content.append(f"")
                for mismatch in high_severity:
                    content.append(f"##### 候选人 {mismatch.candidate_id}")
                    content.append(f"")
                    content.append(f"- **描述**: {mismatch.description}")
                    if mismatch.model_score is not None:
                        content.append(f"- **模型分数**: {mismatch.model_score:.4f}")
                    if mismatch.model_rank is not None:
                        content.append(f"- **模型排名**: #{mismatch.model_rank}")
                    if mismatch.interview_outcome:
                        content.append(f"- **面试结果**: {mismatch.interview_outcome}")
                    content.append(f"- **建议**: {mismatch.recommendation}")
                    if mismatch.details:
                        content.append(f"- **详细信息**:")
                        for key, value in mismatch.details.items():
                            if isinstance(value, list):
                                value_str = ", ".join(str(v) for v in value)
                            else:
                                value_str = str(value)
                            content.append(f"  - {key}: {value_str}")
                    content.append(f"")

            medium_severity = [m for m in mismatches if m.severity == 'medium']
            if medium_severity:
                content.append(f"#### 中优先级案例")
                content.append(f"")
                content.append(f"| 候选人ID | 描述 | 建议 |")
                content.append(f"|----------|------|------|")
                for mismatch in medium_severity[:10]:
                    desc = mismatch.description.replace('|', '\\|')
                    rec = mismatch.recommendation.replace('|', '\\|')
                    content.append(f"| {mismatch.candidate_id} | {desc} | {rec} |")
                if len(medium_severity) > 10:
                    content.append(f"| ... | (共 {len(medium_severity)} 例) | ... |")
                content.append(f"")

        content.append(f"---")
        content.append(f"")

        content.append(f"## 三、按候选人汇总")
        content.append(f"")

        unique_candidates = sorted(set(m.candidate_id for m in reviewer.mismatch_cases))
        content.append(f"存在不匹配的候选人: {len(unique_candidates)} 人")
        content.append(f"")

        for candidate_id in unique_candidates[:20]:
            candidate_mismatches = reviewer.get_mismatches_by_candidate(candidate_id)
            review = reviewer.get_review_by_candidate(candidate_id)

            content.append(f"### 候选人 {candidate_id}")
            content.append(f"")

            if review:
                content.append(f"- **技能匹配分数**: {review.skill_match_score:.2%}")
                if review.matched_skills:
                    content.append(f"- **匹配技能**: {', '.join(review.matched_skills)}")
                if review.missing_skills:
                    content.append(f"- **缺失技能**: {', '.join(review.missing_skills)}")
                if review.experience_info:
                    content.append(f"- **工作年限**: {review.experience_info.total_years} 年")
                    if review.experience_info.is_boundary_case:
                        content.append(f"  - ⚠️ 边界案例: {review.experience_info.boundary_direction} {review.experience_info.boundary_threshold} 年")

            content.append(f"- **发现问题数**: {len(candidate_mismatches)}")
            for mismatch in candidate_mismatches:
                content.append(f"  - [{mismatch.severity}] {mismatch.mismatch_type.value}: {mismatch.description}")
            content.append(f"")

        if len(unique_candidates) > 20:
            content.append(f"... 还有 {len(unique_candidates) - 20} 位候选人，请查看 CSV 文件获取完整列表")
            content.append(f"")

        content.append(f"---")
        content.append(f"")

        content.append(f"## 四、行动建议")
        content.append(f"")

        high_severity_count = stats['severity_counts'].get('high', 0)
        if high_severity_count > 0:
            content.append(f"### 4.1 高优先级行动")
            content.append(f"")
            content.append(f"**发现 {high_severity_count} 个高优先级问题需要立即关注:**")
            content.append(f"")

            high_score_rejected = reviewer.get_mismatches_by_type(MismatchType.HIGH_SCORE_BUT_REJECTED)
            if high_score_rejected:
                content.append(f"1. **模型高分但面试淘汰** ({len(high_score_rejected)} 例):")
                content.append(f"   - 分析模型为什么高估了这些候选人")
                content.append(f"   - 检查模型特征是否忽略了面试中发现的问题")
                content.append(f"   - 考虑添加更多面试相关的训练数据")
                content.append(f"")

            skill_alias = reviewer.get_mismatches_by_type(MismatchType.SKILL_ALIAS_MISMATCH)
            if skill_alias:
                content.append(f"2. **技能别名不匹配** ({len(skill_alias)} 例):")
                content.append(f"   - 更新技能别名映射表")
                content.append(f"   - 审查现有映射是否覆盖了所有常见变体")
                content.append(f"")

            experience_boundary = reviewer.get_mismatches_by_type(MismatchType.EXPERIENCE_BOUNDARY)
            if experience_boundary:
                content.append(f"3. **年限边界案例** ({len(experience_boundary)} 例):")
                content.append(f"   - 审查这些边界案例的处理方式")
                content.append(f"   - 考虑是否需要调整年限阈值或增加灵活性")
                content.append(f"")

        content.append(f"### 4.2 模型改进建议")
        content.append(f"")
        content.append(f"1. **技能归一化**: 扩展技能别名映射表，覆盖更多行业术语变体")
        content.append(f"2. **年限处理**: 优化边界案例的评分逻辑，避免一刀切")
        content.append(f"3. **特征工程**: 考虑添加更多与面试表现相关的特征")
        content.append(f"4. **阈值调整**: 根据复核结果调整模型分数阈值")
        content.append(f"")

        content.append(f"---")
        content.append(f"")
        content.append(f"*本报告由简历岗位匹配偏差复核工具自动生成*")

        with open(path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(content))

        return str(path)


class HTMLReporter:
    """Generates interactive HTML overview report"""

    @staticmethod
    def generate(
        reviewer: BiasReviewer,
        output_path: str,
        generated_at: Optional[str] = None
    ) -> str:
        """Generate interactive HTML report"""
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        if generated_at is None:
            generated_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        stats = reviewer.get_summary_statistics()

        mismatch_data = []
        for mismatch in reviewer.mismatch_cases:
            mismatch_data.append({
                'candidate_id': mismatch.candidate_id,
                'job_id': mismatch.job_id,
                'mismatch_type': mismatch.mismatch_type.value,
                'severity': mismatch.severity,
                'description': mismatch.description,
                'model_score': mismatch.model_score,
                'model_rank': mismatch.model_rank,
                'interview_outcome': mismatch.interview_outcome,
                'technical_rating': mismatch.technical_rating,
                'recommendation': mismatch.recommendation,
                'details': mismatch.details
            })

        mismatch_json = json.dumps(mismatch_data, ensure_ascii=False)
        stats_json = json.dumps(stats, ensure_ascii=False)

        html = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>简历岗位匹配偏差复核概览</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }}
        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}
        .header {{
            background: white;
            border-radius: 16px;
            padding: 30px;
            margin-bottom: 20px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }}
        .header h1 {{
            color: #1a202c;
            font-size: 28px;
            margin-bottom: 10px;
        }}
        .header .meta {{
            color: #718096;
            font-size: 14px;
        }}
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }}
        .stat-card {{
            background: white;
            border-radius: 12px;
            padding: 24px;
            text-align: center;
            box-shadow: 0 4px 15px rgba(0,0,0,0.08);
            transition: transform 0.2s, box-shadow 0.2s;
        }}
        .stat-card:hover {{
            transform: translateY(-4px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.12);
        }}
        .stat-value {{
            font-size: 36px;
            font-weight: bold;
            color: #4a5568;
            margin-bottom: 8px;
        }}
        .stat-label {{
            font-size: 14px;
            color: #718096;
        }}
        .stat-card.high .stat-value {{ color: #e53e3e; }}
        .stat-card.medium .stat-value {{ color: #ed8936; }}
        .stat-card.low .stat-value {{ color: #38a169; }}
        .main-content {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }}
        @media (max-width: 1024px) {{
            .main-content {{
                grid-template-columns: 1fr;
            }}
        }}
        .panel {{
            background: white;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.08);
        }}
        .panel h2 {{
            color: #2d3748;
            font-size: 18px;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 2px solid #edf2f7;
        }}
        .filter-bar {{
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 20px;
        }}
        .filter-btn {{
            padding: 8px 16px;
            border: 2px solid #e2e8f0;
            background: white;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            color: #4a5568;
            transition: all 0.2s;
        }}
        .filter-btn:hover {{
            border-color: #667eea;
            color: #667eea;
        }}
        .filter-btn.active {{
            background: #667eea;
            border-color: #667eea;
            color: white;
        }}
        .filter-btn.severity-high.active {{ background: #e53e3e; border-color: #e53e3e; }}
        .filter-btn.severity-medium.active {{ background: #ed8936; border-color: #ed8936; }}
        .filter-btn.severity-low.active {{ background: #38a169; border-color: #38a169; }}
        .mismatch-list {{
            max-height: 500px;
            overflow-y: auto;
        }}
        .mismatch-item {{
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 12px;
            border-left: 4px solid #e2e8f0;
            background: #f7fafc;
            cursor: pointer;
            transition: all 0.2s;
        }}
        .mismatch-item:hover {{
            background: #edf2f7;
        }}
        .mismatch-item.severity-high {{ border-left-color: #e53e3e; }}
        .mismatch-item.severity-medium {{ border-left-color: #ed8936; }}
        .mismatch-item.severity-low {{ border-left-color: #38a169; }}
        .mismatch-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }}
        .mismatch-candidate {{
            font-weight: 600;
            color: #2d3748;
        }}
        .mismatch-type {{
            font-size: 12px;
            padding: 2px 8px;
            border-radius: 12px;
            background: #e2e8f0;
            color: #4a5568;
        }}
        .mismatch-desc {{
            font-size: 14px;
            color: #718096;
            margin-bottom: 8px;
        }}
        .mismatch-meta {{
            display: flex;
            gap: 16px;
            font-size: 12px;
            color: #a0aec0;
        }}
        .detail-panel {{
            display: none;
            padding: 16px;
            margin-top: 12px;
            background: white;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
        }}
        .detail-panel.show {{
            display: block;
        }}
        .detail-row {{
            display: flex;
            padding: 8px 0;
            border-bottom: 1px solid #f7fafc;
        }}
        .detail-row:last-child {{
            border-bottom: none;
        }}
        .detail-label {{
            font-weight: 500;
            color: #4a5568;
            width: 140px;
            flex-shrink: 0;
        }}
        .detail-value {{
            color: #718096;
            flex: 1;
        }}
        .chart-container {{
            height: 300px;
            display: flex;
            align-items: center;
            justify-content: center;
        }}
        .bar-chart {{
            display: flex;
            align-items: flex-end;
            justify-content: center;
            gap: 30px;
            height: 250px;
            width: 100%;
        }}
        .bar-item {{
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 60px;
        }}
        .bar {{
            width: 50px;
            background: linear-gradient(to top, #667eea, #764ba2);
            border-radius: 4px 4px 0 0;
            transition: height 0.5s ease;
            position: relative;
        }}
        .bar:hover {{
            opacity: 0.8;
        }}
        .bar-label {{
            margin-top: 8px;
            font-size: 11px;
            color: #718096;
            text-align: center;
            word-break: break-word;
        }}
        .bar-value {{
            position: absolute;
            top: -20px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 14px;
            font-weight: bold;
            color: #4a5568;
        }}
        .empty-state {{
            text-align: center;
            padding: 40px;
            color: #a0aec0;
        }}
        .empty-state-icon {{
            font-size: 48px;
            margin-bottom: 16px;
        }}
        .legend {{
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }}
        .legend-item {{
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            color: #718096;
        }}
        .legend-color {{
            width: 12px;
            height: 12px;
            border-radius: 2px;
        }}
        .legend-color.high {{ background: #e53e3e; }}
        .legend-color.medium {{ background: #ed8936; }}
        .legend-color.low {{ background: #38a169; }}
        .tabs {{
            display: flex;
            border-bottom: 2px solid #edf2f7;
            margin-bottom: 20px;
        }}
        .tab {{
            padding: 12px 24px;
            cursor: pointer;
            color: #718096;
            border-bottom: 2px solid transparent;
            margin-bottom: -2px;
            transition: all 0.2s;
        }}
        .tab:hover {{
            color: #667eea;
        }}
        .tab.active {{
            color: #667eea;
            border-bottom-color: #667eea;
        }}
        .tab-content {{
            display: none;
        }}
        .tab-content.active {{
            display: block;
        }}
        .pie-chart-container {{
            display: flex;
            align-items: center;
            justify-content: center;
            height: 250px;
        }}
        .pie-chart {{
            width: 200px;
            height: 200px;
            border-radius: 50%;
            position: relative;
        }}
        .pie-legend {{
            margin-left: 30px;
        }}
        .pie-legend-item {{
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }}
        .pie-color {{
            width: 16px;
            height: 16px;
            border-radius: 4px;
        }}
        .no-data {{
            text-align: center;
            padding: 60px 20px;
            color: #a0aec0;
        }}
        .no-data-icon {{
            font-size: 64px;
            margin-bottom: 16px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 简历岗位匹配偏差复核概览</h1>
            <div class="meta">
                <strong>岗位:</strong> {stats['job_title']} ({stats['job_id']}) | 
                <strong>生成时间:</strong> {generated_at}
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">{stats['total_candidates']}</div>
                <div class="stat-label">总候选人数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{stats['total_mismatches']}</div>
                <div class="stat-label">发现不匹配数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{stats['candidates_with_mismatches']}</div>
                <div class="stat-label">存在问题的候选人</div>
            </div>
            <div class="stat-card high">
                <div class="stat-value">{stats['severity_counts'].get('high', 0)}</div>
                <div class="stat-label">高优先级问题</div>
            </div>
            <div class="stat-card medium">
                <div class="stat-value">{stats['severity_counts'].get('medium', 0)}</div>
                <div class="stat-label">中优先级问题</div>
            </div>
            <div class="stat-card low">
                <div class="stat-value">{stats['severity_counts'].get('low', 0)}</div>
                <div class="stat-label">低优先级问题</div>
            </div>
        </div>

        <div class="main-content">
            <div class="panel">
                <div class="tabs">
                    <div class="tab active" data-tab="type">按类型分布</div>
                    <div class="tab" data-tab="severity">按严重程度</div>
                </div>
                <div class="tab-content active" id="tab-type">
                    <div class="chart-container">
                        <div class="bar-chart" id="type-chart"></div>
                    </div>
                </div>
                <div class="tab-content" id="tab-severity">
                    <div class="pie-chart-container">
                        <div class="pie-chart" id="severity-pie"></div>
                        <div class="pie-legend" id="severity-legend"></div>
                    </div>
                </div>
            </div>

            <div class="panel">
                <h2>⚠️ 不匹配案例详情</h2>
                <div class="legend">
                    <div class="legend-item">
                        <div class="legend-color high"></div>
                        <span>高优先级</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color medium"></div>
                        <span>中优先级</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color low"></div>
                        <span>低优先级</span>
                    </div>
                </div>
                <div class="filter-bar">
                    <button class="filter-btn active" data-filter="all">全部</button>
                    <button class="filter-btn severity-high" data-filter="severity-high">高优先级</button>
                    <button class="filter-btn severity-medium" data-filter="severity-medium">中优先级</button>
                    <button class="filter-btn severity-low" data-filter="severity-low">低优先级</button>
                </div>
                <div class="mismatch-list" id="mismatch-list"></div>
            </div>
        </div>
    </div>

    <script>
        const mismatchData = {mismatch_json};
        const stats = {stats_json};

        const typeNames = {{
            'skill_alias_mismatch': '技能别名',
            'experience_boundary': '年限边界',
            'high_score_but_rejected': '高分被拒',
            'low_score_but_passed': '低分通过',
            'skill_gap': '技能差距',
            'experience_gap': '经验差距'
        }};

        function initTypeChart() {{
            const container = document.getElementById('type-chart');
            const typeCounts = stats.mismatch_type_counts;
            const types = Object.keys(typeCounts);

            if (types.length === 0) {{
                container.innerHTML = '<div class="no-data"><div class="no-data-icon">📊</div><div>暂无数据</div></div>';
                return;
            }}

            const maxCount = Math.max(...Object.values(typeCounts));

            types.forEach(type => {{
                const count = typeCounts[type];
                const height = maxCount > 0 ? (count / maxCount) * 180 : 0;

                const item = document.createElement('div');
                item.className = 'bar-item';
                item.innerHTML = `
                    <div class="bar" style="height: ${{height}}px;">
                        <span class="bar-value">${{count}}</span>
                    </div>
                    <div class="bar-label">${{typeNames[type] || type}}</div>
                `;
                container.appendChild(item);
            }});
        }}

        function initSeverityPie() {{
            const pie = document.getElementById('severity-pie');
            const legend = document.getElementById('severity-legend');
            const severityCounts = stats.severity_counts;

            const colors = {{
                'high': '#e53e3e',
                'medium': '#ed8936',
                'low': '#38a169'
            }};

            const labels = {{
                'high': '高优先级',
                'medium': '中优先级',
                'low': '低优先级'
            }};

            const total = Object.values(severityCounts).reduce((a, b) => a + b, 0);

            if (total === 0) {{
                pie.innerHTML = '';
                legend.innerHTML = '<div class="no-data">暂无数据</div>';
                return;
            }}

            let currentAngle = 0;
            const severities = ['high', 'medium', 'low'];

            severities.forEach(severity => {{
                const count = severityCounts[severity] || 0;
                if (count === 0) return;

                const percentage = count / total;
                const angle = percentage * 360;

                const legendItem = document.createElement('div');
                legendItem.className = 'pie-legend-item';
                legendItem.innerHTML = `
                    <div class="pie-color" style="background: ${{colors[severity]}}"></div>
                    <span>${{labels[severity]}}: ${{count}} (${{(percentage * 100).toFixed(1)}}%)</span>
                `;
                legend.appendChild(legendItem);

                currentAngle += angle;
            }});

            pie.style.background = `conic-gradient(
                #e53e3e 0 ${{(severityCounts['high'] || 0) / total * 360}}deg,
                #ed8936 ${{(severityCounts['high'] || 0) / total * 360}}deg ${{((severityCounts['high'] || 0) + (severityCounts['medium'] || 0)) / total * 360}}deg,
                #38a169 ${{((severityCounts['high'] || 0) + (severityCounts['medium'] || 0)) / total * 360}}deg 360deg
            )`;
        }}

        function renderMismatches(filter = 'all') {{
            const container = document.getElementById('mismatch-list');
            container.innerHTML = '';

            let filtered = mismatchData;
            if (filter === 'severity-high') {{
                filtered = mismatchData.filter(m => m.severity === 'high');
            }} else if (filter === 'severity-medium') {{
                filtered = mismatchData.filter(m => m.severity === 'medium');
            }} else if (filter === 'severity-low') {{
                filtered = mismatchData.filter(m => m.severity === 'low');
            }}

            if (filtered.length === 0) {{
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">✅</div>
                        <div>该分类下暂无不匹配案例</div>
                    </div>
                `;
                return;
            }}

            filtered.forEach((mismatch, index) => {{
                const item = document.createElement('div');
                item.className = `mismatch-item severity-${{mismatch.severity}}`;
                item.dataset.index = index;

                let metaParts = [];
                if (mismatch.model_score !== null) {{
                    metaParts.push(`模型分数: ${{mismatch.model_score.toFixed(2)}}`);
                }}
                if (mismatch.interview_outcome) {{
                    metaParts.push(`面试: ${{mismatch.interview_outcome}}`);
                }}

                item.innerHTML = `
                    <div class="mismatch-header">
                        <span class="mismatch-candidate">👤 ${{mismatch.candidate_id}}</span>
                        <span class="mismatch-type">${{typeNames[mismatch.mismatch_type] || mismatch.mismatch_type}}</span>
                    </div>
                    <div class="mismatch-desc">${{mismatch.description}}</div>
                    <div class="mismatch-meta">
                        ${{metaParts.map(p => `<span>${{p}}</span>`).join('')}}
                    </div>
                    <div class="detail-panel" id="detail-${{index}}">
                        <div class="detail-row">
                            <div class="detail-label">严重程度</div>
                            <div class="detail-value">${{mismatch.severity === 'high' ? '🔴 高' : mismatch.severity === 'medium' ? '🟡 中' : '🟢 低'}}</div>
                        </div>
                        ${{mismatch.model_rank ? `
                        <div class="detail-row">
                            <div class="detail-label">模型排名</div>
                            <div class="detail-value">#${{mismatch.model_rank}}</div>
                        </div>
                        ` : ''}}
                        ${{mismatch.technical_rating !== null ? `
                        <div class="detail-row">
                            <div class="detail-label">技术评分</div>
                            <div class="detail-value">${{mismatch.technical_rating}}</div>
                        </div>
                        ` : ''}}
                        <div class="detail-row">
                            <div class="detail-label">建议</div>
                            <div class="detail-value">${{mismatch.recommendation}}</div>
                        </div>
                        ${{Object.keys(mismatch.details || {{}}).length > 0 ? `
                        <div class="detail-row">
                            <div class="detail-label">详细信息</div>
                            <div class="detail-value">
                                <pre style="white-space: pre-wrap; margin: 0; font-size: 12px;">${{JSON.stringify(mismatch.details, null, 2)}}</pre>
                            </div>
                        </div>
                        ` : ''}}
                    </div>
                `;

                item.addEventListener('click', () => {{
                    const detail = document.getElementById(`detail-${{index}}`);
                    detail.classList.toggle('show');
                }});

                container.appendChild(item);
            }});
        }}

        document.querySelectorAll('.tab').forEach(tab => {{
            tab.addEventListener('click', () => {{
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

                tab.classList.add('active');
                document.getElementById(`tab-${{tab.dataset.tab}}`).classList.add('active');
            }});
        }});

        document.querySelectorAll('.filter-btn').forEach(btn => {{
            btn.addEventListener('click', () => {{
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderMismatches(btn.dataset.filter);
            }});
        }});

        initTypeChart();
        initSeverityPie();
        renderMismatches();
    </script>
</body>
</html>'''

        with open(path, 'w', encoding='utf-8') as f:
            f.write(html)

        return str(path)


def generate_all_reports(
    reviewer: BiasReviewer,
    output_dir: str,
    base_filename: str = "review"
) -> Dict[str, str]:
    """
    Convenience function to generate all three report types.

    Returns:
        Dictionary with paths to generated files
    """
    output_path = Path(output_dir)
    generated_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    csv_path = CSVReporter.generate(
        reviewer,
        str(output_path / f"{base_filename}_mismatch_cases.csv")
    )

    md_path = MarkdownReporter.generate(
        reviewer,
        str(output_path / f"{base_filename}_bias_review.md"),
        generated_at
    )

    html_path = HTMLReporter.generate(
        reviewer,
        str(output_path / f"{base_filename}_overview.html"),
        generated_at
    )

    return {
        "csv": csv_path,
        "markdown": md_path,
        "html": html_path
    }

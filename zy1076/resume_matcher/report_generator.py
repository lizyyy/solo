"""
报告生成模块
支持生成 Markdown、HTML、JSON 三种格式的报告
"""
import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime

from .model import MatchResult, ModelEvaluation
from .exceptions import ReportError


class ReportGenerator:
    """报告生成器"""
    
    def __init__(self):
        self.timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    def generate_json_report(
        self,
        all_results: List[MatchResult],
        comparison_matrix: Dict[str, Any],
        model_evaluation: Optional[ModelEvaluation] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """生成JSON格式报告"""
        report = {
            "report_info": {
                "generated_at": self.timestamp,
                "version": "0.1.0",
                "total_matches": len(all_results),
            },
            "metadata": metadata or {},
            "match_results": [r.to_dict() for r in all_results],
            "comparison_matrix": comparison_matrix,
        }
        
        if model_evaluation:
            report["model_evaluation"] = model_evaluation.to_dict()
        
        return report
    
    def generate_markdown_report(
        self,
        all_results: List[MatchResult],
        comparison_matrix: Dict[str, Any],
        model_evaluation: Optional[ModelEvaluation] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """生成Markdown格式报告"""
        lines = []
        
        # 标题
        lines.append("# 简历岗位匹配报告")
        lines.append("")
        lines.append(f"> 生成时间: {self.timestamp}")
        lines.append(f"> 总匹配数: {len(all_results)}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        # 元数据
        if metadata:
            lines.append("## 执行信息")
            lines.append("")
            for key, value in metadata.items():
                lines.append(f"- **{key}**: {value}")
            lines.append("")
            lines.append("---")
            lines.append("")
        
        # 比较矩阵
        lines.append("## 匹配分数矩阵")
        lines.append("")
        
        score_matrix = comparison_matrix.get("score_matrix", {})
        resume_ids = comparison_matrix.get("resume_ids", [])
        job_ids = comparison_matrix.get("job_ids", [])
        
        if score_matrix and resume_ids and job_ids:
            # 表头
            header = "| 简历 \\ 岗位 | " + " | ".join(job_ids) + " |"
            lines.append(header)
            lines.append("|" + "---|" * (len(job_ids) + 1))
            
            # 数据行
            for resume_id in resume_ids:
                row = [resume_id]
                for job_id in job_ids:
                    score = score_matrix.get(resume_id, {}).get(job_id, 0)
                    # 使用颜色标记
                    if score >= 0.7:
                        score_str = f"**{score:.2%}** ✅"
                    elif score >= 0.5:
                        score_str = f"{score:.2%} ⚠️"
                    else:
                        score_str = f"{score:.2%} ❌"
                    row.append(score_str)
                lines.append("| " + " | ".join(row) + " |")
        
        lines.append("")
        lines.append("---")
        lines.append("")
        
        # 每个岗位的最佳简历
        best_resumes = comparison_matrix.get("best_resumes_per_job", {})
        if best_resumes:
            lines.append("## 各岗位推荐简历")
            lines.append("")
            
            for job_id, info in best_resumes.items():
                lines.append(f"### {info['job_title']} ({job_id})")
                lines.append("")
                lines.append(f"- **最佳匹配**: {info['best_resume_title']} ({info['best_resume_id']})")
                lines.append(f"- **匹配分数**: {info['best_score']:.2%}")
                lines.append(f"- **命中技能数**: {info['matched_skills_count']}")
                lines.append(f"- **缺失技能数**: {info['missing_skills_count']}")
                lines.append("")
                
                # Top 3
                if info.get("top_3_resumes"):
                    lines.append("**Top 3 简历**:")
                    lines.append("")
                    for i, resume in enumerate(info["top_3_resumes"], 1):
                        lines.append(f"{i}. {resume['resume_title']} ({resume['score']:.2%})")
                    lines.append("")
                
                lines.append("---")
                lines.append("")
        
        # 详细匹配结果
        lines.append("## 详细匹配结果")
        lines.append("")
        
        # 按岗位分组
        from collections import defaultdict
        results_by_job = defaultdict(list)
        for result in all_results:
            results_by_job[result.job_id].append(result)
        
        for job_id, results in results_by_job.items():
            # 按分数排序
            results_sorted = sorted(results, key=lambda r: r.total_score, reverse=True)
            
            if not results_sorted:
                continue
            
            job_title = results_sorted[0].job_title
            lines.append(f"---")
            lines.append(f"")
            lines.append(f"### 岗位: {job_title} ({job_id})")
            lines.append("")
            
            for result in results_sorted:
                # 分数等级
                if result.total_score >= 0.7:
                    grade = "🌟 高度匹配"
                elif result.total_score >= 0.5:
                    grade = "⭐ 一般匹配"
                else:
                    grade = "💫 低匹配度"
                
                lines.append(f"#### {result.resume_title} ({result.resume_id}) - {grade}")
                lines.append("")
                
                # 分数详情
                lines.append(f"| 指标 | 分数 |")
                lines.append("|------|------|")
                lines.append(f"| **综合分数** | **{result.total_score:.2%}** |")
                lines.append(f"| 技能匹配 | {result.skill_score:.2%} |")
                lines.append(f"| 文本相似度 | {result.tfidf_score:.2%} |")
                lines.append("")
                
                # 命中技能
                if result.matched_skills:
                    lines.append("**✅ 命中技能**:")
                    lines.append("")
                    for sm in result.matched_skills[:10]:  # 只显示前10个
                        weight_str = f" (权重: {sm.skill.weight})" if sm.skill.weight != 1.0 else ""
                        lines.append(f"- **{sm.skill.name}**{weight_str} - `{sm.matched_text}`")
                        if sm.evidence_sentence:
                            lines.append(f"  > 证据: {sm.evidence_sentence[:100]}{'...' if len(sm.evidence_sentence) > 100 else ''}")
                    if len(result.matched_skills) > 10:
                        lines.append(f"- ... 等 {len(result.matched_skills)} 项技能")
                    lines.append("")
                
                # 缺失技能
                if result.missing_skills:
                    lines.append("**❌ 缺失技能**:")
                    lines.append("")
                    for skill in result.missing_skills[:10]:
                        weight_str = f" (权重: {skill.weight})" if skill.weight != 1.0 else ""
                        lines.append(f"- **{skill.name}**{weight_str} - {skill.category}")
                    if len(result.missing_skills) > 10:
                        lines.append(f"- ... 等 {len(result.missing_skills)} 项技能")
                    lines.append("")
                
                # 优势
                if result.strengths:
                    lines.append("**💪 优势**:")
                    lines.append("")
                    for s in result.strengths:
                        lines.append(f"- {s}")
                    lines.append("")
                
                # 劣势
                if result.weaknesses:
                    lines.append("**⚠️ 劣势**:")
                    lines.append("")
                    for w in result.weaknesses:
                        lines.append(f"- {w}")
                    lines.append("")
                
                # 建议
                if result.suggestions:
                    lines.append("**💡 改进建议**:")
                    lines.append("")
                    for s in result.suggestions:
                        lines.append(f"- {s}")
                    lines.append("")
                
                # 警告
                if result.warnings:
                    lines.append("**🚨 注意事项**:")
                    lines.append("")
                    for w in result.warnings:
                        lines.append(f"- {w}")
                    lines.append("")
        
        # 模型评估
        if model_evaluation:
            lines.append("---")
            lines.append("")
            lines.append("## 模型评估结果")
            lines.append("")
            lines.append("```")
            lines.append(str(model_evaluation))
            lines.append("```")
            lines.append("")
        
        return "\n".join(lines)
    
    def generate_html_report(
        self,
        all_results: List[MatchResult],
        comparison_matrix: Dict[str, Any],
        model_evaluation: Optional[ModelEvaluation] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """生成HTML格式报告"""
        html_parts = []
        
        # 头部
        html_parts.append("""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>简历岗位匹配报告</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f7fa;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.1);
            padding: 40px;
        }
        h1 {
            color: #1a1a1a;
            border-bottom: 3px solid #4a90d9;
            padding-bottom: 15px;
            margin-bottom: 30px;
        }
        h2 {
            color: #2c3e50;
            margin-top: 40px;
            margin-bottom: 20px;
            border-left: 4px solid #4a90d9;
            padding-left: 15px;
        }
        h3 {
            color: #34495e;
            margin-top: 30px;
            margin-bottom: 15px;
        }
        h4 {
            color: #5d6d7e;
            margin-top: 20px;
            margin-bottom: 10px;
        }
        .metadata {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            margin-bottom: 20px;
        }
        .metadata-item {
            display: inline-block;
            margin-right: 30px;
            margin-bottom: 10px;
        }
        .metadata-label {
            font-weight: bold;
            color: #7f8c8d;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #e0e0e0;
        }
        th {
            background-color: #4a90d9;
            color: white;
            font-weight: 600;
        }
        tr:hover {
            background-color: #f8f9fa;
        }
        .score-high {
            color: #27ae60;
            font-weight: bold;
        }
        .score-medium {
            color: #f39c12;
        }
        .score-low {
            color: #e74c3c;
        }
        .score-card {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-weight: 600;
        }
        .score-card.high {
            background-color: #d4edda;
            color: #155724;
        }
        .score-card.medium {
            background-color: #fff3cd;
            color: #856404;
        }
        .score-card.low {
            background-color: #f8d7da;
            color: #721c24;
        }
        .skill-item {
            margin: 10px 0;
            padding: 10px 15px;
            background: #f8f9fa;
            border-radius: 6px;
            border-left: 3px solid #4a90d9;
        }
        .skill-item.missing {
            border-left-color: #e74c3c;
            background: #fdf2f2;
        }
        .skill-name {
            font-weight: 600;
            color: #2c3e50;
        }
        .skill-category {
            font-size: 0.85em;
            color: #7f8c8d;
            margin-left: 10px;
        }
        .skill-evidence {
            margin-top: 5px;
            font-size: 0.9em;
            color: #5d6d7e;
            font-style: italic;
        }
        .section {
            margin: 20px 0;
            padding: 15px;
            border-radius: 6px;
        }
        .section.strengths {
            background: #e8f5e9;
            border-left: 4px solid #4caf50;
        }
        .section.weaknesses {
            background: #fff3e0;
            border-left: 4px solid #ff9800;
        }
        .section.suggestions {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
        }
        .section.warnings {
            background: #ffebee;
            border-left: 4px solid #f44336;
        }
        .section-title {
            font-weight: 600;
            margin-bottom: 10px;
        }
        .section.strengths .section-title { color: #2e7d32; }
        .section.weaknesses .section-title { color: #ef6c00; }
        .section.suggestions .section-title { color: #1565c0; }
        .section.warnings .section-title { color: #c62828; }
        .evaluation-box {
            background: #1a1a2e;
            color: #16c79a;
            padding: 20px;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            overflow-x: auto;
            white-space: pre-wrap;
        }
        .divider {
            height: 1px;
            background: #e0e0e0;
            margin: 30px 0;
        }
        .best-resume-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin: 15px 0;
        }
        .best-resume-card h4 {
            color: rgba(255,255,255,0.9);
            margin-top: 0;
        }
        .best-resume-score {
            font-size: 2em;
            font-weight: bold;
        }
        ul {
            margin-left: 20px;
            margin-bottom: 15px;
        }
        li {
            margin-bottom: 5px;
        }
        .footer {
            text-align: center;
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            color: #7f8c8d;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
""")
        
        # 标题
        html_parts.append(f"""
        <h1>📋 简历岗位匹配报告</h1>
        <div class="metadata">
            <div class="metadata-item">
                <span class="metadata-label">生成时间:</span> {self.timestamp}
            </div>
            <div class="metadata-item">
                <span class="metadata-label">总匹配数:</span> {len(all_results)}
            </div>
        </div>
""")
        
        # 元数据
        if metadata:
            html_parts.append('<div class="metadata">')
            for key, value in metadata.items():
                html_parts.append(f'<div class="metadata-item"><span class="metadata-label">{key}:</span> {value}</div>')
            html_parts.append('</div>')
        
        # 比较矩阵
        score_matrix = comparison_matrix.get("score_matrix", {})
        resume_ids = comparison_matrix.get("resume_ids", [])
        job_ids = comparison_matrix.get("job_ids", [])
        
        if score_matrix and resume_ids and job_ids:
            html_parts.append("""
        <h2>📊 匹配分数矩阵</h2>
        <table>
            <thead>
                <tr>
                    <th>简历 \\ 岗位</th>
""")
            for job_id in job_ids:
                html_parts.append(f'<th>{job_id}</th>')
            html_parts.append("""
                </tr>
            </thead>
            <tbody>
""")
            
            for resume_id in resume_ids:
                html_parts.append(f'<tr><td><strong>{resume_id}</strong></td>')
                for job_id in job_ids:
                    score = score_matrix.get(resume_id, {}).get(job_id, 0)
                    if score >= 0.7:
                        score_class = "score-high"
                        card_class = "high"
                    elif score >= 0.5:
                        score_class = "score-medium"
                        card_class = "medium"
                    else:
                        score_class = "score-low"
                        card_class = "low"
                    html_parts.append(f'<td><span class="score-card {card_class}">{score:.2%}</span></td>')
                html_parts.append('</tr>')
            
            html_parts.append("""
            </tbody>
        </table>
""")
        
        # 每个岗位的最佳简历
        best_resumes = comparison_matrix.get("best_resumes_per_job", {})
        if best_resumes:
            html_parts.append('<h2>🎯 各岗位推荐简历</h2>')
            
            for job_id, info in best_resumes.items():
                score = info['best_score']
                if score >= 0.7:
                    card_class = "high"
                elif score >= 0.5:
                    card_class = "medium"
                else:
                    card_class = "low"
                
                html_parts.append(f"""
        <div class="best-resume-card">
            <h4>💼 {info['job_title']}</h4>
            <div class="best-resume-score">{score:.2%}</div>
            <p><strong>最佳匹配:</strong> {info['best_resume_title']}</p>
            <p><strong>命中技能:</strong> {info['matched_skills_count']} 项 | <strong>缺失技能:</strong> {info['missing_skills_count']} 项</p>
        </div>
""")
                
                # Top 3
                if info.get("top_3_resumes"):
                    html_parts.append('<table><thead><tr><th>排名</th><th>简历</th><th>分数</th></tr></thead><tbody>')
                    for i, resume in enumerate(info["top_3_resumes"], 1):
                        s = resume['score']
                        if s >= 0.7:
                            sc = "score-high"
                        elif s >= 0.5:
                            sc = "score-medium"
                        else:
                            sc = "score-low"
                        html_parts.append(f'<tr><td>{i}</td><td>{resume["resume_title"]}</td><td class="{sc}">{s:.2%}</td></tr>')
                    html_parts.append('</tbody></table>')
        
        # 详细匹配结果
        html_parts.append('<h2>📋 详细匹配结果</h2>')
        
        from collections import defaultdict
        results_by_job = defaultdict(list)
        for result in all_results:
            results_by_job[result.job_id].append(result)
        
        for job_id, results in results_by_job.items():
            results_sorted = sorted(results, key=lambda r: r.total_score, reverse=True)
            
            if not results_sorted:
                continue
            
            job_title = results_sorted[0].job_title
            html_parts.append(f'<div class="divider"></div>')
            html_parts.append(f'<h3>💼 岗位: {job_title} ({job_id})</h3>')
            
            for result in results_sorted:
                # 分数等级
                if result.total_score >= 0.7:
                    grade = "🌟 高度匹配"
                    grade_class = "high"
                elif result.total_score >= 0.5:
                    grade = "⭐ 一般匹配"
                    grade_class = "medium"
                else:
                    grade = "💫 低匹配度"
                    grade_class = "low"
                
                html_parts.append(f"""
        <h4>👤 {result.resume_title} ({result.resume_id}) <span class="score-card {grade_class}">{grade}</span></h4>
        <table>
            <tr><th>指标</th><th>分数</th></tr>
            <tr><td><strong>综合分数</strong></td><td><strong class="score-{grade_class}">{result.total_score:.2%}</strong></td></tr>
            <tr><td>技能匹配</td><td>{result.skill_score:.2%}</td></tr>
            <tr><td>文本相似度</td><td>{result.tfidf_score:.2%}</td></tr>
        </table>
""")
                
                # 命中技能
                if result.matched_skills:
                    html_parts.append('<h5>✅ 命中技能</h5>')
                    for sm in result.matched_skills[:15]:
                        html_parts.append(f"""
        <div class="skill-item">
            <span class="skill-name">{sm.skill.name}</span>
            <span class="skill-category">{sm.skill.category}</span>
            {f'<div class="skill-evidence">证据: {sm.evidence_sentence}</div>' if sm.evidence_sentence else ''}
        </div>
""")
                    if len(result.matched_skills) > 15:
                        html_parts.append(f'<p>... 等 {len(result.matched_skills)} 项技能</p>')
                
                # 缺失技能
                if result.missing_skills:
                    html_parts.append('<h5>❌ 缺失技能</h5>')
                    for skill in result.missing_skills[:10]:
                        html_parts.append(f"""
        <div class="skill-item missing">
            <span class="skill-name">{skill.name}</span>
            <span class="skill-category">{skill.category} (权重: {skill.weight})</span>
        </div>
""")
                    if len(result.missing_skills) > 10:
                        html_parts.append(f'<p>... 等 {len(result.missing_skills)} 项技能</p>')
                
                # 优势
                if result.strengths:
                    html_parts.append("""
        <div class="section strengths">
            <div class="section-title">💪 优势</div>
            <ul>
""")
                    for s in result.strengths:
                        html_parts.append(f'<li>{s}</li>')
                    html_parts.append('</ul></div>')
                
                # 劣势
                if result.weaknesses:
                    html_parts.append("""
        <div class="section weaknesses">
            <div class="section-title">⚠️ 劣势</div>
            <ul>
""")
                    for w in result.weaknesses:
                        html_parts.append(f'<li>{w}</li>')
                    html_parts.append('</ul></div>')
                
                # 建议
                if result.suggestions:
                    html_parts.append("""
        <div class="section suggestions">
            <div class="section-title">💡 改进建议</div>
            <ul>
""")
                    for s in result.suggestions:
                        html_parts.append(f'<li>{s}</li>')
                    html_parts.append('</ul></div>')
                
                # 警告
                if result.warnings:
                    html_parts.append("""
        <div class="section warnings">
            <div class="section-title">🚨 注意事项</div>
            <ul>
""")
                    for w in result.warnings:
                        html_parts.append(f'<li>{w}</li>')
                    html_parts.append('</ul></div>')
        
        # 模型评估
        if model_evaluation:
            html_parts.append('<h2>📈 模型评估结果</h2>')
            html_parts.append(f'<div class="evaluation-box">{str(model_evaluation)}</div>')
        
        # 底部
        html_parts.append("""
        <div class="footer">
            <p>简历岗位匹配小助手 | 本地AI/ML应用</p>
            <p>所有计算均在本地完成，保护您的隐私</p>
        </div>
    </div>
</body>
</html>
""")
        
        return "".join(html_parts)
    
    def save_report(
        self,
        output_path: str,
        format: str,  # "json", "md", "html"
        all_results: List[MatchResult],
        comparison_matrix: Dict[str, Any],
        model_evaluation: Optional[ModelEvaluation] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """保存报告到文件"""
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            if format == "json":
                report = self.generate_json_report(
                    all_results, comparison_matrix, model_evaluation, metadata
                )
                content = json.dumps(report, ensure_ascii=False, indent=2)
            elif format == "md":
                content = self.generate_markdown_report(
                    all_results, comparison_matrix, model_evaluation, metadata
                )
            elif format == "html":
                content = self.generate_html_report(
                    all_results, comparison_matrix, model_evaluation, metadata
                )
            else:
                raise ReportError(f"不支持的报告格式: {format}")
            
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            return str(output_path)
        
        except Exception as e:
            raise ReportError(f"生成报告失败: {e}")

import csv
import json
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime
from jinja2 import Template
from .scoring import ShakeScore
from .aggregator import MatrixRunHistory
from .comparison import RunComparison
from .parser import JobResult


HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitHub Actions 矩阵抖动分析报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 1400px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 30px; }
        h1 { color: #333; margin-bottom: 10px; font-size: 24px; }
        .subtitle { color: #666; margin-bottom: 30px; font-size: 14px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff; }
        .summary-card h3 { font-size: 14px; color: #666; margin-bottom: 8px; }
        .summary-card .value { font-size: 28px; font-weight: bold; color: #333; }
        .summary-card .value.warning { color: #dc3545; }
        .section { margin-bottom: 40px; }
        .section h2 { font-size: 18px; color: #333; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e9ecef; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e9ecef; }
        th { background: #f8f9fa; font-weight: 600; color: #495057; position: sticky; top: 0; }
        tr:hover { background: #f8f9fa; }
        .grade-S { color: #28a745; font-weight: bold; }
        .grade-A { color: #20c997; font-weight: bold; }
        .grade-B { color: #17a2b8; font-weight: bold; }
        .grade-C { color: #ffc107; font-weight: bold; }
        .grade-D { color: #fd7e14; font-weight: bold; }
        .grade-F { color: #dc3545; font-weight: bold; }
        .status-success { color: #28a745; }
        .status-failure { color: #dc3545; }
        .status-cancelled { color: #6c757d; }
        .change-improved { color: #28a745; }
        .change-regressed { color: #dc3545; }
        .change-flaky { color: #ffc107; }
        .flag { display: inline-block; background: #fff3cd; color: #856404; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin: 2px; }
        .matrix-key { font-family: monospace; font-size: 12px; color: #495057; }
        .progress-bar { width: 100px; height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden; display: inline-block; }
        .progress-fill { height: 100%; background: #28a745; }
        .score-bar { display: flex; align-items: center; gap: 8px; }
        .filters { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .filter-btn { padding: 6px 12px; background: #e9ecef; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }
        .filter-btn.active { background: #007bff; color: white; }
        .hidden { display: none; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎯 GitHub Actions 矩阵抖动分析报告</h1>
        <p class="subtitle">生成时间: {{ generated_at }}</p>
        
        <div class="summary">
            <div class="summary-card">
                <h3>矩阵组合总数</h3>
                <div class="value">{{ total_matrix }}</div>
            </div>
            <div class="summary-card">
                <h3>总运行次数</h3>
                <div class="value">{{ total_runs }}</div>
            </div>
            <div class="summary-card">
                <h3>成功率</h3>
                <div class="value {% if success_rate < 0.7 %}warning{% endif %}">{{ "%.1f%%"|format(success_rate * 100) }}</div>
            </div>
            <div class="summary-card">
                <h3>不稳定组合</h3>
                <div class="value {% if unstable_count > 0 %}warning{% endif %}">{{ unstable_count }}</div>
            </div>
        </div>
        
        <div class="section">
            <h2>📊 抖动评分排行 (按稳定性从低到高)</h2>
            <div class="filters">
                <button class="filter-btn active" onclick="filterScores('all')">全部</button>
                <button class="filter-btn" onclick="filterScores('F')">F级</button>
                <button class="filter-btn" onclick="filterScores('D')">D级</button>
                <button class="filter-btn" onclick="filterScores('C')">C级及以下</button>
            </div>
            <table id="scores-table">
                <thead>
                    <tr>
                        <th>排名</th>
                        <th>等级</th>
                        <th>矩阵配置</th>
                        <th>综合评分</th>
                        <th>稳定性</th>
                        <th>一致性</th>
                        <th>失败模式</th>
                        <th>成功/总</th>
                        <th>标记</th>
                    </tr>
                </thead>
                <tbody>
                    {% for score in scores %}
                    <tr data-grade="{{ score.grade }}">
                        <td>{{ loop.index }}</td>
                        <td><span class="grade-{{ score.grade }}">{{ score.grade }}</span></td>
                        <td class="matrix-key">{{ score.matrix_key|e }}</td>
                        <td>{{ score.overall_score }}</td>
                        <td>
                            <div class="score-bar">
                                <div class="progress-bar"><div class="progress-fill" style="width: {{ score.stability_score }}%"></div></div>
                                {{ score.stability_score }}
                            </div>
                        </td>
                        <td>{{ score.consistency_score }}</td>
                        <td>{{ score.failure_pattern_score }}</td>
                        <td>{{ score.success_count }}/{{ score.total_runs }}</td>
                        <td>{% for flag in score.flags %}<span class="flag">{{ flag }}</span>{% endfor %}</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
        
        {% if comparisons %}
        <div class="section">
            <h2>🔄 重跑对比分析</h2>
            {% for comp in comparisons %}
            <h3 style="margin: 20px 0 10px; font-size: 15px;">{{ comp.run_a }} ↔ {{ comp.run_b }}</h3>
            <div style="margin-bottom: 15px;">
                <span style="margin-right: 20px;">无变化: {{ comp.unchanged }}</span>
                <span style="margin-right: 20px; color: #28a745;">好转: {{ comp.improved }}</span>
                <span style="margin-right: 20px; color: #dc3545;">变差: {{ comp.regressed }}</span>
                <span style="color: #ffc107;">抖动率: {{ "%.1f%%"|format(comp.flakiness_rate * 100) }}</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>矩阵配置</th>
                        <th>Run A 状态</th>
                        <th>Run B 状态</th>
                        <th>变化类型</th>
                    </tr>
                </thead>
                <tbody>
                    {% for change in comp.changes if change.changed %}
                    <tr>
                        <td class="matrix-key">{{ change.matrix_key|e }}</td>
                        <td class="status-{{ change.status_a }}">{{ change.status_a }}</td>
                        <td class="status-{{ change.status_b }}">{{ change.status_b }}</td>
                        <td class="change-{{ change.change_type }}">{{ change.change_type }}</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
            {% endfor %}
        </div>
        {% endif %}
        
        <div class="section">
            <h2>⚠️ 失败详情</h2>
            <table>
                <thead>
                    <tr>
                        <th>矩阵配置</th>
                        <th>失败步骤</th>
                        <th>错误信息</th>
                        <th>来源</th>
                    </tr>
                </thead>
                <tbody>
                    {% for failure in failures %}
                    <tr>
                        <td class="matrix-key">{{ failure.matrix_key|e }}</td>
                        <td>{{ failure.step|e }}</td>
                        <td style="max-width: 400px; overflow: hidden; text-overflow: ellipsis;" title="{{ failure.message|e }}">{{ failure.message[:100]|e }}...</td>
                        <td class="matrix-key">{{ failure.source|e }}</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
    </div>
    
    <script>
        function filterScores(level) {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            
            const rows = document.querySelectorAll('#scores-table tbody tr');
            rows.forEach(row => {
                const grade = row.dataset.grade;
                if (level === 'all') {
                    row.classList.remove('hidden');
                } else if (level === 'C') {
                    row.classList.toggle('hidden', !['F', 'D', 'C'].includes(grade));
                } else {
                    row.classList.toggle('hidden', grade !== level);
                }
            });
        }
    </script>
</body>
</html>
"""


class ReportGenerator:
    def __init__(self):
        pass
    
    def generate_html(self, scores: List[ShakeScore], comparisons: List[RunComparison], 
                     job_results: List[JobResult], output_path: str):
        failures = self._collect_failures(job_results)
        
        total_runs = sum(s.total_runs for s in scores)
        total_success = sum(s.success_count for s in scores)
        unstable_count = sum(1 for s in scores if s.grade in ['F', 'D', 'C'])
        
        context = {
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "total_matrix": len(scores),
            "total_runs": total_runs,
            "success_rate": total_success / total_runs if total_runs > 0 else 0,
            "unstable_count": unstable_count,
            "scores": [s.to_dict() for s in scores],
            "comparisons": comparisons,
            "failures": failures,
        }
        
        template = Template(HTML_TEMPLATE)
        html_content = template.render(context)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        return output_path
    
    def generate_csv(self, scores: List[ShakeScore], comparisons: List[RunComparison],
                    job_results: List[JobResult], output_dir: str):
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        self._write_scores_csv(scores, output_path / "scores.csv")
        self._write_comparisons_csv(comparisons, output_path / "comparisons.csv")
        self._write_failures_csv(job_results, output_path / "failures.csv")
        
        return str(output_path)
    
    def _write_scores_csv(self, scores: List[ShakeScore], output_path: Path):
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                "rank", "grade", "matrix_key", "overall_score", "stability_score",
                "consistency_score", "failure_pattern_score", "total_runs", 
                "success_count", "failure_count", "flags"
            ])
            for idx, score in enumerate(scores, 1):
                writer.writerow([
                    idx, score.grade, score.matrix_key, score.overall_score,
                    score.stability_score, score.consistency_score, score.failure_pattern_score,
                    score.total_runs, score.success_count, score.failure_count,
                    "; ".join(score.flags)
                ])
    
    def _write_comparisons_csv(self, comparisons: List[RunComparison], output_path: Path):
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(["run_a", "run_b", "matrix_key", "status_a", "status_b", "change_type"])
            for comp in comparisons:
                for change in comp.changes:
                    writer.writerow([
                        comp.run_a, comp.run_b, change.matrix_key, change.status_a,
                        change.status_b, change.change_type
                    ])
    
    def _write_failures_csv(self, job_results: List[JobResult], output_path: Path):
        failures = self._collect_failures(job_results)
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(["matrix_key", "step", "error_message", "source"])
            for failure in failures:
                writer.writerow([
                    failure["matrix_key"], failure["step"], failure["message"], failure["source"]
                ])
    
    def _collect_failures(self, job_results: List[JobResult]) -> List[Dict]:
        failures = []
        for result in sorted(job_results, key=lambda r: r.matrix.key()):
            if result.failure:
                failures.append({
                    "matrix_key": result.matrix.key(),
                    "step": result.failure.step_name or "unknown",
                    "message": result.failure.error_message,
                    "source": f"{result.job_name}.log"
                })
        return failures

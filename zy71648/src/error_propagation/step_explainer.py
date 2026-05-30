"""步骤解释和公式展示模块"""

from typing import Dict, List, Optional
import sympy as sp
from .types import PropagationResult, PropagationStep, Measurement


class StepExplainer:
    """步骤解释器 - 将计算步骤转化为学生易懂的解释"""

    def __init__(self):
        self.level = "university"  # university / high_school

    def explain_step(self, step: PropagationStep, measurements: Dict[str, Measurement]) -> str:
        """为单个步骤生成详细解释"""
        explanation = [f"### 步骤 {step.step_number}: {step.description}\n"]

        explanation.append("**公式:**")
        explanation.append(f"```latex\n{step.formula_latex}\n```\n")

        explanation.append("**文本表示:**")
        explanation.append(f"`{step.formula_text}`\n")

        if step.variables:
            explanation.append("**涉及变量:**")
            for v in step.variables:
                if v in measurements:
                    m = measurements[v]
                    explanation.append(
                        f"- `{v}` = {m.value} ± {m.uncertainty} {m.unit} "
                        f"(相对不确定度: {m.relative_uncertainty*100:.2f}%)"
                    )
                else:
                    explanation.append(f"- `{v}` (未找到测量数据)")
            explanation.append("")

        if step.partial_derivatives:
            explanation.append("**偏导数:**")
            for var, pd in step.partial_derivatives.items():
                explanation.append(f"- ∂f/∂{var} = {pd}")
            explanation.append("")

        if step.intermediate_values:
            explanation.append("**中间计算结果:**")
            for name, val in step.intermediate_values.items():
                explanation.append(f"- {name} = {val:.6g}")
            explanation.append("")

        if step.uncertainty_contribution:
            explanation.append("**不确定度贡献:**")
            total = sum(c ** 2 for c in step.uncertainty_contribution.values()) ** 0.5
            for var, contrib in step.uncertainty_contribution.items():
                percent = (contrib ** 2 / total ** 2 * 100) if total > 0 else 0
                bar = "█" * int(percent / 10) + "░" * (10 - int(percent / 10))
                explanation.append(f"- {var}: {contrib:.6g} ({percent:5.1f}%) {bar}")
            explanation.append("")

        if step.notes:
            explanation.append("**说明:**")
            for note in step.notes:
                explanation.append(f"- {note}")
            explanation.append("")

        return "\n".join(explanation)

    def explain_result(self, result: PropagationResult, measurements: Dict[str, Measurement]) -> str:
        """为整个计算结果生成完整解释"""
        explanation = []

        explanation.append(f"# 误差传播分析报告: {result.target_name}\n")
        explanation.append("---\n")

        explanation.append("## 最终结果\n")
        explanation.append(f"**{result.target_name} = {result.target_value:.6g} ± {result.target_uncertainty:.6g} {result.target_unit}**\n")
        explanation.append(f"- 相对不确定度: {result.relative_uncertainty*100:.2f}%")
        explanation.append(f"- 主要不确定度来源: {result.dominant_source}")
        explanation.append("")

        explanation.append("## 边界检查\n")
        for check in result.boundary_checks:
            explanation.append(f"- {check}")
        explanation.append("")

        explanation.append("## 结果解释\n")
        explanation.append(result.interpretation)
        explanation.append("")

        explanation.append("## 计算步骤\n")
        for step in result.steps:
            explanation.append(self.explain_step(step, measurements))
            explanation.append("---\n")

        explanation.append("## 不确定度来源分析\n")
        explanation.append(self._generate_contribution_analysis(result))
        explanation.append("")

        explanation.append("## 合成不确定度公式\n")
        explanation.append(f"```latex\n{result.combined_formula_latex}\n```\n")

        return "\n".join(explanation)

    def _generate_contribution_analysis(self, result: PropagationResult) -> str:
        """生成不确定度贡献分析"""
        analysis = []

        contributions = result.uncertainty_contributions
        if not contributions:
            return "无可用的不确定度贡献数据"

        sorted_contribs = sorted(contributions.items(), key=lambda x: x[1], reverse=True)
        total_sq = sum(c ** 2 for c in contributions.values())

        analysis.append("| 变量 | 不确定度贡献 | 占比 | 累积占比 |")
        analysis.append("|------|-------------|------|---------|")

        cumulative = 0.0
        for var, contrib in sorted_contribs:
            percent = (contrib ** 2 / total_sq * 100) if total_sq > 0 else 0
            cumulative += percent
            analysis.append(f"| {var} | {contrib:.6g} | {percent:5.2f}% | {cumulative:5.2f}% |")

        analysis.append("\n**帕累托分析:**")
        top_80 = []
        cum = 0.0
        for var, contrib in sorted_contribs:
            percent = (contrib ** 2 / total_sq * 100) if total_sq > 0 else 0
            if cum < 80:
                top_80.append(var)
                cum += percent

        if top_80:
            analysis.append(f"- 贡献了80%不确定度的变量: {', '.join(top_80)}")
            analysis.append(f"- 建议优先改进这些变量的测量精度")

        return "\n".join(analysis)

    def generate_html_report(
        self,
        result: PropagationResult,
        measurements: Dict[str, Measurement],
        group_name: str = "default",
        issues: Optional[List] = None
    ) -> str:
        """生成HTML格式报告"""
        html = []

        html.append("<!DOCTYPE html>")
        html.append("<html lang='zh-CN'>")
        html.append("<head>")
        html.append("<meta charset='UTF-8'>")
        html.append(f"<title>误差传播分析 - {result.target_name}</title>")
        html.append("<style>")
        html.append("""
            body { font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
            h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
            h2 { color: #34495e; margin-top: 30px; }
            h3 { color: #2980b9; }
            .result-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                          color: white; padding: 20px; border-radius: 10px; margin: 20px 0; }
            .result-box .value { font-size: 2em; font-weight: bold; }
            .step-box { background: #f8f9fa; border-left: 4px solid #3498db;
                        padding: 15px; margin: 15px 0; border-radius: 0 5px 5px 0; }
            .formula { background: #fff; padding: 10px; border-radius: 5px;
                       overflow-x: auto; font-family: 'Times New Roman', serif; }
            table { border-collapse: collapse; width: 100%; margin: 15px 0; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background: #3498db; color: white; }
            tr:nth-child(even) { background: #f2f2f2; }
            .contribution-bar { height: 20px; background: #e0e0e0; border-radius: 10px; overflow: hidden; }
            .contribution-fill { height: 100%; background: linear-gradient(90deg, #e74c3c, #f39c12, #2ecc71); }
            .issue { padding: 10px; margin: 10px 0; border-radius: 5px; }
            .issue-error { background: #ffebee; border-left: 4px solid #f44336; }
            .issue-warning { background: #fff3e0; border-left: 4px solid #ff9800; }
            .issue-info { background: #e3f2fd; border-left: 4px solid #2196f3; }
            .check-pass { color: #27ae60; }
            .check-warn { color: #f39c12; }
            .check-fail { color: #e74c3c; }
        """)
        html.append("</style>")
        html.append("</head>")
        html.append("<body>")

        html.append(f"<h1>🔬 误差传播分析报告</h1>")
        html.append(f"<p><strong>实验组:</strong> {group_name} | <strong>目标量:</strong> {result.target_name}</p>")

        if issues:
            html.append("<h2>⚠️ 数据问题</h2>")
            for issue in issues:
                severity_class = f"issue-{issue.severity.value}"
                html.append(f"<div class='issue {severity_class}'>")
                html.append(f"<strong>[{issue.severity.value.upper()}] {issue.issue_type.value}</strong>")
                if issue.location:
                    html.append(f" <em>({issue.location})</em>")
                html.append(f"<br>{issue.message}")
                html.append("</div>")

        html.append("<div class='result-box'>")
        html.append(f"<div class='value'>{result.target_name} = {result.target_value:.6g} ± {result.target_uncertainty:.6g} {result.target_unit}</div>")
        html.append(f"<p>相对不确定度: {result.relative_uncertainty*100:.2f}% | 主要来源: {result.dominant_source}</p>")
        html.append("</div>")

        html.append("<h2>📊 边界检查</h2>")
        for check in result.boundary_checks:
            if "✅" in check:
                html.append(f"<p class='check-pass'>{check}</p>")
            elif "⚠️" in check:
                html.append(f"<p class='check-warn'>{check}</p>")
            elif "❌" in check:
                html.append(f"<p class='check-fail'>{check}</p>")
            else:
                html.append(f"<p>{check}</p>")

        html.append("<h2>💡 结果解释</h2>")
        html.append(f"<pre style='white-space: pre-wrap; background: #f8f9fa; padding: 15px; border-radius: 5px;'>{result.interpretation}</pre>")

        html.append("<h2>📈 不确定度贡献分析</h2>")
        html.append("<table>")
        html.append("<tr><th>变量</th><th>测量值 ± 不确定度</th><th>单位</th><th>贡献值</th><th>占比</th><th>贡献分布</th></tr>")

        sorted_contribs = sorted(result.uncertainty_contributions.items(), key=lambda x: x[1], reverse=True)
        total_sq = sum(c ** 2 for c in result.uncertainty_contributions.values())

        for var, contrib in sorted_contribs:
            m = measurements.get(var)
            val_str = f"{m.value} ± {m.uncertainty}" if m else "N/A"
            unit = m.unit if m else "N/A"
            percent = (contrib ** 2 / total_sq * 100) if total_sq > 0 else 0
            html.append("<tr>")
            html.append(f"<td><strong>{var}</strong></td>")
            html.append(f"<td>{val_str}</td>")
            html.append(f"<td>{unit}</td>")
            html.append(f"<td>{contrib:.6g}</td>")
            html.append(f"<td>{percent:5.2f}%</td>")
            html.append(f"<td><div class='contribution-bar'><div class='contribution-fill' style='width:{percent}%'></div></div></td>")
            html.append("</tr>")

        html.append("</table>")

        html.append("<h2>📝 计算步骤</h2>")
        for step in result.steps:
            html.append(f"<div class='step-box'>")
            html.append(f"<h3>步骤 {step.step_number}: {step.description}</h3>")
            html.append(f"<div class='formula'>$$ {step.formula_latex} $$</div>")
            html.append(f"<p><em>{step.formula_text}</em></p>")

            if step.uncertainty_contribution:
                html.append("<h4>不确定度贡献:</h4>")
                for v, c in step.uncertainty_contribution.items():
                    percent = (c ** 2 / total_sq * 100) if total_sq > 0 else 0
                    html.append(f"<p>{v}: {c:.6g} ({percent:.1f}%)</p>")

            if step.notes:
                html.append("<h4>说明:</h4>")
                for note in step.notes:
                    html.append(f"<p>• {note}</p>")

            html.append("</div>")

        html.append("<h2>📐 合成不确定度公式</h2>")
        html.append(f"<div class='formula' style='font-size: 1.2em;'>$$ {result.combined_formula_latex} $$</div>")

        html.append("<script src='https://polyfill.io/v3/polyfill.min.js?features=es6'></script>")
        html.append("<script id='MathJax-script' async src='https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js'></script>")
        html.append("</body>")
        html.append("</html>")

        return "\n".join(html)

    def generate_markdown_report(
        self,
        result: PropagationResult,
        measurements: Dict[str, Measurement],
        group_name: str = "default",
        issues: Optional[List] = None
    ) -> str:
        """生成Markdown格式报告"""
        return self.explain_result(result, measurements)

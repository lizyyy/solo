from typing import Dict, List, Optional
import pandas as pd
from pathlib import Path
from datetime import datetime
import json

from .visualization import Visualizer


class ReportGenerator:
    def __init__(self, output_dir: str = "./output"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.visualizer = Visualizer(output_dir=str(self.output_dir / "charts"))

    def generate_summary_report(
        self,
        workflow_summary: Dict,
        step_results: Dict[str, Dict],
        dataframes: Dict[str, pd.DataFrame],
        include_charts: bool = True,
    ) -> Dict[str, str]:
        outputs = {}

        outputs["summary_json"] = self._generate_summary_json(
            workflow_summary, step_results
        )
        outputs["summary_csv"] = self._generate_summary_csv(workflow_summary)
        outputs["detailed_report"] = self._generate_detailed_markdown(
            workflow_summary, step_results, dataframes
        )

        if include_charts:
            chart_paths = self.visualizer.generate_all_charts(
                dataframes, workflow_summary.get("duplicate_summary", {})
            )
            outputs["charts"] = chart_paths

        outputs["index_html"] = self._generate_index_html(
            workflow_summary, step_results, outputs
        )

        return outputs

    def _generate_summary_json(
        self, workflow_summary: Dict, step_results: Dict[str, Dict]
    ) -> str:
        summary = {
            "generated_at": datetime.now().isoformat(),
            "workflow_summary": workflow_summary,
            "step_results": step_results,
        }

        output_path = self.output_dir / "evaluation_summary.json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        return str(output_path)

    def _generate_summary_csv(self, workflow_summary: Dict) -> str:
        dup_summary = workflow_summary.get("duplicate_summary", {})
        data = [
            {
                "指标": "负样本总数",
                "数值": workflow_summary.get("negative_samples_count", 0),
            },
            {
                "指标": "召回候选总数",
                "数值": workflow_summary.get("recall_candidates_count", 0),
            },
            {
                "指标": "特征版本总数",
                "数值": workflow_summary.get("feature_versions_count", 0),
            },
            {
                "指标": "重复训练组数",
                "数值": dup_summary.get("total_duplicate_groups", 0),
            },
            {
                "指标": "重复训练总条数",
                "数值": dup_summary.get("total_duplicate_items", 0),
            },
            {
                "指标": "步骤1完成",
                "数值": workflow_summary.get("steps_completed", {}).get(
                    "step1_import_negative", False
                ),
            },
            {
                "指标": "步骤2完成",
                "数值": workflow_summary.get("steps_completed", {}).get(
                    "step2_review_recall", False
                ),
            },
            {
                "指标": "步骤3完成",
                "数值": workflow_summary.get("steps_completed", {}).get(
                    "step3_update_feature", False
                ),
            },
        ]

        df = pd.DataFrame(data)
        output_path = self.output_dir / "evaluation_summary.csv"
        df.to_csv(output_path, index=False, encoding="utf-8-sig")
        return str(output_path)

    def _generate_detailed_markdown(
        self,
        workflow_summary: Dict,
        step_results: Dict[str, Dict],
        dataframes: Dict[str, pd.DataFrame],
    ) -> str:
        lines = []
        lines.append("# 候选集截断影响评估报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("## 一、评估概览")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 负样本总数 | {workflow_summary.get('negative_samples_count', 0)} |")
        lines.append(f"| 召回候选总数 | {workflow_summary.get('recall_candidates_count', 0)} |")
        lines.append(f"| 特征版本总数 | {workflow_summary.get('feature_versions_count', 0)} |")
        dup_summary = workflow_summary.get("duplicate_summary", {})
        lines.append(f"| 🔴 重复训练组数 | {dup_summary.get('total_duplicate_groups', 0)} |")
        lines.append(f"| 🔴 重复训练总条数 | {dup_summary.get('total_duplicate_items', 0)} |")
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("## 二、执行步骤详情")
        lines.append("")

        steps = [
            (
                "步骤1：负样本列表导入",
                "step1_import_negative",
                step_results.get("step1", {}),
            ),
            (
                "步骤2：召回候选表复核（阿越）",
                "step2_review_recall",
                step_results.get("step2", {}),
            ),
            (
                "步骤3：特征版本表更新",
                "step3_update_feature",
                step_results.get("step3", {}),
            ),
        ]

        for step_name, step_key, result in steps:
            completed = workflow_summary.get("steps_completed", {}).get(step_key, False)
            status_icon = "✅" if completed else "⏳"
            lines.append(f"### {status_icon} {step_name}")
            lines.append("")
            if completed and result:
                for k, v in result.items():
                    if k not in ["duplicates", "cross_duplicate_details"]:
                        lines.append(f"- **{k}**: {v}")
            else:
                lines.append("- 未执行")
            lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("## 三、重复训练检测详情")
        lines.append("")

        dup_groups = dup_summary.get("duplicate_groups", [])
        if dup_groups:
            table_dups = [g for g in dup_groups if not g.get("is_cross", False)]
            cross_dups = [g for g in dup_groups if g.get("is_cross", False)]

            lines.append("### 🔴 检测到的重复训练分组")
            lines.append("")
            if table_dups:
                lines.append("#### 表内重复（单表内同一批数据重复训练两次及以上）")
                lines.append("")
                lines.append("| 批次ID | 商品ID | 重复次数 | 样本/候选ID | 状态 |")
                lines.append("|--------|--------|----------|-------------|------|")
                for g in table_dups:
                    ids = g.get("sample_ids") or g.get("candidate_ids") or []
                    lines.append(
                        f"| {g['batch_id']} | {g['item_id']} | {g['count']} | {', '.join(ids)} | 待策略产品复核 |"
                    )
                lines.append("")

            if cross_dups:
                lines.append("#### 🔗 跨表交叉重复（负样本+召回候选组合起来同一批数据重复训练）")
                lines.append("")
                lines.append(
                    "| 批次ID | 商品ID | 负样本次数 | 召回候选次数 | 总次数 | 负样本ID | 召回候选ID | 状态 |"
                )
                lines.append(
                    "|--------|--------|------------|--------------|--------|----------|------------|------|"
                )
                for g in cross_dups:
                    lines.append(
                        f"| {g['batch_id']} | {g['item_id']} | "
                        f"{g.get('negative_sample_count', 0)} | "
                        f"{g.get('recall_candidate_count', 0)} | "
                        f"{g['count']} | "
                        f"{', '.join(g.get('sample_ids', []))} | "
                        f"{', '.join(g.get('candidate_ids', []))} | "
                        f"待策略产品复核 |"
                    )
                lines.append("")

            lines.append("> ⚠️ **重要提示**: 以上数据检测到同一批数据重复训练两次（含表内重复和跨表交叉重复），")
            lines.append("> 已自动标记为「待策略产品复核」状态，")
            lines.append("> **请勿自动归为正常**，请转交策略产品进行人工复核。")
            lines.append("")
            lines.append("#### 数据追溯方式")
            lines.append("")
            lines.append("通过以下字段可追溯原始记录：")
            lines.append("- 负样本列表：通过 `sample_id` 查找 `negative_samples_processed.csv`")
            lines.append("- 召回候选表：通过 `candidate_id` 查找 `recall_candidates_processed.csv`")
            lines.append("- 特征版本表：通过 `linked_sample_id` / `linked_candidate_id` 双向关联")
            lines.append("")
        else:
            lines.append("✅ 未检测到重复训练数据")
            lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("## 四、特征版本表说明")
        lines.append("")
        lines.append("特征版本表中每条记录包含以下信息：")
        lines.append("")
        lines.append("1. **为什么被留下**：说明数据来源（负样本/召回候选）及初检结论")
        lines.append("2. **还缺什么材料**：列出待补充的材料清单")
        lines.append("3. **下一步找谁**：")
        lines.append("   - 待策略产品复核 → 找「策略产品」")
        lines.append("   - 实验平台数据确认 → 找「实验平台负责人阿越」")
        lines.append("")

        if "feature_versions" in dataframes:
            df = dataframes["feature_versions"]
            if "next_owner" in df.columns:
                owner_counts = df["next_owner"].value_counts()
                lines.append("### 待处理人员分布")
                lines.append("")
                for owner, count in owner_counts.items():
                    lines.append(f"- **{owner}**: {count} 条待处理")
                lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("## 五、输出文件清单")
        lines.append("")
        lines.append("### 数据文件")
        lines.append("- `negative_samples_processed.csv` - 处理后的负样本列表")
        lines.append("- `recall_candidates_processed.csv` - 处理后的召回候选表")
        lines.append("- `feature_versions_updated.csv` - 更新后的特征版本表")
        lines.append("")
        lines.append("### 图表文件（charts/ 目录）")
        lines.append("- 状态分布饼图")
        lines.append("- 重复训练分组柱状图")
        lines.append("- 3D 数据分布散点图")
        lines.append("- 批次质量对比图")
        lines.append("")
        lines.append("### 报告文件")
        lines.append("- `evaluation_summary.json` - 完整评估摘要（JSON）")
        lines.append("- `evaluation_summary.csv` - 评估指标汇总（CSV）")
        lines.append("- `index.html` - 交互式报告首页")
        lines.append("")

        output_path = self.output_dir / "evaluation_report.md"
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        return str(output_path)

    def _generate_index_html(
        self,
        workflow_summary: Dict,
        step_results: Dict[str, Dict],
        outputs: Dict,
    ) -> str:
        dup_summary = workflow_summary.get("duplicate_summary", {})
        dup_groups = dup_summary.get("duplicate_groups", [])

        chart_links = ""
        if "charts" in outputs:
            for name, path in outputs["charts"].items():
                rel_path = Path(path).relative_to(self.output_dir)
                chart_links += f'<li><a href="{rel_path}" target="_blank">{name}</a></li>\n'

        steps_html = ""
        steps = [
            (
                "步骤1：负样本列表导入",
                "step1_import_negative",
                "导入负样本列表，自动检测重复训练",
            ),
            (
                "步骤2：召回候选表复核（阿越）",
                "step2_review_recall",
                "实验平台负责人阿越补看召回候选表",
            ),
            (
                "步骤3：特征版本表更新",
                "step3_update_feature",
                "同步负样本和召回候选状态到特征版本表",
            ),
        ]
        for i, (name, key, desc) in enumerate(steps):
            completed = workflow_summary.get("steps_completed", {}).get(key, False)
            status_class = "completed" if completed else "pending"
            status_text = "已完成" if completed else "待执行"
            steps_html += f"""
            <div class="step-card {status_class}">
                <div class="step-number">{i + 1}</div>
                <div class="step-content">
                    <h3>{name}</h3>
                    <p>{desc}</p>
                    <span class="step-status">{status_text}</span>
                </div>
            </div>
            """

        alert_html = ""
        dup_detail_html = ""
        if dup_groups:
            table_dups = [g for g in dup_groups if not g.get("is_cross", False)]
            cross_dups = [g for g in dup_groups if g.get("is_cross", False)]

            alert_html = f"""
            <div class="alert alert-danger">
                <strong>⚠️ 检测到 {len(dup_groups)} 组重复训练数据！</strong>
                <p>共涉及 {dup_summary.get('total_duplicate_items', 0)} 条记录（表内重复 {len(table_dups)} 组、跨表交叉重复 {len(cross_dups)} 组），
                已自动标记为「待策略产品复核」，<strong>请勿自动归为正常</strong>，请转交策略产品人工复核。</p>
            </div>
            """

            dup_rows_html = ""
            if cross_dups:
                for g in cross_dups:
                    dup_rows_html += f"""
                    <tr class="dup-row cross" id="dup_{g['batch_id']}_{g['item_id']}">
                        <td><span class="badge badge-cross">交叉重复</span></td>
                        <td>{g['batch_id']}</td>
                        <td>{g['item_id']}</td>
                        <td>{g.get('negative_sample_count', 0)}（负样本） + {g.get('recall_candidate_count', 0)}（召回候选） = <strong>{g['count']}</strong></td>
                        <td>
                            <div>负样本ID: {', '.join(g.get('sample_ids', [])) or '—'}</div>
                            <div>召回候选ID: {', '.join(g.get('candidate_ids', [])) or '—'}</div>
                        </td>
                        <td><span class="status-badge pending-strategy">待策略产品复核</span></td>
                        <td><a href="negative_samples_processed.csv" target="_blank">负样本表</a> · <a href="recall_candidates_processed.csv" target="_blank">召回候选表</a> · <a href="feature_versions_updated.csv" target="_blank">特征版本表</a></td>
                    </tr>
                    """
            if table_dups:
                for g in table_dups:
                    ids = g.get("sample_ids") or g.get("candidate_ids") or []
                    dup_rows_html += f"""
                    <tr class="dup-row table">
                        <td><span class="badge badge-table">表内重复</span></td>
                        <td>{g['batch_id']}</td>
                        <td>{g['item_id']}</td>
                        <td><strong>{g['count']}</strong></td>
                        <td>{', '.join(ids)}</td>
                        <td><span class="status-badge pending-strategy">待策略产品复核</span></td>
                        <td><a href="negative_samples_processed.csv" target="_blank">负样本表</a> · <a href="recall_candidates_processed.csv" target="_blank">召回候选表</a> · <a href="feature_versions_updated.csv" target="_blank">特征版本表</a></td>
                    </tr>
                    """

            dup_detail_html = f"""
            <div class="section">
                <h2>🔴 重复训练明细（历史留痕）</h2>
                <div class="dup-hint">⚠️ 所有检测到的同一批数据重复训练两次及以上的数据，都会留痕在此页面，不急着归正常，留给策略产品复核。</div>
                <table class="dup-table">
                    <thead>
                        <tr>
                            <th>类型</th>
                            <th>批次ID</th>
                            <th>商品ID</th>
                            <th>重复次数</th>
                            <th>关联ID（追溯路径）</th>
                            <th>当前状态</th>
                            <th>数据追溯</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dup_rows_html}
                    </tbody>
                </table>
            </div>
            """

        html = f"""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>候选集截断影响评估报告</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; color: #333; }}
        .container {{ max-width: 1200px; margin: 0 auto; padding: 20px; }}
        header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 12px; margin-bottom: 30px; }}
        h1 {{ font-size: 28px; margin-bottom: 10px; }}
        .subtitle {{ opacity: 0.9; font-size: 16px; }}
        .stats-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }}
        .stat-card {{ background: white; padding: 24px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }}
        .stat-number {{ font-size: 36px; font-weight: bold; color: #667eea; }}
        .stat-label {{ color: #666; margin-top: 8px; }}
        .stat-number.danger {{ color: #ef553b; }}
        .alert {{ padding: 20px; border-radius: 12px; margin-bottom: 30px; }}
        .alert-danger {{ background: #ffe5e5; border: 1px solid #ffcccc; color: #c53030; }}
        .alert-danger strong {{ font-size: 18px; }}
        .alert-danger p {{ margin-top: 8px; }}
        .section {{ background: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }}
        .section h2 {{ font-size: 22px; margin-bottom: 20px; color: #333; }}
        .steps-container {{ display: flex; flex-direction: column; gap: 16px; }}
        .step-card {{ display: flex; align-items: center; padding: 20px; border-radius: 10px; background: #f8f9fa; border-left: 4px solid #ddd; transition: all 0.3s; }}
        .step-card.completed {{ border-left-color: #00cc96; background: #f0fff9; }}
        .step-card.pending {{ border-left-color: #ffa500; }}
        .step-number {{ width: 48px; height: 48px; border-radius: 50%; background: #667eea; color: white; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; margin-right: 20px; flex-shrink: 0; }}
        .step-card.completed .step-number {{ background: #00cc96; }}
        .step-content {{ flex: 1; }}
        .step-content h3 {{ font-size: 18px; margin-bottom: 6px; }}
        .step-content p {{ color: #666; }}
        .step-status {{ display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-top: 8px; }}
        .step-card.completed .step-status {{ background: #00cc96; color: white; }}
        .step-card.pending .step-status {{ background: #ffa500; color: white; }}
        .chart-links {{ list-style: none; }}
        .chart-links li {{ padding: 12px 0; border-bottom: 1px solid #eee; }}
        .chart-links li:last-child {{ border-bottom: none; }}
        .chart-links a {{ color: #667eea; text-decoration: none; font-weight: 500; }}
        .chart-links a:hover {{ text-decoration: underline; }}
        .data-files {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; }}
        .file-item {{ padding: 16px; background: #f8f9fa; border-radius: 8px; font-family: monospace; }}
        .dup-hint {{ background: #fff4e5; border-left: 4px solid #ffa500; padding: 14px 18px; border-radius: 8px; margin-bottom: 20px; color: #8a5a00; }}
        .dup-table {{ width: 100%; border-collapse: collapse; font-size: 14px; }}
        .dup-table th, .dup-table td {{ padding: 12px; text-align: left; border-bottom: 1px solid #eee; }}
        .dup-table th {{ background: #f8f9fa; font-weight: 600; color: #333; }}
        .dup-row.cross td {{ background: #fff5f5; }}
        .dup-row.table td {{ background: #fffaf0; }}
        .badge {{ display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; color: white; }}
        .badge-cross {{ background: #ef553b; }}
        .badge-table {{ background: #ffa500; }}
        .status-badge {{ display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }}
        .status-badge.pending-strategy {{ background: #ef553b; color: white; }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>📊 候选集截断影响评估报告</h1>
            <p class="subtitle">生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        </header>

        {alert_html}

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">{workflow_summary.get('negative_samples_count', 0)}</div>
                <div class="stat-label">负样本总数</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">{workflow_summary.get('recall_candidates_count', 0)}</div>
                <div class="stat-label">召回候选总数</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">{workflow_summary.get('feature_versions_count', 0)}</div>
                <div class="stat-label">特征版本总数</div>
            </div>
            <div class="stat-card">
                <div class="stat-number danger">{dup_summary.get('total_duplicate_items', 0)}</div>
                <div class="stat-label">重复训练条数</div>
            </div>
        </div>

        <div class="section">
            <h2>🛤️ 评估流程</h2>
            <div class="steps-container">
                {steps_html}
            </div>
        </div>

        {dup_detail_html}

        <div class="section">
            <h2>📈 可视化图表</h2>
            <ul class="chart-links">
                {chart_links}
            </ul>
        </div>

        <div class="section">
            <h2>📁 输出数据文件</h2>
            <div class="data-files">
                <div class="file-item">negative_samples_processed.csv</div>
                <div class="file-item">recall_candidates_processed.csv</div>
                <div class="file-item">feature_versions_updated.csv</div>
            </div>
        </div>
    </div>
</body>
</html>
        """

        output_path = self.output_dir / "index.html"
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html)
        return str(output_path)

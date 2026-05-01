from typing import List, Dict, Any


def render_summary_markdown(metrics_summary: Dict[str, Any]) -> str:
    lines = [
        "# 菜谱步骤结构化抽取模型评估报告",
        "",
        "## 总体统计",
        f"- 评估菜谱总数: {metrics_summary.get('total_recipes_evaluated', 0)}",
        f"- 总错误数: {metrics_summary.get('total_errors', 0)}",
        f"- 总警告数: {metrics_summary.get('total_warnings', 0)}",
        "",
    ]

    fla = metrics_summary.get("field_level_accuracy", {})
    lines.extend([
        "## 字段级准确率",
        f"- 字段准确率: {fla.get('field_accuracy_percent', 0)}%",
        f"- 正确字段数: {fla.get('correct_fields', 0)}",
        f"- 总字段数: {fla.get('total_fields', 0)}",
        "",
    ])

    conf = metrics_summary.get("common_confusions", {})
    lines.extend([
        "## 常见混淆",
        "",
        "### 错误类型分布",
    ])
    for err_type, count in conf.get("error_type_distribution", {}).items():
        lines.append(f"- {err_type}: {count}")

    lines.extend(["", "### 食材混淆 Top 10"])
    for ing, count in conf.get("top_ingredient_confusions", {}).items():
        lines.append(f"- {ing}: {count}")

    lines.extend(["", "### 火候标签混淆 Top 10"])
    for heat, count in conf.get("top_heat_level_confusions", {}).items():
        lines.append(f"- {heat}: {count}")

    step_stats = metrics_summary.get("step_order_statistics", {})
    lines.extend([
        "",
        "## 步骤顺序统计",
        f"- 有顺序问题的菜谱: {step_stats.get('recipes_with_order_issues', 0)}/{step_stats.get('total_recipes', 0)}",
        f"- 顺序问题率: {step_stats.get('order_issue_rate_percent', 0)}%",
        f"- 步骤顺序错误总数: {step_stats.get('total_step_order_errors', 0)}",
        "",
    ])

    missing_stats = metrics_summary.get("missing_field_statistics", {})
    lines.extend([
        "## 缺字段统计",
        f"- 有缺字段问题的菜谱: {missing_stats.get('recipes_with_missing_fields', 0)}",
        f"- 总缺字段数: {missing_stats.get('total_missing_fields', 0)}",
    ])
    for field, count in missing_stats.get("missing_by_field", {}).items():
        lines.append(f"  - {field}: {count}")

    return "\n".join(lines)
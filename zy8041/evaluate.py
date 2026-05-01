import argparse
import sys
import os
from pathlib import Path

from parsers import parse_recipes_csv, parse_jsonl, parse_schema
from validators import validate_all
from metrics import MetricsCalculator
from reports import render_summary_markdown, render_errors_csv, render_html_comparison


def main():
    parser = argparse.ArgumentParser(description="菜谱步骤结构化抽取模型评估工具")
    parser.add_argument("--recipes", required=True, help="recipes.csv 文件路径")
    parser.add_argument("--golden", required=True, help="golden.jsonl 文件路径")
    parser.add_argument("--model-outputs", required=True, help="model_outputs.jsonl 文件路径")
    parser.add_argument("--schema", required=True, help="schema.yaml 文件路径")
    parser.add_argument("--output-dir", default="output", help="输出目录路径 (默认: output)")

    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    recipes_csv = parse_recipes_csv(args.recipes)
    golden_records = parse_jsonl(args.golden)
    model_outputs = parse_jsonl(args.model_outputs)
    schema = parse_schema(args.schema)

    validation_results = validate_all(golden_records, model_outputs, schema)

    metrics_calc = MetricsCalculator(validation_results)
    summary = metrics_calc.summary()

    summary_md = render_summary_markdown(summary)
    summary_path = output_dir / "summary.md"
    with open(summary_path, "w", encoding="utf-8") as f:
        f.write(summary_md)

    errors_path = output_dir / "errors.csv"
    render_errors_csv(validation_results, str(errors_path))

    html_path = output_dir / "comparison.html"
    render_html_comparison(validation_results, golden_records, model_outputs, str(html_path))

    print(f"评估完成!")
    print(f"  字段准确率: {summary['field_level_accuracy']['field_accuracy_percent']}%")
    print(f"  总错误数: {summary['total_errors']}")
    print(f"  总警告数: {summary['total_warnings']}")
    print(f"\n输出文件:")
    print(f"  - {summary_path}")
    print(f"  - {errors_path}")
    print(f"  - {html_path}")


if __name__ == "__main__":
    main()
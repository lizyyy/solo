import argparse
import sys
from pathlib import Path
from .parser import parse_valve_csv, parse_curve_jsonl, parse_rules_yaml, build_valve_index, group_curves_by_valve
from .rules import process_valve_results, evaluate_result
from .report import generate_abnormal_csv, generate_markdown_report, generate_html_report


def main():
    parser = argparse.ArgumentParser(description='压力容器安全阀校验批次复核工具')
    parser.add_argument('--valve-csv', required=True, help='安全阀台账CSV文件路径')
    parser.add_argument('--curve-jsonl', required=True, help='校验台测试曲线JSONL文件路径')
    parser.add_argument('--rules-yaml', required=True, help='判定规则YAML文件路径')
    parser.add_argument('--output-dir', default='output', help='输出目录')
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        print('正在解析安全阀台账...')
        valves = parse_valve_csv(args.valve_csv)
        valve_index = build_valve_index(valves)
        print(f'  解析到 {len(valves)} 条阀门记录')

        print('正在解析测试曲线...')
        curves = parse_curve_jsonl(args.curve_jsonl)
        curves_by_valve = group_curves_by_valve(curves)
        print(f'  解析到 {len(curves)} 条测试曲线，涉及 {len(curves_by_valve)} 个阀门')

        print('正在加载判定规则...')
        rules = parse_rules_yaml(args.rules_yaml)
        print(f'  整定压力偏差限值: ±{rules.set_pressure_tolerance}%')
        print(f'  最大启闭压差: {rules.opening_closing_diff_max} MPa')
        print(f'  最小采样点数: {rules.min_sample_points}')

        print('正在计算校验结果...')
        all_results = {}
        abnormal_valve_ids = set()
        
        for valve_id, curve_list in curves_by_valve.items():
            if valve_id not in valve_index:
                print(f'  警告: 阀门 {valve_id} 不在台账中，跳过')
                continue
            
            valve = valve_index[valve_id]
            results = process_valve_results(valve_id, curve_list, valve, rules)
            
            for result in results:
                passed, v_list = evaluate_result(result, rules, valve)
                result.violations = v_list
                if not passed:
                    abnormal_valve_ids.add(valve_id)
            
            all_results[valve_id] = results

        print(f'  处理完成，发现 {len(abnormal_valve_ids)} 个异常阀门')

        print('正在生成异常CSV报告...')
        abnormal_csv_path = output_dir / 'abnormal_report.csv'
        generate_abnormal_csv(all_results, valve_index, str(abnormal_csv_path))
        print(f'  已生成: {abnormal_csv_path}')

        print('正在生成Markdown报告...')
        md_report_path = output_dir / 'review_report.md'
        generate_markdown_report(all_results, valve_index, rules, str(md_report_path))
        print(f'  已生成: {md_report_path}')

        print('正在生成HTML曲线浏览页...')
        html_report_path = output_dir / 'curves.html'
        generate_html_report(curves_by_valve, valve_index, str(html_report_path))
        print(f'  已生成: {html_report_path}')

        print('')
        print('复核完成！输出文件位于:', output_dir)

    except Exception as e:
        print(f'错误: {e}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
import argparse
import numpy as np
from pathlib import Path
from .parser import parse_plan_dose, parse_measurements, parse_structures, parse_thresholds
from .calculation import interpolate_dose, calculate_gamma, structure_dose_stats
from .validation import validate_all
from .report import export_qa_report, export_failed_points, export_heatmap


def main():
    parser = argparse.ArgumentParser(
        description="放疗剂量QA工具 - 计划出束前二次剂量校核"
    )
    subparsers = parser.add_subparsers(title="命令", dest="command")

    run_parser = subparsers.add_parser("run", help="运行QA分析")
    run_parser.add_argument("--plan", required=True, help="计划剂量网格CSV文件路径")
    run_parser.add_argument("--measurements", required=True, help="测量点JSONL文件路径")
    run_parser.add_argument("--structures", required=True, help="器官结构JSON文件路径")
    run_parser.add_argument("--thresholds", required=True, help="科室阈值YAML文件路径")
    run_parser.add_argument("--out-dir", default="./output", help="输出目录 (默认: ./output)")

    args = parser.parse_args()

    if args.command == "run":
        run_qa(args)
    else:
        parser.print_help()


def run_qa(args):
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("  放疗剂量QA分析")
    print("=" * 60)

    print("\n[1/6] 解析输入文件...")
    plan_doses, plan_meta = parse_plan_dose(Path(args.plan))
    print(f"  - 计划剂量: {len(plan_doses)} 个点")
    
    measurements = parse_measurements(Path(args.measurements))
    print(f"  - 测量点: {len(measurements)} 个")
    
    structures = parse_structures(Path(args.structures))
    print(f"  - 结构轮廓: {len(structures)} 个")
    
    thresholds = parse_thresholds(Path(args.thresholds))
    print("  - 阈值配置: 已加载")

    print("\n[2/6] 剂量插值取样...")
    meas_coords = np.array([[p['x'], p['y'], p['z']] for p in measurements])
    plan_coords = plan_meta['coords']
    interpolated = interpolate_dose(plan_coords, plan_doses, meas_coords)
    for i, p in enumerate(measurements):
        p['plan_dose'] = interpolated[i]
    print("  - 完成")

    print("\n[3/6] Gamma分析...")
    measured_doses = np.array([p['measured_dose'] for p in measurements])
    gamma_values, gamma_pass_rate = calculate_gamma(
        measured_doses, interpolated,
        dd_threshold=thresholds.get('dd_threshold', 0.03),
        dta_threshold=thresholds.get('dta_threshold', 3.0)
    )
    print(f"  - Gamma通过率: {gamma_pass_rate:.2f}%")

    print("\n[4/6] 器官剂量统计...")
    structure_stats = {}
    for name, struct in structures.items():
        if struct and 'contours' in struct:
            stats = structure_dose_stats(plan_coords, plan_doses, struct['contours'])
            structure_stats[name] = stats
        else:
            structure_stats[name] = None
    print("  - 完成")

    print("\n[5/6] 规则判定...")
    results = validate_all(gamma_pass_rate, structure_stats, thresholds)
    overall = "PASS" if results['overall']['passed'] else "FAIL"
    print(f"  - 总体结果: {overall}")

    print("\n[6/6] 导出报告...")
    report_path = out_dir / "qa_report.md"
    failed_path = out_dir / "failed_points.csv"
    heatmap_path = out_dir / "heatmap.html"
    
    export_qa_report(report_path, results, gamma_pass_rate, structure_stats, measurements)
    print(f"  - QA报告: {report_path}")
    
    export_failed_points(failed_path, measurements, gamma_values)
    print(f"  - 失败点: {failed_path}")
    
    export_heatmap(heatmap_path, measurements, gamma_values)
    print(f"  - 热力图: {heatmap_path}")

    print("\n" + "=" * 60)
    print(f"  分析完成! 总体结果: {overall}")
    print("=" * 60)
    print(f"\n输出目录: {out_dir.absolute()}")


if __name__ == "__main__":
    main()

"""
游泳划水推进分析 CLI 入口
====================

使用方法：
    python -m swim_analysis.cli --input sample_data.json --output result.json
    python -m swim_analysis.cli --sample  # 运行样例数据

输出层级：
    --level 1: 仅总体摘要
    --level 2: 总体摘要 + 段落列表
    --level 3: 前三层（默认）
    --level 4: 全部四层（含逐点原始数据）
"""

import argparse
import json
import sys
from typing import Optional
from .kinematics import KinematicInput, analyze_kinematics
from .resistance import ResistanceInput, analyze_resistance
from .efficiency import analyze_efficiency
from .segmentation import segment_swim
from .data_validation import validate_and_clean_data, apply_manual_correction
from .output_formatter import format_output


def load_input_from_json(filepath: str) -> dict:
    """从JSON文件加载输入数据"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def create_kinematic_input(data: dict) -> KinematicInput:
    """从字典创建运动学输入对象"""
    return KinematicInput(
        time=data["time"],
        position=data["position"],
        stroke_count=data["stroke_count"],
        pool_length=data.get("pool_length", 25.0),
        stroke_style=data.get("stroke_style", "自由泳"),
        athlete_name=data.get("athlete_name", "未知运动员"),
        sample_rate=data.get("sample_rate", 10.0),
    )


def run_analysis(
    input_data: dict,
    known_pool_length: Optional[float] = None,
    enable_autocorrect: bool = False,
    athlete_height: Optional[float] = None,
    athlete_weight: Optional[float] = None,
) -> dict:
    """
    执行完整的分析流程

    流程：
    1. 数据验证与清洗
    2. 运动学分析
    3. 阻力估算
    4. 效率计算
    5. 段落划分与线索关联
    6. 输出格式化
    """
    print("=" * 60)
    print("游泳划水推进分析系统")
    print("=" * 60)

    print("\n[1/6] 数据验证与清洗...")
    kinematic_input = create_kinematic_input(input_data)
    validation_result = validate_and_clean_data(
        kinematic_input,
        known_pool_length=known_pool_length,
        enable_autocorrect=enable_autocorrect
    )
    print(f"  - 原始数据哈希: {validation_result.raw_data_hash}")
    print(f"  - 发现问题: {len(validation_result.issues)} 个")
    for issue in validation_result.issues:
        status = "✗" if issue.severity == "error" else "⚠"
        print(f"    {status} [{issue.severity}] {issue.description}")

    if not validation_result.validated_data:
        print("错误: 数据验证失败，无法继续分析")
        return {"error": "数据验证失败", "issues": [i.description for i in validation_result.issues]}

    print("\n[2/6] 运动学分析...")
    kinematic_result = analyze_kinematics(validation_result.validated_data)
    print(f"  - 总时长: {kinematic_result.stats['total_time']:.2f}s")
    print(f"  - 总距离: {kinematic_result.stats['total_distance']:.2f}m")
    print(f"  - 平均速度: {kinematic_result.stats['avg_velocity']:.3f} m/s")
    print(f"  - 平均划水频率: {kinematic_result.stats['avg_stroke_rate']:.1f} 次/分钟")
    print(f"  - 平均划水步幅: {kinematic_result.stats['avg_stroke_length']:.3f} m/次")

    print("\n[3/6] 阻力估算...")
    height = athlete_height or input_data.get("athlete_height", 1.75)
    weight = athlete_weight or input_data.get("athlete_weight", 65.0)
    resistance_input = ResistanceInput(
        athlete_height=height,
        athlete_weight=weight,
        stroke_style=validation_result.validated_data.stroke_style,
        kinematic_result=kinematic_result
    )
    resistance_result = analyze_resistance(resistance_input)
    print(f"  - 迎水面积 A: {resistance_result.params_used['frontal_area_A']:.4f} m²")
    print(f"  - 阻力系数 Cd: {resistance_result.params_used['Cd']}")
    print(f"  - 主动阻力系数 K: {resistance_result.params_used['K_active']}")
    print(f"  - 平均主动阻力: {resistance_result.stats['avg_active_resistance']:.2f} N")
    print(f"  - 平均推进功率: {resistance_result.stats['avg_power']:.2f} W")

    print("\n[4/6] 效率计算...")
    efficiency_result = analyze_efficiency(kinematic_result, resistance_result)
    print(f"  - 推进效率: {efficiency_result.stats['propulsive_efficiency']:.4f}")
    print(f"  - 平均划水效率: {efficiency_result.stats['avg_stroke_efficiency']:.4f}")
    print(f"  - 平均整体效率: {efficiency_result.stats['avg_overall_efficiency']:.4f}")
    print(f"  - 发现低效率段落: {len(efficiency_result.low_efficiency_segments)} 个")
    for i, seg in enumerate(efficiency_result.low_efficiency_segments):
        print(f"    - 段落 {i+1}: t={seg['start_time']:.1f}-{seg['end_time']:.1f}s, "
              f"效率下降 {seg['efficiency_drop_pct']:.1f}%")
        for cause in seg.get('evidence', {}).get('causes', []):
            print(f"      · 可能原因: {cause}")

    print("\n[5/6] 段落划分与线索关联...")
    segmentation_result = segment_swim(
        kinematic_result,
        resistance_result,
        efficiency_result,
        validation_result
    )
    print(f"  - 划分段落: {len(segmentation_result.segments)} 个")
    print(f"  - 关联线索: {len(segmentation_result.clues)} 条")
    print(f"  - 段落对比: {len(segmentation_result.comparisons)} 组")

    print("\n[6/6] 输出格式化...")
    formatted_output = format_output(
        kinematic_result,
        resistance_result,
        efficiency_result,
        segmentation_result,
        validation_result
    )
    print("  ✓ 输出格式化完成")
    print(f"  ✓ 证据链完整，追溯链接已生成")

    print("\n" + "=" * 60)
    print("分析完成！")
    print("=" * 60)

    return formatted_output.to_dict()


def print_summary(result: dict, level: int = 1):
    """根据级别打印摘要"""
    if level >= 1:
        summary = result["level1_summary"]
        print("\n【Level 1: 总体摘要】")
        print(f"  运动员: {summary['运动员']}")
        print(f"  泳姿: {summary['泳姿']}")
        print(f"  池长: {summary['池长']}")
        print(f"  总时长: {summary['总时长']}")
        print(f"  总距离: {summary['总距离']}")
        print(f"  关键指标:")
        for k, v in summary["关键指标"].items():
            print(f"    - {k}: {v}")

        if summary["低效率段落"]:
            print(f"\n  ⚠ 低效率段落:")
            for seg in summary["低效率段落"]:
                print(f"    - {seg['segment_id']}: {seg['start_time']}-{seg['end_time']}s, "
                      f"效率下降{seg['efficiency_drop_pct']:.1f}%")
                for cause in seg["possible_causes"]:
                    print(f"      · {cause}")

    if level >= 2:
        print("\n【Level 2: 段落列表】")
        for seg in result["level2_segments"]:
            if "segment_id" in seg:
                print(f"\n  {seg['segment_id']} (第{seg['lap_number']}趟, {seg['direction']}方向):")
                print(f"    时长: {seg['duration']}s, 距离: {seg['distance']}m")
                print(f"    平均速度: {seg['avg_velocity']} m/s, 频率: {seg['avg_stroke_rate']} 次/分钟")
                if seg["clues"]:
                    print(f"    线索 ({len(seg['clues'])} 条):")
                    for clue in seg["clues"]:
                        print(f"      - [{clue['severity']}] {clue['description']}")
            elif "type" in seg and seg["type"] == "段落对比":
                print(f"\n  段落对比:")
                for comp in seg["comparisons"]:
                    if comp["conclusions"]:
                        print(f"    {comp['segments']}:")
                        for conc in comp["conclusions"]:
                            print(f"      - {conc}")

    if level >= 3:
        print("\n【Level 3: 单段详情】")
        for seg_id, detail in result["level3_segment_details"].items():
            print(f"\n  {seg_id}:")
            print(f"    时间范围: {detail['time_range']}s")
            print(f"    位置范围: {detail['position_range']}m")
            print(f"    效率: {detail['效率统计']['avg_overall_efficiency']}")

    if level >= 4:
        print("\n【Level 4: 逐点数据】")
        print(f"  共 {len(result['level4_raw_data']['points'])} 个数据点")
        print(f"  查看完整JSON输出获取详细计算过程")

    print("\n【公式参考】")
    for category, formulas in result["formulas_reference"].items():
        print(f"\n  {category}:")
        for name, formula in formulas.items():
            print(f"    - {name}: {formula}")


def main():
    """CLI主函数"""
    parser = argparse.ArgumentParser(
        description="游泳划水推进分析系统 - 整合划水频率、速度、阻力分析",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 运行样例数据
  python -m swim_analysis.cli --sample

  # 分析自定义数据
  python -m swim_analysis.cli --input sample_data.json --output result.json

  # 指定已知池长进行验证
  python -m swim_analysis.cli --input data.json --known-pool-length 25.0

  # 启用自动修正速度尖峰
  python -m swim_analysis.cli --input data.json --auto-correct

  # 输出完整四层数据
  python -m swim_analysis.cli --sample --level 4
        """
    )

    parser.add_argument("--input", "-i", type=str, help="输入数据JSON文件路径")
    parser.add_argument("--sample", action="store_true", help="使用内置样例数据运行")
    parser.add_argument("--output", "-o", type=str, help="输出结果JSON文件路径")
    parser.add_argument("--level", "-l", type=int, default=2, choices=[1, 2, 3, 4],
                        help="输出详细级别 (1-4, 默认: 2)")
    parser.add_argument("--known-pool-length", type=float, help="已知池长（米），用于验证池长输入")
    parser.add_argument("--auto-correct", action="store_true", help="启用自动修正（速度尖峰）")
    parser.add_argument("--athlete-height", type=float, help="运动员身高（米）")
    parser.add_argument("--athlete-weight", type=float, help="运动员体重（公斤）")

    args = parser.parse_args()

    if args.sample:
        from .sample_data import generate_sample_data
        input_data = generate_sample_data()
        print("→ 使用内置样例数据")
    elif args.input:
        input_data = load_input_from_json(args.input)
        print(f"→ 从 {args.input} 加载数据")
    else:
        parser.print_help()
        print("\n错误: 必须指定 --input 或 --sample")
        sys.exit(1)

    result = run_analysis(
        input_data,
        known_pool_length=args.known_pool_length,
        enable_autocorrect=args.auto_correct,
        athlete_height=args.athlete_height,
        athlete_weight=args.athlete_weight,
    )

    if "error" in result:
        print(f"\n分析失败: {result['error']}")
        sys.exit(1)

    print_summary(result, args.level)

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"\n✓ 结果已保存到: {args.output}")

    return result


if __name__ == "__main__":
    main()

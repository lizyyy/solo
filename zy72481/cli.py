#!/usr/bin/env python3
import argparse
import sys
import os
import json
from noise_buffer.processor import NoiseProcessor
from noise_buffer.demo_data import create_demo_data
from noise_buffer.models import ProjectData

DATA_FILE = "project_data.json"


def get_processor():
    if os.path.exists(DATA_FILE):
        data = ProjectData.load(DATA_FILE)
    else:
        data = create_demo_data()
    return NoiseProcessor(data)


def save_processor(processor):
    processor.data.save(DATA_FILE)


def cmd_summary(args):
    processor = get_processor()
    summary = processor.get_sample_summary()
    warnings = processor.get_warnings()

    print("=" * 50)
    print("  口袋篮球场噪声缓冲 - 数据概览")
    print("=" * 50)
    print(f"  总采样点: {summary['total']}")
    print(f"  日间采样: {summary['day']}")
    print(f"  夜间采样: {summary['night']}")
    print(f"  正常数据: {summary['normal']}")
    print(f"  低可信度: {summary['low_confidence']}  ⚠️")
    print(f"  已修正: {summary['corrected']}")
    print(f"  投诉补录: {summary['from_complaint']}")
    print("-" * 50)

    if warnings:
        print("  ⚠️  需要街道规划员复核:")
        for w in warnings:
            print(f"    - {w}")
    else:
        print("  ✅  暂无警告")
    print("=" * 50)


def cmd_list(args):
    processor = get_processor()
    print("=" * 70)
    print(f"  采样点列表 (共{len(processor.data.samples)}个)")
    print("=" * 70)
    for i, s in enumerate(processor.data.samples, 1):
        status_icon = {
            "normal": "✅",
            "low_confidence": "⚠️",
            "corrected": "✏️",
            "from_complaint": "📋",
            "linked": "🔗"
        }.get(s.status, "  ")
        night_icon = "🌙" if s.is_night else "☀️"
        print(f"  [{i}] {status_icon} {night_icon} {s.location_name}")
        print(f"      ID: {s.id[:8]}... | 时段: {s.time_slot} | {s.noise_level}dB")
        print(f"      状态: {s.status} | 来源: {s.source}")
        if s.notes:
            print(f"      备注: {s.notes[:50]}")
        print()
    print("=" * 70)


def cmd_complaints(args):
    processor = get_processor()
    print("=" * 70)
    print(f"  居民投诉列表 (共{len(processor.data.complaints)}条)")
    print("=" * 70)
    for i, c in enumerate(processor.data.complaints, 1):
        status_icon = "🔗" if c.status == "linked" else "⏳"
        print(f"  [{i}] {status_icon} {c.complaint_no}")
        print(f"      {c.location_name} - {c.noise_level}dB")
        print(f"      {c.description}")
        print(f"      上报时间: {c.reported_at} | 状态: {c.status}")
        print()
    print("=" * 70)


def cmd_heatmap(args):
    processor = get_processor()
    heatmap = processor.recompute_heatmap()
    warnings = processor.get_warnings()

    print("=" * 60)
    print("  热力图概览")
    print("=" * 60)

    avg_noise = sum(c.noise_level for c in heatmap) / len(heatmap) if heatmap else 0
    low_conf_count = sum(1 for c in heatmap if c.is_low_confidence)

    print(f"  网格数量: {len(heatmap)}")
    print(f"  平均噪声: {avg_noise:.1f} dB")
    print(f"  低可信度网格: {low_conf_count} 个")
    print()

    if warnings:
        print("  ⚠️  警告:")
        for w in warnings:
            print(f"    - {w}")
        print()

    if args.verbose:
        print("  网格详情:")
        for cell in heatmap:
            flag = " ⚠️" if cell.is_low_confidence else ""
            reason = f" ({cell.reason})" if cell.reason else ""
            print(f"    ({cell.x}, {cell.y}): {cell.noise_level}dB, {cell.sample_count}点{flag}{reason}")

    print("=" * 60)


def cmd_link(args):
    processor = get_processor()
    correction = processor.link_complaint_to_sample(
        sample_id=args.sample_id,
        complaint_no=args.complaint_no,
        operator=args.operator
    )
    if correction:
        save_processor(processor)
        print("✅ 关联成功！")
        print(f"   采样点: {args.sample_id[:8]}...")
        print(f"   投诉编号: {args.complaint_no}")
        print(f"   噪声值: {correction.old_noise_level} → {correction.new_noise_level} dB")
        print(f"   原因: {correction.reason}")
        print("   热力图已更新")
    else:
        print("❌ 关联失败，采样点或投诉编号未找到")
        sys.exit(1)


def cmd_correct(args):
    processor = get_processor()
    correction = processor.manual_correct(
        sample_id=args.sample_id,
        new_noise_level=args.noise,
        reason=args.reason,
        operator=args.operator
    )
    if correction:
        save_processor(processor)
        print("✅ 修正成功！")
        print(f"   采样点: {args.sample_id[:8]}...")
        print(f"   噪声值: {correction.old_noise_level} → {correction.new_noise_level} dB")
        print(f"   原因: {correction.reason}")
        print("   热力图已更新")
    else:
        print("❌ 修正失败，采样点未找到")
        sys.exit(1)


def cmd_import(args):
    processor = get_processor()
    with open(args.file, "r", encoding="utf-8") as f:
        data = json.load(f)
    samples = processor.import_samples(data.get("samples", []))
    save_processor(processor)
    print(f"✅ 成功导入 {len(samples)} 个采样点")


def cmd_reset(args):
    if os.path.exists(DATA_FILE):
        os.remove(DATA_FILE)
        print("✅ 已重置为演示数据")
    else:
        print("ℹ️  已是演示数据状态")


def cmd_demo(args):
    print("=" * 60)
    print("  🎬 口袋篮球场噪声缓冲 - 演示流程")
    print("=" * 60)
    print()
    print("  第一步：查看当前数据状态")
    print("  $ python cli.py summary")
    print()
    print("  第二步：查看采样点列表（找到低可信度的B区）")
    print("  $ python cli.py list")
    print()
    print("  第三步：查看居民投诉编号")
    print("  $ python cli.py complaints")
    print()
    print("  第四步：关联投诉编号到B区采样点（补录）")
    print("  $ python cli.py link <sample_id> TS-20240315-001")
    print()
    print("  第五步：重新计算热力图")
    print("  $ python cli.py heatmap")
    print()
    print("  第六步：人工修正（可选）")
    print("  $ python cli.py correct <sample_id> 70.5 '街道规划员复核确认'")
    print()
    print("=" * 60)
    print("  💡 提示：复制 list 命令输出的采样点 ID 使用")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description="口袋篮球场噪声缓冲 - 城更项目经理阿宁专用",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python cli.py summary              # 查看数据概览
  python cli.py list                 # 列出所有采样点
  python cli.py complaints           # 列出所有投诉
  python cli.py heatmap              # 查看热力图
  python cli.py link <id> <投诉编号>  # 关联投诉到采样点
  python cli.py correct <id> <dB> <原因>  # 人工修正
  python cli.py demo                 # 查看演示流程
        """
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    subparsers.add_parser("summary", help="数据概览").set_defaults(func=cmd_summary)
    subparsers.add_parser("list", help="列出采样点").set_defaults(func=cmd_list)
    subparsers.add_parser("complaints", help="列出投诉").set_defaults(func=cmd_complaints)
    subparsers.add_parser("demo", help="演示流程").set_defaults(func=cmd_demo)
    subparsers.add_parser("reset", help="重置为演示数据").set_defaults(func=cmd_reset)

    heatmap_p = subparsers.add_parser("heatmap", help="热力图")
    heatmap_p.add_argument("-v", "--verbose", action="store_true", help="显示详细网格")
    heatmap_p.set_defaults(func=cmd_heatmap)

    link_p = subparsers.add_parser("link", help="关联投诉")
    link_p.add_argument("sample_id", help="采样点ID")
    link_p.add_argument("complaint_no", help="居民投诉编号")
    link_p.add_argument("--operator", default="阿宁", help="操作人")
    link_p.set_defaults(func=cmd_link)

    correct_p = subparsers.add_parser("correct", help="人工修正")
    correct_p.add_argument("sample_id", help="采样点ID")
    correct_p.add_argument("noise", type=float, help="修正后噪声值(dB)")
    correct_p.add_argument("reason", help="修正原因")
    correct_p.add_argument("--operator", default="阿宁", help="操作人")
    correct_p.set_defaults(func=cmd_correct)

    import_p = subparsers.add_parser("import", help="导入采样点")
    import_p.add_argument("file", help="JSON文件路径")
    import_p.set_defaults(func=cmd_import)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return

    args.func(args)


if __name__ == "__main__":
    main()

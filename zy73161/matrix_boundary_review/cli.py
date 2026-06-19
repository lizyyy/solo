import argparse
import sys
import os

from .core.review import run_review
from .core.export import export_summary, export_details_csv


REQUIRED_FILES = [
    ("historical_answers.csv", "历史答案，必选"),
]
OPTIONAL_FILES = [
    ("alias_mapping.csv", "别名映射（同一对象不同称呼），可选"),
    ("supplementary_notes.csv", "后补说明材料，可选"),
]


def _check_input_dir(input_dir: str) -> list:
    missing = []
    for fname, _ in REQUIRED_FILES:
        if not os.path.exists(os.path.join(input_dir, fname)):
            missing.append(fname)
    return missing


def main():
    parser = argparse.ArgumentParser(
        prog="矩阵分解边界复核",
        description="矩阵分解边界复核工具 —— 比对历史答案、别名记录与后补说明，产出复核结论",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
输入目录应包含以下文件：
  必选：
    historical_answers.csv   历史答案（旧表+新备注可混合）
  可选：
    alias_mapping.csv        同一对象换称呼的别名记录
    supplementary_notes.csv  后补说明材料

输出目录将生成：
  review_summary.txt   复核摘要（终端也会显示关键指标）
  review_details.csv   明细数据（每行状态/备注/结论三一致）
  blocked_items.csv    卡点清单（如有重复样本）

示例：
  python -m matrix_boundary_review -i ./input -o ./output
  python -m matrix_boundary_review -i ./input -o ./output --strict
        """
    )
    parser.add_argument(
        "--input-dir", "-i",
        required=True,
        help="输入目录路径"
    )
    parser.add_argument(
        "--output-dir", "-o",
        required=True,
        help="输出目录路径（不存在会自动创建）"
    )
    parser.add_argument(
        "--strict", "-s",
        action="store_true",
        help="严格模式：检测到重复样本卡点时直接终止，不生成明细"
    )
    args = parser.parse_args()

    input_dir = os.path.abspath(args.input_dir)
    output_dir = os.path.abspath(args.output_dir)

    if not os.path.isdir(input_dir):
        print(f"[错误] 输入目录不存在：{input_dir}")
        print()
        print("请准备好输入目录，包含以下文件：")
        for fname, desc in REQUIRED_FILES:
            print(f"  [必选] {fname}  ——  {desc}")
        for fname, desc in OPTIONAL_FILES:
            print(f"  [可选] {fname}  ——  {desc}")
        sys.exit(1)

    missing = _check_input_dir(input_dir)
    if missing:
        print(f"[错误] 输入目录缺少必选文件：{', '.join(missing)}")
        print()
        print(f"当前目录内容：{input_dir}")
        try:
            for f in sorted(os.listdir(input_dir)):
                print(f"  - {f}")
        except OSError:
            pass
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    result = run_review(input_dir, strict_mode=args.strict)

    summary_path = os.path.join(output_dir, "review_summary.txt")
    details_path = os.path.join(output_dir, "review_details.csv")
    blocked_path = os.path.join(output_dir, "blocked_items.csv")

    export_summary(result, summary_path)
    export_details_csv(result, details_path, blocked_path)

    print()
    print("=" * 60)
    if result.get("strict_stopped"):
        print("复核中止（严格模式）")
    else:
        print("复核完成")
    print(f"  摘要文件：{summary_path}")
    if result.get("reviewed_items"):
        print(f"  明细CSV ：{details_path}")
    if result["blocked_items"]:
        print(f"  卡点CSV ：{blocked_path}")
    print("=" * 60)


if __name__ == "__main__":
    main()

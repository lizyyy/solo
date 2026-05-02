"""面试评分偏见审计工具 - CLI 入口点"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from cli import create_parser
from engine.auditor import BiasAuditor


def main():
    parser = create_parser()
    args = parser.parse_args()

    if args.subcommand == "audit":
        auditor = BiasAuditor(
            candidates_path=args.candidates,
            notes_path=args.notes,
            rules_path=args.rules,
            competency_dict_path=args.competency_dict,
            output_dir=Path(args.output_dir),
            high_score_threshold=args.high_score_threshold,
            low_score_threshold=args.low_score_threshold,
        )
        result = auditor.run()

        if result:
            print("审计完成。报告已生成:")
            print(f"  - {args.output_dir}/bias_audit.md")
            print(f"  - {args.output_dir}/review_flags.csv")
            print(f"  - {args.output_dir}/score_map.html")
            print(f"\n发现 {len(result.get('flags', []))} 个需要复核的问题")
        else:
            print("审计过程出错，请检查输入文件格式")
            sys.exit(1)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()

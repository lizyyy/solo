"""CLI 参数解析"""

import argparse
from pathlib import Path


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="interview-bias-audit",
        description="面试评分偏见审计工具 - 检测评分异常、尺度漂移和结论冲突",
    )

    subparsers = parser.add_subparsers(dest="subcommand", help="子命令")

    audit_parser = subparsers.add_parser("audit", help="运行偏见审计")
    audit_parser.add_argument(
        "--candidates",
        type=Path,
        required=True,
        help="候选人 CSV 文件路径 (需包含: candidate_id, name, position, score)",
    )
    audit_parser.add_argument(
        "--notes",
        type=Path,
        required=True,
        help="面试备注 JSONL 文件路径",
    )
    audit_parser.add_argument(
        "--rules",
        type=Path,
        required=True,
        help="评分规则 YAML 文件路径",
    )
    audit_parser.add_argument(
        "--competency-dict",
        type=Path,
        required=True,
        help="岗位能力词库 YAML 文件路径",
    )
    audit_parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("./output"),
        help="输出目录 (默认: ./output)",
    )
    audit_parser.add_argument(
        "--high-score-threshold",
        type=float,
        default=85.0,
        help="高分阈值 (默认: 85.0)",
    )
    audit_parser.add_argument(
        "--low-score-threshold",
        type=float,
        default=50.0,
        help="低分阈值 (默认: 50.0)",
    )

    return parser

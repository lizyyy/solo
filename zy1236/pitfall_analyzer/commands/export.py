#!/usr/bin/env python3
"""export 命令：导出分析报告。"""

import sys
from pathlib import Path

from ..core.database import Database
from ..core.exporter import export_report
from ..core.models import AnalysisResult, ComparisonResult, Severity


def export_command(args) -> int:
    """执行 export 命令。"""
    db_path = Path(args.db)
    analysis_id = args.analysis_id
    output_format = args.format
    output_path = args.output

    db = Database(db_path)

    if analysis_id is not None:
        result = db.get_analysis(analysis_id)
        if not result:
            print(f"❌ 错误: 找不到分析 ID {analysis_id}")
            print("\n可用的分析记录:")
            list_analyses(db)
            return 1
    else:
        result = db.get_latest_analysis()
        if not result:
            print("❌ 错误: 数据库中没有分析记录")
            print("\n提示: 先运行 'pitfall analyze' 进行分析")
            return 1
        analysis_id = result.id

    display_name = result.name or f"分析 #{analysis_id}"
    print(f"📄 导出报告: {display_name}")
    print(f"   格式: {output_format}")
    if output_path:
        print(f"   输出: {output_path}")
    print()

    try:
        content = export_report(result, output_format, output_path)
    except Exception as e:
        print(f"❌ 导出失败: {e}")
        return 1

    if not output_path:
        print(content)
    else:
        print(f"✅ 报告已导出到: {output_path}")

    return 0


def list_analyses(db: Database):
    """列出可用的分析记录。"""
    analyses = db.list_analyses(limit=10)
    if not analyses:
        print("   (暂无分析记录)")
        return

    for a in analyses:
        name = a["name"] or "(未命名)"
        findings = a.get("finding_count", 0)
        print(f"   #{a['id']} - {name} ({findings} 个问题)")

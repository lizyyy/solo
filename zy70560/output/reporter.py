import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List


class Reporter:
    def __init__(self, verbose=False):
        self.verbose = verbose

    def print_summary(self, analysis):
        print("=" * 70)
        print("  Python 导入影子 CLI - 诊断报告")
        print("=" * 70)
        print()
        print("模块名称:", analysis["module_name"])
        print("候选数量:", analysis["total_candidates"])
        conflict_status = "发现冲突!" if analysis["has_conflicts"] else "无冲突 ✓"
        print("冲突状态:", conflict_status)
        print()

        if analysis["primary_candidate"]:
            primary = analysis["primary_candidate"]
            print("-> 实际将导入的模块:")
            print("   路径:", primary["path"])
            print("   类型:", primary["module_type"])
        print()
        print("导入说明:", analysis["import_explanation"])
        print()

        if analysis["conflicts_detail"]:
            print("!" * 50)
            print("  发现冲突! 以下模块将被遮蔽:")
            print("!" * 50)
            print()
            for conflict in analysis["conflicts_detail"]:
                print("  冲突 #", conflict["conflict_index"])
                print("    被遮蔽:", conflict["shadowed_path"])
                print("    原因:", conflict["reason"])
                print()
        print("-" * 70)
        print("搜索路径顺序 (前10个):")
        for idx, path in enumerate(analysis["search_paths"][:10]):
            print("  #", idx, ":", path)
        print()

    def write_json(self, analysis, output_path):
        output = {
            "generated_at": datetime.now().isoformat(),
            "version": "1.0.0",
        }
        output.update(analysis)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        print("JSON 结果已保存到:", output_path)

    def print_error(self, message):
        print("错误:", message, file=sys.stderr)


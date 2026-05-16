#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

from core.path_resolver import PathResolver
from core.module_finder import ModuleFinder
from core.conflict_analyzer import ConflictAnalyzer
from output.reporter import Reporter


def main():
    parser = argparse.ArgumentParser(
        description="Python 导入影子 CLI - 诊断 Python 模块导入冲突"
    )
    parser.add_argument("-p", "--project", help="项目根目录路径")
    parser.add_argument("-m", "--module", required=True, help="要检查的模块名")
    parser.add_argument("--sys-path", help="自定义 sys.path，用逗号分隔")
    parser.add_argument("--json-output", help="机器可读 JSON 输出路径")
    parser.add_argument("-v", "--verbose", action="store_true", help="详细输出模式")
    parser.add_argument("--strict", action="store_true", help="严格模式，发现冲突时返回非零退出码")

    args = parser.parse_args()

    resolver = PathResolver()
    finder = ModuleFinder()
    analyzer = ConflictAnalyzer()
    reporter = Reporter(verbose=args.verbose)

    try:
        if args.sys_path:
            custom_paths = [p.strip() for p in args.sys_path.split(",")]
            resolver.set_custom_sys_path(custom_paths)

        if args.project:
            project_path = Path(args.project).resolve()
            resolver.set_project_root(project_path)
            candidates = finder.find_modules(args.module, project_path, resolver.get_effective_paths())
        else:
            project_path = Path(".").resolve()
            candidates = finder.find_modules(args.module, project_path, resolver.get_effective_paths())

        analysis = analyzer.analyze(candidates, args.module, resolver.get_effective_paths())
        reporter.print_summary(analysis)

        if args.json_output:
            reporter.write_json(analysis, args.json_output)

        if args.strict and analysis["has_conflicts"]:
            sys.exit(1)

    except Exception as e:
        reporter.print_error(str(e))
        sys.exit(2)


if __name__ == "__main__":
    main()

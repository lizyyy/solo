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
    parser.add_argument("-p", "--project", help="项目根目录路径或文件路径")
    parser.add_argument("-f", "--file", help="单个 Python 文件路径")
    parser.add_argument("-m", "--module", required=True, help="要检查的模块名")
    parser.add_argument("--sys-path", help="自定义 sys.path，用逗号分隔")
    parser.add_argument("--json-output", help="机器可读 JSON 输出路径")
    parser.add_argument("-o", "--output", help="输出 HTML 报告文件路径")
    parser.add_argument("-v", "--verbose", action="store_true", help="详细输出模式")
    parser.add_argument("--strict", action="store_true", help="严格模式，发现冲突或错误时返回非零退出码")

    args = parser.parse_args()

    resolver = PathResolver()
    finder = ModuleFinder()
    analyzer = ConflictAnalyzer()
    reporter = Reporter(verbose=args.verbose)

    try:
        if args.sys_path:
            custom_paths = [p.strip() for p in args.sys_path.split(",")]
            resolver.set_custom_sys_path(custom_paths)

        project_path = None
        if args.file:
            file_path = Path(args.file).resolve()
            if not file_path.exists():
                raise FileNotFoundError(f"文件不存在: {file_path}")
            project_path = file_path.parent
            resolver.set_project_root(project_path)
            candidates = finder.find_from_file(args.module, file_path, resolver.get_effective_paths())
        elif args.project:
            project_path = Path(args.project).resolve()
            if not project_path.exists():
                raise FileNotFoundError(f"路径不存在: {project_path}")
            if project_path.is_file():
                resolver.set_project_root(project_path.parent)
                candidates = finder.find_from_file(args.module, project_path, resolver.get_effective_paths())
            else:
                resolver.set_project_root(project_path)
                candidates = finder.find_modules(args.module, project_path, resolver.get_effective_paths())
        else:
            project_path = Path(".").resolve()
            candidates = finder.find_modules(args.module, project_path, resolver.get_effective_paths())

        analysis = analyzer.analyze(candidates, args.module, resolver.get_effective_paths())
        analysis["path_errors"] = resolver.get_errors() + finder.get_errors()
        analysis["has_path_errors"] = len(analysis["path_errors"]) > 0
        reporter.print_summary(analysis)

        if args.json_output:
            reporter.write_json(analysis, args.json_output)

        if args.output:
            reporter.write_html_report(analysis, args.output)

        if args.strict and (analysis["has_conflicts"] or analysis["has_path_errors"]):
            sys.exit(1)

    except Exception as e:
        reporter.print_error(str(e))
        sys.exit(2)


if __name__ == "__main__":
    main()

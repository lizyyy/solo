#!/usr/bin/env python3
import argparse
import os
import sys
from typing import List, Optional

from .parser import K8sOutputParser
from .analyzer import TimelineAnalyzer
from .output import OutputGenerator
from .exceptions import K8sTimelineError, ValidationError
from . import __version__


def validate_args(args):
    if args.command == 'analyze':
        if not args.deployment:
            raise ValidationError("Deployment name is required (--deployment)")
        if not args.namespace:
            raise ValidationError("Namespace is required (--namespace)")

        input_files = [args.events, args.pods, args.replicasets, args.deployment_file]
        if not any(input_files):
            raise ValidationError("At least one input file is required")

        for f in input_files:
            if f and not os.path.exists(f):
                raise ValidationError(f"File not found: {f}")

        if args.output_dir and not os.path.isdir(args.output_dir):
            try:
                os.makedirs(args.output_dir, exist_ok=True)
            except OSError as e:
                raise ValidationError(f"Cannot create output directory: {e}")


def read_file_content(filepath: str) -> Optional[str]:
    if not filepath:
        return None
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except IOError as e:
        raise K8sTimelineError(f"Failed to read file {filepath}: {e}")


def run_analyze(args):
    parser = K8sOutputParser()

    events_content = read_file_content(args.events)
    pods_content = read_file_content(args.pods)
    replicasets_content = read_file_content(args.replicasets)
    deployment_content = read_file_content(args.deployment_file)

    events = parser.parse_events_json(events_content, args.events) if events_content else []
    pods = parser.parse_pods_json(pods_content, args.pods) if pods_content else []
    replicasets = parser.parse_replicasets_json(replicasets_content, args.replicasets) if replicasets_content else []
    deployment = parser.parse_deployment_json(deployment_content, args.deployment_file) if deployment_content else None

    analyzer = TimelineAnalyzer(args.deployment, args.namespace)
    report = analyzer.analyze(events, pods, replicasets, deployment)

    report.parse_errors = parser.parse_errors

    output_dir = args.output_dir or '.'
    output_gen = OutputGenerator(report, output_dir)

    base_name = f"{args.deployment}_{args.namespace}" if args.base_name is None else args.base_name
    outputs = output_gen.generate_all(base_name)

    print(outputs['console'])
    print(f"\n📄 报告已生成:")
    print(f"   - JSON: {outputs['json']}")
    print(f"   - Markdown: {outputs['markdown']}")

    if parser.parse_errors:
        print(f"\n⚠️  检测到 {len(parser.parse_errors)} 个解析错误，请查看报告中的错误记录。")

    return 0


def run_selftest(args):
    print("=" * 60)
    print("Kubernetes 发布时间线 CLI - 自检程序")
    print("=" * 60)

    test_dir = os.path.join(os.path.dirname(__file__), '..', 'sample_data')
    os.makedirs(test_dir, exist_ok=True)

    print(f"\n📁 测试数据目录: {os.path.abspath(test_dir)}")

    from .selftest import SelfTest

    tester = SelfTest(test_dir)
    results = tester.run_all_tests()

    print("\n" + "=" * 60)
    print(f"测试结果: {results['passed']} 通过, {results['failed']} 失败")
    print("=" * 60)

    for test_name, test_result in results['tests'].items():
        status = "✅ PASS" if test_result['passed'] else "❌ FAIL"
        print(f"{status}: {test_name}")
        if not test_result['passed']:
            print(f"   错误: {test_result.get('error', 'Unknown')}")

    print(f"\n📊 输出文件已生成到: {os.path.abspath(test_dir)}")

    return 0 if results['failed'] == 0 else 1


def main():
    parser = argparse.ArgumentParser(
        description='Kubernetes 发布时间线分析工具 - 分析Deployment发布过程中的事件、Pod状态变更和镜像变化',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  k8s-timeline analyze -d my-app -n default -e events.json -p pods.json
  k8s-timeline analyze --deployment web --namespace prod --events events.json --pods pods.json --rs rs.json -o ./reports
  k8s-timeline selftest
        """
    )

    parser.add_argument('-v', '--version', action='version', version=f'k8s-timeline {__version__}')

    subparsers = parser.add_subparsers(dest='command', help='可用命令')

    analyze_parser = subparsers.add_parser('analyze', help='分析K8s发布时间线')
    analyze_parser.add_argument('-d', '--deployment', required=True, help='Deployment名称')
    analyze_parser.add_argument('-n', '--namespace', required=True, help='命名空间')
    analyze_parser.add_argument('-e', '--events', help='事件JSON文件路径 (kubectl get events -o json)')
    analyze_parser.add_argument('-p', '--pods', help='Pod JSON文件路径 (kubectl get pods -o json)')
    analyze_parser.add_argument('-r', '--replicasets', '--rs', dest='replicasets', help='ReplicaSet JSON文件路径')
    analyze_parser.add_argument('--deployment-file', '--deploy', dest='deployment_file', help='Deployment JSON文件路径')
    analyze_parser.add_argument('-o', '--output-dir', dest='output_dir', help='输出目录')
    analyze_parser.add_argument('--base-name', dest='base_name', help='输出文件基础名称')
    analyze_parser.add_argument('--format', choices=['all', 'json', 'markdown', 'console'], default='all', help='输出格式')

    selftest_parser = subparsers.add_parser('selftest', help='运行自检程序，验证解析、边界样本和导出功能')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    try:
        validate_args(args)

        if args.command == 'analyze':
            return run_analyze(args)
        elif args.command == 'selftest':
            return run_selftest(args)

    except K8sTimelineError as e:
        print(f"❌ 错误: {e}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\n⚠️ 操作已取消", file=sys.stderr)
        return 130
    except Exception as e:
        print(f"❌ 未预期的错误: {e}", file=sys.stderr)
        if os.environ.get('DEBUG'):
            import traceback
            traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())

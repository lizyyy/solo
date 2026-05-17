#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import re
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Any


@dataclass
class ArtifactInfo:
    file_path: str
    file_name: str
    file_size: int
    sha256: str
    commit: Optional[str] = None
    build_number: Optional[str] = None
    source_dir: str = ""
    error: Optional[str] = None
    warning: List[str] = field(default_factory=list)


@dataclass
class IndexResult:
    artifacts: List[ArtifactInfo] = field(default_factory=list)
    errors: List[Dict[str, str]] = field(default_factory=list)
    warnings: List[Dict[str, str]] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)


class ReleaseIndexer:
    COMMIT_PATTERNS = [
        re.compile(r'\b[0-9a-f]{7,40}\b', re.IGNORECASE),
        re.compile(r'commit[_-]?([0-9a-f]{7,40})', re.IGNORECASE),
        re.compile(r'git[_-]?([0-9a-f]{7,40})', re.IGNORECASE),
    ]
    
    BUILD_PATTERNS = [
        re.compile(r'build[_-]?(\d+)', re.IGNORECASE),
        re.compile(r'(\d{8}[-_]\d{6})', re.IGNORECASE),
        re.compile(r'v?(\d+\.\d+\.\d+)', re.IGNORECASE),
    ]

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.result = IndexResult()
        self.result.metadata = {
            'scan_time': datetime.now().isoformat(),
            'source_dirs': config.get('source_dirs', []),
            'expected_commits': config.get('expected_commits', []),
            'build_number': config.get('build_number', ''),
        }

    def compute_sha256(self, file_path: str) -> str:
        sha256_hash = hashlib.sha256()
        try:
            with open(file_path, "rb") as f:
                for byte_block in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(byte_block)
            return sha256_hash.hexdigest()
        except Exception as e:
            raise RuntimeError(f"SHA256计算失败: {str(e)}")

    def extract_commit(self, text: str) -> Optional[str]:
        for pattern in self.COMMIT_PATTERNS:
            match = pattern.search(text)
            if match:
                return match.group(1) if match.groups() else match.group(0)
        return None

    def extract_build_number(self, text: str) -> Optional[str]:
        for pattern in self.BUILD_PATTERNS:
            match = pattern.search(text)
            if match:
                return match.group(1)
        return None

    def scan_directory(self, dir_path: str) -> List[ArtifactInfo]:
        artifacts = []
        dir_path = os.path.abspath(dir_path)
        
        if not os.path.isdir(dir_path):
            self.result.errors.append({
                'type': 'directory_not_found',
                'path': dir_path,
                'message': f'目录不存在: {dir_path}',
            })
            return artifacts

        excluded_dirs = set(self.config.get('exclude_dirs', ['.git', 'node_modules', '__pycache__']))
        excluded_exts = set(self.config.get('exclude_exts', ['.log', '.tmp', '.temp']))
        
        for root, dirs, files in os.walk(dir_path):
            dirs[:] = [d for d in dirs if d not in excluded_dirs]
            
            for file_name in files:
                file_path = os.path.join(root, file_name)
                
                if any(file_name.endswith(ext) for ext in excluded_exts):
                    continue
                
                try:
                    artifact = self._process_file(file_path, dir_path)
                    artifacts.append(artifact)
                except Exception as e:
                    self.result.errors.append({
                        'type': 'file_process_error',
                        'path': file_path,
                        'message': str(e),
                    })
        
        return artifacts

    def _process_file(self, file_path: str, source_dir: str) -> ArtifactInfo:
        file_name = os.path.basename(file_path)
        
        try:
            file_size = os.path.getsize(file_path)
        except Exception as e:
            raise RuntimeError(f'无法获取文件大小: {str(e)}')

        try:
            sha256 = self.compute_sha256(file_path)
        except Exception as e:
            raise RuntimeError(f'哈希计算失败: {str(e)}')

        commit = self.extract_commit(file_name) or self.extract_commit(os.path.dirname(file_path))
        build_number = self.extract_build_number(file_name) or self.extract_build_number(os.path.dirname(file_path))

        artifact = ArtifactInfo(
            file_path=file_path,
            file_name=file_name,
            file_size=file_size,
            sha256=sha256,
            commit=commit,
            build_number=build_number,
            source_dir=source_dir,
        )

        expected_commits = self.config.get('expected_commits', [])
        if expected_commits and commit:
            if not any(c.startswith(commit) or commit.startswith(c) for c in expected_commits):
                artifact.warning.append(f'提交号 {commit} 不在预期列表中')
                self.result.warnings.append({
                    'type': 'commit_mismatch',
                    'path': file_path,
                    'message': f'提交号不匹配: {commit}',
                    'found': commit,
                    'expected': expected_commits,
                })

        expected_build = self.config.get('build_number')
        if expected_build and build_number:
            if build_number != expected_build:
                artifact.warning.append(f'构建号 {build_number} 与预期 {expected_build} 不符')
                self.result.warnings.append({
                    'type': 'build_mismatch',
                    'path': file_path,
                    'message': f'构建号不匹配: {build_number} (预期: {expected_build})',
                    'found': build_number,
                    'expected': expected_build,
                })

        return artifact

    def run(self) -> IndexResult:
        all_artifacts = []
        source_dirs = self.config.get('source_dirs', [])
        
        for source_dir in source_dirs:
            artifacts = self.scan_directory(source_dir)
            all_artifacts.extend(artifacts)
        
        self.result.artifacts = all_artifacts
        
        found_commits = set(a.commit for a in all_artifacts if a.commit)
        expected_commits = set(self.config.get('expected_commits', []))
        missing_commits = expected_commits - found_commits
        
        if missing_commits:
            for commit in missing_commits:
                self.result.warnings.append({
                    'type': 'missing_commit',
                    'message': f'未找到包含提交号 {commit} 的制品',
                    'commit': commit,
                })

        artifact_files = set(a.file_name for a in all_artifacts)
        expected_artifacts = self.config.get('expected_artifacts', [])
        missing_artifacts = set(expected_artifacts) - artifact_files
        
        if missing_artifacts:
            for artifact in missing_artifacts:
                self.result.warnings.append({
                    'type': 'missing_artifact',
                    'message': f'未找到预期制品: {artifact}',
                    'artifact': artifact,
                })

        self.result.summary = {
            'total_artifacts': len(all_artifacts),
            'total_size': sum(a.file_size for a in all_artifacts),
            'with_commit': sum(1 for a in all_artifacts if a.commit),
            'with_build': sum(1 for a in all_artifacts if a.build_number),
            'errors_count': len(self.result.errors),
            'warnings_count': len(self.result.warnings),
            'missing_commits_count': len(missing_commits),
            'missing_artifacts_count': len(missing_artifacts),
            'source_dirs_count': len(source_dirs),
        }

        return self.result


class OutputGenerator:
    def __init__(self, result: IndexResult, output_dir: str):
        self.result = result
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def print_console_summary(self):
        print("\n" + "=" * 80)
        print("RELEASE 制品索引 - 终端摘要")
        print("=" * 80)
        
        summary = self.result.summary
        metadata = self.result.metadata
        
        print(f"\n扫描时间: {metadata['scan_time']}")
        print(f"扫描目录: {summary['source_dirs_count']} 个")
        print(f"制品总数: {summary['total_artifacts']} 个")
        print(f"总大小: {self._format_size(summary['total_size'])}")
        print(f"含提交号: {summary['with_commit']} 个")
        print(f"含构建号: {summary['with_build']} 个")
        print(f"错误数: {summary['errors_count']} 个")
        print(f"警告数: {summary['warnings_count']} 个")
        
        if summary['missing_commits_count'] > 0:
            print(f"缺失提交: {summary['missing_commits_count']} 个")
        
        if summary['missing_artifacts_count'] > 0:
            print(f"缺失制品: {summary['missing_artifacts_count']} 个")

        print("\n" + "-" * 80)
        print("制品列表:")
        print("-" * 80)
        
        for i, artifact in enumerate(self.result.artifacts, 1):
            status = "✓" if not artifact.warning else "⚠"
            print(f"\n{status} [{i}] {artifact.file_name}")
            print(f"  路径: {artifact.file_path}")
            print(f"  大小: {self._format_size(artifact.file_size)}")
            print(f"  SHA256: {artifact.sha256}")
            if artifact.commit:
                print(f"  提交号: {artifact.commit}")
            if artifact.build_number:
                print(f"  构建号: {artifact.build_number}")
            for warning in artifact.warning:
                print(f"  ⚠ 警告: {warning}")

        if self.result.errors:
            print("\n" + "-" * 80)
            print("错误列表:")
            print("-" * 80)
            for i, error in enumerate(self.result.errors, 1):
                print(f"\n✗ [{i}] {error['type']}")
                print(f"  路径: {error.get('path', 'N/A')}")
                print(f"  消息: {error['message']}")

        if self.result.warnings:
            print("\n" + "-" * 80)
            print("警告列表:")
            print("-" * 80)
            for i, warning in enumerate(self.result.warnings, 1):
                print(f"\n⚠ [{i}] {warning['type']}")
                if 'path' in warning:
                    print(f"  路径: {warning['path']}")
                print(f"  消息: {warning['message']}")

        print("\n" + "=" * 80)

    def generate_json(self) -> str:
        result_dict = {
            'metadata': self.result.metadata,
            'summary': self.result.summary,
            'artifacts': [asdict(a) for a in self.result.artifacts],
            'errors': self.result.errors,
            'warnings': self.result.warnings,
        }
        
        output_file = self.output_dir / 'release-index.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result_dict, f, indent=2, ensure_ascii=False)
        
        return str(output_file)

    def generate_markdown(self, title: str = "", handover_note: str = "") -> str:
        lines = []
        
        lines.append(f"# {title or 'Release 制品交接报告'}")
        lines.append("")
        lines.append(f"**生成时间**: {self.result.metadata['scan_time']}")
        lines.append("")
        
        if handover_note:
            lines.append("## 交接说明")
            lines.append("")
            lines.append(handover_note)
            lines.append("")

        lines.append("## 摘要")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        summary = self.result.summary
        lines.append(f"| 制品总数 | {summary['total_artifacts']} |")
        lines.append(f"| 总大小 | {self._format_size(summary['total_size'])} |")
        lines.append(f"| 含提交号 | {summary['with_commit']} |")
        lines.append(f"| 含构建号 | {summary['with_build']} |")
        lines.append(f"| 错误数 | {summary['errors_count']} |")
        lines.append(f"| 警告数 | {summary['warnings_count']} |")
        lines.append("")

        lines.append("## 制品详情")
        lines.append("")
        lines.append("| 序号 | 文件名 | 大小 | 提交号 | 构建号 | SHA256 | 状态 |")
        lines.append("|------|--------|------|--------|--------|--------|------|")
        
        for i, artifact in enumerate(self.result.artifacts, 1):
            status = "✅ 正常" if not artifact.warning else "⚠️ 有警告"
            sha_short = artifact.sha256[:16] + "..."
            lines.append(
                f"| {i} | {artifact.file_name} | "
                f"{self._format_size(artifact.file_size)} | "
                f"{artifact.commit or '-'} | "
                f"{artifact.build_number or '-'} | "
                f"`{sha_short}` | {status} |"
            )
        lines.append("")

        lines.append("## 制品完整信息")
        lines.append("")
        for i, artifact in enumerate(self.result.artifacts, 1):
            lines.append(f"### {i}. {artifact.file_name}")
            lines.append("")
            lines.append(f"- **完整路径**: `{artifact.file_path}`")
            lines.append(f"- **文件大小**: {self._format_size(artifact.file_size)}")
            lines.append(f"- **SHA256**: `{artifact.sha256}`")
            if artifact.commit:
                lines.append(f"- **提交号**: `{artifact.commit}`")
            if artifact.build_number:
                lines.append(f"- **构建号**: `{artifact.build_number}`")
            if artifact.warning:
                lines.append("- **警告**:")
                for w in artifact.warning:
                    lines.append(f"  - ⚠️ {w}")
            lines.append("")

        if self.result.errors:
            lines.append("## ❌ 错误列表")
            lines.append("")
            for i, error in enumerate(self.result.errors, 1):
                lines.append(f"### {i}. {error['type']}")
                lines.append("")
                if 'path' in error:
                    lines.append(f"- **位置**: `{error['path']}`")
                lines.append(f"- **详情**: {error['message']}")
                lines.append("")

        if self.result.warnings:
            lines.append("## ⚠️ 警告列表")
            lines.append("")
            for i, warning in enumerate(self.result.warnings, 1):
                lines.append(f"### {i}. {warning['type']}")
                lines.append("")
                if 'path' in warning:
                    lines.append(f"- **位置**: `{warning['path']}`")
                lines.append(f"- **详情**: {warning['message']}")
                lines.append("")

        output_file = self.output_dir / 'release-index.md'
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        
        return str(output_file)

    def _format_size(self, size_bytes: int) -> str:
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.2f} KB"
        elif size_bytes < 1024 * 1024 * 1024:
            return f"{size_bytes / (1024 * 1024):.2f} MB"
        else:
            return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"


def validate_args(args) -> bool:
    errors = []
    
    if not args.source_dirs:
        errors.append("必须指定至少一个制品目录")
    else:
        for d in args.source_dirs:
            if not os.path.exists(d):
                errors.append(f"目录不存在: {d}")
            elif not os.path.isdir(d):
                errors.append(f"不是有效目录: {d}")

    if args.exclude_dirs:
        for d in args.exclude_dirs:
            if not isinstance(d, str):
                errors.append(f"排除目录必须是字符串: {d}")

    if args.expected_commits:
        for c in args.expected_commits:
            if not re.match(r'^[0-9a-f]{7,40}$', c, re.IGNORECASE):
                errors.append(f"提交号格式无效: {c} (需要7-40位十六进制字符)")

    if args.output_dir:
        try:
            Path(args.output_dir).mkdir(parents=True, exist_ok=True)
        except Exception as e:
            errors.append(f"无法创建输出目录: {str(e)}")

    if errors:
        print("\n❌ 参数校验失败:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        print("", file=sys.stderr)
        return False
    
    return True


def main():
    parser = argparse.ArgumentParser(
        description='Release制品索引CLI - 扫描制品目录，生成交接索引报告',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 基本扫描
  %(prog)s --dirs ./dist ./build --output ./reports
  
  # 指定提交号和构建号校验
  %(prog)s --dirs ./artifacts --commits abc1234 def5678 --build 12345
  
  # 带交接说明
  %(prog)s --dirs ./release --title "v2.0.0 版本交接" --note "包含全量二进制包"
  
  # 排除特定目录
  %(prog)s --dirs ./out --exclude .cache temp
        """
    )

    parser.add_argument(
        '--dirs', '--source-dirs',
        dest='source_dirs',
        nargs='+',
        required=True,
        help='要扫描的制品目录列表（至少一个）',
        metavar='DIR'
    )

    parser.add_argument(
        '--commits', '--expected-commits',
        dest='expected_commits',
        nargs='*',
        default=[],
        help='预期的Git提交号列表（用于校验）',
        metavar='COMMIT'
    )

    parser.add_argument(
        '--build', '--build-number',
        dest='build_number',
        default='',
        help='预期的构建编号',
        metavar='BUILD'
    )

    parser.add_argument(
        '--output', '--output-dir',
        dest='output_dir',
        default='./release-index-output',
        help='输出报告的目录 (默认: ./release-index-output)',
        metavar='DIR'
    )

    parser.add_argument(
        '--title',
        dest='report_title',
        default='',
        help='Markdown报告标题',
        metavar='TITLE'
    )

    parser.add_argument(
        '--note', '--handover-note',
        dest='handover_note',
        default='',
        help='交接说明文字，会写入Markdown报告',
        metavar='TEXT'
    )

    parser.add_argument(
        '--exclude', '--exclude-dirs',
        dest='exclude_dirs',
        nargs='*',
        default=['.git', 'node_modules', '__pycache__'],
        help='要排除的子目录名',
        metavar='DIR'
    )

    parser.add_argument(
        '--exclude-exts',
        dest='exclude_exts',
        nargs='*',
        default=['.log', '.tmp', '.temp', '.swp'],
        help='要排除的文件扩展名',
        metavar='EXT'
    )

    parser.add_argument(
        '--expected-artifacts',
        dest='expected_artifacts',
        nargs='*',
        default=[],
        help='预期的制品文件名列表',
        metavar='FILE'
    )

    parser.add_argument(
        '--quiet',
        action='store_true',
        help='静默模式，只输出关键信息'
    )

    args = parser.parse_args()

    if not validate_args(args):
        sys.exit(1)

    config = {
        'source_dirs': [os.path.abspath(d) for d in args.source_dirs],
        'expected_commits': [c.lower() for c in args.expected_commits],
        'build_number': args.build_number,
        'exclude_dirs': args.exclude_dirs,
        'exclude_exts': args.exclude_exts,
        'expected_artifacts': args.expected_artifacts,
    }

    try:
        if not args.quiet:
            print("🔍 开始扫描制品目录...")
            for d in config['source_dirs']:
                print(f"  - {d}")

        indexer = ReleaseIndexer(config)
        result = indexer.run()

        if not args.quiet:
            print(f"✅ 扫描完成，发现 {result.summary['total_artifacts']} 个制品")

        output = OutputGenerator(result, args.output_dir)

        if not args.quiet:
            output.print_console_summary()

        json_file = output.generate_json()
        md_file = output.generate_markdown(args.report_title, args.handover_note)

        print(f"\n📄 输出文件:")
        print(f"  - 机器可读 (JSON): {json_file}")
        print(f"  - 交接报告 (Markdown): {md_file}")

        if result.errors or result.warnings:
            print(f"\n⚠️  注意: 发现 {len(result.errors)} 个错误和 {len(result.warnings)} 个警告")
            sys.exit(2 if result.errors else 1)

    except Exception as e:
        print(f"\n💥 致命错误: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(3)


if __name__ == '__main__':
    main()

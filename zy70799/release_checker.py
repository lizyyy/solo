#!/usr/bin/env python3
import click
import hashlib
import json
import os
from pathlib import Path
from datetime import datetime
import yaml
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional, Set, Tuple


@dataclass
class Artifact:
    file_path: str
    file_name: str
    file_size: int
    sha256: str
    commit_id: Optional[str] = None
    build_number: Optional[str] = None
    directory: str = ""


@dataclass
class HandoverDoc:
    commit_id: str
    build_number: str
    artifacts: List[Dict[str, str]]
    description: str = ""


@dataclass
class CheckResult:
    status: str
    message: str
    artifact: Optional[Artifact] = None
    expected: Optional[Dict] = None


@dataclass
class CheckReport:
    timestamp: str
    directories_scanned: List[str]
    total_artifacts_found: int
    total_artifacts_expected: int
    matched: List[CheckResult]
    missing: List[CheckResult]
    mismatched: List[CheckResult]
    orphaned: List[CheckResult]
    summary: Dict[str, int]


def calculate_sha256(file_path: Path) -> str:
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


def extract_info_from_filename(filename: str) -> Tuple[Optional[str], Optional[str]]:
    commit_id = None
    build_number = None
    
    parts = filename.replace('-', '_').replace('.', '_').split('_')
    for part in parts:
        if len(part) == 40 and all(c in '0123456789abcdefABCDEF' for c in part):
            commit_id = part
        elif part.isdigit() and len(part) >= 3:
            build_number = part
    
    return commit_id, build_number


def scan_directory(directory: Path, follow_links: bool = False) -> List[Artifact]:
    artifacts = []
    
    if not directory.exists():
        return artifacts
    
    for root, dirs, files in os.walk(directory, followlinks=follow_links):
        for file in files:
            file_path = Path(root) / file
            if file_path.is_file():
                commit_id, build_number = extract_info_from_filename(file)
                artifact = Artifact(
                    file_path=str(file_path),
                    file_name=file,
                    file_size=file_path.stat().st_size,
                    sha256=calculate_sha256(file_path),
                    commit_id=commit_id,
                    build_number=build_number,
                    directory=str(Path(root).relative_to(directory) if Path(root) != directory else "")
                )
                artifacts.append(artifact)
    
    return artifacts


def load_handover_doc(handover_path: Path) -> HandoverDoc:
    with open(handover_path, 'r', encoding='utf-8') as f:
        if handover_path.suffix in ['.yaml', '.yml']:
            data = yaml.safe_load(f)
        elif handover_path.suffix == '.json':
            data = json.load(f)
        else:
            data = {}
            for line in f:
                line = line.strip()
                if line.startswith('commit_id:') or line.startswith('commit:'):
                    data['commit_id'] = line.split(':', 1)[1].strip()
                elif line.startswith('build_number:') or line.startswith('build:'):
                    data['build_number'] = line.split(':', 1)[1].strip()
    
    return HandoverDoc(
        commit_id=data.get('commit_id', ''),
        build_number=data.get('build_number', ''),
        artifacts=data.get('artifacts', []),
        description=data.get('description', '')
    )


def match_artifacts(
    scanned_artifacts: List[Artifact],
    handover_doc: HandoverDoc,
    target_commit: Optional[str] = None,
    target_build: Optional[str] = None
) -> CheckReport:
    expected_commit = target_commit or handover_doc.commit_id
    expected_build = target_build or handover_doc.build_number
    
    matched: List[CheckResult] = []
    missing: List[CheckResult] = []
    mismatched: List[CheckResult] = []
    orphaned: List[CheckResult] = []
    
    expected_artifacts = handover_doc.artifacts.copy()
    
    from collections import defaultdict
    scanned_by_name: Dict[str, List[Artifact]] = defaultdict(list)
    for a in scanned_artifacts:
        scanned_by_name[a.file_name].append(a)
    
    matched_artifact_paths = set()
    
    for expected in expected_artifacts:
        expected_name = expected.get('name', '')
        expected_sha256 = expected.get('sha256', '')
        
        if expected_name in scanned_by_name and scanned_by_name[expected_name]:
            artifacts = scanned_by_name[expected_name]
            found_match = False
            
            for artifact in artifacts:
                if artifact.file_path in matched_artifact_paths:
                    continue
                    
                commit_match = (not expected_commit) or (artifact.commit_id and artifact.commit_id == expected_commit)
                build_match = (not expected_build) or (artifact.build_number and artifact.build_number == expected_build)
                hash_match = (not expected_sha256) or (artifact.sha256 == expected_sha256)
                
                if commit_match and build_match and hash_match:
                    matched.append(CheckResult(
                        status="MATCHED",
                        message=f"制品 {expected_name} 完全匹配 ({artifact.file_path})",
                        artifact=artifact,
                        expected=expected
                    ))
                    matched_artifact_paths.add(artifact.file_path)
                    found_match = True
                    break
            
            if not found_match:
                artifact = artifacts[0]
                issues = []
                commit_match = (not expected_commit) or (artifact.commit_id and artifact.commit_id == expected_commit)
                build_match = (not expected_build) or (artifact.build_number and artifact.build_number == expected_build)
                hash_match = (not expected_sha256) or (artifact.sha256 == expected_sha256)
                
                if not commit_match:
                    issues.append(f"提交号不匹配 (期望: {expected_commit}, 实际: {artifact.commit_id or '未找到'})")
                if not build_match:
                    issues.append(f"构建号不匹配 (期望: {expected_build}, 实际: {artifact.build_number or '未找到'})")
                if not hash_match:
                    issues.append(f"哈希不匹配 (期望: {expected_sha256}, 实际: {artifact.sha256})")
                
                mismatched.append(CheckResult(
                    status="MISMATCHED",
                    message=f"制品 {expected_name} 存在但有问题: {'; '.join(issues)}",
                    artifact=artifact,
                    expected=expected
                ))
                matched_artifact_paths.add(artifact.file_path)
        else:
            missing.append(CheckResult(
                status="MISSING",
                message=f"制品 {expected_name} 在目标目录中未找到",
                expected=expected
            ))
    
    for artifact in scanned_artifacts:
        if artifact.file_path not in matched_artifact_paths:
            orphaned.append(CheckResult(
                status="ORPHANED",
                message=f"制品 {artifact.file_name} 在目录中存在但交接文档未提及 ({artifact.file_path})",
                artifact=artifact
            ))
    
    summary = {
        "total_found": len(scanned_artifacts),
        "total_expected": len(expected_artifacts),
        "matched": len(matched),
        "missing": len(missing),
        "mismatched": len(mismatched),
        "orphaned": len(orphaned)
    }
    
    return CheckReport(
        timestamp=datetime.now().isoformat(),
        directories_scanned=[],
        total_artifacts_found=len(scanned_artifacts),
        total_artifacts_expected=len(expected_artifacts),
        matched=matched,
        missing=missing,
        mismatched=mismatched,
        orphaned=orphaned,
        summary=summary
    )


def format_report_human(report: CheckReport, fail_on_orphaned: bool = True) -> str:
    lines = []
    lines.append("=" * 80)
    lines.append("           Release 制品索引提交匹配排查报告")
    lines.append("=" * 80)
    lines.append(f"检查时间: {report.timestamp}")
    lines.append(f"扫描目录: {', '.join(report.directories_scanned) or '未指定'}")
    lines.append(f"漏写检测:   {'启用 (多余制品将导致 FAIL)' if fail_on_orphaned else '禁用 (多余制品仅提示)'}")
    lines.append("")
    lines.append("-" * 80)
    lines.append("                              检查摘要")
    lines.append("-" * 80)
    lines.append(f"  发现制品总数: {report.summary['total_found']}")
    lines.append(f"  期望制品总数: {report.summary['total_expected']}")
    lines.append(f"  完全匹配:     {report.summary['matched']}")
    lines.append(f"  缺失制品:     {report.summary['missing']}")
    lines.append(f"  属性不匹配:   {report.summary['mismatched']}")
    lines.append(f"  多余制品:     {report.summary['orphaned']} {'(将导致 FAIL)' if fail_on_orphaned and report.summary['orphaned'] > 0 else ''}")
    lines.append("")
    
    if report.matched:
        lines.append("-" * 80)
        lines.append("                            匹配成功的制品")
        lines.append("-" * 80)
        for item in report.matched:
            lines.append(f"  ✓ {item.message}")
            if item.artifact:
                lines.append(f"      文件路径: {item.artifact.file_path}")
                lines.append(f"      文件大小: {item.artifact.file_size} 字节")
                lines.append(f"      SHA256:   {item.artifact.sha256}")
        lines.append("")
    
    if report.missing:
        lines.append("-" * 80)
        lines.append("                              缺失的制品")
        lines.append("-" * 80)
        for item in report.missing:
            lines.append(f"  ✗ {item.message}")
        lines.append("")
    
    if report.mismatched:
        lines.append("-" * 80)
        lines.append("                            属性不匹配的制品")
        lines.append("-" * 80)
        for item in report.mismatched:
            lines.append(f"  ⚠ {item.message}")
            if item.artifact:
                lines.append(f"      文件路径: {item.artifact.file_path}")
        lines.append("")
    
    if report.orphaned:
        lines.append("-" * 80)
        lines.append("                        交接文档漏写的制品")
        lines.append("-" * 80)
        for item in report.orphaned:
            lines.append(f"  ? {item.message}")
            if item.artifact:
                lines.append(f"      文件路径: {item.artifact.file_path}")
        lines.append("")
    
    lines.append("=" * 80)
    
    if fail_on_orphaned:
        status = "PASS" if report.summary['missing'] == 0 and report.summary['mismatched'] == 0 and report.summary['orphaned'] == 0 else "FAIL"
    else:
        status = "PASS" if report.summary['missing'] == 0 and report.summary['mismatched'] == 0 else "FAIL"
    
    lines.append(f"最终检查结果: {status}")
    lines.append("=" * 80)
    
    return "\n".join(lines)


def report_to_dict(report: CheckReport, fail_on_orphaned: bool = True) -> dict:
    def result_to_dict(r: CheckResult) -> dict:
        d = {
            "status": r.status,
            "message": r.message
        }
        if r.artifact:
            d["artifact"] = asdict(r.artifact)
        if r.expected:
            d["expected"] = r.expected
        return d
    
    if fail_on_orphaned:
        final_status = "PASS" if report.summary['missing'] == 0 and report.summary['mismatched'] == 0 and report.summary['orphaned'] == 0 else "FAIL"
    else:
        final_status = "PASS" if report.summary['missing'] == 0 and report.summary['mismatched'] == 0 else "FAIL"
    
    return {
        "timestamp": report.timestamp,
        "directories_scanned": report.directories_scanned,
        "fail_on_orphaned": fail_on_orphaned,
        "total_artifacts_found": report.total_artifacts_found,
        "total_artifacts_expected": report.total_artifacts_expected,
        "final_status": final_status,
        "matched": [result_to_dict(r) for r in report.matched],
        "missing": [result_to_dict(r) for r in report.missing],
        "mismatched": [result_to_dict(r) for r in report.mismatched],
        "orphaned": [result_to_dict(r) for r in report.orphaned],
        "summary": report.summary
    }


@click.group()
def cli():
    """Release 制品索引提交匹配排查 CLI 工具
    
    用于检查发布包上传到多个目录后，交接文档是否完整准确。
    """
    pass


@cli.command()
@click.argument('directories', nargs=-1, type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option('--handover', '-h', type=click.Path(exists=True, dir_okay=False), help='交接文档路径 (JSON/YAML)')
@click.option('--commit', '-c', help='目标提交号 (覆盖交接文档中的值)')
@click.option('--build', '-b', help='目标构建号 (覆盖交接文档中的值)')
@click.option('--output', '-o', type=click.Path(), help='机器可读输出文件路径 (JSON)')
@click.option('--follow-links', is_flag=True, help='遍历目录时跟随符号链接')
@click.option('--quiet', '-q', is_flag=True, help='只输出机器可读格式')
@click.option('--allow-orphaned', is_flag=True, help='允许存在未在交接文档中记录的制品（仅警告，不影响最终结果）')
def check(directories, handover, commit, build, output, follow_links, quiet, allow_orphaned):
    """检查制品目录与交接文档的匹配情况
    
    DIRECTORIES: 要扫描的制品目录列表
    """
    if not directories:
        click.echo("错误: 至少需要指定一个要扫描的目录", err=True)
        return
    
    fail_on_orphaned = not allow_orphaned
    
    all_artifacts = []
    for directory in directories:
        artifacts = scan_directory(Path(directory), follow_links)
        all_artifacts.extend(artifacts)
    
    if handover:
        handover_doc = load_handover_doc(Path(handover))
    else:
        handover_doc = HandoverDoc(
            commit_id=commit or '',
            build_number=build or '',
            artifacts=[]
        )
    
    report = match_artifacts(all_artifacts, handover_doc, commit, build)
    report.directories_scanned = list(directories)
    
    if not quiet:
        click.echo(format_report_human(report, fail_on_orphaned=fail_on_orphaned))
    
    if output:
        with open(output, 'w', encoding='utf-8') as f:
            json.dump(report_to_dict(report, fail_on_orphaned=fail_on_orphaned), f, ensure_ascii=False, indent=2)
        if not quiet:
            click.echo(f"\n机器可读报告已保存到: {output}")


@cli.command(name='list')
@click.argument('directory', type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option('--output', '-o', type=click.Path(), help='输出文件路径')
@click.option('--format', '-f', 'fmt', type=click.Choice(['json', 'yaml']), default='json', help='输出格式')
def list_cmd(directory, output, fmt):
    """列出目录中的所有制品文件及其信息"""
    artifacts = scan_directory(Path(directory))
    
    result = {
        "directory": directory,
        "count": len(artifacts),
        "artifacts": [asdict(a) for a in artifacts]
    }
    
    if output:
        with open(output, 'w', encoding='utf-8') as f:
            if fmt == 'yaml':
                yaml.dump(result, f, allow_unicode=True, default_flow_style=False)
            else:
                json.dump(result, f, ensure_ascii=False, indent=2)
        click.echo(f"制品列表已保存到: {output}")
    else:
        if fmt == 'yaml':
            click.echo(yaml.dump(result, allow_unicode=True, default_flow_style=False))
        else:
            click.echo(json.dumps(result, ensure_ascii=False, indent=2))


@cli.command()
@click.argument('file_path', type=click.Path(exists=True, dir_okay=False))
def hash(file_path):
    """计算文件的SHA256哈希值"""
    file_hash = calculate_sha256(Path(file_path))
    click.echo(f"SHA256: {file_hash}")
    click.echo(f"文件: {file_path}")


@cli.command()
@click.option('--output-dir', '-o', type=click.Path(), default='./sample_data', help='样例数据输出目录')
def generate_samples(output_dir):
    """生成测试样例数据
    
    包含: 正常输入、脏数据、边界冲突、空结果
    """
    base_dir = Path(output_dir)
    base_dir.mkdir(exist_ok=True, parents=True)
    
    click.echo(f"正在生成样例数据到: {base_dir}")
    
    normal_dir = base_dir / "normal"
    normal_dir.mkdir(exist_ok=True)
    normal_artifacts = normal_dir / "artifacts"
    normal_artifacts.mkdir(exist_ok=True)
    
    normal_files = [
        ("app-v1.0.0-abcdef1234567890abcdef1234567890abcdef12-build-123.tar.gz", b"normal app content"),
        ("service-v1.0.0-abcdef1234567890abcdef1234567890abcdef12-build-123.jar", b"normal service content"),
        ("web-v1.0.0-abcdef1234567890abcdef1234567890abcdef12-build-123.zip", b"normal web content")
    ]
    
    for name, content in normal_files:
        with open(normal_artifacts / name, 'wb') as f:
            f.write(content)
    
    normal_handover = {
        "commit_id": "abcdef1234567890abcdef1234567890abcdef12",
        "build_number": "123",
        "description": "正常发布版本 v1.0.0",
        "artifacts": [
            {"name": "app-v1.0.0-abcdef1234567890abcdef1234567890abcdef12-build-123.tar.gz",
             "sha256": calculate_sha256(normal_artifacts / normal_files[0][0])},
            {"name": "service-v1.0.0-abcdef1234567890abcdef1234567890abcdef12-build-123.jar",
             "sha256": calculate_sha256(normal_artifacts / normal_files[1][0])},
            {"name": "web-v1.0.0-abcdef1234567890abcdef1234567890abcdef12-build-123.zip",
             "sha256": calculate_sha256(normal_artifacts / normal_files[2][0])}
        ]
    }
    
    with open(normal_dir / "handover.yaml", 'w', encoding='utf-8') as f:
        yaml.dump(normal_handover, f, allow_unicode=True, default_flow_style=False)
    
    click.echo("✓ 正常样例已生成")
    
    dirty_dir = base_dir / "dirty_data"
    dirty_dir.mkdir(exist_ok=True)
    dirty_artifacts = dirty_dir / "artifacts"
    dirty_artifacts.mkdir(exist_ok=True)
    
    dirty_files = [
        ("app-v1.0.0-wrongcommit-build-123.tar.gz", b"dirty app content"),
        ("service-v1.0.0-abcdef1234567890abcdef1234567890abcdef12-build-999.jar", b"dirty service content"),
        ("web-v1.0.0-abcdef1234567890abcdef1234567890abcdef12-build-123.zip", b"tampered web content")
    ]
    
    for name, content in dirty_files:
        with open(dirty_artifacts / name, 'wb') as f:
            f.write(content)
    
    dirty_handover = {
        "commit_id": "abcdef1234567890abcdef1234567890abcdef12",
        "build_number": "123",
        "description": "包含脏数据的发布版本",
        "artifacts": [
            {"name": "app-v1.0.0-wrongcommit-build-123.tar.gz",
             "sha256": "wronghash1234567890"},
            {"name": "service-v1.0.0-abcdef1234567890abcdef1234567890abcdef12-build-999.jar",
             "sha256": calculate_sha256(dirty_artifacts / dirty_files[1][0])},
            {"name": "web-v1.0.0-abcdef1234567890abcdef1234567890abcdef12-build-123.zip",
             "sha256": "expectedhashnotequal"}
        ]
    }
    
    with open(dirty_dir / "handover.yaml", 'w', encoding='utf-8') as f:
        yaml.dump(dirty_handover, f, allow_unicode=True, default_flow_style=False)
    
    click.echo("✓ 脏数据样例已生成")
    
    conflict_dir = base_dir / "conflict"
    conflict_dir.mkdir(exist_ok=True)
    conflict_artifacts1 = conflict_dir / "artifacts1"
    conflict_artifacts2 = conflict_dir / "artifacts2"
    conflict_artifacts1.mkdir(exist_ok=True)
    conflict_artifacts2.mkdir(exist_ok=True)
    
    with open(conflict_artifacts1 / "common-lib-v1.0.0.tar.gz", 'wb') as f:
        f.write(b"version from artifacts1")
    
    with open(conflict_artifacts2 / "common-lib-v1.0.0.tar.gz", 'wb') as f:
        f.write(b"different version from artifacts2")
    
    conflict_handover = {
        "commit_id": "abcdef1234567890abcdef1234567890abcdef12",
        "build_number": "456",
        "description": "边界冲突 - 多目录同名文件",
        "artifacts": [
            {"name": "common-lib-v1.0.0.tar.gz", "sha256": calculate_sha256(conflict_artifacts1 / "common-lib-v1.0.0.tar.gz")}
        ]
    }
    
    with open(conflict_dir / "handover.yaml", 'w', encoding='utf-8') as f:
        yaml.dump(conflict_handover, f, allow_unicode=True, default_flow_style=False)
    
    click.echo("✓ 边界冲突样例已生成")
    
    empty_dir = base_dir / "empty"
    empty_dir.mkdir(exist_ok=True)
    empty_artifacts = empty_dir / "artifacts"
    empty_artifacts.mkdir(exist_ok=True)
    
    empty_handover = {
        "commit_id": "abcdef1234567890abcdef1234567890abcdef12",
        "build_number": "789",
        "description": "空结果 - 期望制品不存在",
        "artifacts": [
            {"name": "missing-artifact-1.tar.gz", "sha256": "hash1"},
            {"name": "missing-artifact-2.jar", "sha256": "hash2"}
        ]
    }
    
    with open(empty_dir / "handover.yaml", 'w', encoding='utf-8') as f:
        yaml.dump(empty_handover, f, allow_unicode=True, default_flow_style=False)
    
    click.echo("✓ 空结果样例已生成")
    
    click.echo(f"\n样例数据生成完成!")
    click.echo(f"目录结构:")
    for item in sorted(base_dir.rglob('*')):
        rel = item.relative_to(base_dir)
        prefix = "    " * len(rel.parts)
        if item.is_dir():
            click.echo(f"{prefix}{rel.name}/")
        else:
            click.echo(f"{prefix}{rel.name}")


if __name__ == '__main__':
    cli()

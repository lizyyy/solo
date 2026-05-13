#!/usr/bin/env python3
"""
本地合规证据包 CLI 演示流程
展示从缺口到最终证据包索引的完整过程
"""

import os
import sys
import subprocess
import tempfile
import shutil
from pathlib import Path
from datetime import datetime, timedelta

def run_command(cmd, cwd=None):
    print(f"\n{'='*60}")
    print(f"执行: {cmd}")
    print('='*60)
    result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print("stderr:", result.stderr)
    return result.returncode

def create_sample_evidence_files(base_dir):
    """创建一些示例证据文件用于演示"""
    base = Path(base_dir)
    
    ac_dir = base / "access-control"
    ac_dir.mkdir(parents=True, exist_ok=True)
    
    (ac_dir / "policy.pdf").write_bytes(b"%PDF-1.4\n%Demo access control policy document\n")
    (ac_dir / "approval-q2.png").write_bytes(b"\x89PNG\r\n\x1a\nDemo approval screenshot\n")
    (ac_dir / "offboarding-cleanup.xlsx").write_bytes(b"PK\x03\x04Demo offboarding cleanup spreadsheet\n")
    
    vs_dir = base / "vulnerability-scan"
    vs_dir.mkdir(parents=True, exist_ok=True)
    
    (vs_dir / "report-q2.pdf").write_bytes(b"%PDF-1.4\nDemo vulnerability scan report\n")
    (vs_dir / "high-risk-remediation.xlsx").write_bytes(b"PK\x03\x04Demo remediation tracking\n")
    (vs_dir / "scanner-config.json").write_bytes(b'{"config": "demo scanner config", "version": 1}\n')
    
    cc_dir = base / "change-control"
    cc_dir.mkdir(parents=True, exist_ok=True)
    
    (cc_dir / "approval-process.pdf").write_bytes(b"%PDF-1.4\nDemo change approval process\n")
    (cc_dir / "approvals-may.png").write_bytes(b"\x89PNG\r\n\x1a\nDemo may approvals\n")

def main():
    work_dir = Path(tempfile.mkdtemp(prefix="compliance-demo-"))
    print(f"🎬 演示目录: {work_dir}")
    
    os.chdir(work_dir)
    
    print("\n" + "="*60)
    print("步骤 1: 初始化项目")
    print("="*60)
    
    sys.path.insert(0, '/Users/lzy/pro/solo/workspaces/zy70384')
    from compliance_evidence.config import EvidenceConfig, create_sample_config
    
    sample_config = create_sample_config()
    config = EvidenceConfig("evidence-manifest.yaml")
    config.save(sample_config)
    
    print("✓ 创建配置文件: evidence-manifest.yaml")
    print("审计主题:", ", ".join(sorted(set(
        ev["audit_topic"] for ev in sample_config["evidence"] if ev.get("audit_topic")
    ))))
    
    print("\n" + "="*60)
    print("步骤 2: 检查证据缺口（文件都缺失）")
    print("="*60)
    
    from compliance_evidence.validator import EvidenceValidator
    from compliance_evidence.cli import _display_check_results
    
    validator = EvidenceValidator("evidence")
    results = validator.check_all(config.get_evidence_list())
    _display_check_results(results, verbose=False)
    
    print("\n" + "="*60)
    print("步骤 3: 解释缺口详情")
    print("="*60)
    
    from compliance_evidence.cli import explain_missing as explain_missing_cmd
    from click.testing import CliRunner
    runner = CliRunner()
    result = runner.invoke(
        explain_missing_cmd, 
        ['--config', 'evidence-manifest.yaml'],
        catch_exceptions=False
    )
    print(result.output)
    
    print("\n" + "="*60)
    print("步骤 4: 放入证据文件（模拟补齐材料）")
    print("="*60)
    
    create_sample_evidence_files("evidence")
    print("✓ 已创建示例证据文件")
    
    print("\n" + "="*60)
    print("步骤 5: 再次检查（仍然有问题：整改未关闭、过期、可选证据缺失）")
    print("="*60)
    
    results = validator.check_all(config.get_evidence_list())
    _display_check_results(results, verbose=True)
    
    print("\n" + "="*60)
    print("步骤 6: 修复问题 - 标记整改已关闭、更新过期日期")
    print("="*60)
    
    data = config.load()
    for ev in data["evidence"]:
        if ev.get("id") == "VS-002":
            ev["remediation_status"] = "已关闭"
        if ev.get("id") == "VS-003":
            ev["expiry_date"] = (datetime.now() + timedelta(days=90)).strftime("%Y-%m-%d")
        if ev.get("id") == "CR-003":
            (Path("evidence") / ev["path"]).parent.mkdir(parents=True, exist_ok=True)
            (Path("evidence") / ev["path"]).write_bytes(b"\x89PNG\r\n\x1a\nEmergency change approval\n")
            ev["owner"] = "变更经理"
    
    config.save(data)
    print("✓ 已更新配置并创建剩余文件")
    
    print("\n" + "="*60)
    print("步骤 7: 最终检查（所有证据通过）")
    print("="*60)
    
    results = validator.check_all(config.get_evidence_list())
    _display_check_results(results, verbose=False)
    
    print("\n" + "="*60)
    print("步骤 8: 冻结证据快照")
    print("="*60)
    
    from compliance_evidence.cli import freeze as freeze_cmd
    result = runner.invoke(
        freeze_cmd,
        ['--config', 'evidence-manifest.yaml', '--tag', 'audit-2026-q2'],
        catch_exceptions=False
    )
    print(result.output)
    
    print("\n" + "="*60)
    print("步骤 9: 生成最终证据索引和缺口报告")
    print("="*60)
    
    from compliance_evidence.cli import report as report_cmd
    result = runner.invoke(
        report_cmd,
        ['--config', 'evidence-manifest.yaml'],
        catch_exceptions=False
    )
    print(result.output)
    
    print("\n" + "="*60)
    print("步骤 10: 模拟证据文件被替换，验证冻结保护")
    print("="*60)
    
    vs_file = Path("evidence/vulnerability-scan/report-q2.pdf")
    original_content = vs_file.read_bytes()
    vs_file.write_bytes(b"%PDF-1.4\nMaliciously modified report content!\n")
    print("⚠️  已修改漏洞扫描报告内容（模拟被替换）")
    
    print("\n执行冻结重放检查:")
    from compliance_evidence.cli import check as check_cmd
    result = runner.invoke(
        check_cmd,
        ['--freeze', 'audit-2026-q2', '--verbose'],
        catch_exceptions=False
    )
    print(result.output)
    
    print("\n" + "="*60)
    print("✅ 演示完成")
    print("="*60)
    print(f"演示文件保留在: {work_dir}")
    print("\n可以手动清理: rm -rf", work_dir)
    print("\n实际使用命令:")
    print("  cecli init           # 初始化项目")
    print("  cecli check          # 检查证据状态")
    print("  cecli check -v       # 详细检查")
    print("  cecli explain-missing # 查看缺口详情")
    print("  cecli freeze -t tag  # 冻结证据快照")
    print("  cecli check -f tag   # 重放冻结检查")
    print("  cecli report         # 生成报告")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
串口固件升级回放器 - 主入口程序
用于工厂设备运维工程师复核固件升级日志
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.log_parser import LogParser, LogEntry, UpgradeEventType
from src.models import Device, FirmwareManifest, BatchInfo, DeviceStatus
from src.state_machine import UpgradeStateMachine, UpgradeState
from src.rules import RuleEngine, RiskLevel, RuleResult
from src.storage import ReviewStorage, ReviewRecord, ReviewConclusion, ReviewStatus
from src.io_handler import IOHandler, Importer, Exporter


__version__ = "1.0.0"


class SerialFirmwareReplayer:
    def __init__(self):
        self.log_parser = LogParser()
        self.state_machine = UpgradeStateMachine()
        self.rule_engine = RuleEngine()
        self.storage = ReviewStorage()
        self.io_handler = IOHandler()
        
        self.log_entries: list = []
        self.manifest: Optional[FirmwareManifest] = None
        self.batch_info: Optional[BatchInfo] = None
        self.device: Optional[Device] = None
    
    def import_data(self,
                    log_path: Optional[str] = None,
                    manifest_path: Optional[str] = None,
                    batch_path: Optional[str] = None,
                    notes_path: Optional[str] = None) -> Dict[str, Any]:
        result = self.io_handler.import_all(
            log_path=log_path,
            manifest_path=manifest_path,
            batch_path=batch_path,
            notes_path=notes_path,
        )
        
        self.log_entries = result["log_entries"]
        self.manifest = result["manifest"]
        self.batch_info = result["batch_info"]
        
        if self.batch_info and self.batch_info.devices:
            self.device = self.batch_info.devices[0]
        
        return result
    
    def replay_state_machine(self) -> Dict[str, Any]:
        if not self.log_entries:
            raise ValueError("没有日志条目可用于重放")
        
        self.state_machine.reset()
        transitions = self.state_machine.process_log_entries(self.log_entries)
        
        summary = self.state_machine.get_state_summary()
        summary["transition_count"] = len(transitions)
        
        return summary
    
    def run_rule_checks(self) -> Dict[str, Any]:
        if not self.log_entries:
            raise ValueError("没有日志条目可用于规则检查")
        
        expected_crc = self.manifest.crc32 if self.manifest else None
        
        results = self.rule_engine.run_all(
            state_machine=self.state_machine,
            log_entries=self.log_entries,
            device=self.device,
            manifest=self.manifest,
            expected_crc=expected_crc,
        )
        
        summary = self.rule_engine.get_summary()
        summary["results"] = [r.to_dict() for r in results]
        
        return summary
    
    def create_review_record(self,
                             device_id: str = "",
                             batch_id: str = "",
                             reviewer: str = "",
                             notes: str = "") -> ReviewRecord:
        state_summary = self.state_machine.get_state_summary()
        
        record = ReviewRecord(
            review_id=self.storage.generate_review_id(),
            device_id=device_id or (self.device.device_id if self.device else "unknown"),
            batch_id=batch_id or (self.batch_info.batch_id if self.batch_info else ""),
            status=ReviewStatus.IN_PROGRESS,
            conclusion=ReviewConclusion.PENDING,
            source_version=state_summary.get("source_version", ""),
            target_version=state_summary.get("target_version", ""),
            state_summary=state_summary,
            rule_results=list(self.rule_engine.results),
            reviewer=reviewer,
        )
        
        for violation in self.rule_engine.get_all_violations():
            record.add_violation(violation)
        
        record.auto_conclude()
        
        if notes:
            record.add_note(notes, reviewer)
        
        return record
    
    def save_review(self, record: ReviewRecord) -> str:
        return self.storage.save(record)
    
    def export_results(self,
                        record: ReviewRecord,
                        output_dir: str) -> Dict[str, str]:
        return self.io_handler.export_all(
            review_record=record,
            output_dir=output_dir,
            rule_engine=self.rule_engine,
            state_machine=self.state_machine,
            log_entries=self.log_entries,
        )
    
    def run_full_workflow(self,
                          log_path: str,
                          manifest_path: Optional[str] = None,
                          batch_path: Optional[str] = None,
                          notes_path: Optional[str] = None,
                          output_dir: Optional[str] = None,
                          device_id: str = "",
                          reviewer: str = "") -> Dict[str, Any]:
        print(f"=== 串口固件升级回放器 v{__version__} ===")
        print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        print("步骤 1/5: 导入数据...")
        import_result = self.import_data(
            log_path=log_path,
            manifest_path=manifest_path,
            batch_path=batch_path,
            notes_path=notes_path,
        )
        print(f"  - 日志条目数: {len(self.log_entries)}")
        print(f"  - 设备ID: {self.device.device_id if self.device else '未设置'}")
        print(f"  - 固件版本: {self.manifest.version if self.manifest else '未设置'}")
        print()
        
        print("步骤 2/5: 重放升级状态机...")
        state_summary = self.replay_state_machine()
        print(f"  - 最终状态: {state_summary['current_state']}")
        print(f"  - 状态转换: {state_summary['transition_count']} 次")
        print(f"  - CRC验证: {'通过' if state_summary['crc_verified'] else '未通过'}")
        print()
        
        print("步骤 3/5: 执行规则校验...")
        rule_summary = self.run_rule_checks()
        print(f"  - 违规总数: {rule_summary['total_violations']}")
        print(f"  - CRITICAL: {rule_summary['by_risk']['critical']}")
        print(f"  - HIGH: {rule_summary['by_risk']['high']}")
        print(f"  - MEDIUM: {rule_summary['by_risk']['medium']}")
        print(f"  - 整体状态: {rule_summary['overall_status']}")
        print()
        
        print("步骤 4/5: 创建复核记录...")
        notes = ""
        if notes_path:
            with open(notes_path, 'r', encoding='utf-8') as f:
                notes = f.read()
        
        record = self.create_review_record(
            device_id=device_id,
            reviewer=reviewer,
            notes=notes,
        )
        
        review_id = self.save_review(record)
        print(f"  - 复核ID: {review_id}")
        print(f"  - 复核结论: {record.conclusion.value}")
        print(f"  - 保存位置: {self.storage.storage_path}")
        print()
        
        export_files = {}
        if output_dir:
            print("步骤 5/5: 导出报告...")
            export_files = self.export_results(record, output_dir)
            print(f"  - Markdown报告: {export_files.get('markdown', 'N/A')}")
            print(f"  - CSV风险清单: {export_files.get('csv_risks', 'N/A')}")
            print(f"  - JSON审计包: {export_files.get('json_audit', 'N/A')}")
            print()
        
        print("=== 复核完成 ===")
        print(f"结束时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        if record.conclusion == ReviewConclusion.PASS:
            print("✅ 复核通过 - 无严重问题")
        elif record.conclusion == ReviewConclusion.WARNING:
            print("⚠️  存在警告 - 建议复查")
        elif record.conclusion == ReviewConclusion.FAIL:
            print("❌ 复核失败 - 存在严重问题")
            critical_violations = self.rule_engine.get_critical_violations()
            for i, v in enumerate(critical_violations, 1):
                print(f"   {i}. [{v.violation_type.value}] {v.description}")
        print()
        
        return {
            "review_id": review_id,
            "conclusion": record.conclusion.value,
            "state_summary": state_summary,
            "rule_summary": rule_summary,
            "export_files": export_files,
        }
    
    def list_reviews(self, 
                     batch_id: Optional[str] = None,
                     conclusion: Optional[str] = None,
                     limit: int = 50) -> list:
        concl = None
        if conclusion:
            try:
                concl = ReviewConclusion(conclusion.upper())
            except ValueError:
                pass
        
        records = self.storage.list_reviews(
            batch_id=batch_id,
            conclusion=concl,
            limit=limit,
        )
        
        return records
    
    def get_review(self, review_id: str) -> Optional[ReviewRecord]:
        return self.storage.load(review_id)
    
    def show_stats(self) -> Dict[str, Any]:
        return self.storage.get_statistics()


def create_sample_data(output_dir: str) -> Dict[str, str]:
    """创建示例数据用于测试"""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    log_content = """2024-01-15 09:30:00.123 [INFO] 开始设备连接 - 握手
2024-01-15 09:30:00.456 [INFO] 握手成功，检测设备版本 VER: 1.2.0
2024-01-15 09:30:01.000 [INFO] 开始传输固件版本 2.0.0
2024-01-15 09:30:05.000 [INFO] 传输进度: 25%
2024-01-15 09:30:10.000 [INFO] 传输进度: 50%
2024-01-15 09:30:15.000 [INFO] 传输进度: 75%
2024-01-15 09:30:20.000 [INFO] 传输进度: 100%
2024-01-15 09:30:20.500 [INFO] 传输完成，开始CRC校验
2024-01-15 09:30:21.000 [INFO] CRC: A1B2C3D4 - 校验通过
2024-01-15 09:30:21.500 [INFO] 开始烧录固件
2024-01-15 09:30:30.000 [INFO] 烧录进度: 50%
2024-01-15 09:30:40.000 [INFO] 烧录进度: 100%
2024-01-15 09:30:40.500 [INFO] 烧录完成，设备重启
2024-01-15 09:30:45.000 [INFO] 设备重启成功，升级完成
"""
    
    log_path = output_path / "sample_upgrade.log"
    with open(log_path, 'w', encoding='utf-8') as f:
        f.write(log_content)
    
    manifest_content = {
        "version": "2.0.0",
        "type": "application",
        "file_size": 1048576,
        "crc32": "A1B2C3D4",
        "md5": "e10adc3949ba59abbe56e057f20f883",
        "release_date": "2024-01-10T00:00:00",
        "compatible_hardware": ["HW1.0", "HW1.1", "HW2.0"],
        "rollback_allowed": True,
        "minimum_rollback_version": "1.0.0",
        "notes": "此版本修复了通信稳定性问题",
        "metadata": {
            "build_date": "2024-01-10",
            "build_number": "2024011001"
        }
    }
    
    manifest_path = output_path / "firmware_manifest.json"
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest_content, f, ensure_ascii=False, indent=2)
    
    batch_content = """device_id,serial_number,model,hardware_version,firmware_version,status
DEV001,SN20240101,Controller-X,HW1.0,1.2.0,NORMAL
DEV002,SN20240102,Controller-X,HW1.0,1.1.0,NORMAL
DEV003,SN20240103,Controller-X,HW1.1,1.2.0,NORMAL
DEV004,SN20240104,Controller-X,HW2.0,1.0.0,NEEDS_RECOVERY
"""
    
    batch_path = output_path / "batch_20240115.csv"
    with open(batch_path, 'w', encoding='utf-8') as f:
        f.write(batch_content)
    
    notes_content = """复核备注:
- 本次升级针对4台设备，目标版本2.0.0
- DEV004设备之前出现过升级中断，需要特别关注
- 建议升级后运行24小时稳定性测试
"""
    
    notes_path = output_path / "review_notes.txt"
    with open(notes_path, 'w', encoding='utf-8') as f:
        f.write(notes_content)
    
    print(f"示例数据已创建到: {output_path}")
    print(f"  - 日志文件: {log_path}")
    print(f"  - Manifest: {manifest_path}")
    print(f"  - 批次CSV: {batch_path}")
    print(f"  - 备注文件: {notes_path}")
    print()
    print("使用示例:")
    print(f"  python main.py run --log {log_path} --manifest {manifest_path} --output ./output")
    print()
    
    return {
        "log": str(log_path),
        "manifest": str(manifest_path),
        "batch": str(batch_path),
        "notes": str(notes_path),
    }


def main():
    parser = argparse.ArgumentParser(
        description=f"串口固件升级回放器 v{__version__}",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 创建示例数据
  python main.py sample --output ./sample_data
  
  # 运行完整复核流程
  python main.py run --log ./sample.log --manifest ./manifest.json --output ./output
  
  # 列出历史复核记录
  python main.py list --limit 10
  
  # 查看统计信息
  python main.py stats
        """
    )
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    sample_parser = subparsers.add_parser("sample", help="创建示例数据")
    sample_parser.add_argument("--output", "-o", required=True, help="输出目录")
    
    run_parser = subparsers.add_parser("run", help="运行完整复核流程")
    run_parser.add_argument("--log", "-l", required=True, help="串口日志文件路径")
    run_parser.add_argument("--manifest", "-m", help="固件manifest JSON路径")
    run_parser.add_argument("--batch", "-b", help="设备批次CSV路径")
    run_parser.add_argument("--notes", "-n", help="人工备注文件路径")
    run_parser.add_argument("--output", "-o", help="报告输出目录")
    run_parser.add_argument("--device-id", "-d", default="", help="设备ID")
    run_parser.add_argument("--reviewer", "-r", default="", help="复核人名称")
    
    list_parser = subparsers.add_parser("list", help="列出复核记录")
    list_parser.add_argument("--batch-id", "-b", help="按批次ID筛选")
    list_parser.add_argument("--conclusion", "-c", help="按结论筛选 (PASS/WARNING/FAIL)")
    list_parser.add_argument("--limit", "-n", type=int, default=50, help="显示数量限制")
    list_parser.add_argument("--json", action="store_true", help="以JSON格式输出")
    
    get_parser = subparsers.add_parser("get", help="查看详细复核记录")
    get_parser.add_argument("review_id", help="复核ID")
    get_parser.add_argument("--json", action="store_true", help="以JSON格式输出")
    
    stats_parser = subparsers.add_parser("stats", help="查看统计信息")
    stats_parser.add_argument("--json", action="store_true", help="以JSON格式输出")
    
    args = parser.parse_args()
    
    replayer = SerialFirmwareReplayer()
    
    if args.command == "sample":
        create_sample_data(args.output)
    
    elif args.command == "run":
        replayer.run_full_workflow(
            log_path=args.log,
            manifest_path=args.manifest,
            batch_path=args.batch,
            notes_path=args.notes,
            output_dir=args.output,
            device_id=args.device_id,
            reviewer=args.reviewer,
        )
    
    elif args.command == "list":
        records = replayer.list_reviews(
            batch_id=args.batch_id,
            conclusion=args.conclusion,
            limit=args.limit,
        )
        
        if args.json:
            output = [r.to_dict() for r in records]
            print(json.dumps(output, ensure_ascii=False, indent=2))
        else:
            if not records:
                print("没有找到复核记录")
            else:
                print(f"找到 {len(records)} 条复核记录 (最多显示 {args.limit} 条)")
                print("-" * 80)
                for r in records:
                    status_icon = {
                        ReviewConclusion.PASS: "✅",
                        ReviewConclusion.WARNING: "⚠️",
                        ReviewConclusion.FAIL: "❌",
                    }.get(r.conclusion, "?")
                    print(f"{status_icon} {r.review_id}")
                    print(f"    设备: {r.device_id} | 批次: {r.batch_id or 'N/A'}")
                    print(f"    版本: {r.source_version} -> {r.target_version}")
                    print(f"    时间: {r.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
                    print(f"    结论: {r.conclusion.value}")
                    print()
    
    elif args.command == "get":
        record = replayer.get_review(args.review_id)
        if not record:
            print(f"未找到复核记录: {args.review_id}")
            sys.exit(1)
        
        if args.json:
            print(json.dumps(record.to_dict(), ensure_ascii=False, indent=2))
        else:
            print(f"=== 复核记录详情 ===")
            print(f"复核ID: {record.review_id}")
            print(f"设备ID: {record.device_id}")
            print(f"批次ID: {record.batch_id or 'N/A'}")
            print(f"创建时间: {record.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"状态: {record.status.value}")
            print(f"结论: {record.conclusion.value}")
            print()
            print(f"版本: {record.source_version} -> {record.target_version}")
            print()
            
            risk_summary = record.get_risk_summary()
            print(f"风险统计:")
            print(f"  CRITICAL: {risk_summary['critical']}")
            print(f"  HIGH: {risk_summary['high']}")
            print(f"  MEDIUM: {risk_summary['medium']}")
            print()
            
            if record.violations:
                print("违规详情:")
                for i, v in enumerate(record.violations, 1):
                    risk_icon = {
                        RiskLevel.CRITICAL: "🔴",
                        RiskLevel.HIGH: "🟠",
                        RiskLevel.MEDIUM: "🟡",
                        RiskLevel.LOW: "🟢",
                    }.get(v.risk_level, "⚪")
                    print(f"  {risk_icon} [{v.violation_type.value}]")
                    print(f"      {v.description}")
                    if v.log_line_number:
                        print(f"      日志行号: {v.log_line_number}")
                    print()
    
    elif args.command == "stats":
        stats = replayer.show_stats()
        
        if args.json:
            print(json.dumps(stats, ensure_ascii=False, indent=2))
        else:
            print(f"=== 统计信息 ===")
            print(f"总复核数: {stats['total_reviews']}")
            print()
            
            if stats['by_conclusion']:
                print("按结论分布:")
                for concl, count in stats['by_conclusion'].items():
                    print(f"  {concl}: {count}")
                print()
            
            if stats['by_status']:
                print("按状态分布:")
                for status, count in stats['by_status'].items():
                    print(f"  {status}: {count}")
                print()
            
            risk_counts = stats.get('total_violations_by_risk', {})
            if any(risk_counts.values()):
                print("违规风险统计:")
                for level, count in risk_counts.items():
                    print(f"  {level.upper()}: {count}")
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

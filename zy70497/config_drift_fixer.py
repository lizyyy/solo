#!/usr/bin/env python3
import click
from datetime import datetime
from pathlib import Path
import json
import csv
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import hashlib


class CheckStatus(Enum):
    PASS = "通过"
    FAIL = "不通过"
    WARN = "警告"
    SKIP = "跳过"


class FailReason(Enum):
    APPROVAL_MISSING = "审批意见丢失"
    CONFIG_MISMATCH = "配置不匹配"
    DEVICE_OFFLINE = "设备离线"
    VERSION_TOO_OLD = "版本过低"
    INVALID_FORMAT = "格式无效"


@dataclass
class EdgeNode:
    node_id: str
    node_name: str
    department: str
    team: str
    device_type: str
    firmware_version: str
    config_version: str
    approval_id: Optional[str] = None
    approval_opinion: Optional[str] = None
    approval_time: Optional[str] = None
    iot_receipt_id: Optional[str] = None
    last_heartbeat: Optional[str] = None
    location: Optional[str] = None


@dataclass
class CheckRule:
    rule_id: str
    rule_name: str
    rule_version: str
    effective_date: str
    description: str
    check_logic: str
    failure_explanation: str = ""
    applicable_scopes: List[str] = None
    owner_department: str = ""
    change_log: str = ""


@dataclass
class CheckResult:
    node_id: str
    node_name: str
    department: str
    team: str
    status: CheckStatus
    fail_reason: Optional[FailReason]
    fail_details: Optional[str]
    rule_version: str
    check_time: str
    iot_receipt_id: Optional[str]
    original_data_hash: str


@dataclass
class BatchSummary:
    batch_id: str
    rule_version: str
    check_time: str
    total_count: int
    pass_count: int
    fail_count: int
    warn_count: int
    skip_count: int


class ConfigDriftChecker:
    def __init__(self, rules_dir: str = "rules"):
        self.rules_dir = Path(rules_dir)
        self.rules_dir.mkdir(exist_ok=True)
        self.current_rule = self._load_latest_rule()
        
    def _load_latest_rule(self) -> CheckRule:
        rule_files = sorted(self.rules_dir.glob("rule_*.json"), reverse=True)
        if rule_files:
            with open(rule_files[0], 'r', encoding='utf-8') as f:
                data = json.load(f)
                return CheckRule(**data)
        return CheckRule(
            rule_id="R001",
            rule_name="边缘节点配置合规检查",
            rule_version="v1.0",
            effective_date="2024-01-01",
            description="检查边缘节点配置是否符合规范，重点验证审批流程完整性",
            check_logic="审批意见必须存在且非空"
        )
    
    def _calculate_hash(self, data: Dict) -> str:
        return hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:16]
    
    def _check_approval(self, node: EdgeNode) -> Tuple[bool, Optional[str]]:
        if not node.approval_opinion or node.approval_opinion.strip() == "":
            return False, "审批意见为空，无法确认该节点配置变更已完成合规审批流程。根据版本控制规则v1.0，所有配置变更必须附有审批人签字意见，否则将被拦截。"
        
        if not node.approval_id:
            return False, "审批单号缺失，无法在IoT平台回执系统中追溯审批记录。请联系责任团队补充审批单号。"
        
        if not node.approval_time:
            return False, "审批时间缺失，无法确认审批有效性。审批记录必须包含完整的时间戳。"
            
        return True, None
    
    def check_node(self, node: EdgeNode) -> CheckResult:
        check_time = datetime.now().isoformat()
        original_hash = self._calculate_hash(asdict(node))
        
        approval_ok, approval_msg = self._check_approval(node)
        if not approval_ok:
            return CheckResult(
                node_id=node.node_id,
                node_name=node.node_name,
                department=node.department,
                team=node.team,
                status=CheckStatus.FAIL,
                fail_reason=FailReason.APPROVAL_MISSING,
                fail_details=approval_msg,
                rule_version=self.current_rule.rule_version,
                check_time=check_time,
                iot_receipt_id=node.iot_receipt_id,
                original_data_hash=original_hash
            )
        
        return CheckResult(
            node_id=node.node_id,
            node_name=node.node_name,
            department=node.department,
            team=node.team,
            status=CheckStatus.PASS,
            fail_reason=None,
            fail_details=None,
            rule_version=self.current_rule.rule_version,
            check_time=check_time,
            iot_receipt_id=node.iot_receipt_id,
            original_data_hash=original_hash
        )
    
    def batch_check(self, nodes: List[EdgeNode]) -> Tuple[List[CheckResult], BatchSummary]:
        batch_id = f"BATCH_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        results = [self.check_node(node) for node in nodes]
        
        pass_count = sum(1 for r in results if r.status == CheckStatus.PASS)
        fail_count = sum(1 for r in results if r.status == CheckStatus.FAIL)
        warn_count = sum(1 for r in results if r.status == CheckStatus.WARN)
        skip_count = sum(1 for r in results if r.status == CheckStatus.SKIP)
        
        summary = BatchSummary(
            batch_id=batch_id,
            rule_version=self.current_rule.rule_version,
            check_time=datetime.now().isoformat(),
            total_count=len(results),
            pass_count=pass_count,
            fail_count=fail_count,
            warn_count=warn_count,
            skip_count=skip_count
        )
        
        return results, summary


def load_nodes_from_csv(file_path: str) -> List[EdgeNode]:
    nodes = []
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            nodes.append(EdgeNode(
                node_id=row.get('节点ID', ''),
                node_name=row.get('节点名称', ''),
                department=row.get('所属部门', ''),
                team=row.get('责任团队', ''),
                device_type=row.get('设备类型', ''),
                firmware_version=row.get('固件版本', ''),
                config_version=row.get('配置版本', ''),
                approval_id=row.get('审批单号'),
                approval_opinion=row.get('审批意见'),
                approval_time=row.get('审批时间'),
                iot_receipt_id=row.get('IoT回执ID'),
                last_heartbeat=row.get('最后心跳'),
                location=row.get('部署位置')
            ))
    return nodes


def save_results(results: List[CheckResult], summary: BatchSummary, output_dir: str = "output"):
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)
    
    summary_file = output_path / f"{summary.batch_id}_summary.json"
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(asdict(summary), f, ensure_ascii=False, indent=2)
    
    all_results_file = output_path / f"{summary.batch_id}_all_results.csv"
    with open(all_results_file, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['节点ID', '节点名称', '所属部门', '责任团队', '检查状态', '失败原因', '详细说明', 
                        '规则版本', '检查时间', 'IoT回执ID', '原始数据哈希'])
        for r in results:
            writer.writerow([
                r.node_id, r.node_name, r.department, r.team, r.status.value,
                r.fail_reason.value if r.fail_reason else '',
                r.fail_details or '', r.rule_version, r.check_time,
                r.iot_receipt_id or '', r.original_data_hash
            ])
    
    fail_results = [r for r in results if r.status == CheckStatus.FAIL]
    if fail_results:
        fail_file = output_path / f"{summary.batch_id}_failed.csv"
        with open(fail_file, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['节点ID', '节点名称', '所属部门', '责任团队', '失败原因', '详细说明', 
                            '规则版本', '检查时间', 'IoT回执ID', '原始数据哈希'])
            for r in fail_results:
                writer.writerow([
                    r.node_id, r.node_name, r.department, r.team,
                    r.fail_reason.value if r.fail_reason else '',
                    r.fail_details or '', r.rule_version, r.check_time,
                    r.iot_receipt_id or '', r.original_data_hash
                ])
    
    return summary_file, all_results_file, fail_file if fail_results else None


@click.group()
def cli():
    pass


@cli.command()
@click.argument('input_file', type=click.Path(exists=True))
@click.option('--output-dir', '-o', default='output', help='输出目录')
@click.option('--rules-dir', '-r', default='rules', help='规则目录')
def check(input_file: str, output_dir: str, rules_dir: str):
    """执行配置漂移检查"""
    click.echo(f"\n{'='*60}")
    click.echo("配置漂移修复工具 - 批量检查")
    click.echo(f"{'='*60}\n")
    
    checker = ConfigDriftChecker(rules_dir=rules_dir)
    
    click.echo(f"📋 加载节点清单: {input_file}")
    nodes = load_nodes_from_csv(input_file)
    click.echo(f"✅ 共加载 {len(nodes)} 个节点\n")
    
    click.echo(f"🔍 正在执行检查 (规则版本: {checker.current_rule.rule_version})...")
    results, summary = checker.batch_check(nodes)
    
    click.echo(f"\n{'='*60}")
    click.echo("检查完成！结果汇总：")
    click.echo(f"{'='*60}")
    click.echo(f"批次号: {summary.batch_id}")
    click.echo(f"总节点数: {summary.total_count}")
    click.echo(f"✅ 通过: {summary.pass_count}")
    click.echo(f"❌ 失败: {summary.fail_count}")
    click.echo(f"⚠️  警告: {summary.warn_count}")
    click.echo(f"⏭️  跳过: {summary.skip_count}")
    click.echo(f"{'='*60}\n")
    
    failed = [r for r in results if r.status == CheckStatus.FAIL]
    if failed:
        click.echo("❌ 失败明细：")
        click.echo("-" * 60)
        for r in failed:
            click.echo(f"\n节点: {r.node_name} ({r.node_id})")
            click.echo(f"部门: {r.department} / {r.team}")
            click.echo(f"原因: {r.fail_reason.value}")
            click.echo(f"说明: {r.fail_details}")
            click.echo(f"IoT回执ID: {r.iot_receipt_id}")
    
    summary_file, all_file, fail_file = save_results(results, summary, output_dir)
    click.echo(f"\n💾 结果已保存：")
    click.echo(f"  - 汇总: {summary_file}")
    click.echo(f"  - 全部结果: {all_file}")
    if fail_file:
        click.echo(f"  - 失败明细: {fail_file}")


@cli.command()
@click.option('--output-dir', '-o', default='examples', help='样例输出目录')
def generate_examples(output_dir: str):
    """生成样例数据（正常材料+坏材料）"""
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)
    
    normal_file = output_path / "边缘节点清册_正常批次.csv"
    with open(normal_file, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['节点ID', '节点名称', '所属部门', '责任团队', '设备类型', '固件版本', 
                        '配置版本', '审批单号', '审批意见', '审批时间', 'IoT回执ID', '最后心跳', '部署位置'])
        writer.writerow(['EDGE-001', '国贸大厦一楼网关', '运维部', '网络运维组', '工业网关', 'v2.3.1', 
                        'CFG-v1.5', 'AP-2024-0512-001', '同意变更，配置参数符合安全规范', '2024-05-12 14:30:00', 
                        'IOT-RCP-20240512-8821', '2024-05-15 08:00:00', 'A座1层机房'])
        writer.writerow(['EDGE-002', '科技园B区监控节点', '安防部', '视频监控组', '智能摄像头', 'v1.8.0', 
                        'CFG-v1.2', 'AP-2024-0510-015', '审批通过，人脸识别算法已更新', '2024-05-10 09:15:00', 
                        'IOT-RCP-20240510-7632', '2024-05-15 07:55:00', 'B区停车场'])
        writer.writerow(['EDGE-003', '生产车间传感器集群', '制造部', '工业物联网组', '温湿度传感器', 'v3.0.2', 
                        'CFG-v2.0', 'AP-2024-0508-008', '配置审核通过，数据采集频率合规', '2024-05-08 16:45:00', 
                        'IOT-RCP-20240508-5421', '2024-05-15 08:05:00', '2号车间A区'])
    
    bad_file = output_path / "边缘节点清册_含审批丢失问题.csv"
    with open(bad_file, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['节点ID', '节点名称', '所属部门', '责任团队', '设备类型', '固件版本', 
                        '配置版本', '审批单号', '审批意见', '审批时间', 'IoT回执ID', '最后心跳', '部署位置'])
        writer.writerow(['EDGE-001', '国贸大厦一楼网关', '运维部', '网络运维组', '工业网关', 'v2.3.1', 
                        'CFG-v1.5', 'AP-2024-0512-001', '同意变更，配置参数符合安全规范', '2024-05-12 14:30:00', 
                        'IOT-RCP-20240512-8821', '2024-05-15 08:00:00', 'A座1层机房'])
        writer.writerow(['EDGE-004', '行政楼门禁控制器', '行政部', '物业管理组', '门禁控制器', 'v1.5.0', 
                        'CFG-v1.1', 'AP-2024-0514-023', '', '2024-05-14 11:20:00', 
                        'IOT-RCP-20240514-9156', '2024-05-15 07:50:00', '行政楼大厅'])
        writer.writerow(['EDGE-005', '仓库出入口闸机', '物流部', '仓储管理组', '智能闸机', 'v2.1.0', 
                        'CFG-v1.3', '', '同意升级', '', 
                        'IOT-RCP-20240513-6734', '2024-05-15 08:10:00', '3号仓库'])
    
    click.echo(f"✅ 样例数据已生成到 {output_dir}/ 目录：")
    click.echo(f"  - {normal_file.name} (正常材料，全部通过)")
    click.echo(f"  - {bad_file.name} (含审批丢失问题，会被拦截)")


@cli.command()
@click.argument('receipt_id')
@click.option('--data-dir', '-d', default='output', help='数据目录')
def trace(receipt_id: str, data_dir: str):
    """根据IoT回执ID追溯原始记录"""
    output_path = Path(data_dir)
    found = False
    
    for result_file in output_path.glob("*_all_results.csv"):
        with open(result_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('IoT回执ID') == receipt_id:
                    click.echo(f"\n{'='*60}")
                    click.echo("追溯结果")
                    click.echo(f"{'='*60}")
                    click.echo(f"节点ID: {row['节点ID']}")
                    click.echo(f"节点名称: {row['节点名称']}")
                    click.echo(f"所属部门: {row['所属部门']}")
                    click.echo(f"责任团队: {row['责任团队']}")
                    click.echo(f"检查状态: {row['检查状态']}")
                    click.echo(f"失败原因: {row['失败原因']}")
                    click.echo(f"详细说明: {row['详细说明']}")
                    click.echo(f"规则版本: {row['规则版本']}")
                    click.echo(f"检查时间: {row['检查时间']}")
                    click.echo(f"原始数据哈希: {row['原始数据哈希']}")
                    click.echo(f"结果文件: {result_file}")
                    found = True
                    break
    
    if not found:
        click.echo(f"❌ 未找到IoT回执ID为 {receipt_id} 的记录")


if __name__ == '__main__':
    cli()

"""
报告生成模块

生成上线报告，支持按服务汇总、历史对比。
"""

import os
import json
from datetime import datetime
from typing import List, Dict, Optional
from dataclasses import dataclass, field, asdict

from .risk_analyzer import Risk, RiskLevel, RiskType, AnalysisResult
from .waiver_manager import WaiverManager, Waiver


@dataclass
class ComparisonResult:
    """对比结果"""
    fixed_risks: List[Risk] = field(default_factory=list)  # 本次未出现，上次出现的（已修复）
    new_risks: List[Risk] = field(default_factory=list)  # 本次出现，上次未出现的（新风险）
    unchanged_risks: List[Risk] = field(default_factory=list)  # 两次都出现的


@dataclass
class ScanHistory:
    """扫描历史"""
    timestamp: str
    migration_dir: str
    risks: List[Risk] = field(default_factory=list)
    
    def to_dict(self) -> Dict:
        return {
            'timestamp': self.timestamp,
            'migration_dir': self.migration_dir,
            'risks': [self._risk_to_dict(r) for r in self.risks]
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'ScanHistory':
        return cls(
            timestamp=data['timestamp'],
            migration_dir=data['migration_dir'],
            risks=[cls._dict_to_risk(r) for r in data.get('risks', [])]
        )
    
    @staticmethod
    def _risk_to_dict(risk: Risk) -> Dict:
        return {
            'risk_type': risk.risk_type.value if hasattr(risk.risk_type, 'value') else risk.risk_type,
            'level': risk.level.value if hasattr(risk.level, 'value') else risk.level,
            'description': risk.description,
            'script_version': risk.script_version,
            'script_filename': risk.script_filename,
            'service': risk.service,
            'sql_statement': risk.sql_statement,
            'table_name': risk.table_name,
            'details': risk.details,
            'hash': risk.hash
        }
    
    @staticmethod
    def _dict_to_risk(data: Dict) -> Risk:
        return Risk(
            risk_type=RiskType(data['risk_type']) if isinstance(data['risk_type'], str) else data['risk_type'],
            level=RiskLevel(data['level']) if isinstance(data['level'], str) else data['level'],
            description=data['description'],
            script_version=data['script_version'],
            script_filename=data['script_filename'],
            service=data['service'],
            sql_statement=data.get('sql_statement'),
            table_name=data.get('table_name'),
            details=data.get('details', ''),
            hash=data.get('hash', '')
        )


class ReportGenerator:
    """报告生成器"""
    
    def __init__(self, history_file: str = None):
        self.history_file = history_file or os.path.join(os.getcwd(), '.migration_scan_history.json')
        self.histories: List[ScanHistory] = []
        self._load_history()
    
    def _load_history(self) -> None:
        """加载扫描历史"""
        if not os.path.exists(self.history_file):
            return
        
        try:
            with open(self.history_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            self.histories = [ScanHistory.from_dict(h) for h in data.get('histories', [])]
        except (json.JSONDecodeError, IOError) as e:
            print(f"警告: 无法加载扫描历史 {self.history_file}: {e}")
    
    def _save_history(self) -> None:
        """保存扫描历史"""
        # 只保留最近 20 次扫描
        if len(self.histories) > 20:
            self.histories = self.histories[-20:]
        
        data = {
            'version': '1.0',
            'updated_at': datetime.now().isoformat(),
            'histories': [h.to_dict() for h in self.histories]
        }
        
        try:
            dir_path = os.path.dirname(self.history_file)
            if dir_path:
                os.makedirs(dir_path, exist_ok=True)
            with open(self.history_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except IOError as e:
            print(f"错误: 无法保存扫描历史 {self.history_file}: {e}")
    
    def add_scan_result(self, migration_dir: str, risks: List[Risk]) -> ScanHistory:
        """添加扫描结果到历史"""
        history = ScanHistory(
            timestamp=datetime.now().isoformat(),
            migration_dir=migration_dir,
            risks=risks
        )
        self.histories.append(history)
        self._save_history()
        return history
    
    def get_last_scan(self, migration_dir: str) -> Optional[ScanHistory]:
        """获取指定目录的上次扫描结果"""
        for history in reversed(self.histories):
            if history.migration_dir == migration_dir:
                return history
        return None
    
    def compare_with_last_scan(
        self, 
        migration_dir: str, 
        current_risks: List[Risk]
    ) -> ComparisonResult:
        """与上次扫描结果对比"""
        last_scan = self.get_last_scan(migration_dir)
        
        if not last_scan:
            return ComparisonResult(new_risks=current_risks)
        
        last_risk_hashes = {r.hash for r in last_scan.risks}
        current_risk_hashes = {r.hash for r in current_risks}
        
        fixed_risks = [r for r in last_scan.risks if r.hash not in current_risk_hashes]
        new_risks = [r for r in current_risks if r.hash not in last_risk_hashes]
        unchanged_risks = [r for r in current_risks if r.hash in last_risk_hashes]
        
        return ComparisonResult(
            fixed_risks=fixed_risks,
            new_risks=new_risks,
            unchanged_risks=unchanged_risks
        )
    
    def generate_console_report(
        self,
        result: AnalysisResult,
        waiver_manager: WaiverManager,
        comparison: ComparisonResult = None
    ) -> str:
        """生成控制台报告"""
        lines = []
        lines.append("=" * 60)
        lines.append("数据库迁移前置检查报告")
        lines.append("=" * 60)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # 应用豁免过滤
        filtered = waiver_manager.filter_risks(result.risks)
        active_risks = filtered['not_waived'] + filtered['expired']
        
        blockers = [r for r in active_risks if r.level == RiskLevel.BLOCKER]
        warnings = [r for r in active_risks if r.level == RiskLevel.WARNING]
        
        # 总体状态
        if blockers:
            lines.append(f"[🔴 阻断] 发现 {len(blockers)} 个必须修复的问题")
        if warnings:
            lines.append(f"[🟡 警告] 发现 {len(warnings)} 个建议关注的问题")
        if not active_risks:
            lines.append(f"[🟢 通过] 未发现需要处理的风险")
        
        if filtered['waived']:
            lines.append(f"[ℹ️ 豁免] {len(filtered['waived'])} 个风险已被豁免")
        if filtered['expired']:
            lines.append(f"[⚠️ 过期] {len(filtered['expired'])} 个豁免已过期，需要重新确认")
        
        lines.append("")
        
        # 对比信息
        if comparison:
            lines.append("-" * 60)
            lines.append("与上次扫描对比:")
            if comparison.fixed_risks:
                lines.append(f"  ✅ 已修复: {len(comparison.fixed_risks)} 个问题")
            if comparison.new_risks:
                lines.append(f"  🆕 新增: {len(comparison.new_risks)} 个问题")
            if comparison.unchanged_risks:
                lines.append(f"  🔶 未变化: {len(comparison.unchanged_risks)} 个问题")
            lines.append("")
        
        # 阻断级风险详情
        if blockers:
            lines.append("-" * 60)
            lines.append("【阻断项】必须修复后才能上线:")
            for i, risk in enumerate(blockers, 1):
                lines.append(f"  {i}. [{risk.risk_type.value}] {risk.description}")
                lines.append(f"     脚本: {risk.script_filename}")
                if risk.table_name:
                    lines.append(f"     表名: {risk.table_name}")
                lines.append(f"     服务: {risk.service}")
                if risk.details:
                    lines.append(f"     详情: {risk.details}")
                lines.append(f"     风险ID: {risk.hash[:8]}")
                lines.append("")
        
        # 警告级风险详情
        if warnings:
            lines.append("-" * 60)
            lines.append("【提醒项】建议关注:")
            for i, risk in enumerate(warnings, 1):
                lines.append(f"  {i}. [{risk.risk_type.value}] {risk.description}")
                lines.append(f"     脚本: {risk.script_filename}")
                if risk.table_name:
                    lines.append(f"     表名: {risk.table_name}")
                lines.append(f"     服务: {risk.service}")
                if risk.details:
                    lines.append(f"     详情: {risk.details}")
                lines.append(f"     风险ID: {risk.hash[:8]}")
                lines.append("")
        
        # 豁免详情
        if filtered['waived']:
            lines.append("-" * 60)
            lines.append("【豁免项】已被豁免的风险:")
            for i, risk in enumerate(filtered['waived'], 1):
                waiver = waiver_manager.get_waiver(risk.hash)
                lines.append(f"  {i}. [{risk.risk_type.value}] {risk.description}")
                lines.append(f"     脚本: {risk.script_filename}")
                if waiver:
                    lines.append(f"     豁免原因: {waiver.reason}")
                    lines.append(f"     审批人: {waiver.approved_by}")
                    lines.append(f"     到期时间: {waiver.expires_at}")
                lines.append("")
        
        # 按服务汇总
        lines.append("-" * 60)
        lines.append("【按服务汇总】")
        by_service = self._group_by_service(active_risks)
        for service, risks in sorted(by_service.items()):
            service_blockers = len([r for r in risks if r.level == RiskLevel.BLOCKER])
            service_warnings = len([r for r in risks if r.level == RiskLevel.WARNING])
            lines.append(f"  - {service}: {service_blockers} 阻断, {service_warnings} 警告")
        
        lines.append("=" * 60)
        
        return "\n".join(lines)
    
    def generate_json_report(
        self,
        result: AnalysisResult,
        waiver_manager: WaiverManager,
        comparison: ComparisonResult = None
    ) -> Dict:
        """生成 JSON 格式报告"""
        filtered = waiver_manager.filter_risks(result.risks)
        
        report = {
            'generated_at': datetime.now().isoformat(),
            'summary': {
                'total_risks': len(result.risks),
                'blockers': len([r for r in filtered['not_waived'] + filtered['expired'] 
                               if r.level == RiskLevel.BLOCKER]),
                'warnings': len([r for r in filtered['not_waived'] + filtered['expired'] 
                               if r.level == RiskLevel.WARNING]),
                'waived': len(filtered['waived']),
                'expired_waivers': len(filtered['expired']),
                'can_proceed': len([r for r in filtered['not_waived'] + filtered['expired'] 
                                  if r.level == RiskLevel.BLOCKER]) == 0
            },
            'risks': {
                'active': {
                    'blockers': [self._risk_to_dict(r) for r in filtered['not_waived'] + filtered['expired'] 
                               if r.level == RiskLevel.BLOCKER],
                    'warnings': [self._risk_to_dict(r) for r in filtered['not_waived'] + filtered['expired'] 
                               if r.level == RiskLevel.WARNING]
                },
                'waived': [self._risk_to_dict(r) for r in filtered['waived']]
            },
            'by_service': self._group_by_service_for_json(filtered['not_waived'] + filtered['expired'])
        }
        
        if comparison:
            report['comparison'] = {
                'fixed_risks': [self._risk_to_dict(r) for r in comparison.fixed_risks],
                'new_risks': [self._risk_to_dict(r) for r in comparison.new_risks],
                'unchanged_risks': [self._risk_to_dict(r) for r in comparison.unchanged_risks]
            }
        
        return report
    
    def _risk_to_dict(self, risk: Risk) -> Dict:
        return {
            'risk_type': risk.risk_type.value if hasattr(risk.risk_type, 'value') else risk.risk_type,
            'level': risk.level.value if hasattr(risk.level, 'value') else risk.level,
            'description': risk.description,
            'script_version': risk.script_version,
            'script_filename': risk.script_filename,
            'service': risk.service,
            'table_name': risk.table_name,
            'details': risk.details,
            'hash': risk.hash
        }
    
    def _group_by_service(self, risks: List[Risk]) -> Dict[str, List[Risk]]:
        by_service: Dict[str, List[Risk]] = {}
        for risk in risks:
            if risk.service not in by_service:
                by_service[risk.service] = []
            by_service[risk.service].append(risk)
        return by_service
    
    def _group_by_service_for_json(self, risks: List[Risk]) -> Dict:
        by_service: Dict[str, Dict] = {}
        for risk in risks:
            if risk.service not in by_service:
                by_service[risk.service] = {
                    'blockers': 0,
                    'warnings': 0,
                    'risks': []
                }
            
            if risk.level == RiskLevel.BLOCKER:
                by_service[risk.service]['blockers'] += 1
            else:
                by_service[risk.service]['warnings'] += 1
            
            by_service[risk.service]['risks'].append(self._risk_to_dict(risk))
        
        return by_service

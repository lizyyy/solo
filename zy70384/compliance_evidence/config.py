import yaml
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any

DEFAULT_CONFIG_FILE = "evidence-manifest.yaml"
DEFAULT_EVIDENCE_DIR = "evidence"
DEFAULT_FREEZE_DIR = ".evidence-frozen"
DEFAULT_REPORT_DIR = "reports"


class EvidenceConfig:
    def __init__(self, config_file: str = DEFAULT_CONFIG_FILE):
        self.config_file = Path(config_file)
        self.data: Dict[str, Any] = {}

    def load(self) -> Dict[str, Any]:
        if not self.config_file.exists():
            raise FileNotFoundError(f"配置文件不存在: {self.config_file}")
        
        with open(self.config_file, 'r', encoding='utf-8') as f:
            self.data = yaml.safe_load(f) or {}
        
        return self.data

    def save(self, data: Dict[str, Any]):
        self.config_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.config_file, 'w', encoding='utf-8') as f:
            yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

    def get_evidence_list(self) -> List[Dict[str, Any]]:
        return self.data.get("evidence", [])

    def get_audit_topics(self) -> List[str]:
        topics = set()
        for ev in self.get_evidence_list():
            if ev.get("audit_topic"):
                topics.add(ev["audit_topic"])
        return sorted(list(topics))


def create_sample_config() -> Dict[str, Any]:
    now = datetime.now()
    future = now + timedelta(days=90)
    past = now - timedelta(days=30)
    
    return {
        "project": "生产环境合规审计",
        "audit_period": {
            "start": (now - timedelta(days=90)).strftime("%Y-%m-%d"),
            "end": now.strftime("%Y-%m-%d")
        },
        "evidence_base_dir": "evidence",
        "evidence": [
            {
                "id": "AC-001",
                "name": "访问控制策略文档",
                "audit_topic": "访问控制",
                "type": "策略文件",
                "path": "access-control/policy.pdf",
                "description": "系统访问控制策略文档，包含角色权限定义",
                "owner": "安全团队",
                "expiry_date": future.strftime("%Y-%m-%d"),
                "required": True
            },
            {
                "id": "AC-002",
                "name": "季度权限审批记录",
                "audit_topic": "访问控制",
                "type": "审批截图",
                "path": "access-control/approval-q2.png",
                "description": "第二季度用户权限变更审批记录",
                "owner": "IT管理员",
                "expiry_date": future.strftime("%Y-%m-%d"),
                "required": True
            },
            {
                "id": "AC-003",
                "name": "离职人员权限清理记录",
                "audit_topic": "访问控制",
                "type": "整改记录",
                "path": "access-control/offboarding-cleanup.xlsx",
                "description": "离职人员账号权限清理台账",
                "owner": "人力资源",
                "expiry_date": None,
                "required": True,
                "remediation_status": "已关闭"
            },
            {
                "id": "VS-001",
                "name": "漏洞扫描报告",
                "audit_topic": "漏洞扫描",
                "type": "扫描报告",
                "path": "vulnerability-scan/report-q2.pdf",
                "description": "第二季度系统漏洞扫描报告",
                "owner": "安全团队",
                "expiry_date": future.strftime("%Y-%m-%d"),
                "required": True
            },
            {
                "id": "VS-002",
                "name": "高危漏洞整改记录",
                "audit_topic": "漏洞扫描",
                "type": "整改记录",
                "path": "vulnerability-scan/high-risk-remediation.xlsx",
                "description": "高危漏洞修复进度跟踪表",
                "owner": "开发团队",
                "expiry_date": None,
                "required": True,
                "remediation_status": "进行中"
            },
            {
                "id": "VS-003",
                "name": "漏洞扫描工具配置",
                "audit_topic": "漏洞扫描",
                "type": "策略文件",
                "path": "vulnerability-scan/scanner-config.json",
                "description": "漏洞扫描工具的扫描策略配置",
                "owner": "安全团队",
                "expiry_date": past.strftime("%Y-%m-%d"),
                "required": True
            },
            {
                "id": "CR-001",
                "name": "生产变更审批流程",
                "audit_topic": "变更审批",
                "type": "策略文件",
                "path": "change-control/approval-process.pdf",
                "description": "生产环境变更审批流程文档",
                "owner": "运维团队",
                "expiry_date": future.strftime("%Y-%m-%d"),
                "required": True
            },
            {
                "id": "CR-002",
                "name": "月度变更审批记录",
                "audit_topic": "变更审批",
                "type": "审批截图",
                "path": "change-control/approvals-may.png",
                "description": "5月份生产变更审批单截图",
                "owner": "运维团队",
                "expiry_date": None,
                "required": True
            },
            {
                "id": "CR-003",
                "name": "紧急变更例外审批",
                "audit_topic": "变更审批",
                "type": "审批截图",
                "path": "change-control/emergency-change.png",
                "description": "紧急变更例外审批记录",
                "owner": "",
                "expiry_date": None,
                "required": False
            }
        ]
    }

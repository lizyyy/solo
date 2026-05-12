import os
import json
from pathlib import Path
from typing import Dict, Any, Optional
from .models import MaterialRequirement, MaterialType


DEFAULT_REQUIREMENTS = [
    MaterialRequirement(
        name="投标报价单",
        type=MaterialType.QUOTATION,
        pattern="*报价*",
        description="包含详细报价金额的文件"
    ),
    MaterialRequirement(
        name="报价汇总表",
        type=MaterialType.QUOTATION,
        pattern="*汇总*",
        description="报价金额汇总表"
    ),
    MaterialRequirement(
        name="营业执照",
        type=MaterialType.QUALIFICATION,
        pattern="*营业执照*",
        description="企业营业执照副本"
    ),
    MaterialRequirement(
        name="资质证书",
        type=MaterialType.QUALIFICATION,
        pattern="*资质*",
        description="相关资质证明文件"
    ),
    MaterialRequirement(
        name="授权委托书",
        type=MaterialType.AUTHORIZATION,
        pattern="*授权*",
        description="法人授权委托书"
    ),
    MaterialRequirement(
        name="盖章页/骑缝章",
        type=MaterialType.SEAL_PAGE,
        pattern="*盖章*",
        description="需要盖章的文件页面"
    ),
    MaterialRequirement(
        name="版本说明",
        type=MaterialType.VERSION_DOC,
        pattern="*版本*",
        description="版本变更说明文档"
    )
]


class ConfigManager:
    def __init__(self, project_dir: str):
        self.project_dir = Path(project_dir)
        self.config_file = self.project_dir / ".bid-checker" / "config.json"
        self.state_file = self.project_dir / ".bid-checker" / "state.json"
        self.history_file = self.project_dir / ".bid-checker" / "history.json"

    def init_project(self, project_name: str = "投标项目") -> Dict[str, Any]:
        bid_dir = self.project_dir / ".bid-checker"
        bid_dir.mkdir(parents=True, exist_ok=True)

        config = {
            "project_name": project_name,
            "requirements": [r.model_dump() for r in DEFAULT_REQUIREMENTS],
            "rules": {
                "must_have_seal": True,
                "check_version_consistency": True,
                "check_amount_consistency": True,
                "required_materials_cannot_waive": True
            },
            "operators": []
        }

        state = {
            "initialized": True,
            "last_check": None,
            "status": "pending",
            "materials": [],
            "versions": [],
            "check_results": []
        }

        self.config_file.write_text(json.dumps(config, ensure_ascii=False, indent=2))
        self.state_file.write_text(json.dumps(state, ensure_ascii=False, indent=2))
        self.history_file.write_text(json.dumps([], ensure_ascii=False, indent=2))

        return config

    def is_initialized(self) -> bool:
        return self.config_file.exists() and self.state_file.exists()

    def get_config(self) -> Dict[str, Any]:
        if not self.config_file.exists():
            return {}
        return json.loads(self.config_file.read_text())

    def get_state(self) -> Dict[str, Any]:
        if not self.state_file.exists():
            return {}
        return json.loads(self.state_file.read_text())

    def save_state(self, state: Dict[str, Any]) -> None:
        self.state_file.write_text(json.dumps(state, ensure_ascii=False, indent=2))

    def get_history(self) -> list:
        if not self.history_file.exists():
            return []
        return json.loads(self.history_file.read_text())

    def add_history(self, entry: Dict[str, Any]) -> None:
        history = self.get_history()
        history.append(entry)
        self.history_file.write_text(json.dumps(history, ensure_ascii=False, indent=2))

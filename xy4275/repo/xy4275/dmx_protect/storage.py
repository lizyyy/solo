"""
状态存储模块

用于管理项目数据的持久化存储，包括配置、CUE、灯具、修改记录和问题。
"""

import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List

from .models import (
    Cue, Fixture, Modification, ChannelChange, Issue, ProjectData, TheaterConfig,
    TriggerType, FixtureType, IssueType, Severity, ReviewDecision
)
from .parser import CueParser, FixtureParser, ModificationParser


class Storage:
    """存储管理器"""
    
    CONFIG_FILE = "config.json"
    CUES_FILE = "cues.json"
    FIXTURES_FILE = "fixtures.json"
    MODIFICATIONS_FILE = "modifications.json"
    ISSUES_FILE = "issues.json"
    
    def __init__(self, config_dir: Optional[str] = None):
        if config_dir is None:
            self.config_dir = Path.home() / ".dmx-protect"
        else:
            self.config_dir = Path(config_dir)
        
        self._ensure_dir_exists()
    
    def _ensure_dir_exists(self):
        """确保配置目录存在"""
        self.config_dir.mkdir(parents=True, exist_ok=True)
    
    def save_config(self, config: TheaterConfig) -> bool:
        """保存剧场配置"""
        file_path = self.config_dir / self.CONFIG_FILE
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(config.to_dict(), f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"保存配置失败: {e}")
            return False
    
    def load_config(self) -> Optional[TheaterConfig]:
        """加载剧场配置"""
        file_path = self.config_dir / self.CONFIG_FILE
        if not file_path.exists():
            return None
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return TheaterConfig.from_dict(data)
        except Exception as e:
            print(f"加载配置失败: {e}")
            return None
    
    def save_cues(self, cues: List[Cue]) -> bool:
        """保存 CUE 列表"""
        file_path = self.config_dir / self.CUES_FILE
        try:
            cues_data = [cue.to_dict() for cue in cues]
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump({"cues": cues_data}, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"保存 CUE 失败: {e}")
            return False
    
    def load_cues(self) -> List[Cue]:
        """加载 CUE 列表"""
        file_path = self.config_dir / self.CUES_FILE
        if not file_path.exists():
            return []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            cues_data = data.get("cues", [])
            return [self._dict_to_cue(cd) for cd in cues_data]
        except Exception as e:
            print(f"加载 CUE 失败: {e}")
            return []
    
    def _dict_to_cue(self, data: Dict[str, Any]) -> Cue:
        """将字典转换为 Cue 对象"""
        return Cue(
            cue_number=data["cue_number"],
            description=data["description"],
            trigger_type=TriggerType(data["trigger_type"]),
            trigger_value=float(data["trigger_value"]),
            duration=float(data["duration"]),
            channels={int(k): v for k, v in data["channels"].items()} if data.get("channels") else {}
        )
    
    def save_fixtures(self, fixtures: List[Fixture]) -> bool:
        """保存灯具列表"""
        file_path = self.config_dir / self.FIXTURES_FILE
        try:
            fixtures_data = [f.to_dict() for f in fixtures]
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump({"fixtures": fixtures_data}, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"保存灯具失败: {e}")
            return False
    
    def load_fixtures(self) -> List[Fixture]:
        """加载灯具列表"""
        file_path = self.config_dir / self.FIXTURES_FILE
        if not file_path.exists():
            return []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            fixtures_data = data.get("fixtures", [])
            return [self._dict_to_fixture(fd) for fd in fixtures_data]
        except Exception as e:
            print(f"加载灯具失败: {e}")
            return []
    
    def _dict_to_fixture(self, data: Dict[str, Any]) -> Fixture:
        """将字典转换为 Fixture 对象"""
        return Fixture(
            id=data["id"],
            name=data["name"],
            type=FixtureType(data["type"]),
            start_channel=int(data["start_channel"]),
            channel_count=int(data["channel_count"]),
            channels=data.get("channels", {}),
            requires_confirmation=bool(data.get("requires_confirmation", False))
        )
    
    def save_modifications(self, modifications: List[Modification]) -> bool:
        """保存修改记录列表"""
        file_path = self.config_dir / self.MODIFICATIONS_FILE
        try:
            mods_data = [m.to_dict() for m in modifications]
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump({"modifications": mods_data}, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"保存修改记录失败: {e}")
            return False
    
    def load_modifications(self) -> List[Modification]:
        """加载修改记录列表"""
        file_path = self.config_dir / self.MODIFICATIONS_FILE
        if not file_path.exists():
            return []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            mods_data = data.get("modifications", [])
            return [self._dict_to_modification(md) for md in mods_data]
        except Exception as e:
            print(f"加载修改记录失败: {e}")
            return []
    
    def _dict_to_modification(self, data: Dict[str, Any]) -> Modification:
        """将字典转换为 Modification 对象"""
        changes = [
            ChannelChange(
                channel=int(c["channel"]),
                old_value=int(c["old_value"]),
                new_value=int(c["new_value"]),
                reason=c.get("reason", "")
            )
            for c in data.get("changes", [])
        ]
        
        modified_at = datetime.now()
        if data.get("modified_at"):
            try:
                modified_at = datetime.fromisoformat(data["modified_at"])
            except ValueError:
                pass
        
        return Modification(
            id=data["id"],
            cue_number=data["cue_number"],
            modified_at=modified_at,
            modified_by=data.get("modified_by", ""),
            changes=changes,
            confirmed=bool(data.get("confirmed", False))
        )
    
    def save_issues(self, issues: List[Issue]) -> bool:
        """保存问题列表"""
        file_path = self.config_dir / self.ISSUES_FILE
        try:
            issues_data = [i.to_dict() for i in issues]
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump({"issues": issues_data}, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"保存问题失败: {e}")
            return False
    
    def load_issues(self) -> List[Issue]:
        """加载问题列表"""
        file_path = self.config_dir / self.ISSUES_FILE
        if not file_path.exists():
            return []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            issues_data = data.get("issues", [])
            return [self._dict_to_issue(id) for id in issues_data]
        except Exception as e:
            print(f"加载问题失败: {e}")
            return []
    
    def _dict_to_issue(self, data: Dict[str, Any]) -> Issue:
        """将字典转换为 Issue 对象"""
        reviewed_at = None
        if data.get("reviewed_at"):
            try:
                reviewed_at = datetime.fromisoformat(data["reviewed_at"])
            except ValueError:
                pass
        
        return Issue(
            id=data["id"],
            type=IssueType(data["type"]),
            severity=Severity(data["severity"]),
            title=data["title"],
            description=data["description"],
            affected_cues=data.get("affected_cues", []),
            affected_channels=data.get("affected_channels", []),
            details=data.get("details", {}),
            review_decision=ReviewDecision(data.get("review_decision", "pending")),
            review_comment=data.get("review_comment", ""),
            reviewed_at=reviewed_at,
            reviewed_by=data.get("reviewed_by", "")
        )
    
    def load_project_data(self) -> ProjectData:
        """加载完整的项目数据"""
        config = self.load_config()
        if config is None:
            config = TheaterConfig(name="未命名剧场")
        
        return ProjectData(
            config=config,
            cues=self.load_cues(),
            fixtures=self.load_fixtures(),
            modifications=self.load_modifications(),
            issues=self.load_issues()
        )
    
    def save_project_data(self, project: ProjectData) -> bool:
        """保存完整的项目数据"""
        success = True
        if project.config:
            success &= self.save_config(project.config)
        success &= self.save_cues(project.cues)
        success &= self.save_fixtures(project.fixtures)
        success &= self.save_modifications(project.modifications)
        success &= self.save_issues(project.issues)
        return success
    
    def import_cues_from_csv(self, csv_path: str) -> bool:
        """从 CSV 文件导入 CUE"""
        try:
            cues = CueParser.parse_file(csv_path)
            existing = self.load_cues()
            
            existing_numbers = {c.cue_number for c in existing}
            for cue in cues:
                if cue.cue_number in existing_numbers:
                    existing = [c for c in existing if c.cue_number != cue.cue_number]
                existing.append(cue)
            
            return self.save_cues(existing)
        except Exception as e:
            print(f"导入 CUE CSV 失败: {e}")
            return False
    
    def import_fixtures_from_json(self, json_path: str) -> bool:
        """从 JSON 文件导入灯具"""
        try:
            fixtures = FixtureParser.parse_file(json_path)
            existing = self.load_fixtures()
            
            existing_ids = {f.id for f in existing}
            for fixture in fixtures:
                if fixture.id in existing_ids:
                    existing = [f for f in existing if f.id != fixture.id]
                existing.append(fixture)
            
            return self.save_fixtures(existing)
        except Exception as e:
            print(f"导入灯具 JSON 失败: {e}")
            return False
    
    def import_modifications_from_json(self, json_path: str) -> bool:
        """从 JSON 文件导入修改记录"""
        try:
            modifications = ModificationParser.parse_file(json_path)
            existing = self.load_modifications()
            
            existing_ids = {m.id for m in existing}
            for mod in modifications:
                if mod.id in existing_ids:
                    existing = [m for m in existing if m.id != mod.id]
                existing.append(mod)
            
            return self.save_modifications(existing)
        except Exception as e:
            print(f"导入修改记录 JSON 失败: {e}")
            return False
    
    def backup(self, backup_name: Optional[str] = None) -> Optional[str]:
        """创建备份"""
        if backup_name is None:
            backup_name = f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        backup_dir = self.config_dir / "backups" / backup_name
        backup_dir.mkdir(parents=True, exist_ok=True)
        
        files_to_backup = [
            self.CONFIG_FILE,
            self.CUES_FILE,
            self.FIXTURES_FILE,
            self.MODIFICATIONS_FILE,
            self.ISSUES_FILE,
        ]
        
        for filename in files_to_backup:
            src = self.config_dir / filename
            if src.exists():
                dst = backup_dir / filename
                shutil.copy2(src, dst)
        
        return str(backup_dir)
    
    def clear_all(self) -> bool:
        """清空所有数据"""
        files_to_clear = [
            self.CONFIG_FILE,
            self.CUES_FILE,
            self.FIXTURES_FILE,
            self.MODIFICATIONS_FILE,
            self.ISSUES_FILE,
        ]
        
        for filename in files_to_clear:
            file_path = self.config_dir / filename
            if file_path.exists():
                try:
                    file_path.unlink()
                except Exception as e:
                    print(f"删除文件失败: {filename} - {e}")
                    return False
        
        return True

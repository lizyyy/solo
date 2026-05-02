import os
import json
import shutil
from datetime import datetime
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Any
from pathlib import Path

from ..parsers.account import AccountRecord
from ..parsers.ldap import LDAPGroup
from ..parsers.asset import AssetRecord
from ..parsers.sudoers import SudoersRule


@dataclass
class ImportedData:
    source_type: str
    source_file: str
    import_time: str
    records_count: int
    import_metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source_type": self.source_type,
            "source_file": self.source_file,
            "import_time": self.import_time,
            "records_count": self.records_count,
            "import_metadata": self.import_metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ImportedData":
        return cls(
            source_type=data.get("source_type", ""),
            source_file=data.get("source_file", ""),
            import_time=data.get("import_time", ""),
            records_count=data.get("records_count", 0),
            import_metadata=data.get("import_metadata", {}),
        )


class DataStore:
    STATE_FILENAME = "state.json"
    IMPORTS_FILENAME = "imports.json"

    SOURCE_TYPE_ACCOUNT = "account"
    SOURCE_TYPE_LDAP = "ldap"
    SOURCE_TYPE_ASSET = "asset"
    SOURCE_TYPE_SUDOERS = "sudoers"

    def __init__(self, state_dir: str, imports_dir: str):
        self.state_dir = os.path.abspath(state_dir)
        self.imports_dir = os.path.abspath(imports_dir)
        self._accounts: List[AccountRecord] = []
        self._ldap_groups: List[LDAPGroup] = []
        self._assets: List[AssetRecord] = []
        self._sudoers_rules: List[SudoersRule] = []
        self._import_history: List[ImportedData] = []

    def _ensure_dirs(self) -> None:
        os.makedirs(self.state_dir, exist_ok=True)
        os.makedirs(self.imports_dir, exist_ok=True)

    def import_file(self, source_type: str, source_path: str, records: Any) -> ImportedData:
        self._ensure_dirs()
        source_path = os.path.abspath(source_path)
        filename = os.path.basename(source_path)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        archive_filename = f"{timestamp}_{filename}"
        archive_path = os.path.join(self.imports_dir, archive_filename)
        
        shutil.copy2(source_path, archive_path)

        count = 0
        if isinstance(records, list):
            count = len(records)

        imported = ImportedData(
            source_type=source_type,
            source_file=archive_filename,
            import_time=datetime.now().isoformat(),
            records_count=count,
            import_metadata={
                "original_path": source_path,
                "archive_path": archive_path,
            },
        )

        self._import_history.append(imported)
        self._save_import_history()

        if source_type == self.SOURCE_TYPE_ACCOUNT:
            self._accounts = records
        elif source_type == self.SOURCE_TYPE_LDAP:
            self._ldap_groups = records
        elif source_type == self.SOURCE_TYPE_ASSET:
            self._assets = records
        elif source_type == self.SOURCE_TYPE_SUDOERS:
            self._sudoers_rules = records

        self._save_state()

        return imported

    @property
    def accounts(self) -> List[AccountRecord]:
        if not self._accounts:
            self._load_state()
        return self._accounts

    @property
    def ldap_groups(self) -> List[LDAPGroup]:
        if not self._ldap_groups:
            self._load_state()
        return self._ldap_groups

    @property
    def assets(self) -> List[AssetRecord]:
        if not self._assets:
            self._load_state()
        return self._assets

    @property
    def sudoers_rules(self) -> List[SudoersRule]:
        if not self._sudoers_rules:
            self._load_state()
        return self._sudoers_rules

    @property
    def import_history(self) -> List[ImportedData]:
        if not self._import_history:
            self._load_import_history()
        return self._import_history

    def get_last_import(self, source_type: str) -> Optional[ImportedData]:
        for item in reversed(self.import_history):
            if item.source_type == source_type:
                return item
        return None

    def _save_state(self) -> None:
        state_path = os.path.join(self.state_dir, self.STATE_FILENAME)
        
        state = {
            "accounts": [r.to_dict() for r in self._accounts],
            "ldap_groups": [g.to_dict() for g in self._ldap_groups],
            "assets": [a.to_dict() for a in self._assets],
            "sudoers_rules": [r.to_dict() for r in self._sudoers_rules],
            "saved_at": datetime.now().isoformat(),
        }

        with open(state_path, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)

    def _load_state(self) -> None:
        state_path = os.path.join(self.state_dir, self.STATE_FILENAME)
        
        if not os.path.exists(state_path):
            return

        with open(state_path, "r", encoding="utf-8") as f:
            state = json.load(f)

        self._accounts = [AccountRecord.from_dict(r) for r in state.get("accounts", [])]
        self._ldap_groups = [LDAPGroup.from_dict(g) for g in state.get("ldap_groups", [])]
        self._assets = [AssetRecord.from_dict(a) for a in state.get("assets", [])]
        self._sudoers_rules = [SudoersRule.from_dict(r) for r in state.get("sudoers_rules", [])]

    def _save_import_history(self) -> None:
        imports_path = os.path.join(self.state_dir, self.IMPORTS_FILENAME)
        
        data = {
            "imports": [i.to_dict() for i in self._import_history],
            "updated_at": datetime.now().isoformat(),
        }

        with open(imports_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _load_import_history(self) -> None:
        imports_path = os.path.join(self.state_dir, self.IMPORTS_FILENAME)
        
        if not os.path.exists(imports_path):
            return

        with open(imports_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self._import_history = [ImportedData.from_dict(i) for i in data.get("imports", [])]

    def has_all_sources(self) -> bool:
        return (
            len(self.accounts) > 0
            and len(self.ldap_groups) > 0
            and len(self.assets) > 0
            and len(self.sudoers_rules) > 0
        )

    def get_missing_sources(self) -> List[str]:
        missing = []
        if len(self.accounts) == 0:
            missing.append(self.SOURCE_TYPE_ACCOUNT)
        if len(self.ldap_groups) == 0:
            missing.append(self.SOURCE_TYPE_LDAP)
        if len(self.assets) == 0:
            missing.append(self.SOURCE_TYPE_ASSET)
        if len(self.sudoers_rules) == 0:
            missing.append(self.SOURCE_TYPE_SUDOERS)
        return missing

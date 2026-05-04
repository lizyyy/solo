import csv
import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Optional


class RoleType(str, Enum):
    PLAINTIFF = "plaintiff"
    DEFENDANT = "defendant"
    JUDGE = "judge"


class VisibilityLevel(str, Enum):
    PLAINTIFF_ONLY = "plaintiff_only"
    DEFENDANT_ONLY = "defendant_only"
    JUDGE_ONLY = "judge_only"
    ALL = "all"


@dataclass
class Participant:
    id: str
    name: str
    role: str
    id_card: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    is_witness: bool = False
    is_authorized: bool = True
    cross_references: list[str] = field(default_factory=list)


@dataclass
class EvidenceItem:
    id: str
    filename: str
    category: str
    visibility: VisibilityLevel = VisibilityLevel.ALL
    description: str = ""
    file_type: str = ""


@dataclass
class RedactionRule:
    id: str
    rule_type: str
    pattern: str
    replacement: str
    description: str = ""
    enabled: bool = True
    priority: int = 0


@dataclass
class RedactionMap:
    original: str
    redacted: str
    context: str
    rule_id: str
    file_path: str
    line_number: Optional[int] = None
    char_offset: Optional[int] = None
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class CaseConfig:
    manifest_path: Path
    evidence_dir: Path
    participants_path: Optional[Path] = None
    rules_path: Optional[Path] = None
    output_path: Path = field(default_factory=lambda: Path("./output"))
    case_id: str = ""
    case_name: str = ""
    court_name: str = ""
    judge_name: str = ""
    hearing_date: Optional[datetime] = None


class DataLoader:
    @staticmethod
    def load_yaml(path: Path) -> dict[str, Any]:
        try:
            import yaml
            with open(path, "r", encoding="utf-8") as f:
                return yaml.safe_load(f) or {}
        except ImportError:
            raise ImportError("请安装 pyyaml: pip install pyyaml")

    @staticmethod
    def load_csv(path: Path) -> list[dict[str, str]]:
        with open(path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            return list(reader)

    @staticmethod
    def load_json(path: Path) -> Any:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    @staticmethod
    def parse_visibility(value: str) -> VisibilityLevel:
        mapping = {
            "plaintiff": VisibilityLevel.PLAINTIFF_ONLY,
            "defendant": VisibilityLevel.DEFENDANT_ONLY,
            "judge": VisibilityLevel.JUDGE_ONLY,
            "all": VisibilityLevel.ALL,
            "plaintiff_only": VisibilityLevel.PLAINTIFF_ONLY,
            "defendant_only": VisibilityLevel.DEFENDANT_ONLY,
            "judge_only": VisibilityLevel.JUDGE_ONLY,
        }
        return mapping.get(value.lower(), VisibilityLevel.ALL)


class ManifestLoader:
    def __init__(self, path: Path):
        self.path = path
        self.data = DataLoader.load_yaml(path)

    def get_case_info(self) -> dict[str, Any]:
        return self.data.get("case", {})

    def get_evidence_items(self) -> list[EvidenceItem]:
        items = []
        evidence_list = self.data.get("evidence", [])
        
        for idx, item in enumerate(evidence_list, 1):
            file_type = ""
            filename = item.get("filename", "")
            if "." in filename:
                file_type = filename.split(".")[-1].lower()

            items.append(EvidenceItem(
                id=item.get("id", f"EV-{idx:03d}"),
                filename=filename,
                category=item.get("category", "其他"),
                visibility=DataLoader.parse_visibility(item.get("visibility", "all")),
                description=item.get("description", ""),
                file_type=file_type,
            ))
        return items

    def get_all_filenames(self) -> list[str]:
        return [item.filename for item in self.get_evidence_items()]


class ParticipantsLoader:
    def __init__(self, path: Optional[Path]):
        self.path = path
        self.data: list[dict[str, str]] = []
        if path:
            self.data = DataLoader.load_csv(path)

    def get_participants(self) -> list[Participant]:
        participants = []
        name_count: dict[str, int] = {}
        
        for idx, row in enumerate(self.data, 1):
            name = row.get("姓名", row.get("name", f"未知-{idx}"))
            
            if name in name_count:
                name_count[name] += 1
            else:
                name_count[name] = 0
            
            unique_id = row.get("id", row.get("编号", f"P-{idx:03d}"))
            if name_count[name] > 0:
                unique_id = f"{unique_id}-{name_count[name]}"

            role = row.get("角色", row.get("role", "其他"))
            is_witness = role == "证人" or row.get("is_witness", "").lower() == "true"
            is_authorized = row.get("授权", row.get("authorized", "是")).lower() in ["是", "true", "yes", "1"]
            
            cross_refs = []
            if "交叉引用" in row or "cross_references" in row:
                ref_str = row.get("交叉引用", row.get("cross_references", ""))
                if ref_str:
                    cross_refs = [r.strip() for r in ref_str.split(";") if r.strip()]

            participants.append(Participant(
                id=unique_id,
                name=name,
                role=role,
                id_card=row.get("身份证号", row.get("id_card", None)),
                phone=row.get("手机号", row.get("phone", None)),
                address=row.get("地址", row.get("address", None)),
                is_witness=is_witness,
                is_authorized=is_authorized,
                cross_references=cross_refs,
            ))
        
        return participants

    def get_duplicate_names(self) -> dict[str, list[str]]:
        name_map: dict[str, list[str]] = {}
        for p in self.get_participants():
            if p.name not in name_map:
                name_map[p.name] = []
            name_map[p.name].append(p.id)
        return {name: ids for name, ids in name_map.items() if len(ids) > 1}

    def get_unauthorized_witnesses(self) -> list[Participant]:
        return [
            p for p in self.get_participants()
            if p.is_witness and not p.is_authorized
        ]


class RedactRulesLoader:
    def __init__(self, path: Optional[Path]):
        self.path = path
        self.data: dict[str, Any] = {}
        if path:
            self.data = DataLoader.load_yaml(path)

    def get_rules(self) -> list[RedactionRule]:
        rules = []
        rules_list = self.data.get("rules", [])
        
        for idx, rule_data in enumerate(rules_list, 1):
            rules.append(RedactionRule(
                id=rule_data.get("id", f"R-{idx:03d}"),
                rule_type=rule_data.get("type", "regex"),
                pattern=rule_data.get("pattern", ""),
                replacement=rule_data.get("replacement", "***"),
                description=rule_data.get("description", ""),
                enabled=rule_data.get("enabled", True),
                priority=rule_data.get("priority", 0),
            ))
        
        return rules

    def get_enabled_rules(self) -> list[RedactionRule]:
        return [r for r in self.get_rules() if r.enabled]

    def get_missing_rule_warnings(self, participants: list[Participant]) -> list[str]:
        warnings = []
        rules = self.get_rules()
        rule_patterns = [r.pattern for r in rules if r.enabled]
        
        has_id_rule = any("身份证" in r.description or "id" in r.rule_type.lower() for r in rules)
        has_phone_rule = any("手机" in r.description or "phone" in r.rule_type.lower() for r in rules)
        has_address_rule = any("住址" in r.description or "address" in r.rule_type.lower() for r in rules)
        
        for p in participants:
            if p.id_card and not has_id_rule:
                warnings.append(f"参与者 {p.name} ({p.id}) 包含身份证号，但未配置身份证脱敏规则")
            if p.phone and not has_phone_rule:
                warnings.append(f"参与者 {p.name} ({p.id}) 包含手机号，但未配置手机号脱敏规则")
            if p.address and not has_address_rule:
                warnings.append(f"参与者 {p.name} ({p.id}) 包含地址信息，但未配置地址脱敏规则")
        
        return warnings

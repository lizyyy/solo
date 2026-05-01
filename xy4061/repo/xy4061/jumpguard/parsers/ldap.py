import csv
import os
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Set


@dataclass
class LDAPGroup:
    group_name: str
    members: List[str] = field(default_factory=list)
    description: str = ""
    source_file: str = ""
    is_valid: bool = True
    validation_errors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "group_name": self.group_name,
            "members": self.members,
            "description": self.description,
            "source_file": self.source_file,
            "is_valid": self.is_valid,
            "validation_errors": self.validation_errors,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "LDAPGroup":
        return cls(
            group_name=data.get("group_name", ""),
            members=data.get("members", []),
            description=data.get("description", ""),
            source_file=data.get("source_file", ""),
            is_valid=data.get("is_valid", True),
            validation_errors=data.get("validation_errors", []),
        )


class LDAPParser:
    FORMAT_AUTO = "auto"
    FORMAT_CSV_GROUP_MEMBER = "csv_group_member"
    FORMAT_CSV_GROUP_MEMBERS = "csv_group_members"
    FORMAT_LDIF = "ldif"
    FORMAT_TEXT_LIST = "text_list"

    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.group_mapping = self.config.get("group_mapping", {})

    def parse_file(self, file_path: str, format_type: str = FORMAT_AUTO) -> List[LDAPGroup]:
        file_path = os.path.abspath(file_path)
        file_name = os.path.basename(file_path)

        if format_type == self.FORMAT_AUTO:
            format_type = self._detect_format(file_path)

        if format_type == self.FORMAT_CSV_GROUP_MEMBER:
            return self._parse_csv_group_member(file_path, file_name)
        elif format_type == self.FORMAT_CSV_GROUP_MEMBERS:
            return self._parse_csv_group_members(file_path, file_name)
        elif format_type == self.FORMAT_LDIF:
            return self._parse_ldif(file_path, file_name)
        elif format_type == self.FORMAT_TEXT_LIST:
            return self._parse_text_list(file_path, file_name)
        else:
            raise ValueError(f"Unknown format: {format_type}")

    def _detect_format(self, file_path: str) -> str:
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext == ".ldif":
            return self.FORMAT_LDIF
        
        with open(file_path, "r", encoding="utf-8-sig") as f:
            first_line = f.readline().strip()
            f.seek(0)
            sample = f.read(2048)
        
        if "dn:" in sample and "objectClass:" in sample:
            return self.FORMAT_LDIF
        
        if first_line.startswith("#") or ":" in first_line:
            return self.FORMAT_TEXT_LIST
        
        if "," in first_line:
            headers = [h.strip().lower() for h in first_line.split(",")]
            if "group" in headers and "member" in headers:
                return self.FORMAT_CSV_GROUP_MEMBER
            if "members" in headers:
                return self.FORMAT_CSV_GROUP_MEMBERS
            return self.FORMAT_CSV_GROUP_MEMBER
        
        return self.FORMAT_TEXT_LIST

    def _parse_csv_group_member(self, file_path: str, source_file: str) -> List[LDAPGroup]:
        groups: Dict[str, LDAPGroup] = {}
        
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                normalized = {k.strip().lower(): v.strip() for k, v in row.items()}
                
                group_name = normalized.get("group", "") or normalized.get("groupname", "") or normalized.get("cn", "")
                member = normalized.get("member", "") or normalized.get("username", "") or normalized.get("user", "")
                
                if not group_name:
                    continue
                
                if group_name not in groups:
                    groups[group_name] = LDAPGroup(
                        group_name=group_name,
                        members=[],
                        description=normalized.get("description", ""),
                        source_file=source_file,
                    )
                
                if member and member not in groups[group_name].members:
                    groups[group_name].members.append(member)
        
        return list(groups.values())

    def _parse_csv_group_members(self, file_path: str, source_file: str) -> List[LDAPGroup]:
        groups: List[LDAPGroup] = []
        
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                normalized = {k.strip().lower(): v.strip() for k, v in row.items()}
                
                group_name = normalized.get("group", "") or normalized.get("groupname", "") or normalized.get("cn", "")
                members_str = normalized.get("members", "")
                
                if not group_name:
                    continue
                
                members = [m.strip() for m in members_str.split(";") if m.strip()]
                if not members:
                    members = [m.strip() for m in members_str.split(",") if m.strip()]
                
                groups.append(LDAPGroup(
                    group_name=group_name,
                    members=members,
                    description=normalized.get("description", ""),
                    source_file=source_file,
                ))
        
        return groups

    def _parse_ldif(self, file_path: str, source_file: str) -> List[LDAPGroup]:
        groups: List[LDAPGroup] = []
        current_group: Optional[Dict] = None
        
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.rstrip()
                
                if not line or line.startswith("#"):
                    if current_group:
                        groups.append(LDAPGroup(
                            group_name=current_group.get("cn", ""),
                            members=current_group.get("members", []),
                            description=current_group.get("description", ""),
                            source_file=source_file,
                        ))
                        current_group = None
                    continue
                
                if line.startswith("dn:"):
                    if current_group:
                        groups.append(LDAPGroup(
                            group_name=current_group.get("cn", ""),
                            members=current_group.get("members", []),
                            description=current_group.get("description", ""),
                            source_file=source_file,
                        ))
                    current_group = {"cn": "", "members": [], "description": ""}
                    continue
                
                if current_group is None:
                    continue
                
                if ":" in line:
                    key, value = line.split(":", 1)
                    key = key.strip().lower()
                    value = value.strip()
                    
                    if key == "cn":
                        current_group["cn"] = value
                    elif key == "description":
                        current_group["description"] = value
                    elif key in ["member", "uniquemember", "memberuid"]:
                        member = self._extract_member_uid(value)
                        if member and member not in current_group["members"]:
                            current_group["members"].append(member)
        
        if current_group and current_group.get("cn"):
            groups.append(LDAPGroup(
                group_name=current_group.get("cn", ""),
                members=current_group.get("members", []),
                description=current_group.get("description", ""),
                source_file=source_file,
            ))
        
        return groups

    def _extract_member_uid(self, value: str) -> str:
        if "=" in value and "," in value:
            for part in value.split(","):
                if "=" in part:
                    k, v = part.split("=", 1)
                    if k.strip().lower() in ["cn", "uid"]:
                        return v.strip()
        return value.strip()

    def _parse_text_list(self, file_path: str, source_file: str) -> List[LDAPGroup]:
        groups: List[LDAPGroup] = []
        current_group: Optional[LDAPGroup] = None
        
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                
                if not line or line.startswith("#"):
                    continue
                
                if line.endswith(":") or (":" in line and not line.startswith(" ")):
                    if current_group:
                        groups.append(current_group)
                    
                    if ":" in line:
                        group_name, rest = line.split(":", 1)
                        group_name = group_name.strip()
                        description = rest.strip()
                    else:
                        group_name = line.rstrip(":")
                        description = ""
                    
                    current_group = LDAPGroup(
                        group_name=group_name,
                        members=[],
                        description=description,
                        source_file=source_file,
                    )
                    continue
                
                if current_group:
                    member = line.strip()
                    if member and member not in current_group.members:
                        current_group.members.append(member)
        
        if current_group:
            groups.append(current_group)
        
        return groups

    def get_all_members(self, groups: List[LDAPGroup]) -> Set[str]:
        members: Set[str] = set()
        for group in groups:
            members.update(group.members)
        return members

    def get_groups_for_member(self, groups: List[LDAPGroup], username: str) -> List[str]:
        return [g.group_name for g in groups if username in g.members]

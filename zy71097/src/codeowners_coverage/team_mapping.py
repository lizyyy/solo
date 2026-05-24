import yaml
from pathlib import Path
from typing import Dict, List, Optional, Set
from dataclasses import dataclass, field


@dataclass
class TeamMapping:
    aliases: Dict[str, List[str]] = field(default_factory=dict)
    renames: Dict[str, str] = field(default_factory=dict)
    invalid_owners: List[str] = field(default_factory=list)

    def expand_owner(self, owner: str) -> List[str]:
        if owner in self.renames:
            owner = self.renames[owner]

        if owner in self.aliases:
            expanded = []
            for alias_target in self.aliases[owner]:
                expanded.extend(self.expand_owner(alias_target))
            return list(dict.fromkeys(expanded))

        return [owner]

    def expand_owners(self, owners: List[str]) -> List[str]:
        expanded = []
        for owner in owners:
            expanded.extend(self.expand_owner(owner))
        return list(dict.fromkeys(expanded))

    def get_canonical_name(self, owner: str) -> str:
        while owner in self.renames:
            owner = self.renames[owner]
        return owner

    def validate_owners(self, owners: List[str], valid_teams: Set[str]) -> List[str]:
        invalid = []
        for owner in owners:
            canonical = self.get_canonical_name(owner)
            if canonical not in valid_teams and canonical not in self.aliases:
                invalid.append(owner)
        return invalid


class TeamMappingLoader:
    @staticmethod
    def from_yaml(file_path: str) -> TeamMapping:
        path = Path(file_path)
        if not path.exists():
            return TeamMapping()

        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}

        return TeamMappingLoader._from_dict(data)

    @staticmethod
    def _from_dict(data: dict) -> TeamMapping:
        mapping = TeamMapping()

        if "aliases" in data:
            for alias, targets in data["aliases"].items():
                if isinstance(targets, str):
                    targets = [targets]
                mapping.aliases[alias] = targets

        if "renames" in data:
            for old_name, new_name in data["renames"].items():
                mapping.renames[old_name] = new_name

        if "invalid_owners" in data:
            mapping.invalid_owners = data["invalid_owners"]

        return mapping

    @staticmethod
    def from_args(
        aliases: Optional[Dict[str, List[str]]] = None,
        renames: Optional[Dict[str, str]] = None,
    ) -> TeamMapping:
        mapping = TeamMapping()
        if aliases:
            mapping.aliases.update(aliases)
        if renames:
            mapping.renames.update(renames)
        return mapping

from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from .dependency import DependencyCoordinate


class MatchStrategy(str, Enum):
    EXACT = "exact"
    GROUP = "group"
    NAME = "name"
    PATTERN = "pattern"


class ReplacementRule(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    match_strategy: MatchStrategy = MatchStrategy.EXACT
    match_pattern: str
    target_group: Optional[str] = None
    target_name: Optional[str] = None
    target_version: Optional[str] = None
    reason: Optional[str] = None
    priority: int = 0
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.now)
    source_file: Optional[str] = None

    def matches(self, dep: DependencyCoordinate) -> bool:
        if not self.is_active:
            return False

        if self.match_strategy == MatchStrategy.EXACT:
            return dep.full_coordinate == self.match_pattern or dep.canonical_name == self.match_pattern

        if self.match_strategy == MatchStrategy.GROUP:
            return dep.group == self.match_pattern

        if self.match_strategy == MatchStrategy.NAME:
            return dep.name == self.match_pattern

        if self.match_strategy == MatchStrategy.PATTERN:
            import re
            return bool(re.search(self.match_pattern, dep.full_coordinate))

        return False

    def apply(self, dep: DependencyCoordinate) -> DependencyCoordinate:
        new_dep = DependencyCoordinate(
            group=self.target_group if self.target_group else dep.group,
            name=self.target_name if self.target_name else dep.name,
            version=self.target_version if self.target_version else dep.version,
            type=dep.type,
            configuration=dep.configuration,
            source_file=dep.source_file,
            source_line=dep.source_line,
        )
        return new_dep

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "match_strategy": self.match_strategy.value,
            "match_pattern": self.match_pattern,
            "target_group": self.target_group,
            "target_name": self.target_name,
            "target_version": self.target_version,
            "reason": self.reason,
            "priority": self.priority,
            "is_active": self.is_active,
            "source_file": self.source_file,
        }


class ReplacementChain(BaseModel):
    original: DependencyCoordinate
    chain: List[DependencyCoordinate] = Field(default_factory=list)
    applied_rules: List[str] = Field(default_factory=list)

    @property
    def final(self) -> DependencyCoordinate:
        if self.chain:
            return self.chain[-1]
        return self.original

    @property
    def has_changes(self) -> bool:
        return len(self.chain) > 0

    @property
    def change_count(self) -> int:
        return len(self.chain)

    def add_step(self, new_dep: DependencyCoordinate, rule_id: str) -> None:
        self.chain.append(new_dep)
        self.applied_rules.append(rule_id)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "original": self.original.to_dict(),
            "chain": [d.to_dict() for d in self.chain],
            "applied_rules": self.applied_rules,
            "final": self.final.to_dict(),
            "has_changes": self.has_changes,
            "change_count": self.change_count,
        }


class ReplacementResult(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.now)
    total_dependencies: int = 0
    changed_dependencies: int = 0
    unchanged_dependencies: int = 0
    chains: List[ReplacementChain] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)

    @property
    def success(self) -> bool:
        return len(self.errors) == 0

    def add_chain(self, chain: ReplacementChain) -> None:
        self.chains.append(chain)
        self.total_dependencies += 1
        if chain.has_changes:
            self.changed_dependencies += 1
        else:
            self.unchanged_dependencies += 1

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "total_dependencies": self.total_dependencies,
            "changed_dependencies": self.changed_dependencies,
            "unchanged_dependencies": self.unchanged_dependencies,
            "success": self.success,
            "chains": [c.to_dict() for c in self.chains],
            "warnings": self.warnings,
            "errors": self.errors,
        }

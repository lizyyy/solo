import os
import re
from typing import Dict, List, Set, Tuple
from collections import defaultdict
from .models import ServiceEntry, SourceType, SourceLocation


class OwnerMerger:
    def __init__(self, owner_mapping_file: str = None):
        self.owner_mapping: Dict[str, str] = {}
        self.owner_sources: Dict[str, Set[SourceType]] = defaultdict(set)
        if owner_mapping_file and os.path.exists(owner_mapping_file):
            self._load_owner_mapping(owner_mapping_file)

    def _load_owner_mapping(self, file_path: str) -> None:
        import yaml
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
            if isinstance(data, dict):
                for canonical, aliases in data.items():
                    if isinstance(aliases, list):
                        for alias in aliases:
                            self.owner_mapping[alias.lower()] = canonical
                    self.owner_mapping[canonical.lower()] = canonical
        except Exception:
            pass

    def merge_owners(self, entries: List[ServiceEntry]) -> Dict[str, List[ServiceEntry]]:
        owner_to_services: Dict[str, List[ServiceEntry]] = defaultdict(list)

        for entry in entries:
            for owner in entry.owners:
                normalized_owner = self._normalize_owner(owner)
                canonical_owner = self.owner_mapping.get(normalized_owner, normalized_owner)
                owner_to_services[canonical_owner].append(entry)

        for owner in owner_to_services:
            owner_to_services[owner].sort(key=lambda e: e.get_stable_id())

        return dict(sorted(owner_to_services.items(), key=lambda x: x[0].lower()))

    def _normalize_owner(self, owner: str) -> str:
        owner = owner.strip().lower()
        owner = re.sub(r"[^a-z0-9@._-]", "", owner)
        return owner

    def track_owner_sources(self, entry: ServiceEntry) -> Dict[str, List[SourceType]]:
        owner_sources: Dict[str, List[SourceType]] = defaultdict(list)

        for owner in entry.owners:
            normalized_owner = self._normalize_owner(owner)
            canonical_owner = self.owner_mapping.get(normalized_owner, normalized_owner)

            if entry.repository:
                owner_sources[canonical_owner].append(SourceType.REPOSITORY)
            if entry.alert_rules:
                owner_sources[canonical_owner].append(SourceType.ALERT)
            owner_sources[canonical_owner].append(SourceType.CATALOG)

        for owner in owner_sources:
            owner_sources[owner] = sorted(set(owner_sources[owner]), key=lambda t: t.value)

        return dict(owner_sources)

    def get_owner_statistics(self, entries: List[ServiceEntry]) -> Dict[str, dict]:
        owner_to_services = self.merge_owners(entries)
        stats: Dict[str, dict] = {}

        for owner, services in owner_to_services.items():
            with_repo = sum(1 for s in services if s.repository)
            with_alerts = sum(1 for s in services if s.alert_rules)

            stats[owner] = {
                "total_services": len(services),
                "with_repository": with_repo,
                "with_alerts": with_alerts,
                "service_names": [s.service_name for s in services],
            }

        return dict(sorted(stats.items(), key=lambda x: x[0].lower()))

    def find_orphan_owners(self, entries: List[ServiceEntry]) -> List[str]:
        owner_to_services = self.merge_owners(entries)
        orphan_owners: List[str] = []

        for owner, services in owner_to_services.items():
            all_dead = True
            for service in services:
                has_repo = service.repository is not None
                has_alerts = bool(service.alert_rules)
                if has_repo or has_alerts:
                    all_dead = False
                    break
            if all_dead:
                orphan_owners.append(owner)

        return sorted(orphan_owners, key=str.lower)

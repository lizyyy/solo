import re
import hashlib
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class NormalizedResource:
    kind: str
    name: str
    namespace: Optional[str]
    normalized: Dict
    original: Dict
    resource_key: str
    source_position: Optional[int]


class ResourceNormalizer:
    DEFAULT_IGNORE_FIELDS = {
        "metadata": ["creationTimestamp", "resourceVersion", "uid", "selfLink", "generation"],
        "status": ["*"],
    }

    DEFAULT_SORT_FIELDS = {
        "spec.containers": ["name"],
        "spec.volumes": ["name"],
        "spec.env": ["name"],
        "spec.ports": ["containerPort", "name"],
        "spec.template.spec.containers": ["name"],
        "spec.template.spec.volumes": ["name"],
        "data": None,
        "stringData": None,
    }

    def __init__(
        self,
        ignore_fields: Optional[Dict[str, List[str]]] = None,
        sort_fields: Optional[Dict[str, Optional[List[str]]]] = None,
        remove_empty: bool = True
    ):
        self.ignore_fields = ignore_fields or self.DEFAULT_IGNORE_FIELDS
        self.sort_fields = sort_fields or self.DEFAULT_SORT_FIELDS
        self.remove_empty = remove_empty

    def normalize_all(self, manifests: List[Dict]) -> List[NormalizedResource]:
        normalized_list = []
        for manifest in manifests:
            try:
                normalized = self.normalize_one(manifest)
                normalized_list.append(normalized)
            except Exception as e:
                logger.warning(f"Failed to normalize manifest: {e}")
                continue
        
        normalized_list.sort(key=lambda x: x.resource_key)
        return normalized_list

    def normalize_one(self, manifest: Dict) -> NormalizedResource:
        original = manifest.copy()
        normalized = manifest.copy()
        
        source_position = normalized.pop("_source_position", None)
        
        self._remove_ignore_fields(normalized)
        self._sort_list_fields(normalized)
        
        if self.remove_empty:
            normalized = self._remove_empty_values(normalized)
        
        kind = normalized.get("kind", "Unknown")
        metadata = normalized.get("metadata", {})
        name = metadata.get("name", "unknown")
        namespace = metadata.get("namespace")
        
        resource_key = self._make_resource_key(kind, namespace, name)
        
        return NormalizedResource(
            kind=kind,
            name=name,
            namespace=namespace,
            normalized=normalized,
            original=original,
            resource_key=resource_key,
            source_position=source_position
        )

    def _remove_ignore_fields(self, obj: Dict[str, Any], path: str = "") -> None:
        if not isinstance(obj, dict):
            return
            
        for key, value in list(obj.items()):
            current_path = f"{path}.{key}" if path else key
            
            if key in self.ignore_fields:
                ignore_list = self.ignore_fields[key]
                if "*" in ignore_list:
                    del obj[key]
                    continue
                    
            if isinstance(value, dict):
                self._remove_ignore_fields(value, current_path)
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        self._remove_ignore_fields(item, current_path)

        for key, fields in self.ignore_fields.items():
            if "*" in fields:
                continue
            if key in obj and isinstance(obj[key], dict):
                for field in fields:
                    if field in obj[key]:
                        del obj[key][field]

    def _sort_list_fields(self, obj: Any, path: str = "") -> None:
        if isinstance(obj, dict):
            for key, value in obj.items():
                current_path = f"{path}.{key}" if path else key
                if isinstance(value, list):
                    self._sort_list(value, current_path)
                self._sort_list_fields(value, current_path)
        elif isinstance(obj, list):
            for item in obj:
                self._sort_list_fields(item, path)

    def _sort_list(self, lst: List[Any], path: str) -> None:
        if not lst:
            return
            
        sort_keys = self.sort_fields.get(path)
        
        if sort_keys is None and all(isinstance(x, dict) for x in lst):
            lst.sort(key=lambda x: self._dict_hash(x))
        elif sort_keys:
            lst.sort(key=lambda x: tuple(x.get(k, "") for k in sort_keys) if isinstance(x, dict) else str(x))
        elif isinstance(lst[0], (str, int, float, bool)):
            lst.sort()

    def _dict_hash(self, d: Dict) -> str:
        items = sorted(str(k) + str(v) for k, v in d.items() if v is not None)
        return hashlib.md5("|".join(items).encode()).hexdigest()

    def _remove_empty_values(self, obj: Any) -> Any:
        if isinstance(obj, dict):
            return {
                k: self._remove_empty_values(v)
                for k, v in obj.items()
                if v is not None and v != "" and v != {} and v != []
            }
        elif isinstance(obj, list):
            return [self._remove_empty_values(item) for item in obj if item is not None and item != ""]
        return obj

    def _make_resource_key(self, kind: str, namespace: Optional[str], name: str) -> str:
        kind_normalized = kind.lower()
        if namespace:
            return f"{kind_normalized}/{namespace}/{name}"
        return f"{kind_normalized}/{name}"

    def group_by_kind(self, resources: List[NormalizedResource]) -> Dict[str, List[NormalizedResource]]:
        groups = {}
        for res in resources:
            if res.kind not in groups:
                groups[res.kind] = []
            groups[res.kind].append(res)
        return groups

    def get_resource_map(self, resources: List[NormalizedResource]) -> Dict[str, NormalizedResource]:
        return {res.resource_key: res for res in resources}

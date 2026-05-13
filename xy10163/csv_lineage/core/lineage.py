from typing import Dict, List, Any, Optional, Set
from datetime import datetime
import json

class LineageManager:
    def __init__(self, storage):
        self.storage = storage

    def initialize_lineage(self, table_name: str, version: int, 
                          schema: Dict[str, Any]) -> Dict[str, Any]:
        lineage = {
            "table_name": table_name,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "fields": {}
        }
        
        for field in schema.get("fields", []):
            field_name = field["name"]
            lineage["fields"][field_name] = {
                "canonical_name": field_name,
                "aliases": [field_name],
                "first_seen_version": version,
                "last_seen_version": version,
                "history": [{
                    "version": version,
                    "name": field_name,
                    "dtype": field.get("dtype"),
                    "action": "added",
                    "timestamp": datetime.now().isoformat()
                }]
            }
        
        self.storage.save_lineage(table_name, lineage)
        return lineage

    def update_lineage(self, table_name: str, new_version: int, 
                       new_schema: Dict[str, Any], 
                       schema_comparison: Dict[str, Any],
                       renames: Dict[str, str] = None) -> Dict[str, Any]:
        lineage = self.storage.get_lineage(table_name)
        if lineage is None:
            return self.initialize_lineage(table_name, new_version, new_schema)
        
        new_field_names = {f["name"] for f in new_schema.get("fields", [])}
        new_field_info_map = {f["name"]: f for f in new_schema.get("fields", [])}
        renames = renames or {}
        
        processed_new_names = set()
        canonical_to_new_name = {}
        
        for old_name, new_name in renames.items():
            canonical = self._find_canonical_for_name(lineage, old_name)
            
            if canonical and new_name not in processed_new_names:
                canonical_data = lineage["fields"][canonical]
                
                if new_name not in canonical_data["aliases"]:
                    canonical_data["aliases"].append(new_name)
                canonical_data["last_seen_version"] = new_version
                
                new_field_info = new_field_info_map.get(new_name)
                old_dtype = None
                if canonical_data["history"]:
                    last_entry = canonical_data["history"][-1]
                    old_dtype = last_entry.get("dtype")
                
                new_dtype = new_field_info.get("dtype") if new_field_info else None
                
                if new_name != canonical_data["aliases"][-2] if len(canonical_data["aliases"]) >= 2 else old_name:
                    canonical_data["history"].append({
                        "version": new_version,
                        "name": new_name,
                        "dtype": new_dtype,
                        "action": "renamed_from",
                        "old_name": old_name,
                        "timestamp": datetime.now().isoformat()
                    })
                elif old_dtype != new_dtype and new_dtype:
                    canonical_data["history"].append({
                        "version": new_version,
                        "name": new_name,
                        "dtype": new_dtype,
                        "action": "type_changed",
                        "old_dtype": old_dtype,
                        "timestamp": datetime.now().isoformat()
                    })
                
                canonical_to_new_name[canonical] = new_name
                processed_new_names.add(new_name)
        
        for field_name in new_field_names:
            if field_name in processed_new_names:
                continue
            
            canonical = self._find_canonical_for_name(lineage, field_name)
            field_info = new_field_info_map[field_name]
            
            if canonical:
                canonical_data = lineage["fields"][canonical]
                canonical_data["last_seen_version"] = new_version
                
                if field_name not in canonical_data["aliases"]:
                    canonical_data["aliases"].append(field_name)
                
                old_dtype = None
                if canonical_data["history"]:
                    last_entry = canonical_data["history"][-1]
                    old_dtype = last_entry.get("dtype")
                
                new_dtype = field_info.get("dtype")
                if old_dtype != new_dtype and new_dtype:
                    canonical_data["history"].append({
                        "version": new_version,
                        "name": field_name,
                        "dtype": new_dtype,
                        "action": "type_changed",
                        "old_dtype": old_dtype,
                        "timestamp": datetime.now().isoformat()
                    })
            else:
                lineage["fields"][field_name] = {
                    "canonical_name": field_name,
                    "aliases": [field_name],
                    "first_seen_version": new_version,
                    "last_seen_version": new_version,
                    "history": [{
                        "version": new_version,
                        "name": field_name,
                        "dtype": field_info.get("dtype"),
                        "action": "added",
                        "timestamp": datetime.now().isoformat()
                    }]
                }
        
        for canonical, field_data in lineage["fields"].items():
            if field_data["last_seen_version"] < new_version:
                last_seen_name = field_data["aliases"][-1]
                if last_seen_name not in new_field_names:
                    last_history = field_data["history"][-1] if field_data["history"] else None
                    if not last_history or last_history.get("action") != "removed" or last_history.get("version") != new_version:
                        field_data["history"].append({
                            "version": new_version,
                            "name": last_seen_name,
                            "action": "removed",
                            "timestamp": datetime.now().isoformat()
                        })
        
        lineage["updated_at"] = datetime.now().isoformat()
        self.storage.save_lineage(table_name, lineage)
        return lineage

    def _find_canonical_for_name(self, lineage: Dict[str, Any], 
                                  field_name: str) -> Optional[str]:
        for canonical, data in lineage["fields"].items():
            if field_name == canonical or field_name in data["aliases"]:
                return canonical
        return None

    def get_field_history(self, table_name: str, field_name: str) -> Optional[Dict[str, Any]]:
        lineage = self.storage.get_lineage(table_name)
        if lineage is None:
            return None
        
        for canonical, data in lineage["fields"].items():
            if field_name == canonical or field_name in data["aliases"]:
                return {
                    "canonical_name": data["canonical_name"],
                    "aliases": data["aliases"],
                    "first_seen": data["first_seen_version"],
                    "last_seen": data["last_seen_version"],
                    "history": data["history"]
                }
        
        return None

    def identify_breaking_changes(self, table_name: str, 
                                  from_version: int = None,
                                  to_version: int = None) -> Dict[str, Any]:
        lineage = self.storage.get_lineage(table_name)
        if lineage is None:
            return {"breaking_changes": [], "warnings": []}
        
        breaking_changes = []
        warnings = []
        
        for canonical, data in lineage["fields"].items():
            for i, entry in enumerate(data["history"]):
                if from_version and entry["version"] < from_version:
                    continue
                if to_version and entry["version"] > to_version:
                    continue
                
                if entry["action"] == "removed":
                    prev_entry = data["history"][i-1] if i > 0 else None
                    breaking_changes.append({
                        "field": canonical,
                        "version": entry["version"],
                        "action": "removed",
                        "message": f"字段 '{canonical}'（最后使用名: {prev_entry['name'] if prev_entry else canonical}）在版本 {entry['version']} 被删除",
                        "source": {
                            "version": entry["version"],
                            "timestamp": entry["timestamp"],
                            "previous_name": prev_entry['name'] if prev_entry else canonical
                        }
                    })
                elif entry["action"] == "type_changed":
                    warnings.append({
                        "field": canonical,
                        "version": entry["version"],
                        "action": "type_changed",
                        "message": f"字段 '{entry['name']}' 数据类型从 '{entry['old_dtype']}' 变为 '{entry['dtype']}'",
                        "source": {
                            "version": entry["version"],
                            "timestamp": entry["timestamp"],
                            "old_dtype": entry["old_dtype"],
                            "new_dtype": entry["dtype"]
                        }
                    })
        
        return {
            "breaking_changes": breaking_changes,
            "warnings": warnings,
            "summary": {
                "breaking_count": len(breaking_changes),
                "warning_count": len(warnings)
            }
        }

    def get_all_fields_with_aliases(self, table_name: str) -> Dict[str, List[str]]:
        lineage = self.storage.get_lineage(table_name)
        if lineage is None:
            return {}
        
        return {
            canonical: data["aliases"]
            for canonical, data in lineage["fields"].items()
        }

    def rebuild_from_versions(self, table_name: str, alias_manager, 
                               schema_analyzer, verbose: bool = False) -> Dict[str, Any]:
        versions = self.storage.get_all_versions(table_name)
        if not versions:
            return {"success": False, "error": "No versions found"}
        
        sorted_versions = sorted(versions, key=lambda x: x["version"])
        
        from csv_lineage.core.alias import AliasManager
        
        first_version = self.storage.get_version(table_name, sorted_versions[0]["version"])
        first_schema = first_version["schema"]
        
        lineage = {
            "table_name": table_name,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "fields": {}
        }
        
        for field in first_schema.get("fields", []):
            field_name = field["name"]
            lineage["fields"][field_name] = {
                "canonical_name": field_name,
                "aliases": [field_name],
                "first_seen_version": sorted_versions[0]["version"],
                "last_seen_version": sorted_versions[0]["version"],
                "history": [{
                    "version": sorted_versions[0]["version"],
                    "name": field_name,
                    "dtype": field.get("dtype"),
                    "action": "added",
                    "timestamp": datetime.now().isoformat()
                }]
            }
        
        self.storage.save_lineage(table_name, lineage)
        
        for i in range(1, len(sorted_versions)):
            prev_version_data = self.storage.get_version(table_name, sorted_versions[i-1]["version"])
            curr_version_data = self.storage.get_version(table_name, sorted_versions[i]["version"])
            
            prev_schema = prev_version_data["schema"]
            curr_schema = curr_version_data["schema"]
            curr_version_num = sorted_versions[i]["version"]
            
            comparison = schema_analyzer.compare_schemas(prev_schema, curr_schema)
            renames = alias_manager.detect_renames(prev_schema, curr_schema, table_name)
            
            lineage = self.update_lineage(table_name, curr_version_num, curr_schema, comparison, renames)
            
            if renames:
                alias_manager.apply_renames_to_aliases(table_name, renames)
            
            if verbose:
                print(f"  v{curr_version_num}: 检测到 {len(renames)} 个重命名")
        
        return {
            "success": True,
            "table_name": table_name,
            "version_count": len(sorted_versions),
            "field_count": len(lineage["fields"])
        }

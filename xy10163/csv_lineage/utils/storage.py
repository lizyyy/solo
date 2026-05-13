import json
import os
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

class LineageStorage:
    def __init__(self, storage_path: str = None):
        if storage_path is None:
            storage_path = os.path.join(os.getcwd(), ".lineage")
        self.storage_path = Path(storage_path)
        self._init_storage()

    def _init_storage(self):
        self.storage_path.mkdir(exist_ok=True)
        (self.storage_path / "versions").mkdir(exist_ok=True)
        (self.storage_path / "aliases").mkdir(exist_ok=True)
        (self.storage_path / "lineage").mkdir(exist_ok=True)
        (self.storage_path / "reports").mkdir(exist_ok=True)
        
        if not (self.storage_path / "meta.json").exists():
            with open(self.storage_path / "meta.json", "w") as f:
                json.dump({"version_count": 0, "tables": {}}, f, indent=2)

    def get_meta(self) -> Dict[str, Any]:
        with open(self.storage_path / "meta.json", "r") as f:
            return json.load(f)

    def save_meta(self, meta: Dict[str, Any]):
        with open(self.storage_path / "meta.json", "w") as f:
            json.dump(meta, f, indent=2)

    def generate_file_hash(self, file_path: str) -> str:
        with open(file_path, "rb") as f:
            return hashlib.md5(f.read()).hexdigest()

    def save_version(self, table_name: str, file_path: str, 
                     schema: Dict[str, Any], comment: str = "") -> tuple:
        meta = self.get_meta()
        
        if table_name not in meta["tables"]:
            meta["tables"][table_name] = {
                "current_version": 0,
                "versions": [],
                "file_hashes": {}
            }
        
        file_hash = self.generate_file_hash(file_path)
        
        if file_hash in meta["tables"][table_name]["file_hashes"]:
            existing_version = meta["tables"][table_name]["file_hashes"][file_hash]
            return (existing_version, False)
        
        version_num = meta["version_count"] + 1
        meta["version_count"] = version_num
        meta["tables"][table_name]["current_version"] = version_num
        meta["tables"][table_name]["file_hashes"][file_hash] = version_num
        
        version_data = {
            "version": version_num,
            "table_name": table_name,
            "file_path": file_path,
            "file_hash": file_hash,
            "schema": schema,
            "comment": comment,
            "imported_at": datetime.now().isoformat()
        }
        
        version_file = self.storage_path / "versions" / f"{table_name}_v{version_num}.json"
        with open(version_file, "w") as f:
            json.dump(version_data, f, indent=2, ensure_ascii=False)
        
        meta["tables"][table_name]["versions"].append({
            "version": version_num,
            "imported_at": version_data["imported_at"],
            "comment": comment
        })
        
        self.save_meta(meta)
        return (version_num, True)

    def get_version(self, table_name: str, version: int = None) -> Optional[Dict[str, Any]]:
        meta = self.get_meta()
        if table_name not in meta["tables"]:
            return None
        
        if version is None:
            version = meta["tables"][table_name]["current_version"]
        
        version_file = self.storage_path / "versions" / f"{table_name}_v{version}.json"
        if not version_file.exists():
            return None
        
        with open(version_file, "r") as f:
            return json.load(f)

    def get_all_versions(self, table_name: str) -> List[Dict[str, Any]]:
        meta = self.get_meta()
        if table_name not in meta["tables"]:
            return []
        
        versions = []
        for v in meta["tables"][table_name]["versions"]:
            version_data = self.get_version(table_name, v["version"])
            if version_data:
                versions.append({
                    "version": v["version"],
                    "imported_at": v["imported_at"],
                    "comment": v["comment"],
                    "field_count": len(version_data.get("schema", {}).get("fields", []))
                })
        
        return sorted(versions, key=lambda x: x["version"])

    def save_aliases(self, table_name: str, aliases: Dict[str, List[str]]):
        alias_file = self.storage_path / "aliases" / f"{table_name}.json"
        with open(alias_file, "w") as f:
            json.dump(aliases, f, indent=2, ensure_ascii=False)

    def get_aliases(self, table_name: str) -> Dict[str, List[str]]:
        alias_file = self.storage_path / "aliases" / f"{table_name}.json"
        if not alias_file.exists():
            return {}
        with open(alias_file, "r") as f:
            return json.load(f)

    def save_lineage(self, table_name: str, lineage_data: Dict[str, Any]):
        lineage_file = self.storage_path / "lineage" / f"{table_name}.json"
        with open(lineage_file, "w") as f:
            json.dump(lineage_data, f, indent=2, ensure_ascii=False)

    def get_lineage(self, table_name: str) -> Optional[Dict[str, Any]]:
        lineage_file = self.storage_path / "lineage" / f"{table_name}.json"
        if not lineage_file.exists():
            return None
        with open(lineage_file, "r") as f:
            return json.load(f)

    def save_report(self, table_name: str, report_name: str, report_data: str, 
                   format: str = "html") -> str:
        report_file = self.storage_path / "reports" / f"{table_name}_{report_name}.{format}"
        with open(report_file, "w") as f:
            f.write(report_data)
        return str(report_file)

    def list_tables(self) -> List[str]:
        meta = self.get_meta()
        return list(meta["tables"].keys())

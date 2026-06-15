import yaml
import hashlib
from datetime import datetime
from typing import Optional, Tuple, List
from models import ParameterYAML
import uuid


class YAMLImporter:
    def __init__(self, history_tracker=None):
        self.import_history: List[ParameterYAML] = []
        self.history_tracker = history_tracker

    def parse_yaml(self, yaml_content: str) -> dict:
        try:
            data = yaml.safe_load(yaml_content)
            return data if data else {}
        except yaml.YAMLError as e:
            raise ValueError(f"YAML 解析失败: {str(e)}")

    def _compute_hash(self, content: str) -> str:
        return hashlib.md5(content.encode()).hexdigest()

    def import_yaml(self, yaml_content: str, operator: str = "系统") -> Tuple[ParameterYAML, str]:
        data = self.parse_yaml(yaml_content)
        
        experiment_id = data.get("experiment_id", str(uuid.uuid4()))
        experiment_name = data.get("experiment_name", "未命名实验")
        version = data.get("version", "v1.0")
        parameters = data.get("parameters", {})
        metrics = data.get("metrics", {})
        conclusion = data.get("conclusion", "")
        content_hash = self._compute_hash(yaml_content)
        
        existing_for_exp = [
            y for y in self.import_history if y.experiment_id == experiment_id
        ]
        
        import_type = "首次导入"
        if existing_for_exp:
            same_content = any(
                y.content_hash == content_hash for y in existing_for_exp
            )
            if same_content:
                import_type = "重复导入（内容完全一致）"
            else:
                import_type = "版本更新（内容有变化）"
            
            for y in existing_for_exp:
                y.is_latest = False
        
        import_id = str(uuid.uuid4())
        param_yaml = ParameterYAML(
            import_id=import_id,
            experiment_id=experiment_id,
            experiment_name=experiment_name,
            version=version,
            import_time=datetime.now(),
            parameters=parameters,
            metrics=metrics,
            conclusion=conclusion,
            raw_content=yaml_content,
            content_hash=content_hash,
            is_valid=True,
            is_latest=True
        )
        
        self.import_history.append(param_yaml)
        
        if self.history_tracker:
            details = f"实验 {experiment_name}({experiment_id}) 版本 {version}"
            details += f"，导入方式：{import_type}"
            details += f"，导入批次：{import_id[:8]}"
            self.history_tracker.add_record(
                experiment_id=experiment_id,
                action=f"参数YAML-{import_type}",
                operator=operator,
                details=details,
                before_state={
                    "import_count_before": len(existing_for_exp),
                    "latest_version_before": existing_for_exp[-1].version if existing_for_exp else None
                } if existing_for_exp else None,
                after_state={
                    "import_count_after": len(existing_for_exp) + 1,
                    "latest_version_after": version
                }
            )
        
        return param_yaml, import_type

    def get_yaml(self, experiment_id: str) -> Optional[ParameterYAML]:
        latest = [
            y for y in self.import_history
            if y.experiment_id == experiment_id and y.is_latest
        ]
        return latest[0] if latest else None

    def get_all_versions(self, experiment_id: str) -> List[ParameterYAML]:
        versions = [y for y in self.import_history if y.experiment_id == experiment_id]
        return sorted(versions, key=lambda y: y.import_time)

    def get_import_count(self, experiment_id: str) -> int:
        return len([y for y in self.import_history if y.experiment_id == experiment_id])

    def get_duplicate_info(self, experiment_id: str) -> dict:
        versions = self.get_all_versions(experiment_id)
        if not versions:
            return {"total_imports": 0, "unique_content_count": 0, "has_duplicate": False}
        
        unique_hashes = set(y.content_hash for y in versions)
        has_duplicate = len(unique_hashes) < len(versions)
        
        return {
            "total_imports": len(versions),
            "unique_content_count": len(unique_hashes),
            "has_duplicate": has_duplicate,
            "duplicate_count": len(versions) - len(unique_hashes)
        }

    def list_experiments(self):
        seen = set()
        result = []
        for yaml_obj in reversed(self.import_history):
            if yaml_obj.experiment_id not in seen:
                seen.add(yaml_obj.experiment_id)
                result.append({
                    "experiment_id": yaml_obj.experiment_id,
                    "experiment_name": yaml_obj.experiment_name,
                    "version": yaml_obj.version,
                    "import_time": yaml_obj.import_time,
                    "import_count": self.get_import_count(yaml_obj.experiment_id)
                })
        return result

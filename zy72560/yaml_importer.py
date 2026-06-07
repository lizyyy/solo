import yaml
import hashlib
from datetime import datetime
from typing import Optional, Tuple
from models import ParameterYAML, HistoryRecord
import uuid


class YAMLImporter:
    def __init__(self, history_tracker=None):
        self.imported_yamls = {}
        self.history_tracker = history_tracker

    def parse_yaml(self, yaml_content: str) -> dict:
        try:
            data = yaml.safe_load(yaml_content)
            return data if data else {}
        except yaml.YAMLError as e:
            raise ValueError(f"YAML 解析失败: {str(e)}")

    def import_yaml(self, yaml_content: str, operator: str = "系统") -> Tuple[ParameterYAML, bool]:
        data = self.parse_yaml(yaml_content)
        
        experiment_id = data.get("experiment_id", str(uuid.uuid4()))
        experiment_name = data.get("experiment_name", "未命名实验")
        version = data.get("version", "v1.0")
        parameters = data.get("parameters", {})
        metrics = data.get("metrics", {})
        conclusion = data.get("conclusion", "")
        
        content_hash = hashlib.md5(yaml_content.encode()).hexdigest()
        
        is_duplicate = False
        if experiment_id in self.imported_yamls:
            existing = self.imported_yamls[experiment_id]
            existing_hash = hashlib.md5(existing.raw_content.encode()).hexdigest()
            if existing_hash == content_hash:
                is_duplicate = True
        
        param_yaml = ParameterYAML(
            experiment_id=experiment_id,
            experiment_name=experiment_name,
            version=version,
            import_time=datetime.now(),
            parameters=parameters,
            metrics=metrics,
            conclusion=conclusion,
            raw_content=yaml_content,
            is_valid=True
        )
        
        self.imported_yamls[experiment_id] = param_yaml
        
        if self.history_tracker:
            action = "重复导入" if is_duplicate else "参数YAML导入"
            details = f"实验 {experiment_name}({experiment_id}) 版本 {version}"
            if is_duplicate:
                details += "（内容与已有版本完全一致）"
            self.history_tracker.add_record(
                experiment_id=experiment_id,
                action=action,
                operator=operator,
                details=details
            )
        
        return param_yaml, is_duplicate

    def get_yaml(self, experiment_id: str) -> Optional[ParameterYAML]:
        return self.imported_yamls.get(experiment_id)

    def list_experiments(self):
        return [
            {"experiment_id": eid, "experiment_name": yaml.experiment_name, 
             "version": yaml.version, "import_time": yaml.import_time}
            for eid, yaml in self.imported_yamls.items()
        ]

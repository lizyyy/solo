import os
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False


@dataclass
class TemplateConfig:
    name: str
    description: str
    pattern: str
    is_json: bool = False
    fields: Dict[str, Any] = None
    json_fields: Dict[str, List[str]] = None
    timestamp_format: str = None
    level_mapping: Dict[str, str] = None
    error_code_extraction: Dict[str, str] = None
    batch_extraction: Dict[str, str] = None
    
    def __post_init__(self):
        if self.fields is None:
            self.fields = {}
        if self.json_fields is None:
            self.json_fields = {}
        if self.level_mapping is None:
            self.level_mapping = {}


class ConfigLoader:
    def __init__(self, config_path: str):
        self.config_path = config_path
        self._config: Optional[Dict[str, Any]] = None
        self._templates: List[TemplateConfig] = []
        
    def load(self) -> bool:
        if not HAS_YAML:
            raise ImportError(
                "PyYAML is required to load configuration. "
                "Install it with: pip install pyyaml"
            )
        
        if not os.path.exists(self.config_path):
            raise FileNotFoundError(f"Config file not found: {self.config_path}")
        
        with open(self.config_path, "r", encoding="utf-8") as f:
            try:
                self._config = yaml.safe_load(f)
            except yaml.YAMLError as e:
                raise ValueError(f"Invalid YAML in config file: {e}")
        
        if self._config is None:
            raise ValueError("Config file is empty")
        
        self._parse_templates()
        return True
    
    def _parse_templates(self):
        templates_data = self._config.get("templates", [])
        
        for template_data in templates_data:
            template = TemplateConfig(
                name=template_data.get("name", "unknown"),
                description=template_data.get("description", ""),
                pattern=template_data.get("pattern", ""),
                is_json=template_data.get("is_json", False),
                fields=template_data.get("fields", {}),
                json_fields=template_data.get("json_fields", {}),
                timestamp_format=template_data.get("timestamp_format"),
                level_mapping=template_data.get("level_mapping", {}),
                error_code_extraction=template_data.get("error_code_extraction"),
                batch_extraction=template_data.get("batch_extraction"),
            )
            self._templates.append(template)
    
    def get_templates(self) -> List[Dict[str, Any]]:
        result = []
        for template in self._templates:
            template_dict = {
                "name": template.name,
                "description": template.description,
                "pattern": template.pattern,
                "is_json": template.is_json,
                "fields": template.fields,
            }
            
            if template.is_json:
                template_dict["json_fields"] = template.json_fields
                if template.timestamp_format:
                    template_dict["timestamp_format"] = template.timestamp_format
            
            if template.level_mapping:
                template_dict["level_mapping"] = template.level_mapping
            
            if template.error_code_extraction:
                template_dict["error_code_extraction"] = template.error_code_extraction
            
            if template.batch_extraction:
                template_dict["batch_extraction"] = template.batch_extraction
            
            result.append(template_dict)
        
        return result
    
    def validate(self) -> List[str]:
        errors = []
        
        if not self._templates:
            errors.append("No templates defined in configuration")
            return errors
        
        for i, template in enumerate(self._templates):
            if not template.name:
                errors.append(f"Template {i} has no name")
            
            if not template.is_json and not template.pattern:
                errors.append(f"Template '{template.name}' has no pattern defined")
            
            if template.is_json and not template.json_fields:
                errors.append(f"JSON template '{template.name}' has no json_fields defined")
        
        return errors


def load_config(config_path: str) -> List[Dict[str, Any]]:
    loader = ConfigLoader(config_path)
    loader.load()
    
    errors = loader.validate()
    if errors:
        raise ValueError("Configuration validation failed:\n" + "\n".join(errors))
    
    return loader.get_templates()

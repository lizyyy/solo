import yaml
import re
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


@dataclass
class TemplateVariable:
    name: str
    required: bool = True
    description: str = ""


@dataclass
class CacheTemplate:
    name: str
    pattern: str
    variables: List[TemplateVariable]
    description: str = ""


class TemplateManager:
    def __init__(self, templates_file: str):
        self.templates_file = Path(templates_file)
        self.templates: Dict[str, CacheTemplate] = {}
        self._load()

    def _load(self):
        with open(self.templates_file, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        for name, item in data.get('templates', {}).items():
            variables = []
            for var in item.get('variables', []):
                variables.append(TemplateVariable(
                    name=var['name'],
                    required=var.get('required', True),
                    description=var.get('description', '')
                ))
            
            template = CacheTemplate(
                name=name,
                pattern=item['pattern'],
                variables=variables,
                description=item.get('description', '')
            )
            self.templates[name] = template

    def get_template(self, name: str) -> Optional[CacheTemplate]:
        return self.templates.get(name)

    def validate_template(self, template_name: str) -> Tuple[bool, List[str]]:
        if template_name not in self.templates:
            return False, [f"模板不存在: {template_name}"]
        return True, []

    def validate_variables(self, template_name: str, variables: Dict[str, str]) -> Tuple[bool, List[str]]:
        if template_name not in self.templates:
            return False, [f"模板不存在: {template_name}"]
        
        template = self.templates[template_name]
        errors = []
        
        for var in template.variables:
            if var.required and var.name not in variables:
                errors.append(f"缺少必要变量: {var.name}")
        
        for var_name in variables:
            if not any(v.name == var_name for v in template.variables):
                errors.append(f"未知变量: {var_name}")
        
        return len(errors) == 0, errors

    def build_cache_key(self, template_name: str, variables: Dict[str, str]) -> Tuple[Optional[str], List[str]]:
        valid, errors = self.validate_variables(template_name, variables)
        if not valid:
            return None, errors
        
        template = self.templates[template_name]
        try:
            key = template.pattern.format(**variables)
            return key, []
        except KeyError as e:
            return None, [f"变量缺失: {e}"]
        except Exception as e:
            return None, [f"构建缓存键失败: {e}"]

    def get_all_templates(self) -> Dict[str, CacheTemplate]:
        return self.templates

    def get_template_variables(self, template_name: str) -> Optional[List[TemplateVariable]]:
        if template_name not in self.templates:
            return None
        return self.templates[template_name].variables

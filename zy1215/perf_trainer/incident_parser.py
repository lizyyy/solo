from pathlib import Path
from typing import Dict, Any, List, Optional
import yaml

from perf_trainer.exceptions import (
    IncidentNotFoundError,
    InvalidIncidentFormatError,
    SampleNotFoundError
)
from perf_trainer.config import Config


class IncidentParser:
    """解析和验证 incident.yaml 文件"""
    
    # 必需的顶层字段
    REQUIRED_FIELDS = [
        'name', 'description', 'root_cause', 'difficulty', 
        'stages', 'samples'
    ]
    
    # 必需的阶段字段
    REQUIRED_STAGE_FIELDS = [
        'name', 'commands', 'expected_analysis', 'success_criteria'
    ]
    
    # 必需的样本字段
    REQUIRED_SAMPLE_FIELDS = [
        'name', 'type', 'file'
    ]
    
    def __init__(self, incident_path: Path):
        self.incident_path = incident_path
        self.incident_file = incident_path / Config.INCIDENT_FILENAME
        self.samples_dir = incident_path / Config.SAMPLES_DIR
        self._data: Optional[Dict[str, Any]] = None
    
    def load(self) -> Dict[str, Any]:
        """加载并验证 incident.yaml"""
        if not self.incident_file.exists():
            raise IncidentNotFoundError(
                f"incident.yaml not found at {self.incident_file}. "
                f"Please ensure the file exists in the incident directory."
            )
        
        try:
            with open(self.incident_file, 'r', encoding='utf-8') as f:
                self._data = yaml.safe_load(f)
        except yaml.YAMLError as e:
            raise InvalidIncidentFormatError(
                f"Failed to parse YAML: {e}\n"
                f"Tip: Check for indentation errors or invalid YAML syntax. "
                f"Use spaces (not tabs) for indentation."
            )
        
        self._validate()
        return self._data
    
    def _validate(self):
        """验证 incident.yaml 的结构"""
        if self._data is None:
            return
        
        # 检查必需字段
        for field in self.REQUIRED_FIELDS:
            if field not in self._data:
                raise InvalidIncidentFormatError(
                    f"Missing required field: '{field}'\n"
                    f"Tip: incident.yaml must contain: {', '.join(self.REQUIRED_FIELDS)}\n"
                    f"Example structure:\n"
                    f"  name: High CPU Incident\n"
                    f"  description: Server is responding slowly\n"
                    f"  root_cause: Infinite loop in application code\n"
                    f"  difficulty: medium\n"
                    f"  stages: [...]\n"
                    f"  samples: [...]",
                    field=field
                )
        
        # 验证阶段配置
        self._validate_stages()
        
        # 验证样本配置
        self._validate_samples()
    
    def _validate_stages(self):
        """验证阶段配置"""
        stages = self._data.get('stages', [])
        
        if not isinstance(stages, list):
            raise InvalidIncidentFormatError(
                f"'stages' field must be a list, got {type(stages).__name__}\n"
                f"Tip: Stages should be defined as a YAML list with each stage as a map.",
                field='stages'
            )
        
        valid_stages = Config.TROUBLESHOOTING_STAGES
        
        for i, stage in enumerate(stages):
            stage_name = stage.get('name', f'stage_{i+1}')
            
            # 检查必需字段
            for field in self.REQUIRED_STAGE_FIELDS:
                if field not in stage:
                    raise InvalidIncidentFormatError(
                        f"Stage '{stage_name}' (index {i}) missing required field: '{field}'\n"
                        f"Tip: Each stage must contain: {', '.join(self.REQUIRED_STAGE_FIELDS)}\n"
                        f"Example stage:\n"
                        f"  - name: cpu\n"
                        f"    commands:\n"
                        f"      - name: top\n"
                        f"        description: Display process activity\n"
                        f"        sample: top_output.txt\n"
                        f"    expected_analysis: Identify processes with high CPU usage\n"
                        f"    success_criteria: Correctly identify the rogue process",
                        field=f'stages.{i}.{field}'
                    )
            
            # 验证阶段名称有效性
            if stage['name'] not in valid_stages:
                raise InvalidIncidentFormatError(
                    f"Invalid stage name: '{stage['name']}'\n"
                    f"Tip: Valid stages are: {', '.join(valid_stages)}\n"
                    f"Use one of these predefined stage names.",
                    field=f'stages.{i}.name'
                )
            
            # 验证命令配置
            self._validate_commands(stage, i)
    
    def _validate_commands(self, stage: Dict, stage_index: int):
        """验证阶段中的命令配置"""
        commands = stage.get('commands', [])
        stage_name = stage.get('name')
        
        if not isinstance(commands, list):
            raise InvalidIncidentFormatError(
                f"'commands' in stage '{stage_name}' must be a list, got {type(commands).__name__}\n"
                f"Tip: Commands should be defined as a YAML list.",
                field=f'stages.{stage_index}.commands'
            )
        
        for j, cmd in enumerate(commands):
            if not isinstance(cmd, dict):
                raise InvalidIncidentFormatError(
                    f"Command at stage '{stage_name}', index {j} must be a map, got {type(cmd).__name__}\n"
                    f"Tip: Each command should have 'name', 'description', and optionally 'sample'.",
                    field=f'stages.{stage_index}.commands.{j}'
                )
            
            if 'name' not in cmd:
                raise InvalidIncidentFormatError(
                    f"Command at stage '{stage_name}', index {j} missing 'name' field\n"
                    f"Tip: Each command needs a 'name' (e.g., 'top', 'vmstat').",
                    field=f'stages.{stage_index}.commands.{j}.name'
                )
            
            # 如果引用了样本，验证样本存在
            if 'sample' in cmd:
                sample_name = cmd['sample']
                if not (self.samples_dir / sample_name).exists():
                    raise SampleNotFoundError(
                        f"Sample file '{sample_name}' referenced in command '{cmd['name']}' not found.\n"
                        f"Tip: Ensure the file exists in {self.samples_dir}\n"
                        f"or add it to the 'samples' section in incident.yaml."
                    )
    
    def _validate_samples(self):
        """验证样本配置"""
        samples = self._data.get('samples', [])
        
        if not isinstance(samples, list):
            raise InvalidIncidentFormatError(
                f"'samples' field must be a list, got {type(samples).__name__}\n"
                f"Tip: Samples should be defined as a YAML list.",
                field='samples'
            )
        
        for i, sample in enumerate(samples):
            sample_name = sample.get('name', f'sample_{i+1}')
            
            for field in self.REQUIRED_SAMPLE_FIELDS:
                if field not in sample:
                    raise InvalidIncidentFormatError(
                        f"Sample '{sample_name}' (index {i}) missing required field: '{field}'\n"
                        f"Tip: Each sample must contain: {', '.join(self.REQUIRED_SAMPLE_FIELDS)}\n"
                        f"Example sample:\n"
                        f"  - name: top_output\n"
                        f"    type: cpu\n"
                        f"    file: top_output.txt\n"
                        f"    description: Top command output showing high CPU usage",
                        field=f'samples.{i}.{field}'
                    )
            
            # 验证样本文件存在
            sample_file = sample['file']
            if not (self.samples_dir / sample_file).exists():
                raise SampleNotFoundError(
                    f"Sample file '{sample_file}' defined in samples but not found in {self.samples_dir}\n"
                    f"Tip: Either create the file or remove this sample entry."
                )
    
    def get_stage(self, stage_name: str) -> Optional[Dict[str, Any]]:
        """获取指定阶段的配置"""
        if self._data is None:
            self.load()
        
        stages = self._data.get('stages', [])
        for stage in stages:
            if stage['name'] == stage_name:
                return stage
        return None
    
    def get_sample(self, sample_name: str) -> Optional[Dict[str, Any]]:
        """获取指定样本的配置"""
        if self._data is None:
            self.load()
        
        samples = self._data.get('samples', [])
        for sample in samples:
            if sample['name'] == sample_name or sample.get('file') == sample_name:
                return sample
        return None
    
    def read_sample_file(self, filename: str) -> str:
        """读取样本文件内容"""
        sample_path = self.samples_dir / filename
        if not sample_path.exists():
            raise SampleNotFoundError(filename)
        
        with open(sample_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    @property
    def data(self) -> Dict[str, Any]:
        if self._data is None:
            self.load()
        return self._data

"""
YAML导入模块
保留原始行号、人工改动追踪，为策略产品追问留证据
"""
import re
from typing import List, Tuple, Dict
from datetime import datetime

from models import YAMLVersion, YAMLLineRecord, BoundarySample, SampleStatus
from database import Database


class YAMLImporter:
    """YAML导入器 - 逐行解析，保留原始行号"""
    
    def __init__(self, db: Database):
        self.db = db
    
    def import_from_file(self, file_path: str, imported_by: str, version_name: str = None) -> Tuple[int, List[BoundarySample]]:
        """从文件导入YAML"""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        file_name = file_path.split('/')[-1]
        return self.import_from_content(content, file_name, imported_by, version_name)
    
    def import_from_content(self, content: str, file_name: str, imported_by: str, version_name: str = None) -> Tuple[int, List[BoundarySample]]:
        """
        从内容导入YAML
        返回：(yaml版本ID, 解析出的边界样本列表)
        """
        lines = content.split('\n')
        
        if not version_name:
            version_name = f"{file_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # 第一步：保存每一行原始内容
        yaml_version = YAMLVersion(
            version_name=version_name,
            imported_by=imported_by,
            file_name=file_name,
            raw_content=content,
            line_count=len(lines),
            is_active=True
        )
        
        line_records = []
        for idx, line_content in enumerate(lines, start=1):
            line_records.append(YAMLLineRecord(
                line_number=idx,
                original_content=line_content,
                current_content=line_content,
                is_modified=False
            ))
        
        yaml_version_id = self.db.save_yaml_version(yaml_version, line_records)
        
        # 第二步：解析边界样本（这里假设YAML格式是每行一个样本的简化格式）
        # 实际项目中根据真实YAML格式调整解析逻辑
        samples = self._parse_samples(lines, yaml_version_id, imported_by)
        
        # 第三步：保存样本
        for sample in samples:
            if not self.db.check_duplicate_sample_key(sample.sample_key):
                self.db.save_sample(sample)
        
        return yaml_version_id, samples
    
    def _parse_samples(self, lines: List[str], yaml_version_id: int, imported_by: str) -> List[BoundarySample]:
        """
        从YAML行解析边界样本
        简化格式示例：
        - sample_key: batch001_001
          batch_id: batch001
          text: "这个商品到底是手机还是配件"
          predict: 电子产品
          actual: 配件
          line: 15
        """
        samples = []
        current_sample = None
        current_line_start = 0
        
        for line_num, line in enumerate(lines, start=1):
            stripped = line.strip()
            
            # 新样本开始
            if stripped.startswith('- sample_key:') or stripped.startswith('- sample_key：'):
                if current_sample:
                    samples.append(current_sample)
                
                sample_key = self._extract_value(stripped)
                current_sample = BoundarySample(
                    sample_key=sample_key,
                    yaml_version_id=yaml_version_id,
                    yaml_line_number=line_num,
                    last_updated_by=imported_by
                )
                current_line_start = line_num
            
            elif current_sample:
                if 'batch_id' in stripped:
                    current_sample.batch_id = self._extract_value(stripped)
                elif 'text' in stripped or 'text_content' in stripped:
                    current_sample.text_content = self._extract_value(stripped)
                elif 'predict' in stripped or 'predicted_category' in stripped:
                    current_sample.predicted_category = self._extract_value(stripped)
                elif 'actual' in stripped or 'actual_category' in stripped:
                    current_sample.actual_category = self._extract_value(stripped)
        
        if current_sample:
            samples.append(current_sample)
        
        # 如果没有解析到（可能是更简单的格式），尝试逐行解析
        if not samples:
            samples = self._parse_simple_format(lines, yaml_version_id, imported_by)
        
        return samples
    
    def _parse_simple_format(self, lines: List[str], yaml_version_id: int, imported_by: str) -> List[BoundarySample]:
        """简单格式：每一行一个tab/逗号分隔的样本"""
        samples = []
        # 跳过表头
        start_idx = 0
        if lines and ('sample_key' in lines[0] or 'text' in lines[0]):
            start_idx = 1
        
        for line_num, line in enumerate(lines[start_idx:], start=start_idx + 1):
            stripped = line.strip()
            if not stripped or stripped.startswith('#'):
                continue
            
            # 尝试用分隔符解析
            parts = re.split(r'[,\t|]+', stripped)
            if len(parts) >= 4:
                sample = BoundarySample(
                    sample_key=parts[0].strip(),
                    batch_id=parts[1].strip() if len(parts) > 1 else "default",
                    text_content=parts[2].strip() if len(parts) > 2 else "",
                    predicted_category=parts[3].strip() if len(parts) > 3 else "",
                    actual_category=parts[4].strip() if len(parts) > 4 else "",
                    yaml_version_id=yaml_version_id,
                    yaml_line_number=line_num,
                    last_updated_by=imported_by
                )
                samples.append(sample)
        
        return samples
    
    def _extract_value(self, line: str) -> str:
        """从YAML行提取值"""
        # 处理中英文冒号
        match = re.search(r'[:：]\s*(.*)', line)
        if match:
            value = match.group(1).strip()
            # 去掉引号
            if (value.startswith('"') and value.endswith('"')) or \
               (value.startswith("'") and value.endswith("'")):
                value = value[1:-1]
            return value
        return ""
    
    def modify_yaml_line(self, line_id: int, new_content: str, modified_by: str, remark: str = ""):
        """
        修改YAML某一行（人工改动）
        保留改动记录，策略产品追问时能回到证据
        """
        self.db.update_yaml_line(line_id, new_content, modified_by, remark)
    
    def get_version_diff(self, version_id: int) -> List[Dict]:
        """获取某个YAML版本的所有改动（用于策略产品追问时追溯）"""
        lines = self.db.get_yaml_lines(version_id)
        modified = [l for l in lines if l.is_modified]
        
        diffs = []
        for line in modified:
            diffs.append({
                "line_number": line.line_number,
                "original": line.original_content,
                "current": line.current_content,
                "modified_by": line.modified_by,
                "modified_at": line.modified_at,
                "remark": line.remark
            })
        
        return diffs

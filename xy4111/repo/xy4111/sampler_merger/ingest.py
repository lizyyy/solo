import hashlib
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List

from sampler_merger.config import Sample
from sampler_merger.parsers import get_parser, BaseParser


class IngestManager:
    """数据导入管理器"""
    
    def __init__(self, config: Dict, project_dir: Path):
        """
        初始化导入管理器
        
        Args:
            config: 项目配置
            project_dir: 项目目录路径
        """
        self.config = config
        self.project_dir = project_dir
        self.raw_dir = project_dir / "raw"
        self.processed_dir = project_dir / "processed"
    
    def ingest_file(self, file_path: Path, file_type: str) -> Dict[str, Any]:
        """
        导入单个文件
        
        Args:
            file_path: 源文件路径
            file_type: 文件类型 ('csv', 'gpx', 'photos', 'manual')
        
        Returns:
            导入记录字典
        """
        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        # 计算文件哈希
        file_hash = self._calculate_file_hash(file_path)
        
        # 检查是否已导入（通过哈希）
        existing = self._find_existing_by_hash(file_hash)
        if existing:
            raise ValueError(f"文件已存在于项目中: {existing['original_name']}")
        
        # 创建存储子目录（按类型和日期）
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        type_dir = self.raw_dir / file_type
        type_dir.mkdir(parents=True, exist_ok=True)
        
        # 生成存储文件名（保留原始扩展名）
        original_name = file_path.name
        stored_name = f"{timestamp}_{original_name}"
        stored_path = type_dir / stored_name
        
        # 复制文件到raw目录
        shutil.copy2(file_path, stored_path)
        
        # 解析文件
        parser = get_parser(file_type)
        samples = []
        try:
            samples = parser.parse(stored_path)
        except Exception as e:
            # 解析失败但仍记录文件
            pass
        
        # 保存解析结果到processed目录
        processed_info = None
        if samples:
            processed_subdir = self.processed_dir / file_type
            processed_subdir.mkdir(parents=True, exist_ok=True)
            
            processed_file = processed_subdir / f"{stored_name}.json"
            processed_data = {
                "file_type": file_type,
                "original_name": original_name,
                "stored_path": str(stored_path),
                "parsed_at": datetime.now().isoformat(),
                "sample_count": len(samples),
                "samples": [s.to_dict() for s in samples],
            }
            
            import json
            with open(processed_file, 'w', encoding='utf-8') as f:
                json.dump(processed_data, f, indent=2, ensure_ascii=False, default=str)
            
            processed_info = str(processed_file)
        
        # 构建导入记录
        ingest_record = {
            "id": f"ingest_{timestamp}_{file_type}",
            "original_name": original_name,
            "original_path": str(file_path.resolve()),
            "stored_path": str(stored_path),
            "processed_path": processed_info,
            "file_type": file_type,
            "file_size": file_path.stat().st_size,
            "file_hash": file_hash,
            "hash_algorithm": "SHA256",
            "ingested_at": datetime.now().isoformat(),
            "sample_count": len(samples),
        }
        
        return ingest_record
    
    def _calculate_file_hash(self, file_path: Path) -> str:
        """计算文件SHA256哈希"""
        sha256 = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)
        return sha256.hexdigest()
    
    def _find_existing_by_hash(self, file_hash: str) -> Optional[Dict]:
        """通过哈希查找已导入的文件"""
        for record in self.config.get("ingested_files", []):
            if record.get("file_hash") == file_hash:
                return record
        return None
    
    def get_ingested_samples(self) -> List[Sample]:
        """
        获取所有已导入的样点数据
        
        Returns:
            Sample对象列表
        """
        all_samples = []
        
        for record in self.config.get("ingested_files", []):
            processed_path = record.get("processed_path")
            if processed_path:
                try:
                    import json
                    with open(processed_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    for sample_dict in data.get("samples", []):
                        sample = Sample.from_dict(sample_dict)
                        all_samples.append(sample)
                except Exception as e:
                    # 忽略读取错误的文件
                    continue
        
        return all_samples

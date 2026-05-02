"""
文件读取解析器模块
- 扫描指定目录下的 txt 和 md 文件
- 按行读取内容，保留来源文件名和行号
- 过滤空行和无意义内容
"""

import os
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Optional, Generator
import re
import hashlib


@dataclass
class MaterialItem:
    """
    素材项数据结构
    """
    text: str
    source_file: str
    line_number: int
    id: str = field(default="")
    clean_text: str = field(default="")

    def __post_init__(self):
        if not self.clean_text:
            self.clean_text = self._clean_text(self.text)
        if not self.id:
            self.id = self._generate_id()

    def _clean_text(self, text: str) -> str:
        """
        清理文本，用于相似度计算
        - 去除 Markdown 格式符号
        - 去除多余空格和换行
        - 转换为小写
        """
        if not text:
            return ""
        
        cleaned = text
        
        cleaned = re.sub(r'[#*_`\[\]()\-=+~|\\]', ' ', cleaned)
        
        cleaned = re.sub(r'\s+', ' ', cleaned)
        
        cleaned = cleaned.strip()
        
        return cleaned

    def _generate_id(self) -> str:
        """
        基于来源文件、行号和清理后文本生成唯一ID
        用于状态持久化的键
        """
        content = f"{self.source_file}:{self.line_number}:{self.clean_text}"
        return hashlib.md5(content.encode('utf-8')).hexdigest()[:16]

    def is_valid(self, min_length: int = 5) -> bool:
        """
        判断该素材项是否有效（非空、达到最小长度）
        """
        if not self.clean_text:
            return False
        if len(self.clean_text) < min_length:
            return False
        return True


class FileReader:
    """
    文件读取器
    """
    
    SUPPORTED_EXTENSIONS = {'.txt', '.md'}
    
    def __init__(self, source_dir: str, min_length: int = 5, encoding: str = 'utf-8'):
        """
        初始化文件读取器
        
        Args:
            source_dir: 素材源目录
            min_length: 有效素材的最小字符长度
            encoding: 文件编码
        """
        self.source_dir = Path(source_dir).resolve()
        self.min_length = min_length
        self.encoding = encoding
        
        if not self.source_dir.exists():
            raise ValueError(f"源目录不存在: {self.source_dir}")
        if not self.source_dir.is_dir():
            raise ValueError(f"路径不是目录: {self.source_dir}")

    def list_files(self) -> List[Path]:
        """
        列出目录下所有支持的文件
        """
        files = []
        for ext in self.SUPPORTED_EXTENSIONS:
            files.extend(self.source_dir.glob(f"**/*{ext}"))
        return sorted(files)

    def read_file(self, file_path: Path) -> Generator[MaterialItem, None, None]:
        """
        读取单个文件，按行生成素材项
        
        Args:
            file_path: 文件路径
            
        Yields:
            MaterialItem: 素材项
        """
        try:
            with open(file_path, 'r', encoding=self.encoding) as f:
                for line_num, line in enumerate(f, 1):
                    item = MaterialItem(
                        text=line.rstrip('\n'),
                        source_file=str(file_path),
                        line_number=line_num
                    )
                    if item.is_valid(self.min_length):
                        yield item
        except UnicodeDecodeError:
            try:
                with open(file_path, 'r', encoding='gbk') as f:
                    for line_num, line in enumerate(f, 1):
                        item = MaterialItem(
                            text=line.rstrip('\n'),
                            source_file=str(file_path),
                            line_number=line_num
                        )
                        if item.is_valid(self.min_length):
                            yield item
            except Exception as e:
                print(f"无法读取文件 {file_path}: {e}")
        except Exception as e:
            print(f"读取文件时出错 {file_path}: {e}")

    def read_all(self) -> List[MaterialItem]:
        """
        读取所有文件，返回所有有效素材项
        
        Returns:
            List[MaterialItem]: 所有有效素材项列表
        """
        all_items = []
        files = self.list_files()
        
        for file_path in files:
            for item in self.read_file(file_path):
                all_items.append(item)
        
        return all_items

    def get_source_file(self, item: MaterialItem) -> str:
        """
        获取素材项的来源文件（相对路径）
        """
        try:
            return str(Path(item.source_file).relative_to(self.source_dir))
        except ValueError:
            return item.source_file


def read_materials(source_dir: str, min_length: int = 5) -> List[MaterialItem]:
    """
    便捷函数：读取目录下所有素材
    
    Args:
        source_dir: 素材源目录
        min_length: 有效素材最小长度
        
    Returns:
        List[MaterialItem]: 素材项列表
    """
    reader = FileReader(source_dir, min_length)
    return reader.read_all()

"""
文件解析模块
支持解析 txt、md、csv 格式的简历和岗位JD
"""
import re
import csv
import json
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, field

import pandas as pd

from .exceptions import FileParseError, EmptyContentError, MissingFieldError, InvalidFormatError
from config import CSV_FIELD_MAPPING, SUPPORTED_FORMATS


@dataclass
class Document:
    """文档数据类"""
    id: str
    title: str
    content: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    raw_text: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "metadata": self.metadata,
        }


class BaseParser:
    """基础解析器"""
    
    def parse(self, file_path: Union[str, Path]) -> Document:
        """解析文件"""
        raise NotImplementedError("子类必须实现 parse 方法")
    
    def _read_file(self, file_path: Union[str, Path]) -> str:
        """读取文件内容，处理编码问题"""
        file_path = Path(file_path)
        
        # 尝试多种编码
        encodings = ['utf-8', 'gbk', 'gb2312', 'gb18030', 'latin-1']
        content = None
        last_error = None
        
        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    content = f.read()
                break
            except (UnicodeDecodeError, UnicodeError) as e:
                last_error = e
                continue
        
        if content is None:
            raise FileParseError(f"无法解析文件 {file_path}: 编码错误 - {last_error}")
        
        # 清理BOM和不可见字符
        content = content.lstrip('\ufeff\ufffe')
        content = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', content)
        
        return content
    
    def _validate_content(self, content: str, file_path: Path) -> None:
        """验证内容是否为空"""
        if not content or not content.strip():
            raise EmptyContentError(f"文件 {file_path} 内容为空")


class TextParser(BaseParser):
    """纯文本解析器（.txt）"""
    
    def parse(self, file_path: Union[str, Path]) -> Document:
        file_path = Path(file_path)
        content = self._read_file(file_path)
        self._validate_content(content, file_path)
        
        # 提取标题：使用文件名或第一行
        lines = content.strip().split('\n')
        if lines:
            first_line = lines[0].strip()
            if len(first_line) < 100 and not first_line.startswith(('#', '##', '-', '*')):
                title = first_line
            else:
                title = file_path.stem
        else:
            title = file_path.stem
        
        return Document(
            id=file_path.stem,
            title=title,
            content=content,
            raw_text=content,
            metadata={
                "source": str(file_path),
                "format": "txt",
                "line_count": len(lines),
            }
        )


class MarkdownParser(BaseParser):
    """Markdown解析器（.md）"""
    
    def parse(self, file_path: Union[str, Path]) -> Document:
        file_path = Path(file_path)
        content = self._read_file(file_path)
        self._validate_content(content, file_path)
        
        # 提取标题：第一个 H1 标题
        title_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
        if title_match:
            title = title_match.group(1).strip()
        else:
            title = file_path.stem
        
        # 清理 Markdown 格式，提取纯文本内容
        clean_content = self._clean_markdown(content)
        
        return Document(
            id=file_path.stem,
            title=title,
            content=clean_content,
            raw_text=content,
            metadata={
                "source": str(file_path),
                "format": "md",
                "original_title": title,
            }
        )
    
    def _clean_markdown(self, text: str) -> str:
        """清理Markdown格式，返回纯文本"""
        # 移除代码块
        text = re.sub(r'```[\s\S]*?```', '', text)
        text = re.sub(r'`[^`]+`', '', text)
        
        # 移除标题符号
        text = re.sub(r'^#+\s+', '', text, flags=re.MULTILINE)
        
        # 移除链接和图片
        text = re.sub(r'!\[.*?\]\(.*?\)', '', text)
        text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
        
        # 移除强调符号
        text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
        text = re.sub(r'\*([^*]+)\*', r'\1', text)
        text = re.sub(r'__([^_]+)__', r'\1', text)
        text = re.sub(r'_([^_]+)_', r'\1', text)
        
        # 移除列表符号
        text = re.sub(r'^[\s]*[-*+]\s+', ' ', text, flags=re.MULTILINE)
        text = re.sub(r'^[\s]*\d+\.\s+', ' ', text, flags=re.MULTILINE)
        
        # 移除引用符号
        text = re.sub(r'^>\s+', ' ', text, flags=re.MULTILINE)
        
        # 清理多余空白
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = re.sub(r'[ \t]+', ' ', text)
        
        return text.strip()


class CSVParser(BaseParser):
    """CSV解析器（.csv）"""
    
    def parse(self, file_path: Union[str, Path], doc_type: str = "resumes") -> List[Document]:
        """
        解析CSV文件
        doc_type: "resumes" 或 "jobs"
        """
        file_path = Path(file_path)
        content = self._read_file(file_path)
        self._validate_content(content, file_path)
        
        # 解析CSV
        try:
            # 先尝试用pandas解析（更健壮）
            df = pd.read_csv(file_path, encoding='utf-8')
        except Exception as e:
            # 如果失败，尝试其他编码
            try:
                df = pd.read_csv(file_path, encoding='gbk')
            except Exception as e2:
                raise FileParseError(f"无法解析CSV文件 {file_path}: {e2}")
        
        # 检查必要字段
        field_mapping = CSV_FIELD_MAPPING.get(doc_type, {})
        required_fields = field_mapping.get("required", [])
        text_fields = field_mapping.get("text_fields", [])
        
        # 检查缺失字段
        missing_fields = [f for f in required_fields if f not in df.columns]
        if missing_fields:
            raise MissingFieldError(
                f"CSV文件 {file_path} 缺少必要字段: {', '.join(missing_fields)}\n"
                f"必要字段: {', '.join(required_fields)}\n"
                f"可选字段: {', '.join(field_mapping.get('optional', []))}"
            )
        
        documents = []
        
        for idx, row in df.iterrows():
            # 生成ID
            doc_id = f"{file_path.stem}_{idx}"
            
            # 确定标题
            if "name" in df.columns and pd.notna(row.get("name")):
                title = str(row["name"])
            elif "title" in df.columns and pd.notna(row.get("title")):
                title = str(row["title"])
            else:
                title = doc_id
            
            # 合并文本字段
            content_parts = []
            for field in text_fields:
                if field in df.columns and pd.notna(row.get(field)):
                    value = str(row[field]).strip()
                    if value:
                        content_parts.append(f"【{field}】\n{value}")
            
            content = "\n\n".join(content_parts)
            if not content.strip():
                # 如果没有文本字段，使用所有非空字段
                content_parts = []
                for col in df.columns:
                    if pd.notna(row.get(col)):
                        value = str(row[col]).strip()
                        if value and len(value) > 1:
                            content_parts.append(f"{col}: {value}")
                content = "\n".join(content_parts)
            
            # 构建元数据
            metadata = {}
            for col in df.columns:
                if pd.notna(row.get(col)):
                    val = row[col]
                    # 转换为可序列化类型
                    if isinstance(val, (int, float, bool, str)):
                        metadata[col] = val
                    else:
                        metadata[col] = str(val)
            
            # 验证内容
            if not content.strip():
                raise EmptyContentError(
                    f"CSV文件 {file_path} 第 {idx+1} 行没有有效内容"
                )
            
            documents.append(Document(
                id=doc_id,
                title=title,
                content=content,
                raw_text=content,
                metadata=metadata,
            ))
        
        return documents


class ParserFactory:
    """解析器工厂"""
    
    _parsers = {
        ".txt": TextParser,
        ".md": MarkdownParser,
        ".csv": CSVParser,
    }
    
    @classmethod
    def get_parser(cls, file_ext: str) -> BaseParser:
        """根据文件扩展名获取解析器"""
        parser_class = cls._parsers.get(file_ext.lower())
        if not parser_class:
            raise InvalidFormatError(
                f"不支持的文件格式: {file_ext}\n"
                f"支持的格式: {', '.join(cls._parsers.keys())}"
            )
        return parser_class()


class DocumentLoader:
    """文档加载器"""
    
    def __init__(self):
        self.parser_factory = ParserFactory()
    
    def load_file(
        self, 
        file_path: Union[str, Path], 
        doc_type: str = "resumes"
    ) -> List[Document]:
        """
        加载单个文件
        doc_type: "resumes" 或 "jobs"，仅对CSV有效
        """
        file_path = Path(file_path)
        
        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        if not file_path.is_file():
            raise FileParseError(f"不是有效文件: {file_path}")
        
        # 检查格式
        file_ext = file_path.suffix.lower()
        supported_formats = SUPPORTED_FORMATS.get(doc_type, [])
        
        if file_ext not in supported_formats:
            raise InvalidFormatError(
                f"文件 {file_path} 格式不被支持\n"
                f"支持的格式: {', '.join(supported_formats)}"
            )
        
        parser = self.parser_factory.get_parser(file_ext)
        
        try:
            if isinstance(parser, CSVParser):
                return parser.parse(file_path, doc_type)
            else:
                doc = parser.parse(file_path)
                return [doc]
        except Exception as e:
            if isinstance(e, (EmptyContentError, MissingFieldError)):
                raise
            raise FileParseError(f"解析文件 {file_path} 时出错: {e}")
    
    def load_directory(
        self, 
        dir_path: Union[str, Path], 
        doc_type: str = "resumes",
        recursive: bool = False
    ) -> List[Document]:
        """
        加载目录中的所有文件
        """
        dir_path = Path(dir_path)
        
        if not dir_path.exists():
            raise FileNotFoundError(f"目录不存在: {dir_path}")
        
        if not dir_path.is_dir():
            raise FileParseError(f"不是有效目录: {dir_path}")
        
        documents = []
        errors = []
        
        # 获取文件列表
        if recursive:
            files = dir_path.rglob("*")
        else:
            files = dir_path.iterdir()
        
        for file_path in files:
            if not file_path.is_file():
                continue
            
            # 检查扩展名
            file_ext = file_path.suffix.lower()
            supported_formats = SUPPORTED_FORMATS.get(doc_type, [])
            
            if file_ext not in supported_formats:
                continue
            
            try:
                docs = self.load_file(file_path, doc_type)
                documents.extend(docs)
            except Exception as e:
                errors.append(f"文件 {file_path.name}: {str(e)}")
        
        if not documents and errors:
            raise FileParseError(
                f"目录 {dir_path} 中没有成功加载任何文件\n"
                f"错误详情:\n" + "\n".join(errors)
            )
        
        return documents, errors

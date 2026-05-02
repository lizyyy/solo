"""PDF文件解析器"""
from pathlib import Path
from typing import Dict, Any, List, Optional

try:
    from pypdf import PdfReader
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False


def parse_pdf(file_path: str) -> Dict[str, Any]:
    """解析PDF文件，提取文本和元数据
    
    Args:
        file_path: PDF文件路径
    
    Returns:
        包含PDF信息的字典
    """
    if not HAS_PYPDF:
        raise ImportError("需要安装 pypdf 库: pip install pypdf")
    
    path = Path(file_path)
    
    if not path.exists():
        raise FileNotFoundError(f"文件不存在: {file_path}")
    
    reader = PdfReader(file_path)
    
    # 提取元数据
    metadata = {}
    if reader.metadata:
        meta = reader.metadata
        metadata = {
            "title": meta.title,
            "author": meta.author,
            "subject": meta.subject,
            "creator": meta.creator,
            "producer": meta.producer,
            "creation_date": str(meta.creation_date) if meta.creation_date else None,
            "modification_date": str(meta.modification_date) if meta.modification_date else None,
        }
    
    # 提取每页文本
    pages = []
    page_text = []
    
    for i, page in enumerate(reader.pages):
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        
        pages.append({
            "page_number": i + 1,
            "text_length": len(text),
            "text_preview": text[:200] if len(text) > 200 else text,
        })
        page_text.append(text)
    
    result = {
        "file_path": str(path.absolute()),
        "total_pages": len(reader.pages),
        "metadata": metadata,
        "pages": pages,
        "full_text": "\n\n".join(page_text),
        "is_encrypted": reader.is_encrypted,
    }
    
    return result


def get_pdf_page_count(file_path: str) -> int:
    """获取PDF页数
    
    Args:
        file_path: PDF文件路径
    
    Returns:
        页数
    """
    if not HAS_PYPDF:
        raise ImportError("需要安装 pypdf 库: pip install pypdf")
    
    reader = PdfReader(file_path)
    return len(reader.pages)


def extract_pdf_text(file_path: str, page_numbers: Optional[List[int]] = None) -> str:
    """提取PDF文本
    
    Args:
        file_path: PDF文件路径
        page_numbers: 指定页码列表（从1开始），None表示全部提取
    
    Returns:
        提取的文本
    """
    if not HAS_PYPDF:
        raise ImportError("需要安装 pypdf 库: pip install pypdf")
    
    reader = PdfReader(file_path)
    
    if page_numbers is None:
        pages = reader.pages
    else:
        pages = [reader.pages[i - 1] for i in page_numbers if 1 <= i <= len(reader.pages)]
    
    texts = []
    for page in pages:
        try:
            text = page.extract_text() or ""
            texts.append(text)
        except Exception:
            texts.append("")
    
    return "\n\n".join(texts)


def check_pdf_signatures(file_path: str) -> Dict[str, Any]:
    """检查PDF签名页（简单检查，不是数字签名）
    
    Args:
        file_path: PDF文件路径
    
    Returns:
        签名检查结果
    """
    result = {
        "has_signature_fields": False,
        "signature_fields": [],
        "pages_with_signatures": [],
    }
    
    if not HAS_PYPDF:
        return result
    
    try:
        reader = PdfReader(file_path)
        
        for i, page in enumerate(reader.pages):
            try:
                # 检查页面上的签名字段
                if "/Annots" in page:
                    annotations = page["/Annots"]
                    for annot in annotations:
                        annot_obj = annot.get_object()
                        if annot_obj.get("/Subtype") == "/Sig":
                            result["has_signature_fields"] = True
                            result["signature_fields"].append({
                                "page": i + 1,
                                "field_name": str(annot_obj.get("/T", "")),
                            })
                            if i + 1 not in result["pages_with_signatures"]:
                                result["pages_with_signatures"].append(i + 1)
            except Exception:
                continue
        
        # 如果没有签名字段，尝试通过文本关键词检测
        if not result["has_signature_fields"]:
            signature_keywords = [
                "签名", "签字", "签章", "盖章", "公章",
                "签名处", "签字处", "盖章处",
                "sign", "signature", "stamp",
                "法定代表人", "授权代表",
            ]
            
            for i, page in enumerate(reader.pages):
                try:
                    text = page.extract_text() or ""
                    text_lower = text.lower()
                    
                    for keyword in signature_keywords:
                        if keyword in text or keyword.lower() in text_lower:
                            result["has_signature_fields"] = True
                            result["pages_with_signatures"].append(i + 1)
                            break
                except Exception:
                    continue
    
    except Exception:
        pass
    
    return result

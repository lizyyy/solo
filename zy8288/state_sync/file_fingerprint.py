import hashlib
import pandas as pd
from typing import Union, Optional
from pathlib import Path


def compute_file_fingerprint(
    file_content: bytes,
    filename: Optional[str] = None
) -> str:
    """
    计算文件的指纹，用于唯一标识文件内容。
    
    使用 MD5 哈希算法计算文件内容的指纹，
    同时考虑文件名作为辅助标识（可选）。
    
    Args:
        file_content: 文件的二进制内容
        filename: 文件名（可选）
        
    Returns:
        文件指纹的十六进制字符串
    """
    hasher = hashlib.md5()
    hasher.update(file_content)
    
    if filename:
        hasher.update(filename.encode('utf-8'))
    
    return hasher.hexdigest()


def compute_dataframe_fingerprint(df: pd.DataFrame) -> str:
    """
    计算 DataFrame 的指纹，用于检测数据内容变化。
    
    首先对 DataFrame 进行规范化处理，然后计算哈希值。
    
    Args:
        df: pandas DataFrame
        
    Returns:
        DataFrame 指纹的十六进制字符串
    """
    normalized_df = df.copy()
    normalized_df = normalized_df.fillna('')
    normalized_df = normalized_df.astype(str)
    
    rows_hash = hashlib.sha256()
    for _, row in normalized_df.iterrows():
        row_str = '|'.join(row.values)
        rows_hash.update(row_str.encode('utf-8'))
    
    return rows_hash.hexdigest()


def get_file_info(
    file_content: bytes,
    filename: Optional[str] = None
) -> dict:
    """
    获取文件的完整信息，包括指纹、大小等。
    
    Args:
        file_content: 文件的二进制内容
        filename: 文件名（可选）
        
    Returns:
        包含文件信息的字典
    """
    file_size = len(file_content)
    fingerprint = compute_file_fingerprint(file_content, filename)
    
    file_type = None
    if filename:
        file_ext = Path(filename).suffix.lower()
        if file_ext == '.csv':
            file_type = 'csv'
        elif file_ext in ('.xlsx', '.xls'):
            file_type = 'excel'
    
    return {
        'fingerprint': fingerprint,
        'size': file_size,
        'file_type': file_type,
        'filename': filename,
    }

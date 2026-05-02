"""CSV文件解析器"""
import csv
from pathlib import Path
from typing import Dict, Any, List, Optional
from io import StringIO


def parse_csv(file_path: str, encoding: str = "utf-8") -> Dict[str, Any]:
    """解析CSV文件，提取数据和元数据
    
    Args:
        file_path: CSV文件路径
        encoding: 文件编码
    
    Returns:
        包含CSV信息的字典
    """
    path = Path(file_path)
    
    if not path.exists():
        raise FileNotFoundError(f"文件不存在: {file_path}")
    
    result = {
        "file_path": str(path.absolute()),
        "row_count": 0,
        "column_count": 0,
        "columns": [],
        "sample_rows": [],
        "encoding": encoding,
    }
    
    try:
        # 尝试自动检测编码
        detected_encoding = detect_csv_encoding(file_path)
        if detected_encoding:
            result["detected_encoding"] = detected_encoding
            encoding = detected_encoding
        
        with open(file_path, "r", encoding=encoding) as f:
            # 尝试检测CSV方言
            content = f.read(10000)  # 读取部分内容用于检测
            f.seek(0)
            
            try:
                dialect = csv.Sniffer().sniff(content)
                result["dialect"] = {
                    "delimiter": dialect.delimiter,
                    "quotechar": dialect.quotechar,
                    "doublequote": dialect.doublequote,
                    "skipinitialspace": dialect.skipinitialspace,
                    "lineterminator": dialect.lineterminator,
                }
                reader = csv.reader(f, dialect=dialect)
            except Exception:
                reader = csv.reader(f)
            
            rows = list(reader)
            
            if rows:
                # 假设第一行是表头
                header = rows[0]
                data_rows = rows[1:]
                
                result["columns"] = header
                result["column_count"] = len(header)
                result["row_count"] = len(data_rows)
                
                # 保存前10行作为示例
                sample_count = min(10, len(data_rows))
                for i in range(sample_count):
                    row_dict = {}
                    for j, col in enumerate(header):
                        row_dict[col] = data_rows[i][j] if j < len(data_rows[i]) else ""
                    result["sample_rows"].append(row_dict)
                
                # 分析列类型
                result["column_types"] = analyze_column_types(header, data_rows)
    
    except UnicodeDecodeError:
        # 尝试其他常见编码
        for alt_encoding in ["gbk", "gb2312", "gb18030", "utf-8-sig"]:
            try:
                return parse_csv(file_path, alt_encoding)
            except UnicodeDecodeError:
                continue
        raise ValueError(f"无法识别文件编码: {file_path}")
    
    except Exception as e:
        result["error"] = str(e)
    
    return result


def detect_csv_encoding(file_path: str) -> Optional[str]:
    """检测CSV文件编码
    
    Args:
        file_path: CSV文件路径
    
    Returns:
        检测到的编码或None
    """
    encodings_to_try = ["utf-8", "utf-8-sig", "gbk", "gb2312", "gb18030", "latin-1"]
    
    for encoding in encodings_to_try:
        try:
            with open(file_path, "r", encoding=encoding) as f:
                f.read(1000)
            return encoding
        except (UnicodeDecodeError, UnicodeError):
            continue
    
    return None


def analyze_column_types(headers: List[str], data_rows: List[List[str]]) -> Dict[str, str]:
    """分析列的类型
    
    Args:
        headers: 表头列表
        data_rows: 数据行列表
    
    Returns:
        列名到类型的映射
    """
    result = {}
    
    if not data_rows:
        return result
    
    import re
    
    for col_idx, header in enumerate(headers):
        # 收集该列的样本值
        sample_values = []
        for row in data_rows[:100]:  # 只检查前100行
            if col_idx < len(row):
                val = row[col_idx].strip()
                if val:
                    sample_values.append(val)
        
        if not sample_values:
            result[header] = "empty"
            continue
        
        # 检查可能的类型
        type_scores = {
            "id_card": 0,
            "phone": 0,
            "email": 0,
            "date": 0,
            "number": 0,
            "text": 0,
        }
        
        # 身份证号模式
        id_card_pattern = r"^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$"
        
        # 手机号模式
        phone_pattern = r"^1[3-9]\d{9}$"
        
        # 邮箱模式
        email_pattern = r"^[\w\.-]+@[\w\.-]+\.\w+$"
        
        # 日期模式
        date_patterns = [
            r"^\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?$",
            r"^\d{1,2}[-/月]\d{1,2}[-/日]\d{4}$",
        ]
        
        # 数字模式
        number_pattern = r"^-?\d+(\.\d+)?$"
        
        for val in sample_values[:20]:
            if re.match(id_card_pattern, val):
                type_scores["id_card"] += 1
            if re.match(phone_pattern, val):
                type_scores["phone"] += 1
            if re.match(email_pattern, val):
                type_scores["email"] += 1
            if any(re.match(p, val) for p in date_patterns):
                type_scores["date"] += 1
            if re.match(number_pattern, val):
                type_scores["number"] += 1
            if len(val) > 10:
                type_scores["text"] += 1
        
        # 找出得分最高的类型
        max_type = max(type_scores, key=lambda k: type_scores[k])
        
        # 如果所有类型得分都为0，则为text
        if type_scores[max_type] == 0:
            max_type = "text"
        
        result[header] = max_type
    
    return result


def extract_csv_text(file_path: str, encoding: str = "utf-8") -> str:
    """将CSV内容提取为纯文本格式
    
    Args:
        file_path: CSV文件路径
        encoding: 文件编码
    
    Returns:
        格式化的文本
    """
    result = parse_csv(file_path, encoding)
    
    if "error" in result:
        return f"解析错误: {result['error']}"
    
    lines = []
    lines.append(f"文件: {result['file_path']}")
    lines.append(f"行数: {result['row_count']}, 列数: {result['column_count']}")
    lines.append("=" * 60)
    lines.append(" | ".join(result["columns"]))
    lines.append("-" * 60)
    
    for row in result["sample_rows"]:
        row_str = " | ".join(str(row.get(col, "")) for col in result["columns"])
        lines.append(row_str)
    
    if result["row_count"] > len(result["sample_rows"]):
        lines.append(f"... 还有 {result['row_count'] - len(result['sample_rows'])} 行 ...")
    
    return "\n".join(lines)

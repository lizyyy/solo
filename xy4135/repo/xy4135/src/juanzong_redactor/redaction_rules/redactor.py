"""脱敏处理器 - 核心脱敏处理逻辑"""
import re
import os
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime

from juanzong_redactor.redaction_rules.rules import (
    RedactionRule,
    get_all_rules,
    get_rules_by_names,
    get_default_rule_names,
)
from juanzong_redactor.file_parser import (
    extract_pdf_text,
    extract_csv_text,
    parse_csv,
)


class Redactor:
    """脱敏处理器类"""
    
    def __init__(
        self,
        rules: Optional[List[str]] = None,
        preserve_words: Optional[List[str]] = None,
        custom_rules: Optional[Dict[str, Dict[str, Any]]] = None,
    ):
        """初始化脱敏处理器
        
        Args:
            rules: 要使用的规则名称列表，None表示使用默认规则
            preserve_words: 需要保留不脱敏的关键词列表
            custom_rules: 自定义规则，格式为 {name: {"pattern": r"xxx", "mask_function": func}}
        """
        # 获取规则
        if rules is None:
            rule_names = get_default_rule_names()
            self.rules = get_rules_by_names(rule_names)
        else:
            self.rules = get_rules_by_names(rules)
        
        # 添加自定义规则
        if custom_rules:
            for name, config in custom_rules.items():
                pattern = config.get("pattern")
                mask_func = config.get("mask_function", lambda x: "*" * len(x))
                
                if pattern:
                    self.rules[name] = RedactionRule(
                        name=name,
                        display_name=config.get("display_name", name),
                        description=config.get("description", "自定义规则"),
                        pattern=re.compile(pattern),
                        mask_function=mask_func,
                    )
        
        # 保留词
        self.preserve_words = set(preserve_words) if preserve_words else set()
        
        # 预处理保留词的正则表达式
        self.preserve_patterns = []
        for word in self.preserve_words:
            if word:
                self.preserve_patterns.append(re.compile(re.escape(word)))
    
    def redact_text(
        self,
        text: str,
        return_details: bool = True,
    ) -> Dict[str, Any]:
        """对文本进行脱敏处理
        
        Args:
            text: 要脱敏的原始文本
            return_details: 是否返回详细信息
        
        Returns:
            包含脱敏结果的字典
        """
        result = {
            "original_text": text if return_details else None,
            "redacted_text": text,
            "found_items": 0,
            "details": [] if return_details else None,
        }
        
        # 按规则处理
        current_text = text
        
        # 先记录所有匹配位置，避免替换时的位置偏移问题
        all_matches = []
        
        for rule_name, rule in self.rules.items():
            if not rule.enabled:
                continue
            
            matches = list(rule.pattern.finditer(current_text))
            
            for match in matches:
                matched_text = match.group()
                
                # 检查是否在保留词中
                if self._is_preserved(matched_text, current_text):
                    continue
                
                all_matches.append({
                    "start": match.start(),
                    "end": match.end(),
                    "text": matched_text,
                    "rule": rule,
                    "rule_name": rule_name,
                })
        
        # 按位置排序
        all_matches.sort(key=lambda x: x["start"])
        
        # 过滤重叠的匹配（优先保留更长的匹配）
        filtered_matches = []
        last_end = -1
        
        for match in all_matches:
            if match["start"] >= last_end:
                filtered_matches.append(match)
                last_end = match["end"]
        
        # 执行替换
        if filtered_matches:
            parts = []
            current_pos = 0
            
            for match in filtered_matches:
                # 添加匹配前的文本
                if match["start"] > current_pos:
                    parts.append(current_text[current_pos:match["start"]])
                
                # 生成脱敏后的文本
                masked_text = match["rule"].mask_function(match["text"])
                parts.append(masked_text)
                
                # 记录详情
                if return_details:
                    result["details"].append({
                        "type": match["rule"].display_name,
                        "original": match["text"],
                        "masked": masked_text,
                        "position": (match["start"], match["end"]),
                        "rule": match["rule_name"],
                    })
                
                current_pos = match["end"]
            
            # 添加剩余文本
            if current_pos < len(current_text):
                parts.append(current_text[current_pos:])
            
            result["redacted_text"] = "".join(parts)
            result["found_items"] = len(filtered_matches)
        
        return result
    
    def _is_preserved(self, matched_text: str, full_text: str) -> bool:
        """检查匹配的文本是否应该被保留
        
        Args:
            matched_text: 匹配到的文本
            full_text: 完整文本
        
        Returns:
            是否应该保留
        """
        if not self.preserve_words:
            return False
        
        # 检查匹配文本本身是否是保留词
        if matched_text in self.preserve_words:
            return True
        
        # 检查匹配文本是否包含在保留词中
        for word in self.preserve_words:
            if matched_text in word:
                return True
        
        return False
    
    def redact_file(
        self,
        file_path: str,
        output_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        """对文件进行脱敏处理
        
        Args:
            file_path: 源文件路径
            output_path: 输出文件路径（对于文本文件保存脱敏后的内容）
        
        Returns:
            包含脱敏结果的字典
        """
        path = Path(file_path)
        
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        result = {
            "source_file": str(path.absolute()),
            "output_path": output_path,
            "timestamp": datetime.now().isoformat(),
            "found_items": 0,
            "details": [],
            "by_page": [],
        }
        
        extension = path.suffix.lower()
        
        # 根据文件类型处理
        if extension == ".csv":
            return self._redact_csv(file_path, output_path, result)
        elif extension == ".pdf":
            return self._redact_pdf(file_path, output_path, result)
        elif extension in [".txt", ".md", ".json", ".xml"]:
            return self._redact_text_file(file_path, output_path, result)
        else:
            # 默认作为文本处理
            return self._redact_text_file(file_path, output_path, result)
    
    def _redact_text_file(
        self,
        file_path: str,
        output_path: Optional[str],
        base_result: Dict[str, Any],
    ) -> Dict[str, Any]:
        """脱敏文本文件"""
        encodings = ["utf-8", "gbk", "gb2312", "utf-8-sig", "latin-1"]
        text = None
        used_encoding = None
        
        for encoding in encodings:
            try:
                with open(file_path, "r", encoding=encoding) as f:
                    text = f.read()
                used_encoding = encoding
                break
            except UnicodeDecodeError:
                continue
        
        if text is None:
            raise ValueError(f"无法读取文件编码: {file_path}")
        
        base_result["encoding"] = used_encoding
        
        # 脱敏处理
        redact_result = self.redact_text(text, return_details=True)
        
        base_result["found_items"] = redact_result["found_items"]
        base_result["details"] = redact_result["details"]
        
        # 保存脱敏后的文件
        if output_path and redact_result["found_items"] > 0:
            with open(output_path, "w", encoding=used_encoding) as f:
                f.write(redact_result["redacted_text"])
            base_result["output_path"] = output_path
        
        return base_result
    
    def _redact_csv(
        self,
        file_path: str,
        output_path: Optional[str],
        base_result: Dict[str, Any],
    ) -> Dict[str, Any]:
        """脱敏CSV文件"""
        import csv
        
        csv_info = parse_csv(file_path)
        
        if "error" in csv_info:
            base_result["error"] = csv_info["error"]
            return base_result
        
        # 读取CSV内容
        rows = []
        header = None
        
        detected_encoding = csv_info.get("detected_encoding", "utf-8")
        
        with open(file_path, "r", encoding=detected_encoding) as f:
            reader = csv.reader(f)
            for i, row in enumerate(reader):
                if i == 0:
                    header = row
                rows.append(row)
        
        # 对每个单元格进行脱敏
        total_found = 0
        all_details = []
        
        for row_idx, row in enumerate(rows):
            for col_idx, cell in enumerate(row):
                if not cell:
                    continue
                
                # 检查列类型，如果是敏感信息列，则脱敏
                column_name = header[col_idx] if header and col_idx < len(header) else f"列{col_idx}"
                
                redact_result = self.redact_text(cell, return_details=True)
                
                if redact_result["found_items"] > 0:
                    total_found += redact_result["found_items"]
                    
                    # 添加位置信息
                    for detail in redact_result["details"]:
                        detail["row"] = row_idx + 1
                        detail["column"] = column_name
                        all_details.append(detail)
                    
                    # 替换单元格内容
                    rows[row_idx][col_idx] = redact_result["redacted_text"]
        
        base_result["found_items"] = total_found
        base_result["details"] = all_details
        
        # 保存脱敏后的CSV
        if output_path and total_found > 0:
            with open(output_path, "w", encoding=detected_encoding, newline="") as f:
                writer = csv.writer(f)
                writer.writerows(rows)
            base_result["output_path"] = output_path
        
        return base_result
    
    def _redact_pdf(
        self,
        file_path: str,
        output_path: Optional[str],
        base_result: Dict[str, Any],
    ) -> Dict[str, Any]:
        """脱敏PDF文件（文本提取和分析，不修改原始PDF）"""
        try:
            from juanzong_redactor.file_parser.pdf_parser import get_pdf_page_count
            
            page_count = get_pdf_page_count(file_path)
            base_result["page_count"] = page_count
            
            total_found = 0
            all_details = []
            by_page = []
            
            # 逐页分析
            for page_num in range(1, page_count + 1):
                page_text = extract_pdf_text(file_path, [page_num])
                
                redact_result = self.redact_text(page_text, return_details=True)
                
                page_info = {
                    "page_number": page_num,
                    "found_items": redact_result["found_items"],
                    "text_preview": page_text[:200] if len(page_text) > 200 else page_text,
                    "redacted_preview": redact_result["redacted_text"][:200] if len(redact_result["redacted_text"]) > 200 else redact_result["redacted_text"],
                }
                
                by_page.append(page_info)
                
                if redact_result["found_items"] > 0:
                    total_found += redact_result["found_items"]
                    
                    # 添加页码信息
                    for detail in redact_result["details"]:
                        detail["page"] = page_num
                        all_details.append(detail)
            
            base_result["found_items"] = total_found
            base_result["details"] = all_details
            base_result["by_page"] = by_page
            
            # 注意：PDF脱敏涉及复杂的格式，这里只做分析报告
            # 实际修改PDF需要更复杂的库如 PyMuPDF 或 reportlab
            if output_path:
                # 保存脱敏后的文本到文本文件
                full_text = extract_pdf_text(file_path)
                redact_result = self.redact_text(full_text)
                
                text_output = str(Path(output_path).with_suffix(".txt"))
                with open(text_output, "w", encoding="utf-8") as f:
                    f.write(redact_result["redacted_text"])
                
                base_result["output_path"] = text_output
                base_result["note"] = "PDF脱敏仅导出文本版本，原始PDF未修改"
            
            return base_result
        
        except ImportError:
            base_result["error"] = "需要安装 pypdf 库才能处理PDF文件"
            return base_result
    
    def analyze_text(
        self,
        text: str,
    ) -> Dict[str, Any]:
        """仅分析文本中的敏感信息，不执行脱敏
        
        Args:
            text: 要分析的文本
        
        Returns:
            包含分析结果的字典
        """
        result = {
            "total_found": 0,
            "by_rule": {},
            "matches": [],
        }
        
        for rule_name, rule in self.rules.items():
            if not rule.enabled:
                continue
            
            matches = list(rule.pattern.finditer(text))
            
            rule_matches = []
            for match in matches:
                matched_text = match.group()
                
                if self._is_preserved(matched_text, text):
                    continue
                
                rule_matches.append({
                    "text": matched_text,
                    "start": match.start(),
                    "end": match.end(),
                    "masked": rule.mask_function(matched_text),
                })
            
            if rule_matches:
                result["total_found"] += len(rule_matches)
                result["by_rule"][rule_name] = {
                    "display_name": rule.display_name,
                    "count": len(rule_matches),
                    "matches": rule_matches,
                }
                result["matches"].extend(rule_matches)
        
        return result

"""目录校验模块 - 页码、哈希重复、缺签名页、保留词误伤检查"""
import os
import re
from pathlib import Path
from typing import Dict, List, Any, Optional, Set, Tuple
from collections import defaultdict
from datetime import datetime

from juanzong_redactor.file_parser import (
    get_pdf_page_count,
    check_pdf_signatures,
    check_image_signatures,
)
from juanzong_redactor.redaction_rules import Redactor


class Validator:
    """校验器类"""
    
    def __init__(self):
        """初始化校验器"""
        self.issues = []
    
    def validate(
        self,
        scan_data: Dict[str, Any],
        catalog_path: Optional[str] = None,
        checks: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """执行校验
        
        Args:
            scan_data: 扫描结果数据
            catalog_path: 材料目录文件路径
            checks: 要执行的检查项目列表
        
        Returns:
            包含校验结果的字典
        """
        self.issues = []
        result = {
            "timestamp": datetime.now().isoformat(),
            "checks_performed": [],
            "total_files": scan_data.get("total_files", 0),
            "issues": [],
            "summary": {
                "errors": 0,
                "warnings": 0,
                "info": 0,
            },
        }
        
        # 确定要执行的检查
        all_checks = ["page", "hash", "signature", "preserve"]
        if checks is None:
            checks_to_run = all_checks
        else:
            checks_to_run = [c for c in checks if c in all_checks]
        
        result["checks_performed"] = checks_to_run
        
        # 执行各项检查
        files = scan_data.get("files", [])
        
        if "page" in checks_to_run:
            page_issues = self.check_page_numbers(files, catalog_path)
            self.issues.extend(page_issues)
        
        if "hash" in checks_to_run:
            hash_issues = self.check_duplicate_hashes(files)
            self.issues.extend(hash_issues)
        
        if "signature" in checks_to_run:
            signature_issues = self.check_missing_signatures(files)
            self.issues.extend(signature_issues)
        
        if "preserve" in checks_to_run:
            # 保留词检查需要额外的参数
            pass
        
        result["issues"] = self.issues
        
        # 统计
        for issue in self.issues:
            severity = issue.get("severity", "info")
            if severity == "error":
                result["summary"]["errors"] += 1
            elif severity == "warning":
                result["summary"]["warnings"] += 1
            else:
                result["summary"]["info"] += 1
        
        return result
    
    def check_page_numbers(
        self,
        files: List[Dict[str, Any]],
        catalog_path: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """检查页码连续性和目录匹配
        
        Args:
            files: 文件列表
            catalog_path: 目录文件路径
        
        Returns:
            问题列表
        """
        issues = []
        
        # 分析文件名中的页码
        page_info = self._extract_page_numbers_from_files(files)
        
        if page_info["page_numbers"]:
            # 检查页码连续性
            sorted_pages = sorted(page_info["page_numbers"])
            expected_pages = set(range(sorted_pages[0], sorted_pages[-1] + 1))
            actual_pages = set(sorted_pages)
            
            missing_pages = expected_pages - actual_pages
            if missing_pages:
                issues.append({
                    "type": "page_missing",
                    "severity": "error",
                    "message": f"发现缺失页码: {sorted(missing_pages)}",
                    "details": {
                        "expected_range": (sorted_pages[0], sorted_pages[-1]),
                        "missing_pages": sorted(missing_pages),
                    },
                })
            
            # 检查重复页码
            page_count = defaultdict(int)
            for p in page_info["page_numbers"]:
                page_count[p] += 1
            
            duplicate_pages = [p for p, c in page_count.items() if c > 1]
            if duplicate_pages:
                issues.append({
                    "type": "page_duplicate",
                    "severity": "error",
                    "message": f"发现重复页码: {duplicate_pages}",
                    "details": {
                        "duplicate_pages": duplicate_pages,
                        "files_by_page": page_info.get("files_by_page", {}),
                    },
                })
        
        # 如果有目录文件，尝试解析并比对
        if catalog_path:
            catalog_pages = self._parse_catalog_file(catalog_path)
            if catalog_pages:
                issues.extend(self._compare_with_catalog(page_info, catalog_pages))
        
        # 检查PDF页数
        for file_info in files:
            file_type = file_info.get("file_type", "")
            file_path = file_info.get("absolute_path", "")
            
            if file_type == "pdf":
                try:
                    page_count = get_pdf_page_count(file_path)
                    
                    # 检查是否为多页PDF
                    if page_count > 1:
                        issues.append({
                            "type": "pdf_multipage",
                            "severity": "info",
                            "message": f"发现多页PDF: {file_info['name']} ({page_count}页)",
                            "details": {
                                "file": file_info["path"],
                                "page_count": page_count,
                            },
                        })
                except Exception as e:
                    issues.append({
                        "type": "pdf_read_error",
                        "severity": "warning",
                        "message": f"无法读取PDF页数: {file_info['name']}",
                        "details": {
                            "file": file_info["path"],
                            "error": str(e),
                        },
                    })
        
        return issues
    
    def _extract_page_numbers_from_files(
        self,
        files: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """从文件名中提取页码
        
        Args:
            files: 文件列表
        
        Returns:
            页码信息字典
        """
        result = {
            "page_numbers": [],
            "files_by_page": defaultdict(list),
            "unable_to_extract": [],
        }
        
        # 常见的页码模式
        patterns = [
            r"第(\d+)页",
            r"p(\d+)",
            r"P(\d+)",
            r"页(\d+)",
            r"[-_](\d+)[-_]",
            r"[-_](\d+)$",
            r"^(\d+)[-_]",
        ]
        
        for file_info in files:
            name = file_info.get("name", "")
            stem = Path(name).stem
            found = False
            
            for pattern in patterns:
                match = re.search(pattern, stem)
                if match:
                    page_num = int(match.group(1))
                    result["page_numbers"].append(page_num)
                    result["files_by_page"][page_num].append(file_info["path"])
                    found = True
                    break
            
            # 尝试直接提取数字
            if not found:
                numbers = re.findall(r"\d+", stem)
                if len(numbers) == 1:
                    page_num = int(numbers[0])
                    if 1 <= page_num <= 1000:  # 合理的页码范围
                        result["page_numbers"].append(page_num)
                        result["files_by_page"][page_num].append(file_info["path"])
                        found = True
            
            if not found:
                result["unable_to_extract"].append(file_info["path"])
        
        return result
    
    def _parse_catalog_file(self, catalog_path: str) -> Dict[str, Any]:
        """解析目录文件
        
        Args:
            catalog_path: 目录文件路径
        
        Returns:
            目录信息
        """
        result = {
            "items": [],
            "total_pages": 0,
        }
        
        path = Path(catalog_path)
        
        if path.suffix.lower() == ".csv":
            # 解析CSV目录
            try:
                import csv
                with open(catalog_path, "r", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        # 尝试提取页码信息
                        item = {
                            "name": row.get("名称", row.get("name", "")),
                            "start_page": row.get("起始页", row.get("start_page", "")),
                            "end_page": row.get("结束页", row.get("end_page", "")),
                            "page_count": row.get("页数", row.get("page_count", "")),
                        }
                        
                        # 转换页码为数字
                        try:
                            if item["start_page"]:
                                item["start_page"] = int(item["start_page"])
                            if item["end_page"]:
                                item["end_page"] = int(item["end_page"])
                            if item["page_count"]:
                                item["page_count"] = int(item["page_count"])
                        except (ValueError, TypeError):
                            pass
                        
                        result["items"].append(item)
            except Exception:
                pass
        
        return result
    
    def _compare_with_catalog(
        self,
        file_page_info: Dict[str, Any],
        catalog_info: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """与目录比对
        
        Args:
            file_page_info: 文件页码信息
            catalog_info: 目录信息
        
        Returns:
            问题列表
        """
        issues = []
        
        # 简单比对：检查期望的总页数
        if catalog_info["items"]:
            # 从目录计算期望的页码范围
            all_pages = set()
            for item in catalog_info["items"]:
                start = item.get("start_page")
                end = item.get("end_page")
                count = item.get("page_count")
                
                if start and end:
                    for p in range(int(start), int(end) + 1):
                        all_pages.add(p)
                elif start and count:
                    for p in range(int(start), int(start) + int(count)):
                        all_pages.add(p)
            
            if all_pages:
                file_pages = set(file_page_info["page_numbers"])
                
                missing_in_files = all_pages - file_pages
                extra_in_files = file_pages - all_pages
                
                if missing_in_files:
                    issues.append({
                        "type": "catalog_mismatch",
                        "severity": "error",
                        "message": f"目录中存在但文件中缺失的页码: {sorted(missing_in_files)}",
                        "details": {
                            "expected_pages": sorted(all_pages),
                            "missing_pages": sorted(missing_in_files),
                        },
                    })
                
                if extra_in_files:
                    issues.append({
                        "type": "catalog_mismatch",
                        "severity": "warning",
                        "message": f"文件中存在但目录中未记录的页码: {sorted(extra_in_files)}",
                        "details": {
                            "extra_pages": sorted(extra_in_files),
                        },
                    })
        
        return issues
    
    def check_duplicate_hashes(
        self,
        files: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """检查重复文件（通过哈希值）
        
        Args:
            files: 文件列表
        
        Returns:
            问题列表
        """
        issues = []
        
        # 按哈希值分组
        hash_groups = defaultdict(list)
        
        for file_info in files:
            sha256 = file_info.get("hash_sha256")
            md5 = file_info.get("hash_md5")
            
            # 使用SHA256作为主要哈希
            if sha256:
                hash_groups[sha256].append(file_info)
        
        # 检查重复
        for file_hash, file_list in hash_groups.items():
            if len(file_list) > 1:
                # 按大小排序，确认是否真正重复
                sizes = set(f.get("size", 0) for f in file_list)
                
                if len(sizes) == 1:
                    # 完全相同
                    issues.append({
                        "type": "hash_duplicate",
                        "severity": "error",
                        "message": f"发现完全重复的文件 (SHA256: {file_hash[:16]}...)",
                        "details": {
                            "hash": file_hash,
                            "files": [f["path"] for f in file_list],
                            "size": file_list[0].get("size", 0),
                            "size_human": file_list[0].get("size_human", ""),
                        },
                    })
                else:
                    # 哈希碰撞（极不可能）或不同文件
                    issues.append({
                        "type": "hash_collision",
                        "severity": "warning",
                        "message": f"发现哈希相同但大小不同的文件 (SHA256: {file_hash[:16]}...)",
                        "details": {
                            "hash": file_hash,
                            "files": [{"path": f["path"], "size": f["size"]} for f in file_list],
                        },
                    })
        
        return issues
    
    def check_missing_signatures(
        self,
        files: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """检查缺签名页
        
        Args:
            files: 文件列表
        
        Returns:
            问题列表
        """
        issues = []
        
        # 找出所有可能的合同/协议文件
        signature_keywords = [
            "合同", "协议", "委托书", "授权书", "声明", "承诺",
            "保证", "担保", "借条", "欠条", "收据",
            "contract", "agreement", "signature", "sign",
        ]
        
        for file_info in files:
            name = file_info.get("name", "")
            name_lower = name.lower()
            file_type = file_info.get("file_type", "")
            file_path = file_info.get("absolute_path", "")
            
            # 检查文件名是否暗示需要签名
            needs_signature = any(kw in name or kw.lower() in name_lower for kw in signature_keywords)
            
            if needs_signature:
                # 检查是否有签名
                has_signature = False
                
                if file_type == "pdf":
                    try:
                        sig_info = check_pdf_signatures(file_path)
                        has_signature = sig_info.get("has_signature_fields", False)
                    except Exception:
                        pass
                
                elif file_type == "image":
                    try:
                        sig_info = check_image_signatures(file_path)
                        has_signature = sig_info.get("likely_has_signature", False)
                    except Exception:
                        pass
                
                if not has_signature:
                    issues.append({
                        "type": "signature_missing",
                        "severity": "warning",
                        "message": f"可能缺少签名页: {name}",
                        "details": {
                            "file": file_info["path"],
                            "reason": "文件名暗示需要签名但未检测到签名特征",
                        },
                    })
        
        return issues
    
    def check_preserve_word_accidents(
        self,
        files: List[Dict[str, Any]],
        preserve_words: List[str],
        redactor: Optional[Redactor] = None,
    ) -> List[Dict[str, Any]]:
        """检查保留词是否可能被误伤
        
        Args:
            files: 文件列表
            preserve_words: 保留词列表
            redactor: 脱敏处理器实例
        
        Returns:
            问题列表
        """
        issues = []
        
        if not preserve_words:
            return issues
        
        # 检查每个保留词是否可能匹配脱敏规则
        if redactor is None:
            redactor = Redactor()
        
        for word in preserve_words:
            # 分析这个词是否会被识别为敏感信息
            analysis = redactor.analyze_text(word)
            
            if analysis["total_found"] > 0:
                # 这个词可能被误伤
                matches = analysis.get("matches", [])
                rules = []
                for match in matches:
                    for rule_name, rule_info in analysis.get("by_rule", {}).items():
                        if any(m.get("text") == match.get("text") for m in rule_info.get("matches", [])):
                            rules.append(rule_info.get("display_name", rule_name))
                            break
                
                issues.append({
                    "type": "preserve_risk",
                    "severity": "warning",
                    "message": f"保留词 '{word}' 可能被脱敏规则误伤",
                    "details": {
                        "word": word,
                        "matched_rules": rules,
                        "matches": matches,
                        "recommendation": "请确认该词是否真的需要保留，或调整脱敏规则",
                    },
                })
        
        return issues

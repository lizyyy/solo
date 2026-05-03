import os
import re
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Set

from .models import Applicant, MaterialFile, Issue, IssueType, RiskLevel
from .utils import get_file_extension, generate_normalized_filename


DOCUMENT_TYPE_PATTERNS = {
    'passport': [
        r'passport', r'护照', r'huzhao', r'护_照',
        r'(?i)passport', r'(?i)huzhao'
    ],
    'photo': [
        r'photo', r'证件照', r'照片', r'zhaopian',
        r'(?i)photo', r'(?i)zhaopian', r'(?i)picture'
    ],
    'employment_cert': [
        r'employment', r'在职证明', r'工作证明', r'employment_cert',
        r'(?i)employment', r'(?i)在职', r'(?i)工作证明'
    ],
    'bank_statement': [
        r'bank', r'statement', r'银行流水', r'yinhang', r'bank_statement',
        r'(?i)bank', r'(?i)statement', r'(?i)流水'
    ],
    'flight_itinerary': [
        r'flight', r'机票', r'行程单', r'jipiao', r'flight_itinerary',
        r'(?i)flight', r'(?i)机票', r'(?i)行程'
    ],
    'hotel_booking': [
        r'hotel', r'酒店', r'住宿', r'jiudian', r'hotel_booking',
        r'(?i)hotel', r'(?i)酒店', r'(?i)住宿'
    ],
    'insurance': [
        r'insurance', r'保险', r'baoxian',
        r'(?i)insurance', r'(?i)保险', r'(?i)baoxian'
    ],
    'itinerary': [
        r'itinerary', r'行程', r'行程表',
        r'(?i)itinerary', r'(?i)行程表'
    ],
}


def scan_materials(materials_dir: str) -> Tuple[List[MaterialFile], List[Issue]]:
    materials = []
    issues = []
    
    if not os.path.exists(materials_dir):
        issues.append(Issue(
            issue_type=IssueType.MATERIAL_DIR_EMPTY,
            severity=RiskLevel.CRITICAL,
            message=f"材料目录不存在: {materials_dir}",
            evidence="请创建 materials/ 目录并放入材料文件"
        ))
        return materials, issues
    
    if not os.path.isdir(materials_dir):
        issues.append(Issue(
            issue_type=IssueType.MATERIAL_DIR_EMPTY,
            severity=RiskLevel.CRITICAL,
            message=f"{materials_dir} 不是目录",
            evidence="请确保 materials/ 是一个目录"
        ))
        return materials, issues
    
    for root, dirs, files in os.walk(materials_dir):
        for filename in files:
            if filename.startswith('.'):
                continue
            
            file_path = os.path.join(root, filename)
            try:
                file_size = os.path.getsize(file_path)
            except OSError:
                continue
            
            ext = get_file_extension(filename)
            
            material = MaterialFile(
                original_path=file_path,
                filename=filename,
                extension=ext,
                file_size=file_size,
            )
            materials.append(material)
    
    if not materials:
        issues.append(Issue(
            issue_type=IssueType.MATERIAL_DIR_EMPTY,
            severity=RiskLevel.HIGH,
            message=f"材料目录为空: {materials_dir}",
            evidence="未找到任何材料文件"
        ))
    
    return materials, issues


def infer_document_type(filename: str) -> Optional[str]:
    name_lower = filename.lower()
    name_without_ext = os.path.splitext(filename)[0].lower()
    
    for doc_type, patterns in DOCUMENT_TYPE_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, filename):
                return doc_type
            if re.search(pattern, name_without_ext):
                return doc_type
    
    return None


def infer_applicant_id(filename: str, applicant_ids: Set[str]) -> Optional[str]:
    name_without_ext = os.path.splitext(filename)[0]
    
    for aid in sorted(applicant_ids, key=len, reverse=True):
        if aid in name_without_ext:
            return aid
        if aid.upper() in name_without_ext.upper():
            return aid
    
    patterns = [
        r'(?:A|APP|申请人)[_\s-]?(\d+)',
        r'(\d{3,})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, name_without_ext, re.IGNORECASE)
        if match:
            candidate = match.group(1)
            if candidate in applicant_ids:
                return candidate
    
    return None


def match_materials(
    materials: List[MaterialFile],
    applicants: List[Applicant],
    naming_pattern: str
) -> Tuple[Dict[str, List[MaterialFile]], List[MaterialFile], List[Issue]]:
    matched: Dict[str, List[MaterialFile]] = {a.applicant_id: [] for a in applicants}
    unmatched: List[MaterialFile] = []
    issues: List[Issue] = []
    
    applicant_ids = {a.applicant_id for a in applicants}
    applicant_by_id = {a.applicant_id: a for a in applicants}
    
    for material in materials:
        inferred_applicant_id = infer_applicant_id(material.filename, applicant_ids)
        inferred_doc_type = infer_document_type(material.filename)
        
        if inferred_applicant_id:
            material.applicant_id = inferred_applicant_id
        if inferred_doc_type:
            material.document_type = inferred_doc_type
        
        if inferred_applicant_id and inferred_applicant_id in matched:
            if inferred_doc_type:
                normalized = generate_normalized_filename(
                    applicant_id=inferred_applicant_id,
                    document_type=inferred_doc_type,
                    original_extension=material.extension,
                    pattern=naming_pattern
                )
                material.normalized_filename = normalized
                
                if material.filename != normalized:
                    issues.append(Issue(
                        issue_type=IssueType.INVALID_FILENAME,
                        severity=RiskLevel.LOW,
                        message=f"文件名不规范，建议重命名",
                        evidence=f"当前: {material.filename} -> 建议: {normalized}",
                        document_type=inferred_doc_type,
                        file_path=material.original_path
                    ))
            else:
                issues.append(Issue(
                    issue_type=IssueType.UNKNOWN_DOCUMENT,
                    severity=RiskLevel.MEDIUM,
                    message=f"无法识别文件类型",
                    evidence=f"文件: {material.filename}，已匹配申请人 {inferred_applicant_id} 但无法识别材料类型",
                    file_path=material.original_path
                ))
            
            matched[inferred_applicant_id].append(material)
        else:
            if inferred_doc_type:
                issues.append(Issue(
                    issue_type=IssueType.APPLICANT_NOT_FOUND,
                    severity=RiskLevel.MEDIUM,
                    message=f"无法匹配文件到申请人",
                    evidence=f"文件: {material.filename}，识别为 {inferred_doc_type} 但未找到对应的申请人编号",
                    document_type=inferred_doc_type,
                    file_path=material.original_path
                ))
            else:
                issues.append(Issue(
                    issue_type=IssueType.UNKNOWN_DOCUMENT,
                    severity=RiskLevel.HIGH,
                    message=f"完全无法识别的文件",
                    evidence=f"文件: {material.filename}，既无法识别申请人也无法识别材料类型",
                    file_path=material.original_path
                ))
            unmatched.append(material)
    
    return matched, unmatched, issues

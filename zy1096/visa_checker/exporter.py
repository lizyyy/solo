import os
import shutil
from datetime import date
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Any

from .models import ValidationResult, Applicant, MaterialFile, Issue, IssueType, RiskLevel


def preview_renames(result: ValidationResult) -> List[Dict[str, str]]:
    renames = []
    
    for applicant in result.applicants:
        for material in applicant.materials:
            if material.normalized_filename and material.filename != material.normalized_filename:
                renames.append({
                    'applicant_id': applicant.applicant_id,
                    'applicant_name': applicant.name,
                    'original': material.filename,
                    'original_path': material.original_path,
                    'target': material.normalized_filename,
                    'document_type': material.document_type or 'unknown',
                })
    
    return renames


def execute_renames(
    result: ValidationResult,
    dry_run: bool = True
) -> Tuple[List[Dict[str, str]], List[Dict[str, str]]]:
    renames = preview_renames(result)
    executed = []
    skipped = []
    
    for rename in renames:
        original_path = rename['original_path']
        directory = os.path.dirname(original_path)
        target_path = os.path.join(directory, rename['target'])
        
        if os.path.exists(target_path) and target_path != original_path:
            skipped.append({
                **rename,
                'reason': f"目标文件已存在: {target_path}"
            })
            continue
        
        if dry_run:
            executed.append({
                **rename,
                'status': 'preview',
                'target_path': target_path,
            })
        else:
            try:
                shutil.move(original_path, target_path)
                executed.append({
                    **rename,
                    'status': 'done',
                    'target_path': target_path,
                })
            except Exception as e:
                skipped.append({
                    **rename,
                    'reason': str(e)
                })
    
    return executed, skipped


def copy_and_rename_materials(
    result: ValidationResult,
    target_dir: str,
    use_normalized_names: bool = True
) -> Dict[str, List[Dict[str, str]]]:
    copied: Dict[str, List[Dict[str, str]]] = {}
    
    if not os.path.exists(target_dir):
        os.makedirs(target_dir, exist_ok=True)
    
    for applicant in result.applicants:
        applicant_dir = os.path.join(target_dir, f"{applicant.applicant_id}_{applicant.name}")
        if not os.path.exists(applicant_dir):
            os.makedirs(applicant_dir, exist_ok=True)
        
        copied[applicant.applicant_id] = []
        
        for material in applicant.materials:
            if use_normalized_names and material.normalized_filename:
                target_filename = material.normalized_filename
            else:
                target_filename = material.filename
            
            target_path = os.path.join(applicant_dir, target_filename)
            
            counter = 1
            base_name = os.path.splitext(target_filename)[0]
            ext = os.path.splitext(target_filename)[1]
            while os.path.exists(target_path):
                target_filename = f"{base_name}_{counter}{ext}"
                target_path = os.path.join(applicant_dir, target_filename)
                counter += 1
            
            try:
                shutil.copy2(material.original_path, target_path)
                copied[applicant.applicant_id].append({
                    'original': material.original_path,
                    'target': target_path,
                    'document_type': material.document_type,
                    'filename': target_filename,
                })
            except Exception as e:
                copied[applicant.applicant_id].append({
                    'original': material.original_path,
                    'error': str(e),
                    'status': 'failed',
                })
    
    if result.unmatched_materials:
        unmatched_dir = os.path.join(target_dir, "_unmatched")
        if not os.path.exists(unmatched_dir):
            os.makedirs(unmatched_dir, exist_ok=True)
        
        copied['_unmatched'] = []
        for material in result.unmatched_materials:
            target_path = os.path.join(unmatched_dir, material.filename)
            try:
                shutil.copy2(material.original_path, target_path)
                copied['_unmatched'].append({
                    'original': material.original_path,
                    'target': target_path,
                    'filename': material.filename,
                })
            except Exception as e:
                copied['_unmatched'].append({
                    'original': material.original_path,
                    'error': str(e),
                    'status': 'failed',
                })
    
    return copied


def create_package(
    result: ValidationResult,
    output_path: str,
    include_reports: bool = True,
    report_paths: Optional[Dict[str, str]] = None
) -> str:
    import zipfile
    import tempfile
    
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
    
    with tempfile.TemporaryDirectory() as temp_dir:
        materials_dir = os.path.join(temp_dir, "materials")
        copy_and_rename_materials(result, materials_dir, use_normalized_names=True)
        
        if include_reports and report_paths:
            reports_dir = os.path.join(temp_dir, "reports")
            if not os.path.exists(reports_dir):
                os.makedirs(reports_dir, exist_ok=True)
            
            for fmt, path in report_paths.items():
                if os.path.exists(path):
                    filename = os.path.basename(path)
                    shutil.copy2(path, os.path.join(reports_dir, filename))
        
        summary_file = os.path.join(temp_dir, "SUMMARY.txt")
        with open(summary_file, 'w', encoding='utf-8') as f:
            f.write("签证材料包核对摘要\n")
            f.write("=" * 50 + "\n\n")
            f.write(f"打包时间: {date.today().strftime('%Y-%m-%d')}\n")
            f.write(f"申请人数: {len(result.applicants)}\n")
            f.write(f"问题总数: {result.total_issues}\n")
            f.write(f"是否有严重问题: {'是' if result.has_critical_issues else '否'}\n\n")
            
            f.write("申请人状态:\n")
            f.write("-" * 30 + "\n")
            for applicant in result.applicants:
                status = "✅ 通过" if applicant.risk_level == RiskLevel.OK else f"⚠️ {applicant.risk_level.value.upper()}"
                f.write(f"  [{applicant.applicant_id}] {applicant.name}: {status}\n")
                if applicant.issues:
                    for issue in applicant.issues:
                        f.write(f"    - [{issue.severity.value}] {issue.message}\n")
                f.write("\n")
        
        base_output = os.path.splitext(output_path)[0]
        zip_path = f"{base_output}.zip"
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, temp_dir)
                    zf.write(file_path, arcname)
        
        return zip_path


def export_materials(
    result: ValidationResult,
    output_dir: str,
    format: str = "folder",
    report_paths: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    if format == "folder":
        copied = copy_and_rename_materials(result, output_dir, use_normalized_names=True)
        
        total_copied = sum(len(files) for files in copied.values())
        
        return {
            'format': 'folder',
            'output_path': output_dir,
            'total_applicants': len(result.applicants),
            'files_copied': total_copied,
            'details': copied,
        }
    
    elif format == "zip":
        zip_path = create_package(
            result,
            output_dir,
            include_reports=True,
            report_paths=report_paths
        )
        
        return {
            'format': 'zip',
            'output_path': zip_path,
            'total_applicants': len(result.applicants),
        }
    
    else:
        raise ValueError(f"不支持的导出格式: {format}")

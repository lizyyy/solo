import os
import json
import shutil
from datetime import datetime
from typing import List, Dict, Optional, Any, Tuple
from dataclasses import dataclass, field
from collections import defaultdict

from config import Config


@dataclass
class ExportPlan:
    source_path: str
    target_path: str
    filename: str
    case_number: Optional[str] = None
    page_number: Optional[int] = None
    box_number: Optional[str] = None
    issues: List[Dict] = field(default_factory=list)
    review_status: str = 'pending'


@dataclass
class DryRunResult:
    plans: List[ExportPlan]
    warnings: List[str]
    target_directory: str
    will_override: bool = False
    existing_files: List[str] = field(default_factory=list)


class ExportManager:
    def __init__(self, files: List[Dict], issues: List[Dict], config: Dict = None):
        self.files = files
        self.issues = issues
        self.config = config or {}
        
        self.filename_to_issues = defaultdict(list)
        for issue in self.issues:
            affected_files = issue.get('affected_files', [])
            for filename in affected_files:
                self.filename_to_issues[filename].append(issue)
    
    def create_export_plan(self, target_directory: str, 
                          include_only_approved: bool = False,
                          naming_rule: str = '{case_number}_{page_number}{ext}') -> List[ExportPlan]:
        plans = []
        
        approved_statuses = {'confirmed', 'replaced', 'ignored'}
        
        for f in self.files:
            filename = f['filename']
            source_path = f['filepath']
            ext = os.path.splitext(filename)[1].lower()
            
            case_number = f.get('extracted_case_number', '')
            page_number = f.get('extracted_page_number')
            box_number = f.get('extracted_box_number', '')
            
            file_issues = self.filename_to_issues.get(filename, [])
            
            has_pending_issues = any(
                issue.get('review_status') == 'pending' 
                for issue in file_issues
            )
            
            if include_only_approved and has_pending_issues:
                continue
            
            target_filename = self._generate_filename(
                naming_rule, f, ext
            )
            
            case_subdir = case_number if case_number else 'uncategorized'
            target_path = os.path.join(target_directory, case_subdir, target_filename)
            
            plans.append(ExportPlan(
                source_path=source_path,
                target_path=target_path,
                filename=target_filename,
                case_number=case_number,
                page_number=page_number,
                box_number=box_number,
                issues=file_issues,
                review_status='approved' if not has_pending_issues else 'has_issues'
            ))
        
        return plans
    
    def _generate_filename(self, rule: str, file_info: Dict, ext: str) -> str:
        case_number = file_info.get('extracted_case_number', '')
        page_number = file_info.get('extracted_page_number', 0)
        box_number = file_info.get('extracted_box_number', '')
        original_filename = os.path.splitext(file_info['filename'])[0]
        
        replacements = {
            '{case_number}': case_number or 'unknown',
            '{page_number}': f"{page_number:04d}" if page_number else '0000',
            '{box_number}': box_number or '0',
            '{original}': original_filename,
            '{ext}': ext
        }
        
        result = rule
        for key, value in replacements.items():
            result = result.replace(key, value)
        
        if not result.endswith(ext):
            result = result + ext
        
        return result
    
    def dry_run(self, target_directory: str, 
                include_only_approved: bool = False,
                naming_rule: str = '{case_number}_{page_number}{ext}') -> DryRunResult:
        plans = self.create_export_plan(target_directory, include_only_approved, naming_rule)
        
        warnings = []
        existing_files = []
        will_override = False
        
        case_targets = defaultdict(list)
        for plan in plans:
            case_targets[plan.case_number].append(plan)
        
        for case_number, case_plans in case_targets.items():
            page_numbers = [p.page_number for p in case_plans if p.page_number is not None]
            if page_numbers:
                min_page = min(page_numbers)
                max_page = max(page_numbers)
                expected_pages = set(range(min_page, max_page + 1))
                actual_pages = set(page_numbers)
                missing_pages = expected_pages - actual_pages
                
                if missing_pages and case_number:
                    warnings.append(
                        f"案卷号 {case_number}: 导出时将缺失页码 {', '.join(map(str, sorted(missing_pages)))}"
                    )
        
        for plan in plans:
            if os.path.exists(plan.target_path):
                existing_files.append(plan.target_path)
                will_override = True
        
        filename_counts = defaultdict(int)
        for plan in plans:
            filename_counts[plan.filename] += 1
        
        for filename, count in filename_counts.items():
            if count > 1:
                warnings.append(f"文件名冲突: {filename} 将被导出 {count} 次")
        
        return DryRunResult(
            plans=plans,
            warnings=warnings,
            target_directory=target_directory,
            will_override=will_override,
            existing_files=existing_files
        )
    
    def execute_export(self, plans: List[ExportPlan], 
                       create_manifest: bool = True) -> Tuple[str, List[str]]:
        target_directory = None
        copied_files = []
        
        for plan in plans:
            target_dir = os.path.dirname(plan.target_path)
            if target_directory is None:
                target_directory = os.path.dirname(target_dir) if target_dir else plan.target_path
            os.makedirs(target_dir, exist_ok=True)
            
            shutil.copy2(plan.source_path, plan.target_path)
            copied_files.append(plan.target_path)
        
        if create_manifest and target_directory:
            manifest_path = self._create_manifest(target_directory, plans)
            return manifest_path, copied_files
        
        return '', copied_files
    
    def _create_manifest(self, target_directory: str, plans: List[ExportPlan]) -> str:
        manifest = {
            'version': Config.APP_VERSION,
            'exported_at': datetime.now().isoformat(),
            'total_files': len(plans),
            'files': [],
            'summary': {
                'by_case': defaultdict(int),
                'by_status': defaultdict(int)
            }
        }
        
        for plan in plans:
            file_info = {
                'filename': plan.filename,
                'relative_path': os.path.relpath(plan.target_path, target_directory),
                'case_number': plan.case_number,
                'page_number': plan.page_number,
                'box_number': plan.box_number,
                'review_status': plan.review_status,
                'issue_count': len(plan.issues)
            }
            
            if plan.issues:
                file_info['issues'] = [
                    {
                        'type': issue.get('issue_type'),
                        'severity': issue.get('severity'),
                        'status': issue.get('review_status')
                    }
                    for issue in plan.issues
                ]
            
            manifest['files'].append(file_info)
            
            if plan.case_number:
                manifest['summary']['by_case'][plan.case_number] += 1
            manifest['summary']['by_status'][plan.review_status] += 1
        
        manifest['summary']['by_case'] = dict(manifest['summary']['by_case'])
        manifest['summary']['by_status'] = dict(manifest['summary']['by_status'])
        
        manifest_path = os.path.join(target_directory, 'manifest.json')
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
        
        return manifest_path


def create_export_plan(files: List[Dict], issues: List[Dict], 
                       target_directory: str, config: Dict = None) -> List[Dict]:
    manager = ExportManager(files, issues, config)
    plans = manager.create_export_plan(target_directory)
    
    result = []
    for plan in plans:
        result.append({
            'source_path': plan.source_path,
            'target_path': plan.target_path,
            'filename': plan.filename,
            'case_number': plan.case_number,
            'page_number': plan.page_number,
            'box_number': plan.box_number,
            'issues': plan.issues,
            'review_status': plan.review_status
        })
    
    return result


def run_dry_run(files: List[Dict], issues: List[Dict],
                target_directory: str, config: Dict = None) -> Dict:
    manager = ExportManager(files, issues, config)
    dry_run = manager.dry_run(target_directory)
    
    return {
        'plans': [{
            'source_path': p.source_path,
            'target_path': p.target_path,
            'filename': p.filename,
            'case_number': p.case_number,
            'page_number': p.page_number
        } for p in dry_run.plans],
        'warnings': dry_run.warnings,
        'target_directory': dry_run.target_directory,
        'will_override': dry_run.will_override,
        'existing_files': dry_run.existing_files,
        'total_files': len(dry_run.plans)
    }

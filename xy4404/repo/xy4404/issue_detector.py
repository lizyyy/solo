import os
import logging
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
from config import Config
from database import Database

logger = logging.getLogger(__name__)

class IssueDetector:
    def __init__(self, db: Database = None):
        self.db = db or Database()
    
    def detect_all_issues(self) -> Dict[str, List[Dict[str, Any]]]:
        results = {
            'filename_conflicts': [],
            'license_expiry': [],
            'missing_pages': [],
            'missing_files': [],
            'public_with_expired_license': []
        }
        
        results['license_expiry'] = self.check_license_expiry()
        results['missing_files'] = self.check_missing_files()
        results['filename_conflicts'] = self.check_filename_conflicts()
        results['public_with_expired_license'] = self.check_public_with_expired_license()
        
        return results
    
    def check_license_expiry(self, warning_days: int = None) -> List[Dict[str, Any]]:
        warning_days = warning_days or Config.LICENSE_EXPIRY_WARNING_DAYS
        today = date.today()
        
        expiring = self.db.get_expiring_licenses(warning_days)
        issues = []
        
        for lic in expiring:
            end_date = lic.get('end_date')
            if end_date:
                try:
                    if isinstance(end_date, str):
                        end_date = datetime.fromisoformat(end_date).date()
                    
                    days_left = (end_date - today).days
                    
                    severity = 'warning'
                    if days_left <= 7:
                        severity = 'critical'
                    elif days_left <= 14:
                        severity = 'error'
                    
                    issues.append({
                        'performance_id': lic['performance_id'],
                        'performance_name': lic['performance_name'],
                        'license_id': lic['id'],
                        'file_name': lic['file_name'],
                        'end_date': str(end_date),
                        'days_left': days_left,
                        'is_public': bool(lic.get('is_public')),
                        'needs_takedown': bool(lic.get('needs_takedown')),
                        'severity': severity,
                        'issue_type': 'license_expiry'
                    })
                    
                    if not self._issue_exists(lic['performance_id'], 'license_expiry', lic['file_name']):
                        self.db.add_issue(
                            performance_id=lic['performance_id'],
                            issue_type='license_expiry',
                            issue_description=f'授权将在 {days_left} 天后过期 ({end_date})',
                            file_name=lic['file_name'],
                            severity=severity
                        )
                        
                except (ValueError, TypeError) as e:
                    logger.warning(f"解析授权日期时出错: {e}")
        
        return issues
    
    def check_missing_files(self) -> List[Dict[str, Any]]:
        performances = self.db.get_performances_with_missing_files()
        issues = []
        
        for perf in performances:
            missing = []
            if perf['audio_count'] == 0:
                missing.append('音频文件')
            if perf['transcript_count'] == 0:
                missing.append('转写稿')
            if perf['license_count'] == 0:
                missing.append('授权文件')
            
            if missing:
                issues.append({
                    'performance_id': perf['id'],
                    'performance_name': perf['performance_name'],
                    'missing_files': missing,
                    'status': perf['status'],
                    'issue_type': 'missing_files'
                })
                
                if not self._issue_exists(perf['id'], 'missing_files'):
                    self.db.add_issue(
                        performance_id=perf['id'],
                        issue_type='missing_files',
                        issue_description=f'缺少材料: {", ".join(missing)}',
                        severity='warning'
                    )
        
        return issues
    
    def check_filename_conflicts(self) -> List[Dict[str, Any]]:
        performances = self.db.get_all_performances()
        conflicts = []
        
        for perf in performances:
            files = self.db.get_performance_files(perf['id'])
            all_files = files['audio'] + files['transcripts'] + files['licenses']
            
            file_names = {}
            for f in all_files:
                fname = f['file_name']
                if fname in file_names:
                    conflicts.append({
                        'performance_id': perf['id'],
                        'performance_name': perf['performance_name'],
                        'conflicting_file': fname,
                        'existing_entry': file_names[fname],
                        'new_entry': f,
                        'issue_type': 'filename_conflict'
                    })
                else:
                    file_names[fname] = f
        
        return conflicts
    
    def check_public_with_expired_license(self) -> List[Dict[str, Any]]:
        today = date.today()
        issues = []
        
        performances = self.db.get_all_performances()
        for perf in performances:
            if not perf.get('is_public'):
                continue
            
            files = self.db.get_performance_files(perf['id'])
            for lic in files['licenses']:
                end_date = lic.get('end_date')
                if end_date:
                    try:
                        if isinstance(end_date, str):
                            end_date = datetime.fromisoformat(end_date).date()
                        
                        if end_date < today:
                            issues.append({
                                'performance_id': perf['id'],
                                'performance_name': perf['performance_name'],
                                'license_id': lic['id'],
                                'file_name': lic['file_name'],
                                'end_date': str(end_date),
                                'is_public': True,
                                'issue_type': 'public_with_expired_license'
                            })
                            
                            if not self._issue_exists(perf['id'], 'public_with_expired_license', lic['file_name']):
                                self.db.add_issue(
                                    performance_id=perf['id'],
                                    issue_type='public_with_expired_license',
                                    issue_description=f'已公开的演出授权已过期 ({end_date})，建议下架',
                                    file_name=lic['file_name'],
                                    severity='critical'
                                )
                                
                    except (ValueError, TypeError) as e:
                        logger.warning(f"检查过期授权时出错: {e}")
        
        return issues
    
    def check_transcript_pages(self, performance_id: int = None) -> List[Dict[str, Any]]:
        issues = []
        
        if performance_id:
            performances = [self.db.get_performance_by_id(performance_id)]
        else:
            performances = self.db.get_all_performances()
        
        for perf in performances:
            if not perf:
                continue
            
            files = self.db.get_performance_files(perf['id'])
            for transcript in files['transcripts']:
                page_count = transcript.get('page_count')
                if page_count and page_count < 2:
                    issues.append({
                        'performance_id': perf['id'],
                        'performance_name': perf['performance_name'],
                        'transcript_id': transcript['id'],
                        'file_name': transcript['file_name'],
                        'page_count': page_count,
                        'issue_type': 'missing_pages'
                    })
        
        return issues
    
    def _issue_exists(self, performance_id: int, issue_type: str, file_name: str = None) -> bool:
        open_issues = self.db.get_open_issues()
        for issue in open_issues:
            if (issue['performance_id'] == performance_id and 
                issue['issue_type'] == issue_type):
                if file_name is None or issue.get('file_name') == file_name:
                    return True
        return False
    
    def get_issue_summary(self) -> Dict[str, Any]:
        open_issues = self.db.get_open_issues()
        
        summary = {
            'total_open': len(open_issues),
            'by_type': {},
            'by_severity': {
                'critical': 0,
                'error': 0,
                'warning': 0,
                'info': 0
            },
            'expiring_licenses': 0,
            'missing_files': 0,
            'conflicts': 0
        }
        
        for issue in open_issues:
            issue_type = issue['issue_type']
            severity = issue['severity']
            
            if issue_type not in summary['by_type']:
                summary['by_type'][issue_type] = 0
            summary['by_type'][issue_type] += 1
            
            if severity in summary['by_severity']:
                summary['by_severity'][severity] += 1
            
            if issue_type == 'license_expiry':
                summary['expiring_licenses'] += 1
            elif issue_type == 'missing_files':
                summary['missing_files'] += 1
            elif issue_type == 'filename_conflict':
                summary['conflicts'] += 1
        
        return summary

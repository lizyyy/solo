from datetime import datetime
from typing import List, Optional, Dict, Any
from database import Database
from models import RiskControlRelease, ReleaseStatus, OperationHistory, ImportBadRecord
import csv
import io


class RiskControlAPI:
    def __init__(self, db: Database = None):
        self.db = db or Database()

    def create_release(self, mobile: str, scene: str, business_object: str,
                      risk_reason: str, applicant: str, remark: str = "") -> Dict[str, Any]:
        release = self.db.create_release(mobile, scene, business_object, risk_reason, applicant, remark)
        return self._release_to_dict(release)

    def apply_release(self, release_id: int, operator: str, 
                     release_start_time: datetime, release_end_time: datetime,
                     remark: str = "") -> Optional[Dict[str, Any]]:
        release = self.db.apply_release(release_id, operator, release_start_time, release_end_time, remark)
        return self._release_to_dict(release) if release else None

    def approve_release(self, release_id: int, approver: str, remark: str = "") -> Optional[Dict[str, Any]]:
        release = self.db.approve_release(release_id, approver, remark)
        return self._release_to_dict(release) if release else None

    def add_remark(self, release_id: int, operator: str, remark: str) -> Optional[Dict[str, Any]]:
        release = self.db.add_remark(release_id, operator, remark)
        return self._release_to_dict(release) if release else None

    def expire_release(self, release_id: int, operator: str) -> Optional[Dict[str, Any]]:
        release = self.db.expire_release(release_id, operator)
        return self._release_to_dict(release) if release else None

    def get_release_detail(self, release_id: int) -> Optional[Dict[str, Any]]:
        release = self.db.get_release_by_id(release_id)
        if not release:
            return None
        
        history = self.db.get_history_by_release_id(release_id)
        result = self._release_to_dict(release)
        result['history'] = [self._history_to_dict(h) for h in history]
        return result

    def query_releases(self, start_date: Optional[str] = None, end_date: Optional[str] = None,
                      status: Optional[str] = None, applicant: Optional[str] = None,
                      business_object: Optional[str] = None, mobile: Optional[str] = None,
                      scene: Optional[str] = None) -> List[Dict[str, Any]]:
        status_enum = None
        if status:
            for s in ReleaseStatus:
                if s.value == status or s.name == status:
                    status_enum = s
                    break
        
        start_dt = datetime.fromisoformat(start_date) if start_date else None
        end_dt = datetime.fromisoformat(end_date) if end_date else None
        
        releases = self.db.query_releases(
            start_date=start_dt,
            end_date=end_dt,
            status=status_enum,
            applicant=applicant,
            business_object=business_object,
            mobile=mobile,
            scene=scene
        )
        
        return [self._release_to_dict(r) for r in releases]

    def export_releases(self, start_date: Optional[str] = None, end_date: Optional[str] = None,
                       status: Optional[str] = None, applicant: Optional[str] = None,
                       business_object: Optional[str] = None, mobile: Optional[str] = None,
                       scene: Optional[str] = None, output_file: str = None) -> str:
        releases = self.query_releases(start_date, end_date, status, applicant, 
                                       business_object, mobile, scene)
        
        headers = [
            "手机号", "场景", "业务对象", "风控原因", "状态",
            "放行开始时间", "放行结束时间", "申请人", "审批人",
            "申请时间", "审批时间", "备注", "创建时间", "更新时间", "版本号"
        ]
        
        if output_file:
            with open(output_file, 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f)
                writer.writerow(headers)
                for r in releases:
                    writer.writerow([
                        r['mobile'],
                        r['scene'],
                        r['business_object'],
                        r['risk_reason'],
                        r['status'],
                        r['release_start_time'],
                        r['release_end_time'],
                        r['applicant'],
                        r['approver'],
                        r['apply_time'],
                        r['approve_time'],
                        r['remark'],
                        r['created_at'],
                        r['updated_at'],
                        r['version']
                    ])
            return output_file
        else:
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(headers)
            for r in releases:
                writer.writerow([
                    r['mobile'],
                    r['scene'],
                    r['business_object'],
                    r['risk_reason'],
                    r['status'],
                    r['release_start_time'],
                    r['release_end_time'],
                    r['applicant'],
                    r['approver'],
                    r['apply_time'],
                    r['approve_time'],
                    r['remark'],
                    r['created_at'],
                    r['updated_at'],
                    r['version']
                ])
            return output.getvalue()

    def _release_to_dict(self, release: RiskControlRelease) -> Dict[str, Any]:
        return {
            'id': release.id,
            'mobile': release.mobile,
            'scene': release.scene,
            'business_object': release.business_object,
            'risk_reason': release.risk_reason,
            'status': release.status.value,
            'release_start_time': release.release_start_time.isoformat() if release.release_start_time else None,
            'release_end_time': release.release_end_time.isoformat() if release.release_end_time else None,
            'applicant': release.applicant,
            'approver': release.approver,
            'apply_time': release.apply_time.isoformat(),
            'approve_time': release.approve_time.isoformat() if release.approve_time else None,
            'remark': release.remark,
            'created_at': release.created_at.isoformat(),
            'updated_at': release.updated_at.isoformat(),
            'version': release.version
        }

    def _history_to_dict(self, history: OperationHistory) -> Dict[str, Any]:
        return {
            'id': history.id,
            'release_id': history.release_id,
            'operation_type': history.operation_type,
            'old_status': history.old_status,
            'new_status': history.new_status,
            'operator': history.operator,
            'operation_time': history.operation_time.isoformat(),
            'remark': history.remark,
            'old_data': history.old_data,
            'new_data': history.new_data
        }

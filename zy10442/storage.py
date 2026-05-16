import json
import os
from datetime import datetime
from typing import Optional, List, Dict, Any
from pathlib import Path

from models import ResidencyApproval, ResidencyReport, Tenant, Region


class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


class DataStore:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        
        self.approvals_file = self.data_dir / "approvals.json"
        self.reports_file = self.data_dir / "reports.json"
        self.tenants_file = self.data_dir / "tenants.json"
        self.regions_file = self.data_dir / "regions.json"
        self.id_counter_file = self.data_dir / "id_counter.json"
        
        self._init_files()
    
    def _init_files(self):
        for file_path in [
            self.approvals_file, 
            self.reports_file, 
            self.tenants_file, 
            self.regions_file,
            self.id_counter_file
        ]:
            if not file_path.exists():
                with open(file_path, 'w', encoding='utf-8') as f:
                    if file_path == self.id_counter_file:
                        json.dump({"approval": 1, "report": 1, "comment": 1, "block_reason": 1}, f)
                    else:
                        json.dump([], f)
    
    def _load_json(self, file_path: Path) -> List[Dict[str, Any]]:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def _save_json(self, file_path: Path, data: List[Dict[str, Any]]):
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, cls=JSONEncoder, indent=2, ensure_ascii=False)
    
    def _get_next_id(self, prefix: str) -> str:
        with open(self.id_counter_file, 'r+', encoding='utf-8') as f:
            counters = json.load(f)
            next_num = counters.get(prefix, 1)
            counters[prefix] = next_num + 1
            f.seek(0)
            json.dump(counters, f, indent=2)
            f.truncate()
        return f"{prefix}_{next_num:06d}"
    
    def get_next_approval_id(self) -> str:
        return self._get_next_id("approval")
    
    def get_next_report_id(self) -> str:
        return self._get_next_id("report")
    
    def get_next_comment_id(self) -> str:
        return self._get_next_id("comment")
    
    def get_next_block_reason_id(self) -> str:
        return self._get_next_id("block_reason")
    
    def save_approval(self, approval: ResidencyApproval):
        approvals = self._load_json(self.approvals_file)
        approval_dict = approval.model_dump()
        
        existing_idx = next((i for i, a in enumerate(approvals) if a["approval_id"] == approval.approval_id), None)
        if existing_idx is not None:
            approvals[existing_idx] = approval_dict
        else:
            approvals.append(approval_dict)
        
        self._save_json(self.approvals_file, approvals)
    
    def get_approval(self, approval_id: str) -> Optional[ResidencyApproval]:
        approvals = self._load_json(self.approvals_file)
        for a in approvals:
            if a["approval_id"] == approval_id:
                return ResidencyApproval.model_validate(a)
        return None
    
    def get_approval_by_tenant_and_region(self, tenant_id: str, target_region: str) -> Optional[ResidencyApproval]:
        approvals = self._load_json(self.approvals_file)
        for a in approvals:
            if a["tenant_id"] == tenant_id and a["target_region"] == target_region:
                return ResidencyApproval.model_validate(a)
        return None
    
    def list_approvals(self, tenant_id: Optional[str] = None, status: Optional[str] = None) -> List[ResidencyApproval]:
        approvals = self._load_json(self.approvals_file)
        result = []
        for a in approvals:
            if tenant_id and a["tenant_id"] != tenant_id:
                continue
            if status and a["status"] != status:
                continue
            result.append(ResidencyApproval.model_validate(a))
        return result
    
    def save_report(self, report: ResidencyReport):
        reports = self._load_json(self.reports_file)
        report_dict = report.model_dump()
        
        existing_idx = next((i for i, r in enumerate(reports) if r["report_id"] == report.report_id), None)
        if existing_idx is not None:
            reports[existing_idx] = report_dict
        else:
            reports.append(report_dict)
        
        self._save_json(self.reports_file, reports)
    
    def get_report(self, report_id: str) -> Optional[ResidencyReport]:
        reports = self._load_json(self.reports_file)
        for r in reports:
            if r["report_id"] == report_id:
                return ResidencyReport.model_validate(r)
        return None
    
    def list_reports(self, approval_id: Optional[str] = None) -> List[ResidencyReport]:
        reports = self._load_json(self.reports_file)
        result = []
        for r in reports:
            if approval_id and r["approval_id"] != approval_id:
                continue
            result.append(ResidencyReport.model_validate(r))
        return result
    
    def save_tenant(self, tenant: Tenant):
        tenants = self._load_json(self.tenants_file)
        tenant_dict = tenant.model_dump()
        
        existing_idx = next((i for i, t in enumerate(tenants) if t["tenant_id"] == tenant.tenant_id), None)
        if existing_idx is not None:
            tenants[existing_idx] = tenant_dict
        else:
            tenants.append(tenant_dict)
        
        self._save_json(self.tenants_file, tenants)
    
    def get_tenant(self, tenant_id: str) -> Optional[Tenant]:
        tenants = self._load_json(self.tenants_file)
        for t in tenants:
            if t["tenant_id"] == tenant_id:
                return Tenant.model_validate(t)
        return None
    
    def save_region(self, region: Region):
        regions = self._load_json(self.regions_file)
        region_dict = region.model_dump()
        
        existing_idx = next((i for i, r in enumerate(regions) if r["code"] == region.code), None)
        if existing_idx is not None:
            regions[existing_idx] = region_dict
        else:
            regions.append(region_dict)
        
        self._save_json(self.regions_file, regions)
    
    def get_region(self, code: str) -> Optional[Region]:
        regions = self._load_json(self.regions_file)
        for r in regions:
            if r["code"] == code:
                return Region.model_validate(r)
        return None
    
    def list_regions(self) -> List[Region]:
        regions = self._load_json(self.regions_file)
        return [Region.model_validate(r) for r in regions]


store = DataStore()

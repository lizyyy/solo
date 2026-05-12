import os
from pathlib import Path


class Config:
    APP_NAME = "refund-interceptor"
    
    def __init__(self, workspace_path: str = None):
        self.workspace_path = Path(workspace_path or os.getcwd()).resolve()
        self.data_dir = self.workspace_path / ".refund_data"
        self.import_dir = self.data_dir / "imports"
        self.exports_dir = self.data_dir / "exports"
        
    def ensure_dirs(self):
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.import_dir.mkdir(parents=True, exist_ok=True)
        self.exports_dir.mkdir(parents=True, exist_ok=True)
    
    @property
    def state_file(self):
        return self.data_dir / "workspace_state.json"
    
    @property
    def payments_file(self):
        return self.data_dir / "payments.json"
    
    @property
    def blacklist_file(self):
        return self.data_dir / "blacklist.json"
    
    @property
    def approvals_file(self):
        return self.data_dir / "approvals.json"
    
    @property
    def historical_refunds_file(self):
        return self.data_dir / "historical_refunds.json"
    
    @property
    def refund_requests_file(self):
        return self.data_dir / "refund_requests.json"
    
    @property
    def corrections_file(self):
        return self.data_dir / "corrections.json"
    
    @property
    def check_history_file(self):
        return self.data_dir / "check_history.json"

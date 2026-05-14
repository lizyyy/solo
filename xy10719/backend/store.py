from typing import Dict, List, Optional
from models import SampleData, ApprovalRecord, ComplianceRecord
import uuid
from datetime import datetime

class DataStore:
    def __init__(self):
        self.samples: Dict[str, SampleData] = {}
        self.approvals: Dict[str, ApprovalRecord] = {}
        self.compliance_records: Dict[str, ComplianceRecord] = {}
        self._init_demo_data()
    
    def _init_demo_data(self):
        demo_samples = [
            SampleData(
                id=str(uuid.uuid4()),
                field_name="手机号",
                field_type="phone",
                original_value="13812345678",
                status="success",
                is_dirty=False
            ),
            SampleData(
                id=str(uuid.uuid4()),
                field_name="身份证号",
                field_type="id_card",
                original_value="110101199001011234",
                status="failed",
                is_dirty=True,
                error_message="身份证格式校验失败: 出生日期无效"
            ),
            SampleData(
                id=str(uuid.uuid4()),
                field_name="邮箱",
                field_type="email",
                original_value="test@example.com",
                status="needs_approval",
                is_dirty=False
            ),
            SampleData(
                id=str(uuid.uuid4()),
                field_name="银行卡号",
                field_type="bank_card",
                original_value="6222021234567890123",
                status="pending",
                is_dirty=False
            ),
            SampleData(
                id=str(uuid.uuid4()),
                field_name="姓名",
                field_type="name",
                original_value="张三",
                status="approved",
                is_dirty=False
            )
        ]
        for sample in demo_samples:
            self.samples[sample.id] = sample

store = DataStore()

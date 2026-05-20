import csv
import json
import uuid
from datetime import datetime
from io import StringIO, BytesIO
from typing import List, Dict, Any
import pandas as pd
from models import (
    ClaimApplication, ClaimItem, Material, Policy, PolicyCoverage,
    MaterialType, ClaimStatus
)


class DataImporter:
    def __init__(self):
        self.imported_claims: Dict[str, ClaimApplication] = {}
        self.imported_policies: Dict[str, Policy] = {}

    def parse_materials_csv(self, csv_content: str) -> List[Material]:
        materials = []
        reader = csv.DictReader(StringIO(csv_content))
        
        for row in reader:
            material_type = self._detect_material_type(row.get('材料类型', row.get('type', '')))
            material = Material(
                material_id=row.get('材料ID', row.get('material_id', str(uuid.uuid4()))),
                material_type=material_type,
                name=row.get('材料名称', row.get('name', '')),
                upload_time=datetime.fromisoformat(row.get('上传时间', row.get('upload_time', datetime.now().isoformat()))),
                file_url=row.get('文件链接', row.get('file_url')),
                is_valid=row.get('是否有效', row.get('is_valid', 'true')).lower() == 'true',
                remarks=row.get('备注', row.get('remarks'))
            )
            materials.append(material)
        return materials

    def parse_claim_items_csv(self, csv_content: str) -> List[ClaimItem]:
        items = []
        reader = csv.DictReader(StringIO(csv_content))
        
        for row in reader:
            item = ClaimItem(
                item_id=row.get('项目ID', row.get('item_id', str(uuid.uuid4()))),
                expense_type=row.get('费用类型', row.get('expense_type', '')),
                expense_date=datetime.fromisoformat(row.get('费用日期', row.get('expense_date', datetime.now().isoformat()))),
                invoice_number=row.get('发票号', row.get('invoice_number')),
                invoice_amount=float(row.get('发票金额', row.get('invoice_amount', 0)) or 0),
                claimed_amount=float(row.get('申报金额', row.get('claimed_amount', 0)) or 0),
                hospital=row.get('医院', row.get('hospital')),
                diagnosis=row.get('诊断', row.get('diagnosis'))
            )
            items.append(item)
        return items

    def import_claim_from_json(self, json_content: str) -> ClaimApplication:
        data = json.loads(json_content)
        
        materials = []
        for mat_data in data.get('materials', []):
            materials.append(Material(**mat_data))
        
        claim_items = []
        for item_data in data.get('claim_items', []):
            claim_items.append(ClaimItem(**item_data))
        
        claim = ClaimApplication(
            claim_id=data.get('claim_id', str(uuid.uuid4())),
            claim_number=data.get('claim_number', ''),
            policy_id=data.get('policy_id', ''),
            applicant_name=data.get('applicant_name', ''),
            applicant_id=data.get('applicant_id', ''),
            claim_date=datetime.fromisoformat(data.get('claim_date', datetime.now().isoformat())),
            materials=materials,
            claim_items=claim_items,
            total_claimed_amount=float(data.get('total_claimed_amount', 0) or 0),
            status=ClaimStatus(data.get('status', ClaimStatus.PENDING))
        )
        
        self.imported_claims[claim.claim_id] = claim
        return claim

    def import_policy_from_json(self, json_content: str) -> Policy:
        data = json.loads(json_content)
        
        coverages = []
        for cov_data in data.get('coverages', []):
            coverages.append(PolicyCoverage(**cov_data))
        
        policy = Policy(
            policy_id=data.get('policy_id', str(uuid.uuid4())),
            policy_number=data.get('policy_number', ''),
            insured_name=data.get('insured_name', ''),
            id_number=data.get('id_number', ''),
            effective_date=datetime.fromisoformat(data.get('effective_date')),
            expiry_date=datetime.fromisoformat(data.get('expiry_date')),
            coverages=coverages,
            total_limit=float(data.get('total_limit', 0) or 0),
            remaining_limit=float(data.get('remaining_limit', 0) or 0)
        )
        
        self.imported_policies[policy.policy_id] = policy
        return policy

    def import_materials_from_excel(self, file_content: bytes) -> List[Material]:
        df = pd.read_excel(BytesIO(file_content))
        materials = []
        
        for _, row in df.iterrows():
            material_type = self._detect_material_type(str(row.get('材料类型', row.get('type', ''))))
            upload_time = pd.to_datetime(row.get('上传时间', row.get('upload_time', datetime.now())))
            
            material = Material(
                material_id=str(row.get('材料ID', row.get('material_id', str(uuid.uuid4())))),
                material_type=material_type,
                name=str(row.get('材料名称', row.get('name', ''))),
                upload_time=upload_time.to_pydatetime(),
                file_url=str(row.get('文件链接', row.get('file_url', ''))) or None,
                is_valid=bool(row.get('是否有效', row.get('is_valid', True))),
                remarks=str(row.get('备注', row.get('remarks', ''))) or None
            )
            materials.append(material)
        return materials

    def _detect_material_type(self, type_str: str) -> MaterialType:
        type_map = {
            '发票': MaterialType.INVOICE,
            'invoice': MaterialType.INVOICE,
            '病历': MaterialType.HOSPITAL_RECORD,
            '出院小结': MaterialType.DISCHARGE_SUMMARY,
            '身份证': MaterialType.ID_CARD,
            '银行卡': MaterialType.BANK_CARD,
            '诊断证明': MaterialType.DIAGNOSIS,
            '费用清单': MaterialType.EXPENSE_LIST,
        }
        return type_map.get(type_str, MaterialType.OTHER)

    def get_claim(self, claim_id: str) -> ClaimApplication:
        return self.imported_claims.get(claim_id)

    def get_policy(self, policy_id: str) -> Policy:
        return self.imported_policies.get(policy_id)

    def clear_all(self):
        self.imported_claims.clear()
        self.imported_policies.clear()

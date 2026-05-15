import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any
from .models import (
    ContractSubmission, OfflineContractSupplement, PaymentReceipt
)


class DemoDataGenerator:
    def __init__(self, output_path: str = "data/demo"):
        self.output_path = Path(output_path)
        self.output_path.mkdir(parents=True, exist_ok=True)
    
    def generate_normal_contracts(self) -> List[Dict[str, Any]]:
        contracts = []
        base_time = datetime(2024, 1, 15, 10, 0, 0)
        
        for i in range(3):
            contract_id = f"CTR{2024000 + i}"
            sign_time_a = base_time + timedelta(days=i)
            sign_time_b = sign_time_a + timedelta(hours=2)
            
            supplements = [
                OfflineContractSupplement(
                    contract_id=contract_id,
                    supplement_id=f"SUP{contract_id}_01",
                    supplement_type="补充协议",
                    content=f"关于{contract_id}的补充条款{i+1}",
                    create_time=sign_time_a + timedelta(minutes=30),
                    operator="张三"
                ),
                OfflineContractSupplement(
                    contract_id=contract_id,
                    supplement_id=f"SUP{contract_id}_02",
                    supplement_type="附件",
                    content=f"{contract_id}的附件材料",
                    create_time=sign_time_a + timedelta(hours=1),
                    operator="李四"
                )
            ]
            
            payment_receipts = [
                PaymentReceipt(
                    receipt_id=f"RCP{contract_id}_01",
                    contract_id=contract_id,
                    payment_channel="支付宝",
                    amount=10000.0 * (i + 1),
                    payment_time=sign_time_b + timedelta(days=1),
                    manual_remark=f"正常付款{i+1}",
                    caller="payment_service_001"
                )
            ]
            
            submission = ContractSubmission(
                batch_id=f"BATCH202400{i+1}",
                contract_id=contract_id,
                contract_name=f"采购合同-{i+1}",
                party_a="甲方公司",
                party_b=f"乙方供应商{i+1}",
                sign_time_a=sign_time_a,
                sign_time_b=sign_time_b,
                create_time=base_time + timedelta(days=i-1),
                supplements=supplements,
                payment_receipts=payment_receipts,
                submitter="王五"
            )
            contracts.append(submission.dict())
        
        return contracts
    
    def generate_time_order_error_contract(self) -> Dict[str, Any]:
        base_time = datetime(2024, 1, 20, 14, 0, 0)
        contract_id = "CTR2024999"
        
        sign_time_a = base_time
        sign_time_b = base_time - timedelta(hours=3)
        
        supplements = [
            OfflineContractSupplement(
                contract_id=contract_id,
                supplement_id="SUPCTR2024999_01",
                supplement_type="补充协议",
                content="这是一条故意时间顺序错误的合同，用于复核测试",
                create_time=base_time - timedelta(days=1),
                operator="测试人员"
            )
        ]
        
        payment_receipts = [
            PaymentReceipt(
                receipt_id="RCPCTR2024999_01",
                contract_id=contract_id,
                payment_channel="微信支付",
                amount=50000.0,
                payment_time=sign_time_a + timedelta(days=2),
                manual_remark="时间顺序测试合同，故意设置乙方签署时间早于甲方",
                caller="test_service_001"
            )
        ]
        
        submission = ContractSubmission.construct(
            batch_id="BATCH2024999",
            contract_id=contract_id,
            contract_name="测试合同-时间顺序反转",
            party_a="测试甲方",
            party_b="测试乙方",
            sign_time_a=sign_time_a,
            sign_time_b=sign_time_b,
            create_time=base_time - timedelta(days=2),
            supplements=supplements,
            payment_receipts=payment_receipts,
            submitter="测试人员"
        )
        return submission.dict()
    
    def generate_all_demo_data(self) -> Dict[str, Any]:
        normal_contracts = self.generate_normal_contracts()
        error_contract = self.generate_time_order_error_contract()
        
        all_data = {
            "normal_contracts": normal_contracts,
            "time_order_error_contract": error_contract,
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "total_contracts": len(normal_contracts) + 1,
                "description": "包含3条正常合同和1条故意设置时间顺序错误的合同，用于功能测试和复核"
            }
        }
        
        demo_file = self.output_path / "demo_contracts.json"
        with open(demo_file, 'w', encoding='utf-8') as f:
            json.dump(all_data, f, ensure_ascii=False, indent=2, default=str)
        
        return all_data
    
    def get_demo_batch(self, include_error: bool = True) -> List[Dict[str, Any]]:
        all_data = self.generate_all_demo_data()
        batch = all_data["normal_contracts"].copy()
        if include_error:
            batch.append(all_data["time_order_error_contract"])
        return batch

import json
import csv
from typing import List, Dict, Any, Optional
from contract_review.models import ContractSample, ExtractedClause, FeedbackTicket
from contract_review.core.store import ReviewStore


class SampleImporter:
    def __init__(self, store: ReviewStore):
        self.store = store

    def import_from_json(self, file_path: str, model_version: str) -> List[str]:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if isinstance(data, dict):
            data = [data]

        imported_ids = []
        for item in data:
            sample = self._dict_to_sample(item, model_version)
            self.store.add_sample(sample)
            imported_ids.append(sample.sample_id)

        return imported_ids

    def import_from_csv(self, file_path: str, model_version: str) -> List[str]:
        samples = []
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            current_sample: Optional[ContractSample] = None
            for row in reader:
                sample_id = row.get("sample_id", "").strip()
                if not sample_id or (current_sample is None or current_sample.sample_id != sample_id):
                    if current_sample:
                        samples.append(current_sample)
                    current_sample = ContractSample(
                        sample_id=sample_id or None,
                        contract_name=row.get("contract_name", ""),
                        contract_content=row.get("contract_content", ""),
                        model_version=model_version,
                        overall_confidence=float(row.get("overall_confidence", 0)),
                        ticket_id=row.get("ticket_id") or None,
                        desensitization_note=row.get("desensitization_note", ""),
                        review_status=row.get("review_status", "pending")
                    )

                if current_sample and row.get("clause_id"):
                    clause = ExtractedClause(
                        clause_id=row["clause_id"],
                        clause_type=row.get("clause_type", ""),
                        content=row.get("clause_content", ""),
                        confidence=float(row.get("confidence", 0)),
                        start_pos=int(row.get("start_pos", 0)),
                        end_pos=int(row.get("end_pos", 0)),
                        is_correct=None if row.get("is_correct", "") == "" else row.get("is_correct").lower() == "true"
                    )
                    current_sample.extracted_clauses.append(clause)

            if current_sample:
                samples.append(current_sample)

        imported_ids = []
        for sample in samples:
            self.store.add_sample(sample)
            imported_ids.append(sample.sample_id)

        return imported_ids

    def import_tickets_from_json(self, file_path: str) -> List[str]:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if isinstance(data, dict):
            data = [data]

        imported_ids = []
        for item in data:
            ticket = FeedbackTicket(**item)
            self.store.add_ticket(ticket)
            imported_ids.append(ticket.ticket_id)

        return imported_ids

    def _dict_to_sample(self, data: Dict[str, Any], model_version: str) -> ContractSample:
        clauses_data = data.get("extracted_clauses", [])
        clauses = [ExtractedClause(**c) for c in clauses_data]

        sample = ContractSample(
            sample_id=data.get("sample_id"),
            contract_name=data.get("contract_name", ""),
            contract_content=data.get("contract_content", ""),
            model_version=data.get("model_version", model_version),
            overall_confidence=data.get("overall_confidence", 0.0),
            ticket_id=data.get("ticket_id"),
            desensitization_note=data.get("desensitization_note", ""),
            review_status=data.get("review_status", "pending"),
            reviewer=data.get("reviewer")
        )
        sample.extracted_clauses = clauses
        return sample

    def generate_demo_samples(self, model_version: str, count: int = 5) -> List[str]:
        demo_data = [
            {
                "contract_name": "采购合同-2024-001",
                "overall_confidence": 0.82,
                "extracted_clauses": [
                    {"clause_id": "C001", "clause_type": "payment", "content": "甲方应于收货后30日内支付货款", "confidence": 0.95, "start_pos": 100, "end_pos": 130},
                    {"clause_id": "C002", "clause_type": "delivery", "content": "乙方应于签订后15日内交货", "confidence": 0.92, "start_pos": 200, "end_pos": 230},
                    {"clause_id": "C003", "clause_type": "liability", "content": "违约方赔偿损失", "confidence": 0.55, "start_pos": 300, "end_pos": 320},
                ]
            },
            {
                "contract_name": "服务协议-2024-056",
                "overall_confidence": 0.78,
                "extracted_clauses": [
                    {"clause_id": "C004", "clause_type": "term", "content": "本协议有效期一年", "confidence": 0.94, "start_pos": 50, "end_pos": 70},
                    {"clause_id": "C005", "clause_type": "confidential", "content": "保密期限五年", "confidence": 0.60, "start_pos": 150, "end_pos": 170},
                ]
            },
            {
                "contract_name": "劳动合同-T003",
                "overall_confidence": 0.65,
                "extracted_clauses": [
                    {"clause_id": "C006", "clause_type": "salary", "content": "月薪8000元", "confidence": 0.58, "start_pos": 80, "end_pos": 95},
                    {"clause_id": "C007", "clause_type": "probation", "content": "试用期三个月", "confidence": 0.62, "start_pos": 120, "end_pos": 140},
                ]
            },
            {
                "contract_name": "租赁合同-A202",
                "overall_confidence": 0.88,
                "extracted_clauses": [
                    {"clause_id": "C008", "clause_type": "rent", "content": "月租金5000元", "confidence": 0.96, "start_pos": 60, "end_pos": 80},
                    {"clause_id": "C009", "clause_type": "deposit", "content": "押金10000元", "confidence": 0.93, "start_pos": 100, "end_pos": 120},
                    {"clause_id": "C010", "clause_type": "duration", "content": "租期自2024至2026", "confidence": 0.68, "start_pos": 140, "end_pos": 165},
                ]
            },
            {
                "contract_name": "技术开发合同-DEV01",
                "overall_confidence": 0.91,
                "extracted_clauses": [
                    {"clause_id": "C011", "clause_type": "scope", "content": "开发内容见附件", "confidence": 0.94, "start_pos": 30, "end_pos": 50},
                    {"clause_id": "C012", "clause_type": "milestone", "content": "分三期交付", "confidence": 0.92, "start_pos": 70, "end_pos": 90},
                    {"clause_id": "C013", "clause_type": "acceptance", "content": "验收标准见需求文档", "confidence": 0.95, "start_pos": 110, "end_pos": 140},
                ]
            }
        ]

        imported_ids = []
        for i, item in enumerate(demo_data[:count]):
            sample = self._dict_to_sample(item, model_version)
            sample.sample_id = f"S{model_version.replace('.', '')}{i+1:03d}"
            self.store.add_sample(sample)
            imported_ids.append(sample.sample_id)

        return imported_ids

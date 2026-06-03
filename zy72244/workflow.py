from typing import List, Dict, Tuple
from dataclasses import dataclass
from datetime import datetime

from models import (
    AccountManagerEmail,
    SettlementBatch,
    LoanInterestRecord,
    RecordStatus,
    NextHandler,
)
from service import InterestCalculationService
from report_service import ReportService


@dataclass
class WorkflowStep:
    step_name: str
    description: str
    operator: str
    timestamp: datetime
    completed: bool = False


class LoanInterestWorkflow:
    def __init__(self):
        self.calc_service = InterestCalculationService()
        self.report_service = ReportService()
        self.workflow_steps: List[WorkflowStep] = []

    def step1_import_account_manager_email(
        self,
        email_data_list: List[Dict]
    ) -> Tuple[List[AccountManagerEmail], List[LoanInterestRecord]]:
        step = WorkflowStep(
            step_name="第一步：导入客户经理补充邮件",
            description="客户经理提交借款信息邮件",
            operator="客户经理",
            timestamp=datetime.now()
        )

        imported_emails = []
        created_records = []

        for email_data in email_data_list:
            email, is_duplicate = self.calc_service.import_account_manager_email(email_data)
            imported_emails.append(email)

            if not is_duplicate:
                record = self.calc_service.create_interest_record_from_email(email)
                created_records.append(record)

        step.completed = True
        self.workflow_steps.append(step)

        return imported_emails, created_records

    def step2_link_settlement_batches(
        self,
        batch_data_list: List[Dict],
        record_batch_mapping: Dict[str, str]
    ) -> List[LoanInterestRecord]:
        step = WorkflowStep(
            step_name="第二步：基金会计补看清算批次号",
            description="林姐匹配清算批次号与借款记录",
            operator="基金会计林姐",
            timestamp=datetime.now()
        )

        imported_batches = []
        for batch_data in batch_data_list:
            batch = self.calc_service.import_settlement_batch(batch_data)
            imported_batches.append(batch)

        batch_map = {b.batch_no: b for b in imported_batches}

        updated_records = []
        for record_id, batch_no in record_batch_mapping.items():
            if batch_no in batch_map:
                self.calc_service.link_settlement_to_record(
                    record_id,
                    batch_map[batch_no],
                    "基金会计林姐"
                )
                updated_records.append(self.calc_service.records[record_id])

        step.completed = True
        self.workflow_steps.append(step)

        return updated_records

    def step3_update_supplementary_records(
        self,
        supplementary_data: Dict[str, Dict]
    ) -> List[LoanInterestRecord]:
        step = WorkflowStep(
            step_name="第三步：更新补录记录",
            description="补充说明保留原因、缺失材料、下一步处理人",
            operator="基金会计林姐",
            timestamp=datetime.now()
        )

        updated_records = []
        for record_id, supp_data in supplementary_data.items():
            if record_id in self.calc_service.records:
                record = self.calc_service.records[record_id]
                self.report_service.generate_supplementary_record(
                    record=record,
                    reason_kept=supp_data["reason_kept"],
                    missing_materials=supp_data["missing_materials"],
                    next_handler=NextHandler(supp_data["next_handler"]),
                    notes=supp_data.get("notes", ""),
                    created_by="基金会计林姐"
                )
                updated_records.append(record)

        step.completed = True
        self.workflow_steps.append(step)

        return updated_records

    def step4_financial_reviewer_review(
        self,
        review_decisions: Dict[str, Dict]
    ) -> List[LoanInterestRecord]:
        step = WorkflowStep(
            step_name="第四步：财务复核人复核",
            description="对机构简称不一致的记录进行复核确认",
            operator="财务复核人",
            timestamp=datetime.now()
        )

        reviewed_records = []
        for record_id, decision in review_decisions.items():
            if record_id in self.calc_service.records:
                record = self.calc_service.records[record_id]
                self.report_service.review_conflict_record(
                    record=record,
                    reviewer_decision=decision["decision"],
                    correct_short_name=decision.get("correct_short_name"),
                    reviewed_by="财务复核人"
                )
                reviewed_records.append(record)

        step.completed = True
        self.workflow_steps.append(step)

        return reviewed_records

    def update_remark(
        self,
        record_id: str,
        new_remark: str,
        operator: str
    ):
        self.calc_service.update_remark(record_id, new_remark, operator)

    def get_record_history(self, record_id: str) -> List[Dict]:
        return self.calc_service.get_record_history(record_id)

    def get_source_data(self, record_id: str) -> Dict:
        return self.calc_service.get_source_data_for_record(record_id)

    def get_conflict_records(self) -> List[LoanInterestRecord]:
        return self.calc_service.get_conflict_records()

    def get_all_records(self) -> List[LoanInterestRecord]:
        return list(self.calc_service.records.values())

    def generate_friendly_report(self, record_id: str) -> str:
        if record_id not in self.calc_service.records:
            return "记录不存在"
        return self.report_service.generate_friendly_report(
            self.calc_service.records[record_id]
        )

    def generate_summary(self) -> Dict:
        return self.report_service.generate_summary_report(
            list(self.calc_service.records.values())
        )

    def get_workflow_progress(self) -> List[Dict]:
        return [
            {
                "步骤": step.step_name,
                "描述": step.description,
                "操作人": step.operator,
                "时间": step.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "状态": "已完成" if step.completed else "进行中"
            }
            for step in self.workflow_steps
        ]

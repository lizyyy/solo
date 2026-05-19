import hashlib
from typing import List, Optional, Tuple
from datetime import datetime

from repository import UnitOfWork
from models import (
    Application,
    ApplicationItem,
    ApplicationStatus,
    OperationType,
    ExceptionType,
    OperationLog,
)
from rules import (
    ApplicationContext,
    RuleEngine,
    create_application_rules,
    RuleResult,
)


class ApplicationService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow
        self.rule_engine = RuleEngine[ApplicationContext]()
        self.rule_engine.register_all(create_application_rules())

    def _generate_request_hash(self, applicant_id: str, items: List[dict]) -> str:
        content = f"{applicant_id}:{sorted(str(i) for i in items)}"
        return hashlib.md5(content.encode()).hexdigest()

    def create_application(
        self,
        applicant_id: str,
        applicant_name: str,
        purpose: str,
        items_data: List[dict],
        department: Optional[str] = None,
        idempotent_key: Optional[str] = None,
    ) -> Tuple[Application, List[RuleResult], bool]:
        request_hash = self._generate_request_hash(applicant_id, items_data)
        
        if idempotent_key:
            existing = self.uow.applications.find_by_idempotent_key(idempotent_key)
            if existing:
                return existing, [], True
        
        existing = self.uow.applications.find_by_request_hash(request_hash)
        if existing:
            return existing, [], True

        application = Application(
            applicant_id=applicant_id,
            applicant_name=applicant_name,
            department=department,
            purpose=purpose,
            status=ApplicationStatus.DRAFT,
            request_hash=request_hash,
        )
        if idempotent_key:
            application.idempotent_key = idempotent_key

        for item_data in items_data:
            item = ApplicationItem(
                application_id=application.id,
                reagent_id=item_data["reagent_id"],
                reagent_name=item_data["reagent_name"],
                specification=item_data.get("specification", ""),
                quantity=item_data["quantity"],
                unit=item_data.get("unit", ""),
                danger_level=item_data.get("danger_level", "无"),
            )
            application.items.append(item)

        self.uow.applications.create(application)
        return application, [], True

    def submit_application(
        self,
        application_id: str,
        operator_id: str,
        operator_name: str,
    ) -> Tuple[Application, List[RuleResult], bool]:
        application = self.uow.applications.get_by_id(application_id)
        if not application:
            raise ValueError(f"申请单 {application_id} 不存在")

        reagent_ids = [item.reagent_id for item in application.items]
        reagents = [self.uow.reagents.get_by_id(rid) for rid in reagent_ids]
        reagents = [r for r in reagents if r]
        
        inventories = []
        for rid in reagent_ids:
            inventories.extend(self.uow.inventory.find_by_reagent_id(rid))

        context = ApplicationContext(
            application=application,
            items=application.items,
            reagents=reagents,
            inventories=inventories,
        )

        results, all_passed = self.rule_engine.execute(context)

        if not all_passed:
            for result in results:
                if not result.passed:
                    application.exception_type = result.exception_type
                    application.exception_message = result.message
                    break
            self.uow.applications.update(application)
            self._log_operation(
                application_id, "Application", OperationType.APPLY,
                operator_id, operator_name, application.model_dump(),
                application.exception_type, application.exception_message,
            )
            return application, results, False

        application.submit()
        application.status = ApplicationStatus.PENDING
        
        self.uow.applications.update(application)
        self._log_operation(
            application_id, "Application", OperationType.APPLY,
            operator_id, operator_name, application.model_dump(),
        )

        return application, results, True

    def resubmit_application(
        self,
        application_id: str,
        operator_id: str,
        operator_name: str,
        updated_items: Optional[List[dict]] = None,
    ) -> Tuple[Application, List[RuleResult], bool]:
        application = self.uow.applications.get_by_id(application_id)
        if not application:
            raise ValueError(f"申请单 {application_id} 不存在")

        if application.status != ApplicationStatus.REJECTED:
            raise ValueError("只有被驳回的申请才能重新提交")

        if updated_items:
            application.items = []
            for item_data in updated_items:
                item = ApplicationItem(
                    application_id=application.id,
                    reagent_id=item_data["reagent_id"],
                    reagent_name=item_data["reagent_name"],
                    specification=item_data.get("specification", ""),
                    quantity=item_data["quantity"],
                    unit=item_data.get("unit", ""),
                    danger_level=item_data.get("danger_level", "无"),
                )
                application.items.append(item)

        application.resubmit()

        reagent_ids = [item.reagent_id for item in application.items]
        reagents = [self.uow.reagents.get_by_id(rid) for rid in reagent_ids]
        reagents = [r for r in reagents if r]
        
        inventories = []
        for rid in reagent_ids:
            inventories.extend(self.uow.inventory.find_by_reagent_id(rid))

        context = ApplicationContext(
            application=application,
            items=application.items,
            reagents=reagents,
            inventories=inventories,
        )

        results, all_passed = self.rule_engine.execute(context)

        if not all_passed:
            for result in results:
                if not result.passed:
                    application.exception_type = result.exception_type
                    application.exception_message = result.message
                    break
            self.uow.applications.update(application)
            return application, results, False

        application.status = ApplicationStatus.PENDING
        application.exception_type = ExceptionType.REJECTED_RESUBMIT
        application.exception_message = "驳回后重新提交"
        
        self.uow.applications.update(application)
        self._log_operation(
            application_id, "Application", OperationType.APPLY,
            operator_id, operator_name, application.model_dump(),
            ExceptionType.REJECTED_RESUBMIT, "驳回后重新提交",
        )

        return application, results, True

    def cancel_application(
        self,
        application_id: str,
        operator_id: str,
        operator_name: str,
    ) -> Application:
        application = self.uow.applications.get_by_id(application_id)
        if not application:
            raise ValueError(f"申请单 {application_id} 不存在")

        application.cancel()
        self.uow.applications.update(application)
        
        self._log_operation(
            application_id, "Application", OperationType.APPLY,
            operator_id, operator_name, application.model_dump(),
        )

        return application

    def get_application(self, application_id: str) -> Optional[Application]:
        return self.uow.applications.get_by_id(application_id)

    def _log_operation(
        self,
        target_id: str,
        target_type: str,
        operation_type: OperationType,
        operator_id: str,
        operator_name: str,
        after_data: Optional[dict] = None,
        exception_type: ExceptionType = ExceptionType.NONE,
        exception_message: Optional[str] = None,
    ):
        log = OperationLog(
            operation_type=operation_type,
            operator_id=operator_id,
            operator_name=operator_name,
            target_id=target_id,
            target_type=target_type,
            after_data=after_data,
            exception_type=exception_type,
            exception_message=exception_message,
        )
        self.uow.logs.create(log)

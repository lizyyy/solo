from datetime import datetime
from typing import List, Dict, Optional
from uuid import uuid4
from models import (
    Bill, BillStatus, Endorsement, EndorsementStatus,
    CollectionRequest, CollectionStatus, ReturnRecord,
    FundTransaction, TransactionType, FailedOperation
)


class BillStateValidator:
    
    @staticmethod
    def can_register(current_status: BillStatus) -> bool:
        return current_status == BillStatus.DRAFT
    
    @staticmethod
    def can_endorse(current_status: BillStatus) -> bool:
        return current_status in [BillStatus.REGISTERED, BillStatus.ENDORSED]
    
    @staticmethod
    def can_initiate_collection(current_status: BillStatus, maturity_date: datetime) -> bool:
        if current_status not in [BillStatus.REGISTERED, BillStatus.ENDORSED]:
            return False
        return datetime.now() >= maturity_date
    
    @staticmethod
    def can_submit_collection(current_status: BillStatus) -> bool:
        return current_status == BillStatus.COLLECTION_PENDING
    
    @staticmethod
    def can_confirm_collection(current_status: BillStatus) -> bool:
        return current_status == BillStatus.COLLECTION_SUBMITTED
    
    @staticmethod
    def can_pay(current_status: BillStatus) -> bool:
        return current_status == BillStatus.COLLECTION_CONFIRMED
    
    @staticmethod
    def can_return(current_status: BillStatus) -> bool:
        return current_status in [
            BillStatus.COLLECTION_PENDING,
            BillStatus.COLLECTION_SUBMITTED,
            BillStatus.COLLECTION_CONFIRMED
        ]


class BillService:
    
    def __init__(self):
        self.bills: Dict[str, Bill] = {}
    
    def register_bill(
        self,
        bill_no: str,
        drawer: str,
        acceptor: str,
        amount: float,
        currency: str,
        issue_date: datetime,
        maturity_date: datetime,
        initial_holder: str
    ) -> Bill:
        if maturity_date <= issue_date:
            raise ValueError("Maturity date must be after issue date")
        if amount <= 0:
            raise ValueError("Amount must be positive")
        
        bill_id = str(uuid4())
        bill = Bill(
            id=bill_id,
            bill_no=bill_no,
            drawer=drawer,
            acceptor=acceptor,
            amount=amount,
            currency=currency,
            issue_date=issue_date,
            maturity_date=maturity_date,
            current_holder=initial_holder,
            status=BillStatus.DRAFT
        )
        
        self._execute_with_retry(bill, "register", self._do_register, {
            "bill_no": bill_no,
            "drawer": drawer,
            "acceptor": acceptor,
            "amount": amount,
            "currency": currency,
            "issue_date": issue_date,
            "maturity_date": maturity_date,
            "initial_holder": initial_holder
        })
        
        self.bills[bill_id] = bill
        return bill
    
    def _do_register(self, bill: Bill, data: Dict):
        if not BillStateValidator.can_register(bill.status):
            raise ValueError(f"Cannot register bill in status {bill.status}")
        
        bill.status = BillStatus.REGISTERED
        bill.updated_at = datetime.now()
    
    def endorse_bill(
        self,
        bill_id: str,
        from_holder: str,
        to_holder: str,
        confirm_immediately: bool = True
    ) -> Endorsement:
        bill = self._get_bill(bill_id)
        
        if not BillStateValidator.can_endorse(bill.status):
            raise ValueError(f"Cannot endorse bill in status {bill.status}")
        
        if not bill.verify_endorsement_chain():
            raise ValueError("Endorsement chain is broken, cannot add new endorsement")
        
        endorsement = Endorsement(
            id=str(uuid4()),
            from_holder=from_holder,
            to_holder=to_holder,
            sequence=len(bill.endorsements) + 1,
            status=EndorsementStatus.PENDING if not confirm_immediately else EndorsementStatus.CONFIRMED,
            created_at=datetime.now(),
            confirmed_at=datetime.now() if confirm_immediately else None
        )
        
        self._execute_with_retry(bill, "endorse", self._do_endorse, {
            "endorsement": endorsement,
            "to_holder": to_holder,
            "confirm_immediately": confirm_immediately
        })
        
        return endorsement
    
    def _do_endorse(self, bill: Bill, data: Dict):
        endorsement = data["endorsement"]
        to_holder = data["to_holder"]
        confirm_immediately = data["confirm_immediately"]
        
        bill.add_endorsement(endorsement)
        if confirm_immediately:
            bill.current_holder = to_holder
            bill.status = BillStatus.ENDORSED
        bill.updated_at = datetime.now()
    
    def confirm_endorsement(self, bill_id: str, endorsement_id: str) -> Endorsement:
        bill = self._get_bill(bill_id)
        
        endorsement = None
        for e in bill.endorsements:
            if e.id == endorsement_id:
                endorsement = e
                break
        
        if not endorsement:
            raise ValueError("Endorsement not found")
        
        if endorsement.status != EndorsementStatus.PENDING:
            raise ValueError("Endorsement is not pending")
        
        self._execute_with_retry(bill, "confirm_endorsement", self._do_confirm_endorsement, {
            "endorsement": endorsement
        })
        
        return endorsement
    
    def _do_confirm_endorsement(self, bill: Bill, data: Dict):
        endorsement = data["endorsement"]
        endorsement.status = EndorsementStatus.CONFIRMED
        endorsement.confirmed_at = datetime.now()
        bill.current_holder = endorsement.to_holder
        bill.status = BillStatus.ENDORSED
        bill.updated_at = datetime.now()
    
    def reject_endorsement(self, bill_id: str, endorsement_id: str, reason: str) -> Endorsement:
        bill = self._get_bill(bill_id)
        
        endorsement = None
        for e in bill.endorsements:
            if e.id == endorsement_id:
                endorsement = e
                break
        
        if not endorsement:
            raise ValueError("Endorsement not found")
        
        if endorsement.status != EndorsementStatus.PENDING:
            raise ValueError("Endorsement is not pending")
        
        endorsement.status = EndorsementStatus.REJECTED
        endorsement.rejected_at = datetime.now()
        endorsement.reject_reason = reason
        bill.updated_at = datetime.now()
        
        return endorsement
    
    def initiate_collection(
        self,
        bill_id: str,
        holder_id: str,
        collection_bank: str,
        collection_account: str
    ) -> CollectionRequest:
        bill = self._get_bill(bill_id)
        
        if holder_id != bill.current_holder:
            raise ValueError("Only current holder can initiate collection")
        
        if not bill.verify_endorsement_chain():
            raise ValueError("Endorsement chain must be complete before collection")
        
        if not BillStateValidator.can_initiate_collection(bill.status, bill.maturity_date):
            raise ValueError(f"Cannot initiate collection in status {bill.status}")
        
        if bill.collection_request and bill.collection_request.status == CollectionStatus.SUBMITTED:
            raise ValueError("Collection already submitted")
        
        collection_request = CollectionRequest(
            id=str(uuid4()),
            bill_id=bill_id,
            holder_id=holder_id,
            collection_bank=collection_bank,
            collection_account=collection_account,
            status=CollectionStatus.PENDING,
            created_at=datetime.now()
        )
        
        self._execute_with_retry(bill, "initiate_collection", self._do_initiate_collection, {
            "collection_request": collection_request
        })
        
        return collection_request
    
    def _do_initiate_collection(self, bill: Bill, data: Dict):
        collection_request = data["collection_request"]
        bill.collection_request = collection_request
        bill.status = BillStatus.COLLECTION_PENDING
        bill.updated_at = datetime.now()
    
    def submit_collection(self, bill_id: str) -> CollectionRequest:
        bill = self._get_bill(bill_id)
        
        if not BillStateValidator.can_submit_collection(bill.status):
            raise ValueError(f"Cannot submit collection in status {bill.status}")
        
        if not bill.collection_request:
            raise ValueError("No collection request initiated")
        
        self._execute_with_retry(bill, "submit_collection", self._do_submit_collection, {})
        
        return bill.collection_request
    
    def _do_submit_collection(self, bill: Bill, data: Dict):
        bill.collection_request.status = CollectionStatus.SUBMITTED
        bill.collection_request.submitted_at = datetime.now()
        bill.status = BillStatus.COLLECTION_SUBMITTED
        bill.updated_at = datetime.now()
    
    def confirm_collection(self, bill_id: str) -> CollectionRequest:
        bill = self._get_bill(bill_id)
        
        if not BillStateValidator.can_confirm_collection(bill.status):
            raise ValueError(f"Cannot confirm collection in status {bill.status}")
        
        if not bill.collection_request:
            raise ValueError("No collection request")
        
        self._execute_with_retry(bill, "confirm_collection", self._do_confirm_collection, {
            "debit_account": f"BANK_{bill.acceptor}",
            "credit_account": bill.collection_request.collection_account,
            "amount": bill.amount,
            "currency": bill.currency,
            "reference_id": bill.collection_request.id
        })
        
        return bill.collection_request
    
    def _do_confirm_collection(self, bill: Bill, data: Dict):
        bill.collection_request.status = CollectionStatus.CONFIRMED
        bill.collection_request.confirmed_at = datetime.now()
        bill.status = BillStatus.COLLECTION_CONFIRMED
        
        transaction = FundTransaction(
            id=str(uuid4()),
            bill_id=bill.id,
            transaction_type=TransactionType.COLLECTION_CONFIRM,
            amount=data["amount"],
            currency=data["currency"],
            debit_account=data["debit_account"],
            credit_account=data["credit_account"],
            created_at=datetime.now(),
            reference_id=data["reference_id"]
        )
        bill.transactions.append(transaction)
        bill.updated_at = datetime.now()
    
    def pay_bill(self, bill_id: str) -> FundTransaction:
        bill = self._get_bill(bill_id)
        
        if not BillStateValidator.can_pay(bill.status):
            raise ValueError(f"Cannot pay bill in status {bill.status}")
        
        if not bill.collection_request:
            raise ValueError("No collection request")
        
        transaction = FundTransaction(
            id=str(uuid4()),
            bill_id=bill.id,
            transaction_type=TransactionType.PAYMENT,
            amount=bill.amount,
            currency=bill.currency,
            debit_account=f"PAYER_{bill.acceptor}",
            credit_account=bill.collection_request.collection_account,
            created_at=datetime.now(),
            reference_id=bill.collection_request.id
        )
        
        self._execute_with_retry(bill, "pay_bill", self._do_pay_bill, {
            "transaction": transaction
        })
        
        return transaction
    
    def _do_pay_bill(self, bill: Bill, data: Dict):
        transaction = data["transaction"]
        bill.transactions.append(transaction)
        bill.status = BillStatus.PAID
        bill.updated_at = datetime.now()
    
    def process_return(
        self,
        bill_id: str,
        return_bank: str,
        return_reason: str,
        return_date: datetime = None
    ) -> ReturnRecord:
        bill = self._get_bill(bill_id)
        
        if not BillStateValidator.can_return(bill.status):
            raise ValueError(f"Cannot return bill in status {bill.status}")
        
        if not bill.collection_request:
            raise ValueError("No collection in progress")
        
        return_record = ReturnRecord(
            id=str(uuid4()),
            bill_id=bill_id,
            holder_id=bill.current_holder,
            return_bank=return_bank,
            return_reason=return_reason,
            return_date=return_date or datetime.now()
        )
        
        self._execute_with_retry(bill, "process_return", self._do_process_return, {
            "return_record": return_record
        })
        
        return return_record
    
    def _do_process_return(self, bill: Bill, data: Dict):
        return_record = data["return_record"]
        bill.return_record = return_record
        
        if bill.collection_request:
            bill.collection_request.status = CollectionStatus.FAILED
            bill.collection_request.failed_at = datetime.now()
            bill.collection_request.fail_reason = return_record.return_reason
        
        bill.status = BillStatus.RETURNED
        bill.updated_at = datetime.now()
    
    def record_fund_transaction(
        self,
        bill_id: str,
        transaction_type: TransactionType,
        amount: float,
        currency: str,
        debit_account: str,
        credit_account: str,
        reference_id: str
    ) -> FundTransaction:
        bill = self._get_bill(bill_id)
        
        transaction = FundTransaction(
            id=str(uuid4()),
            bill_id=bill_id,
            transaction_type=transaction_type,
            amount=amount,
            currency=currency,
            debit_account=debit_account,
            credit_account=credit_account,
            created_at=datetime.now(),
            reference_id=reference_id
        )
        
        bill.transactions.append(transaction)
        bill.updated_at = datetime.now()
        
        return transaction
    
    def _execute_with_retry(
        self,
        bill: Bill,
        operation_type: str,
        operation_func,
        data: Dict
    ):
        try:
            operation_func(bill, data)
        except Exception as e:
            failed_op = FailedOperation(
                id=str(uuid4()),
                bill_id=bill.id,
                operation_type=operation_type,
                operation_data=data,
                error_message=str(e),
                failed_at=datetime.now()
            )
            bill.failed_operations.append(failed_op)
            bill.status = BillStatus.ERROR
            bill.updated_at = datetime.now()
            raise e
    
    def retry_failed_operation(self, bill_id: str, failed_operation_id: str):
        bill = self._get_bill(bill_id)
        
        failed_op = None
        for op in bill.failed_operations:
            if op.id == failed_operation_id:
                failed_op = op
                break
        
        if not failed_op:
            raise ValueError("Failed operation not found")
        
        if failed_op.resolved:
            raise ValueError("Operation already resolved")
        
        operation_map = {
            "register": self._do_register,
            "endorse": self._do_endorse,
            "confirm_endorsement": self._do_confirm_endorsement,
            "initiate_collection": self._do_initiate_collection,
            "submit_collection": self._do_submit_collection,
            "confirm_collection": self._do_confirm_collection,
            "pay_bill": self._do_pay_bill,
            "process_return": self._do_process_return
        }
        
        operation_func = operation_map.get(failed_op.operation_type)
        if not operation_func:
            raise ValueError(f"Unknown operation type: {failed_op.operation_type}")
        
        try:
            operation_func(bill, failed_op.operation_data)
            failed_op.resolved = True
            failed_op.resolved_at = datetime.now()
            bill.updated_at = datetime.now()
        except Exception as e:
            failed_op.retry_count += 1
            failed_op.last_retry_at = datetime.now()
            failed_op.error_message = str(e)
            raise e
    
    def get_bill(self, bill_id: str) -> Bill:
        return self._get_bill(bill_id)
    
    def get_all_bills(self) -> List[Bill]:
        return list(self.bills.values())
    
    def _get_bill(self, bill_id: str) -> Bill:
        if bill_id not in self.bills:
            raise ValueError(f"Bill not found: {bill_id}")
        return self.bills[bill_id]

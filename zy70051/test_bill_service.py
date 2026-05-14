import unittest
from datetime import datetime, timedelta
from models import (
    BillStatus, EndorsementStatus, CollectionStatus, TransactionType
)
from bill_service import BillService, BillStateValidator


class TestBillStateValidator(unittest.TestCase):
    
    def test_can_register_only_from_draft(self):
        self.assertTrue(BillStateValidator.can_register(BillStatus.DRAFT))
        self.assertFalse(BillStateValidator.can_register(BillStatus.REGISTERED))
        self.assertFalse(BillStateValidator.can_register(BillStatus.PAID))
    
    def test_can_endorse_only_from_registered_or_endorsed(self):
        self.assertTrue(BillStateValidator.can_endorse(BillStatus.REGISTERED))
        self.assertTrue(BillStateValidator.can_endorse(BillStatus.ENDORSED))
        self.assertFalse(BillStateValidator.can_endorse(BillStatus.COLLECTION_PENDING))
        self.assertFalse(BillStateValidator.can_endorse(BillStatus.PAID))
    
    def test_can_initiate_collection_maturity_date_check(self):
        past_date = datetime.now() - timedelta(days=10)
        future_date = datetime.now() + timedelta(days=10)
        
        self.assertTrue(BillStateValidator.can_initiate_collection(BillStatus.REGISTERED, past_date))
        self.assertTrue(BillStateValidator.can_initiate_collection(BillStatus.ENDORSED, past_date))
        self.assertFalse(BillStateValidator.can_initiate_collection(BillStatus.REGISTERED, future_date))
        self.assertFalse(BillStateValidator.can_initiate_collection(BillStatus.COLLECTION_PENDING, past_date))
    
    def test_can_submit_collection_only_from_pending(self):
        self.assertTrue(BillStateValidator.can_submit_collection(BillStatus.COLLECTION_PENDING))
        self.assertFalse(BillStateValidator.can_submit_collection(BillStatus.REGISTERED))
        self.assertFalse(BillStateValidator.can_submit_collection(BillStatus.COLLECTION_SUBMITTED))
    
    def test_can_confirm_collection_only_from_submitted(self):
        self.assertTrue(BillStateValidator.can_confirm_collection(BillStatus.COLLECTION_SUBMITTED))
        self.assertFalse(BillStateValidator.can_confirm_collection(BillStatus.COLLECTION_PENDING))
        self.assertFalse(BillStateValidator.can_confirm_collection(BillStatus.PAID))
    
    def test_can_pay_only_from_confirmed(self):
        self.assertTrue(BillStateValidator.can_pay(BillStatus.COLLECTION_CONFIRMED))
        self.assertFalse(BillStateValidator.can_pay(BillStatus.COLLECTION_SUBMITTED))
        self.assertFalse(BillStateValidator.can_pay(BillStatus.PAID))
    
    def test_can_return_during_collection(self):
        self.assertTrue(BillStateValidator.can_return(BillStatus.COLLECTION_PENDING))
        self.assertTrue(BillStateValidator.can_return(BillStatus.COLLECTION_SUBMITTED))
        self.assertTrue(BillStateValidator.can_return(BillStatus.COLLECTION_CONFIRMED))
        self.assertFalse(BillStateValidator.can_return(BillStatus.REGISTERED))
        self.assertFalse(BillStateValidator.can_return(BillStatus.PAID))


class TestBillRegistration(unittest.TestCase):
    
    def setUp(self):
        self.service = BillService()
    
    def test_successful_registration(self):
        issue_date = datetime(2024, 1, 1)
        maturity_date = datetime(2024, 6, 1)
        
        bill = self.service.register_bill(
            bill_no="BILL001",
            drawer="Company A",
            acceptor="Bank X",
            amount=100000,
            currency="CNY",
            issue_date=issue_date,
            maturity_date=maturity_date,
            initial_holder="Company A"
        )
        
        self.assertIsNotNone(bill.id)
        self.assertEqual(bill.status, BillStatus.REGISTERED)
        self.assertEqual(bill.current_holder, "Company A")
        self.assertEqual(bill.amount, 100000)
    
    def test_registration_fails_with_negative_amount(self):
        with self.assertRaises(ValueError) as ctx:
            self.service.register_bill(
                bill_no="BILL002",
                drawer="Company A",
                acceptor="Bank X",
                amount=-100,
                currency="CNY",
                issue_date=datetime(2024, 1, 1),
                maturity_date=datetime(2024, 6, 1),
                initial_holder="Company A"
            )
        self.assertIn("positive", str(ctx.exception))
    
    def test_registration_fails_with_invalid_maturity(self):
        with self.assertRaises(ValueError) as ctx:
            self.service.register_bill(
                bill_no="BILL003",
                drawer="Company A",
                acceptor="Bank X",
                amount=100000,
                currency="CNY",
                issue_date=datetime(2024, 6, 1),
                maturity_date=datetime(2024, 1, 1),
                initial_holder="Company A"
            )
        self.assertIn("Maturity", str(ctx.exception))


class TestEndorsement(unittest.TestCase):
    
    def setUp(self):
        self.service = BillService()
        self.bill = self.service.register_bill(
            bill_no="BILL001",
            drawer="Company A",
            acceptor="Bank X",
            amount=100000,
            currency="CNY",
            issue_date=datetime(2024, 1, 1),
            maturity_date=datetime(2024, 6, 1),
            initial_holder="Company A"
        )
    
    def test_successful_endorsement(self):
        endorsement = self.service.endorse_bill(
            bill_id=self.bill.id,
            from_holder="Company A",
            to_holder="Company B"
        )
        
        self.assertEqual(endorsement.from_holder, "Company A")
        self.assertEqual(endorsement.to_holder, "Company B")
        self.assertEqual(endorsement.sequence, 1)
        self.assertEqual(endorsement.status, EndorsementStatus.CONFIRMED)
        
        updated_bill = self.service.get_bill(self.bill.id)
        self.assertEqual(updated_bill.current_holder, "Company B")
        self.assertEqual(updated_bill.status, BillStatus.ENDORSED)
    
    def test_endorsement_fails_wrong_from_holder(self):
        with self.assertRaises(ValueError) as ctx:
            self.service.endorse_bill(
                bill_id=self.bill.id,
                from_holder="Wrong Holder",
                to_holder="Company B"
            )
        self.assertIn("mismatch", str(ctx.exception))
    
    def test_verify_endorsement_chain(self):
        endorsement = self.service.endorse_bill(
            bill_id=self.bill.id,
            from_holder="Company A",
            to_holder="Company B"
        )
        
        bill = self.service.get_bill(self.bill.id)
        self.assertTrue(bill.verify_endorsement_chain())
    
    def test_pending_endorsement_breaks_chain(self):
        endorsement = self.service.endorse_bill(
            bill_id=self.bill.id,
            from_holder="Company A",
            to_holder="Company B",
            confirm_immediately=False
        )
        
        bill = self.service.get_bill(self.bill.id)
        self.assertFalse(bill.verify_endorsement_chain())
    
    def test_confirm_endorsement(self):
        endorsement = self.service.endorse_bill(
            bill_id=self.bill.id,
            from_holder="Company A",
            to_holder="Company B",
            confirm_immediately=False
        )
        
        self.service.confirm_endorsement(self.bill.id, endorsement.id)
        
        bill = self.service.get_bill(self.bill.id)
        self.assertEqual(bill.current_holder, "Company B")
        self.assertTrue(bill.verify_endorsement_chain())
    
    def test_cannot_endorse_after_collection_started(self):
        past_maturity = datetime.now() - timedelta(days=5)
        bill = self.service.register_bill(
            bill_no="BILL002",
            drawer="Company A",
            acceptor="Bank X",
            amount=100000,
            currency="CNY",
            issue_date=datetime(2024, 1, 1),
            maturity_date=past_maturity,
            initial_holder="Company A"
        )
        
        self.service.initiate_collection(
            bill_id=bill.id,
            holder_id="Company A",
            collection_bank="Bank Y",
            collection_account="ACC123"
        )
        
        with self.assertRaises(ValueError):
            self.service.endorse_bill(
                bill_id=bill.id,
                from_holder="Company A",
                to_holder="Company B"
            )


class TestCollection(unittest.TestCase):
    
    def setUp(self):
        self.service = BillService()
        self.past_maturity = datetime.now() - timedelta(days=5)
        self.bill = self.service.register_bill(
            bill_no="BILL001",
            drawer="Company A",
            acceptor="Bank X",
            amount=100000,
            currency="CNY",
            issue_date=datetime(2024, 1, 1),
            maturity_date=self.past_maturity,
            initial_holder="Company A"
        )
    
    def test_initiate_collection_before_maturity_fails(self):
        future_maturity = datetime.now() + timedelta(days=30)
        bill = self.service.register_bill(
            bill_no="BILL002",
            drawer="Company A",
            acceptor="Bank X",
            amount=100000,
            currency="CNY",
            issue_date=datetime(2024, 1, 1),
            maturity_date=future_maturity,
            initial_holder="Company A"
        )
        
        with self.assertRaises(ValueError) as ctx:
            self.service.initiate_collection(
                bill_id=bill.id,
                holder_id="Company A",
                collection_bank="Bank Y",
                collection_account="ACC123"
            )
        self.assertIn("collection", str(ctx.exception).lower())
    
    def test_only_current_holder_can_initiate_collection(self):
        with self.assertRaises(ValueError) as ctx:
            self.service.initiate_collection(
                bill_id=self.bill.id,
                holder_id="Wrong Holder",
                collection_bank="Bank Y",
                collection_account="ACC123"
            )
        self.assertIn("current holder", str(ctx.exception))
    
    def test_full_collection_flow(self):
        request = self.service.initiate_collection(
            bill_id=self.bill.id,
            holder_id="Company A",
            collection_bank="Bank Y",
            collection_account="ACC123"
        )
        bill = self.service.get_bill(self.bill.id)
        self.assertEqual(bill.status, BillStatus.COLLECTION_PENDING)
        self.assertEqual(request.status, CollectionStatus.PENDING)
        
        self.service.submit_collection(self.bill.id)
        bill = self.service.get_bill(self.bill.id)
        self.assertEqual(bill.status, BillStatus.COLLECTION_SUBMITTED)
        self.assertEqual(bill.collection_request.status, CollectionStatus.SUBMITTED)
        
        self.service.confirm_collection(self.bill.id)
        bill = self.service.get_bill(self.bill.id)
        self.assertEqual(bill.status, BillStatus.COLLECTION_CONFIRMED)
        self.assertEqual(bill.collection_request.status, CollectionStatus.CONFIRMED)
        
        confirm_transactions = [
            t for t in bill.transactions
            if t.transaction_type == TransactionType.COLLECTION_CONFIRM
        ]
        self.assertEqual(len(confirm_transactions), 1)
    
    def test_payment_creates_transaction(self):
        self.service.initiate_collection(
            bill_id=self.bill.id,
            holder_id="Company A",
            collection_bank="Bank Y",
            collection_account="ACC123"
        )
        self.service.submit_collection(self.bill.id)
        self.service.confirm_collection(self.bill.id)
        
        payment = self.service.pay_bill(self.bill.id)
        
        self.assertEqual(payment.transaction_type, TransactionType.PAYMENT)
        self.assertEqual(payment.amount, 100000)
        
        bill = self.service.get_bill(self.bill.id)
        self.assertEqual(bill.status, BillStatus.PAID)
    
    def test_collection_with_broken_chain_fails(self):
        endorsement = self.service.endorse_bill(
            bill_id=self.bill.id,
            from_holder="Company A",
            to_holder="Company B",
            confirm_immediately=False
        )
        
        with self.assertRaises(ValueError) as ctx:
            self.service.initiate_collection(
                bill_id=self.bill.id,
                holder_id="Company A",
                collection_bank="Bank Y",
                collection_account="ACC123"
            )
        self.assertIn("chain", str(ctx.exception).lower())


class TestReturn(unittest.TestCase):
    
    def setUp(self):
        self.service = BillService()
        self.past_maturity = datetime.now() - timedelta(days=5)
        self.bill = self.service.register_bill(
            bill_no="BILL001",
            drawer="Company A",
            acceptor="Bank X",
            amount=100000,
            currency="CNY",
            issue_date=datetime(2024, 1, 1),
            maturity_date=self.past_maturity,
            initial_holder="Company A"
        )
    
    def test_return_during_collection(self):
        self.service.initiate_collection(
            bill_id=self.bill.id,
            holder_id="Company A",
            collection_bank="Bank Y",
            collection_account="ACC123"
        )
        self.service.submit_collection(self.bill.id)
        
        return_record = self.service.process_return(
            bill_id=self.bill.id,
            return_bank="Bank X",
            return_reason="Insufficient funds"
        )
        
        bill = self.service.get_bill(self.bill.id)
        self.assertEqual(bill.status, BillStatus.RETURNED)
        self.assertEqual(bill.return_record, return_record)
        self.assertEqual(bill.collection_request.status, CollectionStatus.FAILED)
    
    def test_cannot_return_before_collection(self):
        with self.assertRaises(ValueError):
            self.service.process_return(
                bill_id=self.bill.id,
                return_bank="Bank X",
                return_reason="Test"
            )


class TestRetryMechanism(unittest.TestCase):
    
    def setUp(self):
        self.service = BillService()
    
    def test_failed_operation_recorded(self):
        with self.assertRaises(ValueError):
            self.service.register_bill(
                bill_no="BILL001",
                drawer="Company A",
                acceptor="Bank X",
                amount=-100,
                currency="CNY",
                issue_date=datetime(2024, 1, 1),
                maturity_date=datetime(2024, 6, 1),
                initial_holder="Company A"
            )
    
    def test_submit_collection_failure_then_retry_and_continue(self):
        past_maturity = datetime.now() - timedelta(days=5)
        bill = self.service.register_bill(
            bill_no="RETRY-TEST-001",
            drawer="Company A",
            acceptor="Bank X",
            amount=100000,
            currency="CNY",
            issue_date=datetime(2024, 1, 1),
            maturity_date=past_maturity,
            initial_holder="Company A"
        )
        
        self.service.initiate_collection(
            bill_id=bill.id,
            holder_id="Company A",
            collection_bank="Bank Y",
            collection_account="ACC123"
        )
        
        bill = self.service.get_bill(bill.id)
        self.assertEqual(bill.status, BillStatus.COLLECTION_PENDING)
        self.assertEqual(bill.collection_request.status, CollectionStatus.PENDING)
        
        original_do_submit = self.service._do_submit_collection
        def broken_submit(bill_obj, data):
            raise RuntimeError("Database connection failed")
        self.service._do_submit_collection = broken_submit
        
        with self.assertRaises(RuntimeError):
            self.service.submit_collection(bill.id)
        
        bill = self.service.get_bill(bill.id)
        self.assertEqual(bill.status, BillStatus.ERROR)
        self.assertEqual(len(bill.failed_operations), 1)
        self.assertFalse(bill.failed_operations[0].resolved)
        
        self.service._do_submit_collection = original_do_submit
        failed_op = bill.failed_operations[0]
        self.service.retry_failed_operation(bill.id, failed_op.id)
        
        bill = self.service.get_bill(bill.id)
        self.assertEqual(bill.status, BillStatus.COLLECTION_SUBMITTED)
        self.assertEqual(bill.collection_request.status, CollectionStatus.SUBMITTED)
        self.assertTrue(failed_op.resolved)
        
        self.service.confirm_collection(bill.id)
        bill = self.service.get_bill(bill.id)
        self.assertEqual(bill.status, BillStatus.COLLECTION_CONFIRMED)
        self.assertEqual(bill.collection_request.status, CollectionStatus.CONFIRMED)
        
        payment = self.service.pay_bill(bill.id)
        bill = self.service.get_bill(bill.id)
        self.assertEqual(bill.status, BillStatus.PAID)
        self.assertEqual(payment.transaction_type, TransactionType.PAYMENT)
    
    def test_confirm_collection_failure_then_retry_and_pay(self):
        past_maturity = datetime.now() - timedelta(days=5)
        bill = self.service.register_bill(
            bill_no="RETRY-TEST-002",
            drawer="Company B",
            acceptor="Bank Y",
            amount=200000,
            currency="CNY",
            issue_date=datetime(2024, 1, 1),
            maturity_date=past_maturity,
            initial_holder="Company B"
        )
        
        self.service.initiate_collection(
            bill_id=bill.id,
            holder_id="Company B",
            collection_bank="Bank Z",
            collection_account="ACC456"
        )
        self.service.submit_collection(bill.id)
        
        bill = self.service.get_bill(bill.id)
        self.assertEqual(bill.status, BillStatus.COLLECTION_SUBMITTED)
        
        original_do_confirm = self.service._do_confirm_collection
        def broken_confirm(bill_obj, data):
            raise RuntimeError("Network timeout")
        self.service._do_confirm_collection = broken_confirm
        
        with self.assertRaises(RuntimeError):
            self.service.confirm_collection(bill.id)
        
        bill = self.service.get_bill(bill.id)
        self.assertEqual(bill.status, BillStatus.ERROR)
        self.assertEqual(len(bill.failed_operations), 1)
        
        self.service._do_confirm_collection = original_do_confirm
        failed_op = bill.failed_operations[0]
        self.service.retry_failed_operation(bill.id, failed_op.id)
        
        bill = self.service.get_bill(bill.id)
        self.assertEqual(bill.status, BillStatus.COLLECTION_CONFIRMED)
        self.assertEqual(bill.collection_request.status, CollectionStatus.CONFIRMED)
        
        payment = self.service.pay_bill(bill.id)
        bill = self.service.get_bill(bill.id)
        self.assertEqual(bill.status, BillStatus.PAID)
    
    def test_endorsement_failure_then_retry(self):
        bill = self.service.register_bill(
            bill_no="RETRY-TEST-003",
            drawer="Company C",
            acceptor="Bank X",
            amount=50000,
            currency="CNY",
            issue_date=datetime(2024, 1, 1),
            maturity_date=datetime(2024, 6, 1),
            initial_holder="Company C"
        )
        
        bill = self.service.get_bill(bill.id)
        self.assertEqual(bill.status, BillStatus.REGISTERED)
        
        original_do_endorse = self.service._do_endorse
        def broken_endorse(bill_obj, data):
            raise RuntimeError("Lock timeout")
        self.service._do_endorse = broken_endorse
        
        with self.assertRaises(RuntimeError):
            self.service.endorse_bill(
                bill_id=bill.id,
                from_holder="Company C",
                to_holder="Company D"
            )
        
        bill = self.service.get_bill(bill.id)
        self.assertEqual(bill.status, BillStatus.ERROR)
        self.assertEqual(len(bill.failed_operations), 1)
        
        self.service._do_endorse = original_do_endorse
        failed_op = bill.failed_operations[0]
        self.service.retry_failed_operation(bill.id, failed_op.id)
        
        bill = self.service.get_bill(bill.id)
        self.assertEqual(bill.status, BillStatus.ENDORSED)
        self.assertEqual(bill.current_holder, "Company D")
        self.assertTrue(bill.verify_endorsement_chain())


if __name__ == '__main__':
    unittest.main()

import unittest
from datetime import datetime
from offset_fixer.models import (
    Message, PartitionInfo, ConsumerInfo, ConsumerRecord,
    AdjustmentTarget, OffsetStatus
)
from offset_fixer.offset_manager import OffsetManager
from offset_fixer.message_store import MessageStore
from offset_fixer.consumer_registry import ConsumerRegistry
from offset_fixer.adjustment_plan import AdjustmentPlan
from offset_fixer.verifier import Verifier
from offset_fixer.reporter import Reporter


class TestModels(unittest.TestCase):
    
    def test_partition_info_status(self):
        normal = PartitionInfo(
            topic='test',
            partition=0,
            current_offset=100,
            earliest_offset=50,
            latest_offset=150
        )
        self.assertEqual(normal.status(), OffsetStatus.NORMAL)
        
        future = PartitionInfo(
            topic='test',
            partition=0,
            current_offset=200,
            earliest_offset=50,
            latest_offset=150
        )
        self.assertEqual(future.status(), OffsetStatus.FUTURE)
        
        rollback = PartitionInfo(
            topic='test',
            partition=0,
            current_offset=20,
            earliest_offset=50,
            latest_offset=150
        )
        self.assertEqual(rollback.status(), OffsetStatus.NEEDS_ROLLBACK)


class TestMessageStore(unittest.TestCase):
    
    def setUp(self):
        self.store = MessageStore()
        self.store.add_topic('test-topic', 2)
        
    def test_add_and_get_messages(self):
        base_time = datetime(2024, 1, 1)
        for i in range(100, 150):
            self.store.add_message(Message(
                offset=i,
                partition=0,
                topic='test-topic',
                timestamp=base_time,
                content=f'msg-{i}'
            ))
        
        messages = self.store.get_messages('test-topic', 0)
        self.assertEqual(len(messages), 50)
        self.assertEqual(messages[0].offset, 100)
        self.assertEqual(messages[-1].offset, 149)
        
    def test_get_partition_info(self):
        base_time = datetime(2024, 1, 1)
        for i in range(100, 150):
            self.store.add_message(Message(
                offset=i,
                partition=0,
                topic='test-topic',
                timestamp=base_time,
                content=f'msg-{i}'
            ))
        
        info = self.store.get_partition_info('test-topic', 0, 120)
        self.assertIsNotNone(info)
        self.assertEqual(info.earliest_offset, 100)
        self.assertEqual(info.latest_offset, 149)
        self.assertEqual(info.current_offset, 120)


class TestOffsetManager(unittest.TestCase):
    
    def setUp(self):
        self.manager = OffsetManager()
        self.manager.set_current_offset('test-topic', 0, 150)
        
    def test_inspect_normal(self):
        info = PartitionInfo(
            topic='test-topic',
            partition=0,
            current_offset=150,
            earliest_offset=100,
            latest_offset=200
        )
        result = self.manager.inspect('test-topic', 0, info)
        self.assertEqual(result['status'], OffsetStatus.NORMAL.value)
        
    def test_inspect_future(self):
        self.manager.set_current_offset('test-topic', 0, 250)
        info = PartitionInfo(
            topic='test-topic',
            partition=0,
            current_offset=250,
            earliest_offset=100,
            latest_offset=200
        )
        result = self.manager.inspect('test-topic', 0, info)
        self.assertEqual(result['status'], OffsetStatus.FUTURE.value)
        
    def test_plan_adjustment(self):
        target = AdjustmentTarget(
            topic='test-topic',
            partition=0,
            target_offset=120,
            reason='test'
        )
        info = PartitionInfo(
            topic='test-topic',
            partition=0,
            current_offset=150,
            earliest_offset=100,
            latest_offset=200
        )
        
        plan = self.manager.plan_adjustment(target, info, consumer_online=False)
        self.assertTrue(plan['success'])
        self.assertEqual(plan['target_offset'], 120)
        self.assertEqual(plan['risk']['duplicate_count'], 30)
        
    def test_plan_adjustment_consumer_online_blocked(self):
        target = AdjustmentTarget(
            topic='test-topic',
            partition=0,
            target_offset=120,
            reason='test'
        )
        info = PartitionInfo(
            topic='test-topic',
            partition=0,
            current_offset=150,
            earliest_offset=100,
            latest_offset=200
        )
        
        plan = self.manager.plan_adjustment(target, info, consumer_online=True)
        self.assertFalse(plan['success'])
        
    def test_execute_adjustment(self):
        target = AdjustmentTarget(
            topic='test-topic',
            partition=0,
            target_offset=120,
            reason='test'
        )
        info = PartitionInfo(
            topic='test-topic',
            partition=0,
            current_offset=150,
            earliest_offset=100,
            latest_offset=200
        )
        
        result = self.manager.execute_adjustment(
            target, 'test-operator', info, consumer_online=False
        )
        self.assertTrue(result.success)
        self.assertEqual(result.before_offset, 150)
        self.assertEqual(result.after_offset, 120)
        self.assertEqual(result.operator, 'test-operator')
        
    def test_execute_adjustment_idempotent(self):
        self.manager.set_current_offset('test-topic', 0, 120)
        target = AdjustmentTarget(
            topic='test-topic',
            partition=0,
            target_offset=120,
            reason='test'
        )
        info = PartitionInfo(
            topic='test-topic',
            partition=0,
            current_offset=120,
            earliest_offset=100,
            latest_offset=200
        )
        
        result = self.manager.execute_adjustment(
            target, 'test-operator', info, consumer_online=False
        )
        self.assertTrue(result.success)
        self.assertIn('幂等', result.message)


class TestConsumerRegistry(unittest.TestCase):
    
    def setUp(self):
        self.registry = ConsumerRegistry()
        
    def test_register_and_check_online(self):
        consumer = ConsumerInfo(
            consumer_id='consumer-1',
            group_id='test-group',
            is_online=True,
            topics=['test-topic']
        )
        self.registry.register_consumer(consumer)
        
        self.assertTrue(self.registry.is_consumer_online_for_partition('test-topic', 0))
        self.assertFalse(self.registry.is_consumer_online_for_partition('other-topic', 0))
        
    def test_consumers_needing_idempotent_check(self):
        consumer = ConsumerInfo(
            consumer_id='consumer-1',
            group_id='test-group',
            is_online=False,
            topics=['test-topic']
        )
        self.registry.register_consumer(consumer)
        
        for i in range(100, 150):
            self.registry.add_processed_record(ConsumerRecord(
                consumer_id='consumer-1',
                topic='test-topic',
                partition=0,
                processed_offset=i,
                processed_at=datetime.now()
            ))
        
        consumers = self.registry.get_consumers_needing_idempotent_check(
            'test-topic', 0, 120
        )
        self.assertEqual(len(consumers), 1)
        self.assertEqual(consumers[0].consumer_id, 'consumer-1')


class TestVerifier(unittest.TestCase):
    
    def setUp(self):
        self.verifier = Verifier()
        
    def test_verify_offset_correct(self):
        result = self.verifier.verify_offset('test', 0, 100, 100)
        self.assertTrue(result.is_correct)
        
    def test_verify_offset_incorrect(self):
        result = self.verifier.verify_offset('test', 0, 100, 150)
        self.assertFalse(result.is_correct)
        
    def test_verify_adjustment_range(self):
        valid = self.verifier.verify_adjustment_range('test', 0, 50, 200, 100)
        self.assertTrue(valid['is_valid'])
        
        too_low = self.verifier.verify_adjustment_range('test', 0, 50, 200, 30)
        self.assertFalse(too_low['is_valid'])
        
        too_high = self.verifier.verify_adjustment_range('test', 0, 50, 200, 250)
        self.assertFalse(too_high['is_valid'])


class TestIntegration(unittest.TestCase):
    
    def test_full_workflow(self):
        offset_manager = OffsetManager()
        message_store = MessageStore()
        consumer_registry = ConsumerRegistry()
        adjustment_plan = AdjustmentPlan()
        verifier = Verifier()
        reporter = Reporter()
        
        topic = 'test-topic'
        partition = 0
        
        message_store.add_topic(topic, 1)
        base_time = datetime(2024, 1, 1)
        for i in range(100, 150):
            message_store.add_message(Message(
                offset=i,
                partition=partition,
                topic=topic,
                timestamp=base_time,
                content=f'msg-{i}'
            ))
        
        offset_manager.set_current_offset(topic, partition, 200)
        
        info = message_store.get_partition_info(topic, partition, 200)
        self.assertEqual(info.status(), OffsetStatus.FUTURE)
        
        inspection = offset_manager.inspect(topic, partition, info)
        self.assertEqual(inspection['status'], OffsetStatus.FUTURE.value)
        
        consumer = ConsumerInfo(
            consumer_id='consumer-1',
            group_id='test-group',
            is_online=False,
            topics=[topic]
        )
        consumer_registry.register_consumer(consumer)
        
        for i in range(100, 150):
            consumer_registry.add_processed_record(ConsumerRecord(
                consumer_id='consumer-1',
                topic=topic,
                partition=partition,
                processed_offset=i,
                processed_at=datetime.now()
            ))
        
        target = AdjustmentTarget(
            topic=topic,
            partition=partition,
            target_offset=149,
            reason='修复未来位点'
        )
        
        consumers_need_check = consumer_registry.get_consumers_needing_idempotent_check(
            topic, partition, 120
        )
        self.assertEqual(len(consumers_need_check), 1)
        
        plan = adjustment_plan.create_plan(
            target, info, 200,
            consumer_online=False,
            consumers_needing_check=consumers_need_check
        )
        self.assertTrue(plan['can_execute'])
        self.assertEqual(plan['risk_assessment']['duplicate_count'], 51)
        
        result = offset_manager.execute_adjustment(
            target, 'operator-1', info, consumer_online=False
        )
        self.assertTrue(result.success)
        self.assertEqual(result.before_offset, 200)
        self.assertEqual(result.after_offset, 149)
        
        verification = verifier.verify_offset(
            topic, partition, 149,
            offset_manager.get_current_offset(topic, partition)
        )
        self.assertTrue(verification.is_correct)
        
        inspection_report = reporter.generate_inspection_report([inspection])
        self.assertEqual(inspection_report['summary']['future'], 1)
        
        plan_report = reporter.generate_plan_report([plan])
        self.assertEqual(plan_report['summary']['executable'], 1)
        
        verification_report = reporter.generate_verification_report(
            [verification.to_dict()],
            offset_manager.get_history()
        )
        self.assertEqual(verification_report['summary']['passed'], 1)


if __name__ == '__main__':
    unittest.main()

#!/usr/bin/env python3
import unittest
import os
import sqlite3
from datetime import datetime
from models import Database, AuditInfo
from service import WarehouseService

class TestWarehouseService(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_db = 'test_warehouse.db'
        if os.path.exists(cls.test_db):
            os.remove(cls.test_db)
    
    def setUp(self):
        self.db = Database(self.test_db)
        self.service = WarehouseService(self.db)
        self.audit = AuditInfo(
            operator_id='test001',
            operator_name='测试工程师',
            role='engineer',
            operation_time=datetime.now()
        )
    
    def tearDown(self):
        pass
    
    @classmethod
    def tearDownClass(cls):
        if os.path.exists(cls.test_db):
            os.remove(cls.test_db)
    
    def test_01_receive_parts_success(self):
        parts = [
            {"part_code": "P001", "part_name": "压缩机", "quantity": 5}
        ]
        result = self.service.receive_parts("REC001", parts, self.audit)
        self.assertTrue(result['success'])
        self.assertEqual(result['total_parts'], 1)
        print("✓ 领用成功测试通过")
    
    def test_02_receive_parts_idempotent(self):
        parts = [
            {"part_code": "P001", "part_name": "压缩机", "quantity": 5}
        ]
        result1 = self.service.receive_parts("REC002", parts, self.audit)
        self.assertTrue(result1['success'])
        
        result2 = self.service.receive_parts("REC002", parts, self.audit)
        self.assertTrue(result2['success'])
        self.assertIn("幂等返回", result2['message'])
        print("✓ 领用幂等性测试通过")
    
    def test_03_full_workflow(self):
        receive_parts = [{"part_code": "P002", "part_name": "电机", "quantity": 3}]
        receive_result = self.service.receive_parts("REC003", receive_parts, self.audit)
        self.assertTrue(receive_result['success'])
        
        install_parts = [{"part_code": "P002", "quantity": 1}]
        install_result = self.service.install_parts("INS001", "REC003", install_parts, self.audit)
        self.assertTrue(install_result['success'])
        
        return_parts = [{"part_code": "P002", "quantity": 1}]
        return_result = self.service.return_parts("RET001", "INS001", return_parts, self.audit)
        self.assertTrue(return_result['success'])
        
        claim_parts = [{"part_code": "P002", "quantity": 1}]
        claim_result = self.service.claim_parts("CLA001", "RET001", claim_parts, self.audit)
        self.assertTrue(claim_result['success'])
        
        writeoff_parts = [{"part_code": "P002", "quantity": 1}]
        writeoff_result = self.service.write_off_parts("WOF001", "CLA001", writeoff_parts, self.audit)
        self.assertTrue(writeoff_result['success'])
        
        print("✓ 完整流程测试通过")
    
    def test_04_install_with_invalid_receive_id(self):
        parts = [{"part_code": "P003", "quantity": 1}]
        result = self.service.install_parts("INS002", "INVALID_REC", parts, self.audit)
        self.assertFalse(result['success'])
        self.assertIn("不存在或未成功", result['message'])
        print("✓ 无效关联ID测试通过")
    
    def test_05_batch_operation(self):
        operations = [
            {
                "operation_type": "receive",
                "operation_id": "REC_B01",
                "parts": [{"part_code": "P004", "part_name": "电路板", "quantity": 2}]
            },
            {
                "operation_type": "receive",
                "operation_id": "REC_B02",
                "parts": [{"part_code": "P005", "part_name": "传感器", "quantity": 3}]
            },
            {
                "operation_type": "install",
                "operation_id": "INS_B01",
                "receive_operation_id": "REC_B01",
                "parts": [{"part_code": "P004", "quantity": 1}]
            }
        ]
        
        result = self.service.batch_operation(operations, self.audit)
        self.assertEqual(result['total_count'], 3)
        self.assertEqual(result['success_count'], 3)
        self.assertEqual(result['failed_count'], 0)
        print("✓ 批量操作测试通过")
    
    def test_06_batch_operation_with_failures(self):
        operations = [
            {
                "operation_type": "receive",
                "operation_id": "REC_B03",
                "parts": [{"part_code": "P006", "part_name": "开关", "quantity": 2}]
            },
            {
                "operation_type": "install",
                "operation_id": "INS_B02",
                "receive_operation_id": "INVALID_ID",
                "parts": [{"part_code": "P006", "quantity": 1}]
            }
        ]
        
        result = self.service.batch_operation(operations, self.audit)
        self.assertEqual(result['total_count'], 2)
        self.assertEqual(result['success_count'], 1)
        self.assertEqual(result['failed_count'], 1)
        self.assertEqual(result['overall_status'], 'partial')
        print("✓ 批量操作含失败测试通过")
    
    def test_07_query_operations(self):
        result = self.service.query_operations(
            operator_id='test001',
            page=1,
            page_size=10
        )
        self.assertGreater(result['total'], 0)
        self.assertIn('operations', result)
        print("✓ 查询操作测试通过")
    
    def test_08_export_report(self):
        report_file = self.service.export_report(operator_id='test001')
        self.assertTrue(os.path.exists(report_file))
        os.remove(report_file)
        print("✓ 导出报告测试通过")
    
    def test_09_part_trace(self):
        trace = self.service.get_part_trace("P001")
        self.assertEqual(trace['part_code'], "P001")
        self.assertIn('trace', trace)
        print("✓ 零件追溯测试通过")
    
    def test_10_retry_failed_operation(self):
        parts = [{"part_code": "P007", "quantity": 1}]
        result1 = self.service.install_parts("INS_RETRY", "INVALID", parts, self.audit)
        self.assertFalse(result1['success'])
        
        receive_parts = [{"part_code": "P007", "part_name": "电池", "quantity": 2}]
        self.service.receive_parts("REC_RETRY", receive_parts, self.audit)
        
        result2 = self.service.install_parts("INS_RETRY2", "REC_RETRY", parts, self.audit)
        self.assertTrue(result2['success'])
        print("✓ 失败重试测试通过")

if __name__ == '__main__':
    print("=" * 60)
    print("家电售后仓管理系统 - 单元测试")
    print("=" * 60)
    unittest.main(verbosity=2)

import unittest
import json
from app import app


class TestLateRecordAPI(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.client.testing = True
        
        with app.app_context():
            from app import late_records
            late_records.clear()
    
    def test_normal_import(self):
        print("测试1: 正常导入迟到记录")
        payload = {
            "records": [
                {
                    "student_id": "2024001",
                    "student_name": "张三",
                    "class_name": "三年级一班",
                    "route_number": "校车A线",
                    "bus_plate": "京A12345",
                    "driver_name": "李师傅",
                    "late_date": "2024-05-20",
                    "scheduled_arrival": "07:30",
                    "actual_arrival": "07:45",
                    "late_minutes": 15,
                    "reason_category": "交通拥堵"
                }
            ]
        }
        
        response = self.client.post('/api/late-records/import',
                                  data=json.dumps(payload),
                                  content_type='application/json')
        
        data = json.loads(response.data)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(data['success'])
        self.assertEqual(data['total_count'], 1)
        self.assertEqual(data['success_count'], 1)
        self.assertEqual(data['failed_count'], 0)
        print("✓ 正常导入成功")
        print()
    
    def test_missing_required_fields(self):
        print("测试2: 缺少必填字段")
        payload = {
            "records": [
                {
                    "student_id": "2024002",
                    "student_name": "李四",
                    "late_minutes": 10
                }
            ]
        }
        
        response = self.client.post('/api/late-records/import',
                                  data=json.dumps(payload),
                                  content_type='application/json')
        
        data = json.loads(response.data)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(data['failed_count'], 1)
        self.assertIn('缺少必填字段', data['failed_records'][0]['error_reason'])
        self.assertIn('original_data', data['failed_records'][0])
        self.assertIn('suggestion', data['failed_records'][0])
        print(f"✓ 正确捕获缺字段错误: {data['failed_records'][0]['error_reason']}")
        print()
    
    def test_negative_late_minutes(self):
        print("测试3: 负数迟到分钟数")
        payload = {
            "records": [
                {
                    "student_id": "2024003",
                    "student_name": "王五",
                    "class_name": "三年级二班",
                    "route_number": "校车B线",
                    "bus_plate": "京B67890",
                    "driver_name": "张师傅",
                    "late_date": "2024-05-20",
                    "scheduled_arrival": "07:30",
                    "actual_arrival": "07:25",
                    "late_minutes": -5,
                    "reason_category": "早到"
                }
            ]
        }
        
        response = self.client.post('/api/late-records/import',
                                  data=json.dumps(payload),
                                  content_type='application/json')
        
        data = json.loads(response.data)
        self.assertEqual(data['failed_count'], 1)
        self.assertIn('不能为负数', data['failed_records'][0]['error_reason'])
        print(f"✓ 正确捕获负数错误: {data['failed_records'][0]['error_reason']}")
        print()
    
    def test_invalid_date_format(self):
        print("测试4: 无效日期格式")
        payload = {
            "records": [
                {
                    "student_id": "2024004",
                    "student_name": "赵六",
                    "class_name": "三年级三班",
                    "route_number": "校车C线",
                    "bus_plate": "京C11111",
                    "driver_name": "王师傅",
                    "late_date": "2024/05/20",
                    "scheduled_arrival": "07:30",
                    "actual_arrival": "07:45",
                    "late_minutes": 15,
                    "reason_category": "交通拥堵"
                }
            ]
        }
        
        response = self.client.post('/api/late-records/import',
                                  data=json.dumps(payload),
                                  content_type='application/json')
        
        data = json.loads(response.data)
        self.assertEqual(data['failed_count'], 1)
        self.assertIn('日期格式无效', data['failed_records'][0]['error_reason'])
        print(f"✓ 正确捕获日期格式错误: {data['failed_records'][0]['error_reason']}")
        print()
    
    def test_duplicate_record(self):
        print("测试5: 重复提交记录")
        
        payload = {
            "records": [
                {
                    "student_id": "2024005",
                    "student_name": "钱七",
                    "class_name": "四年级一班",
                    "route_number": "校车A线",
                    "bus_plate": "京A12345",
                    "driver_name": "李师傅",
                    "late_date": "2024-05-20",
                    "scheduled_arrival": "07:30",
                    "actual_arrival": "07:45",
                    "late_minutes": 15,
                    "reason_category": "交通拥堵"
                }
            ]
        }
        
        self.client.post('/api/late-records/import',
                        data=json.dumps(payload),
                        content_type='application/json')
        
        response = self.client.post('/api/late-records/import',
                                  data=json.dumps(payload),
                                  content_type='application/json')
        
        data = json.loads(response.data)
        self.assertEqual(data['failed_count'], 1)
        self.assertIn('已存在', data['failed_records'][0]['error_reason'])
        print(f"✓ 正确捕获重复记录: {data['failed_records'][0]['error_reason']}")
        print()
    
    def test_driver_marked_needs_review(self):
        print("测试6: 司机手工标记需人工审核")
        payload = {
            "records": [
                {
                    "student_id": "2024006",
                    "student_name": "孙八",
                    "class_name": "四年级二班",
                    "route_number": "校车B线",
                    "bus_plate": "京B67890",
                    "driver_name": "张师傅",
                    "late_date": "2024-05-21",
                    "scheduled_arrival": "07:30",
                    "actual_arrival": "07:50",
                    "late_minutes": 20,
                    "reason_category": "设备故障",
                    "is_driver_marked": True
                }
            ]
        }
        
        response = self.client.post('/api/late-records/import',
                                  data=json.dumps(payload),
                                  content_type='application/json')
        
        data = json.loads(response.data)
        self.assertEqual(data['need_manual_review_count'], 1)
        self.assertIn('司机手工标记', data['need_manual_review_records'][0]['review_reason'])
        print(f"✓ 正确识别需审核记录: {data['need_manual_review_records'][0]['review_reason']}")
        print()
    
    def test_weekly_consistent_needs_review(self):
        print("测试7: 迟到周报一致性标记需审核")
        payload = {
            "records": [
                {
                    "student_id": "2024007",
                    "student_name": "周九",
                    "class_name": "四年级三班",
                    "route_number": "校车C线",
                    "bus_plate": "京C11111",
                    "driver_name": "王师傅",
                    "late_date": "2024-05-21",
                    "scheduled_arrival": "07:30",
                    "actual_arrival": "07:55",
                    "late_minutes": 25,
                    "reason_category": "天气原因",
                    "is_weekly_consistent": True
                }
            ]
        }
        
        response = self.client.post('/api/late-records/import',
                                  data=json.dumps(payload),
                                  content_type='application/json')
        
        data = json.loads(response.data)
        self.assertEqual(data['need_manual_review_count'], 1)
        self.assertIn('周报一致性', data['need_manual_review_records'][0]['review_reason'])
        print(f"✓ 正确识别周报一致性标记: {data['need_manual_review_records'][0]['review_reason']}")
        print()
    
    def test_status_transition_pending_to_confirmed(self):
        print("测试8: 正常状态流转 pending → confirmed")
        
        payload = {
            "records": [
                {
                    "student_id": "2024008",
                    "student_name": "吴十",
                    "class_name": "五年级一班",
                    "route_number": "校车A线",
                    "bus_plate": "京A12345",
                    "driver_name": "李师傅",
                    "late_date": "2024-05-22",
                    "scheduled_arrival": "07:30",
                    "actual_arrival": "07:40",
                    "late_minutes": 10,
                    "reason_category": "起床晚"
                }
            ]
        }
        
        import_response = self.client.post('/api/late-records/import',
                                          data=json.dumps(payload),
                                          content_type='application/json')
        
        import_data = json.loads(import_response.data)
        record_id = import_data['successful_records'][0]['id']
        
        update_payload = {
            "status": "confirmed",
            "remark": "已核实情况属实"
        }
        
        response = self.client.put(f'/api/late-records/{record_id}/status',
                                 data=json.dumps(update_payload),
                                 content_type='application/json')
        
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['record']['status'], 'confirmed')
        self.assertEqual(data['record']['remark'], '已核实情况属实')
        print("✓ pending → confirmed 状态流转成功")
        print()
    
    def test_status_transition_invalid_skip_level(self):
        print("测试9: 状态越级流转（禁止从 archived 变回 pending）")
        
        payload = {
            "records": [
                {
                    "student_id": "2024009",
                    "student_name": "郑十一",
                    "class_name": "五年级二班",
                    "route_number": "校车B线",
                    "bus_plate": "京B67890",
                    "driver_name": "张师傅",
                    "late_date": "2024-05-22",
                    "scheduled_arrival": "07:30",
                    "actual_arrival": "07:45",
                    "late_minutes": 15,
                    "reason_category": "交通拥堵"
                }
            ]
        }
        
        import_response = self.client.post('/api/late-records/import',
                                          data=json.dumps(payload),
                                          content_type='application/json')
        
        import_data = json.loads(import_response.data)
        record_id = import_data['successful_records'][0]['id']
        
        self.client.put(f'/api/late-records/{record_id}/status',
                       data=json.dumps({"status": "confirmed"}),
                       content_type='application/json')
        
        self.client.put(f'/api/late-records/{record_id}/status',
                       data=json.dumps({"status": "archived"}),
                       content_type='application/json')
        
        update_payload = {
            "status": "pending"
        }
        
        response = self.client.put(f'/api/late-records/{record_id}/status',
                                 data=json.dumps(update_payload),
                                 content_type='application/json')
        
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertIn('original_data', data)
        self.assertIn('suggestion', data)
        print(f"✓ 正确禁止越级流转: {data['error']}")
        print()
    
    def test_invalid_status_value(self):
        print("测试10: 无效状态值")
        
        payload = {
            "records": [
                {
                    "student_id": "2024010",
                    "student_name": "王十二",
                    "class_name": "五年级三班",
                    "route_number": "校车C线",
                    "bus_plate": "京C11111",
                    "driver_name": "王师傅",
                    "late_date": "2024-05-23",
                    "scheduled_arrival": "07:30",
                    "actual_arrival": "07:50",
                    "late_minutes": 20,
                    "reason_category": "交通拥堵",
                    "status": "invalid_status"
                }
            ]
        }
        
        response = self.client.post('/api/late-records/import',
                                  data=json.dumps(payload),
                                  content_type='application/json')
        
        data = json.loads(response.data)
        self.assertEqual(data['failed_count'], 1)
        self.assertIn('无效状态', data['failed_records'][0]['error_reason'])
        print(f"✓ 正确捕获无效状态值: {data['failed_records'][0]['error_reason']}")
        print()
    
    def test_mixed_import_with_success_and_errors(self):
        print("测试11: 混合导入（成功+失败+需审核）")
        payload = {
            "records": [
                {
                    "student_id": "2024011",
                    "student_name": "李十三",
                    "class_name": "六年级一班",
                    "route_number": "校车A线",
                    "bus_plate": "京A12345",
                    "driver_name": "李师傅",
                    "late_date": "2024-05-24",
                    "scheduled_arrival": "07:30",
                    "actual_arrival": "07:45",
                    "late_minutes": 15,
                    "reason_category": "交通拥堵"
                },
                {
                    "student_id": "2024012",
                    "student_name": "张十四",
                    "late_minutes": 10
                },
                {
                    "student_id": "2024013",
                    "student_name": "王十五",
                    "class_name": "六年级三班",
                    "route_number": "校车C线",
                    "bus_plate": "京C11111",
                    "driver_name": "王师傅",
                    "late_date": "2024-05-24",
                    "scheduled_arrival": "07:30",
                    "actual_arrival": "07:50",
                    "late_minutes": 20,
                    "reason_category": "设备故障",
                    "is_driver_marked": True
                }
            ]
        }
        
        response = self.client.post('/api/late-records/import',
                                  data=json.dumps(payload),
                                  content_type='application/json')
        
        data = json.loads(response.data)
        self.assertEqual(data['total_count'], 3)
        self.assertEqual(data['success_count'], 2)
        self.assertEqual(data['failed_count'], 1)
        self.assertEqual(data['need_manual_review_count'], 1)
        print(f"✓ 混合导入处理正确:")
        print(f"  - 总记录: {data['total_count']}")
        print(f"  - 成功: {data['success_count']}")
        print(f"  - 失败: {data['failed_count']}")
        print(f"  - 需审核: {data['need_manual_review_count']}")
        print()
    
    def test_get_records_with_filter(self):
        print("测试12: 查询记录并过滤")
        
        for i in range(3):
            payload = {
                "records": [
                    {
                        "student_id": f"20240{i+20}",
                        "student_name": f"学生{i+20}",
                        "class_name": "一年级一班",
                        "route_number": "校车A线",
                        "bus_plate": "京A12345",
                        "driver_name": "李师傅",
                        "late_date": "2024-05-25",
                        "scheduled_arrival": "07:30",
                        "actual_arrival": f"07:{35+i}",
                        "late_minutes": 5 + i,
                        "reason_category": "交通拥堵"
                    }
                ]
            }
            self.client.post('/api/late-records/import',
                           data=json.dumps(payload),
                           content_type='application/json')
        
        response = self.client.get('/api/late-records?status=pending')
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['total'], 3)
        print(f"✓ 查询过滤正确，共找到 {data['total']} 条 pending 状态记录")
        print()


if __name__ == '__main__':
    print("=" * 60)
    print("校车运营队学生迟到补登 API 测试")
    print("=" * 60)
    print()
    unittest.main(verbosity=0)

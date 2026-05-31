import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import unittest
from app.services.diagnosis_engine import (
    SequenceRecurrenceValidator,
    EquivalentAnswerMatcher,
    EmptySetHandler
)


class TestSequenceRecurrenceValidator(unittest.TestCase):
    def setUp(self):
        self.validator = SequenceRecurrenceValidator()

    def test_normalize_expression(self):
        self.assertEqual(
            self.validator.normalize_expression('a_{n+1} = a_n + 2'),
            'a_{n+1}=a_n+2'
        )
        self.assertEqual(
            self.validator.normalize_expression('a {n+1} = a n + 2'),
            'a_{n+1}=a_n+2'
        )
        self.assertEqual(
            self.validator.normalize_expression('a_{n+1} = a_n × 2'),
            'a_{n+1}=a_n*2'
        )

    def test_parse_arithmetic(self):
        result = self.validator.parse_recurrence('a_{n+1} = a_n + 2')
        self.assertIsNotNone(result)
        self.assertEqual(result['type'], 'arithmetic')
        self.assertEqual(result['common_difference'], 2.0)

        result = self.validator.parse_recurrence('a_{n+1} = a_n - 3')
        self.assertIsNotNone(result)
        self.assertEqual(result['type'], 'arithmetic')
        self.assertEqual(result['common_difference'], -3.0)

    def test_parse_geometric(self):
        result = self.validator.parse_recurrence('a_{n+1} = 2 * a_n')
        self.assertIsNotNone(result)
        self.assertEqual(result['type'], 'geometric')
        self.assertEqual(result['common_ratio'], 2.0)

    def test_parse_linear_nonhomogeneous(self):
        result = self.validator.parse_recurrence('a_{n+1} = 2 * a_n + 1')
        self.assertIsNotNone(result)
        self.assertEqual(result['type'], 'linear_nonhomogeneous')
        self.assertEqual(result['coefficient'], 2.0)
        self.assertEqual(result['constant'], 1.0)

        result = self.validator.parse_recurrence('a_{n+1} = 3 * a_n - 5')
        self.assertIsNotNone(result)
        self.assertEqual(result['type'], 'linear_nonhomogeneous')
        self.assertEqual(result['coefficient'], 3.0)
        self.assertEqual(result['constant'], -5.0)

    def test_equivalence_arithmetic(self):
        is_equiv, reason = self.validator.check_equivalence(
            'a_{n+1} = a_n + 2',
            'a_{n+1} = a_n + 2'
        )
        self.assertTrue(is_equiv)
        self.assertIn('公差相等', reason)

        is_equiv, reason = self.validator.check_equivalence(
            'a_{n+1} = a_n + 2',
            'a_{n+1} = a_n + 3'
        )
        self.assertFalse(is_equiv)
        self.assertIn('公差不等', reason)

    def test_equivalence_geometric(self):
        is_equiv, reason = self.validator.check_equivalence(
            'a_{n+1} = 2 * a_n',
            'a_{n+1} = 2 * a_n'
        )
        self.assertTrue(is_equiv)
        self.assertIn('公比相等', reason)

    def test_equivalence_different_types(self):
        is_equiv, reason = self.validator.check_equivalence(
            'a_{n+1} = a_n + 2',
            'a_{n+1} = 2 * a_n'
        )
        self.assertFalse(is_equiv)
        self.assertIn('递推类型不匹配', reason)

    def test_equivalence_various_formats(self):
        is_equiv, _ = self.validator.check_equivalence(
            'a_{n+1} - a_n = 2',
            'a_{n+1} - a_n = 2'
        )
        self.assertTrue(is_equiv)


class MockEquivalentAnswer:
    def __init__(self, id: int, answer_expression: str, description: str = ''):
        self.id = id
        self.answer_expression = answer_expression
        self.description = description


class TestEquivalentAnswerMatcher(unittest.TestCase):
    def setUp(self):
        self.equivalent_answers = [
            MockEquivalentAnswer(1, 'a_{n+1} - a_n = 2', '移项形式'),
            MockEquivalentAnswer(2, 'a_{n+1} / a_n = 2', '比值形式'),
        ]
        self.matcher = EquivalentAnswerMatcher(self.equivalent_answers)

    def test_match_existing(self):
        is_match, eq_id, reason = self.matcher.match('a_{n+1} - a_n = 2')
        self.assertTrue(is_match)
        self.assertEqual(eq_id, 1)

    def test_no_match(self):
        is_match, eq_id, reason = self.matcher.match('a_{n+1} = a_n + 5')
        self.assertFalse(is_match)
        self.assertIsNone(eq_id)


class MockEvaluationRecord:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


class TestEmptySetHandler(unittest.TestCase):
    def setUp(self):
        self.handler = EmptySetHandler()

    def test_check_empty_evaluation_records(self):
        records = [
            MockEvaluationRecord(
                id=1,
                student_id='S001',
                student_name='张三',
                question_no='SEQ001',
                student_answer='a_{n+1} = a_n + 2'
            ),
            MockEvaluationRecord(
                id=2,
                student_id='',
                student_name='李四',
                question_no='SEQ001',
                student_answer='a_{n+1} = a_n + 2'
            ),
            MockEvaluationRecord(
                id=3,
                student_id='S003',
                student_name='王五',
                question_no='SEQ001',
                student_answer=''
            ),
            MockEvaluationRecord(
                id=4,
                student_id='S004',
                student_name='赵六',
                question_no='SEQ001',
                student_answer='null'
            ),
        ]

        empty_records = self.handler.check_empty_records(
            records,
            '高三1班月考',
            'evaluation_record'
        )

        self.assertEqual(len(empty_records), 3)

        empty_ids = [r['record_id'] for r in empty_records]
        self.assertIn(2, empty_ids)
        self.assertIn(3, empty_ids)
        self.assertIn(4, empty_ids)

        record_2 = next(r for r in empty_records if r['record_id'] == 2)
        self.assertIn('学号为空', record_2['issues'])

        record_3 = next(r for r in empty_records if r['record_id'] == 3)
        self.assertIn('学生答案为空', record_3['issues'])

        record_4 = next(r for r in empty_records if r['record_id'] == 4)
        self.assertIn('学生答案为无效值', record_4['issues'])

    def test_generate_human_readable_report(self):
        empty_records = [
            {
                'index': 1,
                'record_id': 2,
                'student_name': '李四',
                'question_no': 'SEQ001',
                'issues': ['学号为空'],
                'source': '高三1班月考',
                'source_type': 'evaluation_record'
            },
            {
                'index': 2,
                'record_id': 3,
                'student_name': '王五',
                'question_no': 'SEQ001',
                'issues': ['学生答案为空'],
                'source': '高三1班月考',
                'source_type': 'evaluation_record'
            },
        ]

        report = self.handler.generate_human_readable_report(empty_records)

        self.assertTrue(report['has_empty'])
        self.assertEqual(report['total_count'], 2)
        self.assertEqual(len(report['by_source']), 1)

        source_info = report['by_source'][0]
        self.assertEqual(source_info['source'], '高三1班月考')
        self.assertEqual(source_info['source_type'], 'evaluation_record')
        self.assertEqual(source_info['count'], 2)
        self.assertEqual(source_info['contact_person'], '讲评老师')
        self.assertIn('联系讲评老师', source_info['next_action'])

    def test_no_empty_records(self):
        report = self.handler.generate_human_readable_report([])
        self.assertFalse(report['has_empty'])

    def test_check_empty_question_bank(self):
        records = [
            MockEvaluationRecord(
                id=1,
                question_no='SEQ001',
                content='题目内容',
                standard_answer='答案'
            ),
            MockEvaluationRecord(
                id=2,
                question_no='',
                content='题目内容',
                standard_answer='答案'
            ),
            MockEvaluationRecord(
                id=3,
                question_no='SEQ003',
                content='',
                standard_answer='答案'
            ),
        ]

        empty_records = self.handler.check_empty_records(
            records,
            '题库表',
            'question_bank'
        )

        self.assertEqual(len(empty_records), 2)

        empty_ids = [r['record_id'] for r in empty_records]
        self.assertIn(2, empty_ids)
        self.assertIn(3, empty_ids)

        record_2 = next(r for r in empty_records if r['record_id'] == 2)
        self.assertIn('题目编号为空', record_2['issues'])

        record_3 = next(r for r in empty_records if r['record_id'] == 3)
        self.assertIn('题目内容为空', record_3['issues'])


class TestIdempotency(unittest.TestCase):
    def test_material_hash_consistency(self):
        import hashlib
        ids_1 = [1, 2, 3, 4, 5]
        ids_2 = [5, 4, 3, 2, 1]

        sorted_ids_1 = sorted(ids_1)
        sorted_ids_2 = sorted(ids_2)

        hash_1 = hashlib.sha256(
            ','.join(map(str, sorted_ids_1)).encode()
        ).hexdigest()
        hash_2 = hashlib.sha256(
            ','.join(map(str, sorted_ids_2)).encode()
        ).hexdigest()

        self.assertEqual(hash_1, hash_2)

    def test_material_hash_different(self):
        import hashlib
        ids_1 = [1, 2, 3]
        ids_2 = [1, 2, 4]

        hash_1 = hashlib.sha256(
            ','.join(map(str, sorted(ids_1))).encode()
        ).hexdigest()
        hash_2 = hashlib.sha256(
            ','.join(map(str, sorted(ids_2))).encode()
        ).hexdigest()

        self.assertNotEqual(hash_1, hash_2)


class TestHumanReadableErrors(unittest.TestCase):
    def test_error_message_format(self):
        from app.services.diagnosis_service import DiagnosisService
        from unittest.mock import MagicMock

        db = MagicMock()
        service = DiagnosisService(db)

        error = service._generate_human_error(
            'format_error',
            '张三',
            'SEQ001',
            'a n + 2',
            'a_{n+1} = a_n + 2',
            '无法解析表达式'
        )

        self.assertIn('张三', error)
        self.assertIn('SEQ001', error)
        self.assertIn('a n + 2', error)
        self.assertIn('格式有问题', error)
        self.assertIn('我们读不懂', error)
        self.assertNotIn('Traceback', error)
        self.assertNotIn('NoneType', error)

    def test_error_type_mismatch_message(self):
        from app.services.diagnosis_service import DiagnosisService
        from unittest.mock import MagicMock

        db = MagicMock()
        service = DiagnosisService(db)

        error = service._generate_human_error(
            'type_mismatch',
            '李四',
            'SEQ002',
            'a_{n+1} = a_n + 2',
            'a_{n+1} = 2 * a_n',
            '递推类型不匹配'
        )

        self.assertIn('李四', error)
        self.assertIn('等差数列', error)
        self.assertIn('等比数列', error)

    def test_suggestion_generation(self):
        from app.services.diagnosis_service import DiagnosisService
        from unittest.mock import MagicMock

        db = MagicMock()
        service = DiagnosisService(db)

        suggestion, next_action, contact = service._generate_suggestion(
            'wrong_common_difference'
        )

        self.assertIn('重新计算', suggestion)
        self.assertIn('公差', suggestion)
        self.assertIn('讲评老师', contact)
        self.assertIn('讲评老师', next_action)


if __name__ == '__main__':
    unittest.main(verbosity=2)

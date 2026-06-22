import os
import tempfile
import math
import pytest
import pandas as pd

from sequence_error_attribution.data_loader import DataLoader
from sequence_error_attribution.attribution import SequenceAttribution
from sequence_error_attribution.jump_detector import JumpDetector
from sequence_error_attribution.exporter import ResultExporter
from sequence_error_attribution.config import DEFAULT_CONFIG, STABLE_MESSAGES


SAMPLE_CSV_CONTENT = """题目ID,来源,题目内容,数列类型,已知项,递推公式,学生答案,正确答案,错误类型
Q001,2023年高考数学全国甲卷,"已知数列{{an}}满足a1=2, a(n+1)=2*a(n)+1,求a4的值",线性递推,a1=2,a(n+1)=2*a(n)+1,"2, 5, 11, 23","2, 5, 11, 23",无
Q002,2023年高二上学期期中,"已知a1=1, a(n+1)=a(n)/(a(n)-2),求a3",分式递推,a1=1,a(n+1)=a(n)/(a(n)-2),"1, -1, 1/3","1, -1, 1/3",计算错误
Q003,2024年高三模拟卷一,"已知a1=2, a(n+1)=(a(n)+1)/(a(n)-1),求a4",分式递推,a1=2,a(n+1)=(a(n)+1)/(a(n)-1),"2, 3, 2, 3","2, 3, 2, 3",无
Q006,2023年高考数学浙江卷,"已知a1=1, a(n+1)=a(n)/(1-a(n)),求a3",分式递推,a1=1,a(n+1)=a(n)/(1-a(n)),"1, 不存在","1, 无穷大",除零边界
Q008,2023年高一竞赛初赛,"已知a1=1, a2=1, a(n+2)=a(n+1)+a(n),求a6",斐波那契,"a1=1, a2=1",a(n+2)=a(n+1)+a(n),"1, 1, 2, 3, 5, 8","1, 1, 2, 3, 5, 8",无
Q010,2023年高三周测,"已知a1=5, a(n+1)=3*a(n)-2,求a4",线性递推,a1=5,a(n+1)=3*a(n)-2,"5, 13, 37, 110","5, 13, 37, 109",计算错误
"""


class TestEndToEnd:
    """端到端测试：从 CSV 读取 → 归因 → 跳变检测 → CSV 导出"""

    @pytest.fixture
    def sample_csv(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write(SAMPLE_CSV_CONTENT)
            temp_path = f.name
        yield temp_path
        os.unlink(temp_path)

    def run_pipeline(self, input_path, output_dir, base_filename, min_sample_size=1):
        from sequence_error_attribution.config import AttributionConfig
        cfg = AttributionConfig(min_sample_size=min_sample_size)
        loader = DataLoader(config=cfg)
        attribution = SequenceAttribution(config=cfg)
        detector = JumpDetector(config=cfg)
        exporter = ResultExporter(config=cfg)

        records = loader.load_file(input_path)
        records, _ = loader.validate_records(records)
        records = attribution.analyze_batch(records)
        records = detector.detect_batch(records)

        from sequence_error_attribution.models import AttributionResult
        csv_path = os.path.join(output_dir, f"{base_filename}_details.csv")
        csv_path = exporter.export_to_csv(records, csv_path)

        report_path = os.path.join(output_dir, f"{base_filename}_report.txt")
        result = AttributionResult(
            total_records=len(records),
            success_count=sum(1 for r in records if r.processing_status == STABLE_MESSAGES.STATUS_SUCCESS),
            review_count=sum(1 for r in records if r.needs_review),
            failed_count=sum(1 for r in records if r.processing_status == STABLE_MESSAGES.STATUS_FAILED),
            jump_count=0,
            records=list(records),
            output_file=csv_path,
        )
        report_path = exporter.export_summary_report(result, report_path)
        return records, csv_path, report_path

    def test_csv_export_contains_required_columns(self, sample_csv, tmp_path):
        """导出的 CSV 必须包含稳定列：来源位置、处理状态、计算项、复核理由等"""
        _, csv_path, _ = self.run_pipeline(sample_csv, str(tmp_path), "e2e_test")
        assert os.path.exists(csv_path)
        df = pd.read_csv(csv_path, dtype=str)
        required = [
            "question_id", "question_source", "source_location",
            "processing_status", "attribution_result", "error_category",
            "needs_review", "review_reason",
            "jump_detected", "jump_reason",
            "original_terms", "calculated_terms", "processing_log",
        ]
        for col in required:
            assert col in df.columns, f"缺少必填列: {col}"

    def test_q001_correct_answer_no_nan(self, sample_csv, tmp_path):
        """Q001 线性递推：必须处理完成、无 nan、计算项正确"""
        records, _, _ = self.run_pipeline(sample_csv, str(tmp_path), "e2e")
        q001 = next(r for r in records if r.question_id == "Q001")
        assert q001.source_location.endswith(":2"), f"来源位置应为第2行，实际 {q001.source_location}"
        assert q001.processing_status == STABLE_MESSAGES.STATUS_SUCCESS
        assert q001.needs_review is False
        assert "答案正确" in q001.attribution_result
        assert q001.calculated_terms, "calculated_terms 不能为空"
        assert not any(math.isnan(t) for t in q001.calculated_terms), "计算项不能出现 nan"
        assert abs(q001.calculated_terms[0] - 2.0) < 1e-9
        assert abs(q001.calculated_terms[1] - 5.0) < 1e-9
        assert abs(q001.calculated_terms[2] - 11.0) < 1e-9

    def test_q002_fraction_answer_parsed(self, sample_csv, tmp_path):
        """Q002 分式递推：1/3 必须解析为单个分数，不能拆成两个数"""
        records, _, _ = self.run_pipeline(sample_csv, str(tmp_path), "e2e")
        q002 = next(r for r in records if r.question_id == "Q002")
        assert q002.processing_status == STABLE_MESSAGES.STATUS_SUCCESS
        assert q002.needs_review is False
        student = q002.processing_log
        log_str = "\n".join(student)
        assert "解析学生答案数值" in log_str
        assert abs(q002.calculated_terms[0] - 1.0) < 1e-9
        assert abs(q002.calculated_terms[1] - (-1.0)) < 1e-9
        assert abs(q002.calculated_terms[2] - (1.0 / 3.0)) < 1e-6

    def test_q003_periodic_sequence(self, sample_csv, tmp_path):
        """Q003 周期递推：a(n+1)=(a(n)+1)/(a(n)-1) 周期为2"""
        records, _, _ = self.run_pipeline(sample_csv, str(tmp_path), "e2e")
        q003 = next(r for r in records if r.question_id == "Q003")
        assert q003.processing_status == STABLE_MESSAGES.STATUS_SUCCESS
        assert q003.needs_review is False
        terms = q003.calculated_terms
        assert len(terms) >= 4
        assert abs(terms[0] - 2.0) < 1e-9
        assert abs(terms[1] - 3.0) < 1e-9
        assert abs(terms[2] - 2.0) < 1e-9
        assert abs(terms[3] - 3.0) < 1e-9

    def test_q006_division_by_zero_marks_review(self, sample_csv, tmp_path):
        """Q006 除零边界：必须标记待复核，并说明哪一项代入后分母为零"""
        records, csv_path, _ = self.run_pipeline(sample_csv, str(tmp_path), "e2e")
        q006 = next(r for r in records if r.question_id == "Q006")
        assert q006.processing_status == STABLE_MESSAGES.STATUS_NEEDS_REVIEW
        assert q006.needs_review is True
        assert STABLE_MESSAGES.REVIEW_REASON_DIVISION_BY_ZERO in q006.review_reason
        assert "1.0" in q006.review_reason or "第1项" in q006.review_reason
        df = pd.read_csv(csv_path, dtype=str)
        row = df[df["question_id"] == "Q006"].iloc[0]
        assert row["needs_review"] == "True"
        assert STABLE_MESSAGES.REVIEW_REASON_DIVISION_BY_ZERO in str(row["review_reason"])
        assert row["source_location"].endswith(":5")

    def test_q008_fibonacci_second_order(self, sample_csv, tmp_path):
        """Q008 斐波那契二阶递推：计算结果必须是 1,1,2,3,5,8"""
        records, _, _ = self.run_pipeline(sample_csv, str(tmp_path), "e2e")
        q008 = next(r for r in records if r.question_id == "Q008")
        assert q008.processing_status == STABLE_MESSAGES.STATUS_SUCCESS
        assert q008.needs_review is False
        terms = q008.calculated_terms
        assert len(terms) >= 6
        assert terms[:6] == [1.0, 1.0, 2.0, 3.0, 5.0, 8.0]

    def test_q010_calculation_error_detected(self, sample_csv, tmp_path):
        """Q010 计算错误：a4=109 而学生答 110，必须识别为第4项计算错误"""
        records, csv_path, _ = self.run_pipeline(sample_csv, str(tmp_path), "e2e")
        q010 = next(r for r in records if r.question_id == "Q010")
        assert q010.processing_status == STABLE_MESSAGES.STATUS_SUCCESS
        assert q010.error_category == "计算错误"
        assert "第[4]项" in q010.attribution_result
        assert q010.needs_review is False
        df = pd.read_csv(csv_path, dtype=str)
        row = df[df["question_id"] == "Q010"].iloc[0]
        assert row["processing_status"] == STABLE_MESSAGES.STATUS_SUCCESS
        assert "计算错误" in str(row["error_category"])

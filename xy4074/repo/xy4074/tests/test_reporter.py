import pytest

from classroom_cluster.models import QuestionItem, QuestionCluster, Chapter, TimeRange, ReviewStatus
from classroom_cluster.reporter import ReportGenerator, format_seconds


class TestFormatSeconds:
    def test_format_seconds_basic(self):
        assert format_seconds(0) == "00:00:00"
        assert format_seconds(60) == "00:01:00"
        assert format_seconds(3661) == "01:01:01"
        assert format_seconds(None) == "--:--:--"


class TestReportGenerator:
    def create_test_data(self):
        questions = [
            QuestionItem(
                id="q1",
                content="API接口的参数怎么理解？",
                speaker="学员A",
                time_range=TimeRange(start_seconds=30.0, end_seconds=35.0),
                chapter_title="第一章：API接口基础",
            ),
            QuestionItem(
                id="q2",
                content="API参数应该怎么传？",
                speaker="学员B",
                time_range=TimeRange(start_seconds=150.0, end_seconds=155.0),
                chapter_title="第一章：API接口基础",
            ),
            QuestionItem(
                id="q3",
                content="认证流程具体是怎么执行的？",
                speaker="学员C",
                time_range=TimeRange(start_seconds=75.0, end_seconds=80.0),
                chapter_title="第二章：认证与授权",
            ),
        ]
        
        clusters = [
            QuestionCluster(
                id="cluster1",
                representative_question="API接口的参数怎么理解？",
                questions=["q1", "q2"],
                chapter_title="第一章：API接口基础",
                confidence=0.85,
                avg_time_start=90.0,
                review_status=ReviewStatus.PENDING,
            ),
            QuestionCluster(
                id="cluster2",
                representative_question="认证流程具体是怎么执行的？",
                questions=["q3"],
                chapter_title="第二章：认证与授权",
                confidence=0.92,
                avg_time_start=75.0,
                review_status=ReviewStatus.CONFIRMED,
            ),
        ]
        
        chapters = [
            Chapter(
                title="第一章：API接口基础",
                order=0,
                time_range=TimeRange(start_seconds=0, end_seconds=120),
            ),
            Chapter(
                title="第二章：认证与授权",
                order=1,
                time_range=TimeRange(start_seconds=120, end_seconds=240),
            ),
        ]
        
        return questions, clusters, chapters
    
    def test_generate_markdown_report(self):
        questions, clusters, chapters = self.create_test_data()
        generator = ReportGenerator(
            clusters=clusters,
            questions=questions,
            chapters=chapters,
        )
        
        md_content = generator.generate_markdown_report("测试培训项目")
        
        assert "测试培训项目" in md_content
        assert "API接口的参数" in md_content
        assert "认证流程" in md_content
        assert "第一章：API接口基础" in md_content
        assert "置信度" in md_content
        assert "85.0%" in md_content or "92.0%" in md_content
    
    def test_generate_csv_question_list(self):
        questions, clusters, chapters = self.create_test_data()
        generator = ReportGenerator(
            clusters=clusters,
            questions=questions,
            chapters=chapters,
        )
        
        csv_content = generator.generate_csv_question_list()
        
        assert "问题ID" in csv_content
        assert "聚类ID" in csv_content
        assert "API接口的参数" in csv_content
        assert "认证流程" in csv_content
        assert "学员A" in csv_content
        assert "pending" in csv_content or "confirmed" in csv_content
    
    def test_generate_json_audit_record(self):
        questions, clusters, chapters = self.create_test_data()
        generator = ReportGenerator(
            clusters=clusters,
            questions=questions,
            chapters=chapters,
        )
        
        json_content = generator.generate_json_audit_record("测试培训项目")
        
        assert "测试培训项目" in json_content
        assert "clusters" in json_content
        assert "questions" in json_content
        assert "summary" in json_content
        assert "API接口的参数" in json_content
    
    def test_statistics_calculation(self):
        questions, clusters, chapters = self.create_test_data()
        generator = ReportGenerator(
            clusters=clusters,
            questions=questions,
            chapters=chapters,
        )
        
        stats = generator._calculate_statistics()
        
        assert stats["total_questions"] == 3
        assert stats["total_clusters"] == 2
        assert stats["confirmed_clusters"] == 1
        assert stats["pending_clusters"] == 1

import pytest

from classroom_cluster.models import QuestionItem, Chapter, TimeRange
from classroom_cluster.clusterer import (
    TextPreprocessor, TFIDFClusterer, ChapterMatcher, ClusteringResult
)


class TestTextPreprocessor:
    def test_chinese_tokenization(self):
        preprocessor = TextPreprocessor(language="zh")
        text = "请问这个API接口的参数怎么理解？"
        processed = preprocessor.preprocess(text)
        
        assert "API" in processed
        assert "接口" in processed
        assert "参数" in processed
    
    def test_stop_words_removal(self):
        preprocessor = TextPreprocessor(language="zh")
        text = "请问老师这个是怎么回事？"
        processed = preprocessor.preprocess(text)
        
        assert "请问" not in processed
        assert "老师" not in processed


class TestTFIDFClusterer:
    def create_test_questions(self):
        questions_data = [
            ("API接口的参数怎么理解？", 30.0),
            ("API参数应该怎么传？", 150.0),
            ("认证流程具体是怎么执行的？", 75.0),
            ("token过期怎么处理？", 120.0),
            ("数据库连接池的配置参数是什么意思？", 240.0),
            ("连接池大小设置多少合适？", 250.0),
        ]
        
        questions = []
        for i, (content, start_seconds) in enumerate(questions_data):
            q = QuestionItem(
                content=content,
                time_range=TimeRange(start_seconds=start_seconds, end_seconds=start_seconds + 5.0),
            )
            questions.append(q)
        
        return questions
    
    def test_clustering_basic(self):
        questions = self.create_test_questions()
        clusterer = TFIDFClusterer(
            similarity_threshold=0.3,
            min_cluster_size=2,
        )
        
        result = clusterer.cluster(questions)
        
        assert isinstance(result, ClusteringResult)
        assert len(result.clusters) >= 2
        
        api_clusters = [
            c for c in result.clusters
            if "API" in c.representative_question or "参数" in c.representative_question
        ]
        assert len(api_clusters) >= 1
    
    def test_confidence_calculation(self):
        questions = self.create_test_questions()
        clusterer = TFIDFClusterer(
            similarity_threshold=0.3,
            min_cluster_size=2,
        )
        
        result = clusterer.cluster(questions)
        
        for cluster in result.clusters:
            assert 0.0 <= cluster.confidence <= 1.0
            if len(cluster.questions) >= 2:
                assert cluster.confidence > 0.0
    
    def test_representative_question(self):
        questions = self.create_test_questions()
        clusterer = TFIDFClusterer(
            similarity_threshold=0.3,
            min_cluster_size=2,
        )
        
        result = clusterer.cluster(questions)
        
        for cluster in result.clusters:
            assert cluster.representative_question
            assert len(cluster.representative_question) > 0


class TestChapterMatcher:
    def create_test_chapters(self):
        return [
            Chapter(
                title="第一章：API接口基础",
                order=0,
                time_range=TimeRange(start_seconds=0, end_seconds=60),
            ),
            Chapter(
                title="第二章：认证与授权",
                order=1,
                time_range=TimeRange(start_seconds=60, end_seconds=180),
            ),
            Chapter(
                title="第三章：数据库连接管理",
                order=2,
                time_range=TimeRange(start_seconds=180, end_seconds=300),
            ),
        ]
    
    def test_match_by_time(self):
        chapters = self.create_test_chapters()
        matcher = ChapterMatcher(time_tolerance_seconds=30)
        
        questions = [
            QuestionItem(
                content="API参数问题",
                time_range=TimeRange(start_seconds=30.0, end_seconds=35.0),
            ),
            QuestionItem(
                content="认证流程问题",
                time_range=TimeRange(start_seconds=90.0, end_seconds=95.0),
            ),
            QuestionItem(
                content="数据库问题",
                time_range=TimeRange(start_seconds=200.0, end_seconds=205.0),
            ),
        ]
        
        matched = matcher.match_questions_to_chapters(questions, chapters)
        
        assert matched[0].chapter_title == "第一章：API接口基础"
        assert matched[1].chapter_title == "第二章：认证与授权"
        assert matched[2].chapter_title == "第三章：数据库连接管理"
    
    def test_match_by_similarity(self):
        chapters = self.create_test_chapters()
        matcher = ChapterMatcher()
        
        questions = [
            QuestionItem(
                content="API接口的参数怎么传？",
                time_range=None,
            ),
        ]
        
        matched = matcher.match_questions_to_chapters(questions, chapters)
        
        assert matched[0].chapter_title is not None

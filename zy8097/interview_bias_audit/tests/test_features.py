"""特征提取与聚类测试"""

import pytest

from interview_bias_audit.features import CompetencyExtractor, ReasonClusterer


class TestCompetencyExtractor:
    def test_extract_with_matching_keywords(self):
        competency_dict = {
            "技术基础": ["算法", "数据库"],
            "问题解决": ["逻辑思维", "分析"],
        }
        extractor = CompetencyExtractor(competency_dict)

        text = "候选人算法基础扎实，逻辑思维清晰"
        evidence = extractor.extract(text)

        assert "技术基础" in evidence
        assert "问题解决" in evidence
        assert "算法" in evidence["技术基础"]
        assert "逻辑思维" in evidence["问题解决"]

    def test_extract_with_no_matches(self):
        competency_dict = {"技术基础": ["算法", "数据库"]}
        extractor = CompetencyExtractor(competency_dict)

        text = "候选人沟通能力不错"
        evidence = extractor.extract(text)

        assert len(evidence.get("技术基础", [])) == 0

    def test_extract_empty_text(self):
        competency_dict = {"技术基础": ["算法"]}
        extractor = CompetencyExtractor(competency_dict)

        evidence = extractor.extract("")
        assert evidence == {}

    def test_has_evidence_true(self):
        competency_dict = {"技术基础": ["算法", "数据库"]}
        extractor = CompetencyExtractor(competency_dict)

        assert extractor.has_evidence("候选人算法很好") is True

    def test_has_evidence_false(self):
        competency_dict = {"技术基础": ["算法", "数据库"]}
        extractor = CompetencyExtractor(competency_dict)

        assert extractor.has_evidence("候选人沟通能力不错") is False

    def test_has_evidence_empty_text(self):
        competency_dict = {"技术基础": ["算法", "数据库"]}
        extractor = CompetencyExtractor(competency_dict)

        assert extractor.has_evidence("") is False


class TestReasonClusterer:
    def test_clustering_small_samples(self):
        clusterer = ReasonClusterer(min_cluster_size=3)
        reasons = ["reason1", "reason2"]

        clusters = clusterer.fit_cluster(reasons)

        assert 0 in clusters
        assert len(clusters[0]) == 2

    def test_clustering_enough_samples(self):
        clusterer = ReasonClusterer(min_cluster_size=2)
        reasons = [
            "算法基础扎实",
            "算法能力不错",
            "数据库设计合理",
            "数据库优化经验",
            "沟通表达清晰",
        ]

        clusters = clusterer.fit_cluster(reasons)

        assert len(clusters) >= 1

    def test_clustering_similar_reasons(self):
        clusterer = ReasonClusterer(min_cluster_size=2)
        reasons = ["算法很好", "算法不错", "算法优秀"]

        clusters = clusterer.fit_cluster(reasons)

        assert len(clusters) <= 2

    def test_get_cluster_summary(self):
        clusterer = ReasonClusterer(min_cluster_size=2)
        clusterer.clusters = {
            0: ["算法很好", "算法不错"],
            1: ["沟通清晰"],
        }

        summary = clusterer.get_cluster_summary()

        assert "cluster_0" in summary
        assert summary["cluster_0"]["count"] == 2

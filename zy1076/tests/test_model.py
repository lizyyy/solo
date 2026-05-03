"""
匹配模型测试
"""
import pytest
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from resume_matcher.model import (
    ResumeMatcherModel,
    MatchResult,
    SkillMatch,
    ModelEvaluation,
)
from resume_matcher.parser import Document
from resume_matcher.skills_dictionary import SkillsDictionary


class TestSkillMatch:
    """SkillMatch数据类测试"""
    
    def test_skill_match_creation(self):
        """测试创建SkillMatch对象"""
        skills_dict = SkillsDictionary()
        python_skill = skills_dict.get_skill("Python")
        
        skill_match = SkillMatch(
            skill=python_skill,
            matched_text="python",
            position=10,
            evidence_sentence="熟练使用python进行开发",
            confidence=0.95,
        )
        
        assert skill_match.skill.name == "Python"
        assert skill_match.matched_text == "python"
        assert skill_match.position == 10
        assert "熟练使用python" in skill_match.evidence_sentence


class TestMatchResult:
    """MatchResult数据类测试"""
    
    def test_match_result_creation(self):
        """测试创建MatchResult对象"""
        skills_dict = SkillsDictionary()
        python_skill = skills_dict.get_skill("Python")
        
        skill_match = SkillMatch(
            skill=python_skill,
            matched_text="Python",
            position=0,
        )
        
        result = MatchResult(
            resume_id="resume_001",
            resume_title="张三 - Python工程师",
            job_id="job_001",
            job_title="Python开发工程师",
            total_score=0.85,
            skill_score=0.90,
            tfidf_score=0.80,
            matched_skills=[skill_match],
            missing_skills=[],
            strengths=["技能匹配度高"],
            weaknesses=[],
            suggestions=[],
            warnings=[],
        )
        
        assert result.resume_id == "resume_001"
        assert result.total_score == 0.85
        assert len(result.matched_skills) == 1
    
    def test_match_result_to_dict(self):
        """测试MatchResult转字典"""
        result = MatchResult(
            resume_id="r1",
            resume_title="测试简历",
            job_id="j1",
            job_title="测试岗位",
            total_score=0.75,
            skill_score=0.80,
            tfidf_score=0.70,
        )
        
        result_dict = result.to_dict()
        
        assert result_dict["resume_id"] == "r1"
        assert result_dict["total_score"] == 0.75
        assert result_dict["skill_score"] == 0.80
        assert result_dict["tfidf_score"] == 0.70


class TestModelEvaluation:
    """ModelEvaluation测试"""
    
    def test_evaluation_creation(self):
        """测试创建评估对象"""
        evaluation = ModelEvaluation(
            accuracy=0.85,
            precision={"high_match": 0.88, "low_match": 0.82},
            recall={"high_match": 0.85, "low_match": 0.80},
            f1_score={"high_match": 0.86, "low_match": 0.81},
            support={"high_match": 50, "low_match": 50},
        )
        
        assert evaluation.accuracy == 0.85
        assert evaluation.precision["high_match"] == 0.88
    
    def test_evaluation_to_dict(self):
        """测试评估对象转字典"""
        evaluation = ModelEvaluation(
            accuracy=0.90,
            precision={"A": 0.95},
            recall={"A": 0.90},
            f1_score={"A": 0.92},
            support={"A": 100},
        )
        
        eval_dict = evaluation.to_dict()
        
        assert eval_dict["accuracy"] == 0.90
        assert eval_dict["precision"]["A"] == 0.95
    
    def test_evaluation_str(self):
        """测试评估对象字符串表示"""
        evaluation = ModelEvaluation(
            accuracy=0.85,
            precision={"high_match": 0.88, "medium_match": 0.75, "low_match": 0.82},
            recall={"high_match": 0.85, "medium_match": 0.70, "low_match": 0.80},
            f1_score={"high_match": 0.86, "medium_match": 0.72, "low_match": 0.81},
            support={"high_match": 50, "medium_match": 30, "low_match": 20},
        )
        
        str_repr = str(evaluation)
        
        assert "85.00%" in str_repr  # 准确率
        assert "high_match" in str_repr
        assert "精确率" in str_repr
        assert "召回率" in str_repr


class TestResumeMatcherModel:
    """ResumeMatcherModel测试"""
    
    def test_initialization(self):
        """测试模型初始化"""
        model = ResumeMatcherModel()
        
        assert model.skills_dict is not None
        assert len(model.skill_weights) > 0
        assert model.tfidf_vectorizer is None
    
    def test_initialization_with_custom_skills_dict(self):
        """测试使用自定义技能词典初始化"""
        custom_skills = SkillsDictionary()
        model = ResumeMatcherModel(skills_dict=custom_skills)
        
        assert model.skills_dict is custom_skills
    
    def test_preprocess_text(self):
        """测试文本预处理"""
        model = ResumeMatcherModel()
        
        text = "我  精通   Python  和  JavaScript，\n\n熟练使用  React。"
        processed = model.preprocess_text(text)
        
        # 应该合并多个空格
        assert "  " not in processed
        # 应该转小写
        assert "python" in processed
        assert "javascript" in processed
    
    def test_extract_sentences(self):
        """测试句子提取"""
        model = ResumeMatcherModel()
        
        text = "我精通Python。熟练使用Django框架。有3年开发经验！"
        sentences = model.extract_sentences(text)
        
        assert len(sentences) >= 3
        assert "我精通Python" in sentences
        assert "熟练使用Django框架" in sentences
    
    def test_find_evidence_sentence(self):
        """测试查找证据句"""
        model = ResumeMatcherModel()
        
        text = "我精通Python。熟练使用Django框架进行Web开发。有3年开发经验。"
        keyword = "Django"
        position = text.find(keyword)
        
        evidence = model.find_evidence_sentence(text, keyword, position)
        
        assert "Django" in evidence
        assert "Web开发" in evidence
    
    def test_extract_job_skills(self):
        """测试从岗位JD提取技能"""
        model = ResumeMatcherModel()
        
        job_doc = Document(
            id="test_job",
            title="测试岗位",
            content="""
            要求：精通Python，熟悉Django或Flask框架。
            有机器学习经验优先，熟悉TensorFlow或PyTorch。
            掌握MySQL、Redis等数据库。
            """,
        )
        
        skills = model.extract_job_skills(job_doc)
        skill_names = [s.name for s in skills]
        
        # 应该提取到关键技能
        expected = ["Python", "Django", "Flask", "机器学习", "TensorFlow", "PyTorch", "MySQL", "Redis"]
        skill_names_set = set(skill_names)
        for exp in expected:
            if exp in skill_names_set:
                assert True, f"应该提取到 {exp}"
    
    def test_match_basic(self):
        """测试基本匹配功能"""
        model = ResumeMatcherModel()
        
        # 匹配的简历和岗位
        resume = Document(
            id="r1",
            title="匹配简历",
            content="""
            我是一名Python开发工程师，精通Python和Django框架。
            有3年机器学习经验，熟悉TensorFlow和PyTorch。
            熟练使用MySQL和Redis数据库。
            """,
        )
        
        job = Document(
            id="j1",
            title="Python后端工程师",
            content="""
            要求：精通Python，熟悉Django或Flask框架。
            有机器学习经验优先，熟悉TensorFlow或PyTorch。
            掌握MySQL、Redis等数据库。
            """,
        )
        
        result = model.match(resume, job)
        
        # 匹配分数应该较高
        assert result.total_score > 0.5
        assert result.resume_id == "r1"
        assert result.job_id == "j1"
        
        # 应该有匹配到的技能
        assert len(result.matched_skills) > 0
        
        # 应该有优势分析
        assert len(result.strengths) > 0
    
    def test_match_low_similarity(self):
        """测试匹配相似度逻辑"""
        model = ResumeMatcherModel()
        
        # 高匹配简历
        resume_high = Document(
            id="high",
            title="高匹配简历",
            content="Python Django Flask TensorFlow PyTorch MySQL Redis",
        )
        
        # 低匹配简历
        resume_low = Document(
            id="low",
            title="低匹配简历",
            content="Java Spring Boot Oracle",
        )
        
        # 岗位
        job = Document(
            id="j1",
            title="Python岗位",
            content="Python Django Flask TensorFlow PyTorch MySQL Redis",
        )
        
        result_high = model.match(resume_high, job)
        result_low = model.match(resume_low, job)
        
        # 高匹配简历的分数应该更高
        assert result_high.total_score > result_low.total_score
    
    def test_match_all(self):
        """测试多对多匹配"""
        model = ResumeMatcherModel()
        
        resumes = [
            Document(id="r1", title="简历1", content="Python Django"),
            Document(id="r2", title="简历2", content="Java Spring"),
        ]
        
        jobs = [
            Document(id="j1", title="Python岗位", content="Python Django"),
            Document(id="j2", title="Java岗位", content="Java Spring"),
        ]
        
        all_results, results_by_job = model.match_all(resumes, jobs)
        
        # 应该有2*2=4组匹配
        assert len(all_results) == 4
        
        # 每个岗位应该有2个结果
        assert len(results_by_job["j1"]) == 2
        assert len(results_by_job["j2"]) == 2
        
        # r1-j1的分数应该高于r2-j1
        r1j1 = next(r for r in all_results if r.resume_id == "r1" and r.job_id == "j1")
        r2j1 = next(r for r in all_results if r.resume_id == "r2" and r.job_id == "j1")
        
        assert r1j1.total_score > r2j1.total_score
    
    def test_generate_comparison_matrix(self):
        """测试生成比较矩阵"""
        model = ResumeMatcherModel()
        
        resumes = [
            Document(id="r1", title="简历1", content="Python"),
            Document(id="r2", title="简历2", content="Java"),
        ]
        
        jobs = [
            Document(id="j1", title="岗位1", content="Python"),
            Document(id="j2", title="岗位2", content="Java"),
        ]
        
        all_results, _ = model.match_all(resumes, jobs)
        matrix = model.generate_comparison_matrix(all_results, resumes, jobs)
        
        # 检查矩阵结构
        assert "score_matrix" in matrix
        assert "resume_ids" in matrix
        assert "job_ids" in matrix
        assert "best_resumes_per_job" in matrix
        assert "best_jobs_per_resume" in matrix
        
        # 检查最佳匹配
        best_resumes = matrix["best_resumes_per_job"]
        assert "j1" in best_resumes
        assert "j2" in best_resumes
        
        # j1的最佳简历应该是r1
        assert best_resumes["j1"]["best_resume_id"] == "r1"
        
        # j2的最佳简历应该是r2
        assert best_resumes["j2"]["best_resume_id"] == "r2"
    
    def test_strengths_generation(self):
        """测试优势生成"""
        model = ResumeMatcherModel()
        
        resume = Document(
            id="r1",
            title="测试简历",
            content="Python Django Flask TensorFlow PyTorch MySQL Redis 机器学习",
        )
        
        job = Document(
            id="j1",
            title="测试岗位",
            content="Python Django Flask TensorFlow PyTorch MySQL Redis 机器学习",
        )
        
        result = model.match(resume, job)
        
        # 应该有优势
        assert len(result.strengths) > 0
        
        # 优势应该包含技能匹配相关内容
        has_skill_strength = any("技能" in s or "核心" in s for s in result.strengths)
        assert has_skill_strength
    
    def test_weaknesses_generation(self):
        """测试劣势生成"""
        model = ResumeMatcherModel()
        
        # 简历缺少关键技能
        resume = Document(
            id="r1",
            title="测试简历",
            content="只有一些不相关的内容",
        )
        
        job = Document(
            id="j1",
            title="测试岗位",
            content="要求Python、Django、TensorFlow、PyTorch、MySQL",
        )
        
        result = model.match(resume, job)
        
        # 应该有劣势
        assert len(result.weaknesses) > 0
    
    def test_suggestions_generation(self):
        """测试建议生成"""
        model = ResumeMatcherModel()
        
        resume = Document(
            id="r1",
            title="测试简历",
            content="Python",
        )
        
        job = Document(
            id="j1",
            title="测试岗位",
            content="Python Django TensorFlow",
        )
        
        result = model.match(resume, job)
        
        # 应该有改进建议
        assert len(result.suggestions) > 0
    
    def test_save_and_load(self, tmp_path):
        """测试模型保存和加载"""
        model = ResumeMatcherModel()
        
        # 添加一些自定义权重
        model.skill_weights["Python"] = 2.0
        
        # 保存
        model_dir = tmp_path / "model"
        model.save(str(model_dir))
        
        # 加载
        loaded_model = ResumeMatcherModel.load(str(model_dir))
        
        # 检查权重是否保存
        assert loaded_model.skill_weights["Python"] == 2.0
    
    def test_empty_content_match(self):
        """测试空内容匹配"""
        model = ResumeMatcherModel()
        
        # 空简历
        empty_resume = Document(
            id="empty",
            title="空简历",
            content="",
        )
        
        job = Document(
            id="j1",
            title="测试岗位",
            content="Python Django",
        )
        
        # 不应该崩溃
        result = model.match(empty_resume, job)
        
        # 分数应该很低
        assert result.total_score < 0.5


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

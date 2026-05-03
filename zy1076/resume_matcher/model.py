"""
匹配模型模块
基于TF-IDF和技能词典的本地匹配模型
支持训练、评估、预测
"""
import re
import json
import math
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple, Set
from dataclasses import dataclass, field
from collections import Counter, defaultdict

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics import classification_report, accuracy_score

from .parser import Document
from .skills_dictionary import SkillsDictionary, Skill
from .exceptions import ModelError
from config import DEFAULT_MODEL_CONFIG


@dataclass
class SkillMatch:
    """技能匹配结果"""
    skill: Skill
    matched_text: str
    position: int
    evidence_sentence: str = ""
    confidence: float = 1.0


@dataclass
class MatchResult:
    """匹配结果"""
    resume_id: str
    resume_title: str
    job_id: str
    job_title: str
    
    # 分数
    total_score: float
    skill_score: float
    tfidf_score: float
    
    # 技能匹配详情
    matched_skills: List[SkillMatch] = field(default_factory=list)
    missing_skills: List[Skill] = field(default_factory=list)
    
    # 证据句
    evidence_sentences: List[str] = field(default_factory=list)
    
    # 详细分析
    strengths: List[str] = field(default_factory=list)
    weaknesses: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "resume_id": self.resume_id,
            "resume_title": self.resume_title,
            "job_id": self.job_id,
            "job_title": self.job_title,
            "total_score": round(self.total_score, 4),
            "skill_score": round(self.skill_score, 4),
            "tfidf_score": round(self.tfidf_score, 4),
            "matched_skills": [
                {
                    "skill_name": sm.skill.name,
                    "category": sm.skill.category,
                    "weight": sm.skill.weight,
                    "matched_text": sm.matched_text,
                    "evidence_sentence": sm.evidence_sentence,
                    "confidence": round(sm.confidence, 4),
                }
                for sm in self.matched_skills
            ],
            "missing_skills": [
                {
                    "skill_name": s.name,
                    "category": s.category,
                    "weight": s.weight,
                }
                for s in self.missing_skills
            ],
            "evidence_sentences": self.evidence_sentences,
            "strengths": self.strengths,
            "weaknesses": self.weaknesses,
            "suggestions": self.suggestions,
            "warnings": self.warnings,
        }


@dataclass
class ModelEvaluation:
    """模型评估结果"""
    accuracy: float
    precision: Dict[str, float]
    recall: Dict[str, float]
    f1_score: Dict[str, float]
    support: Dict[str, int]
    confusion_matrix: Optional[List[List[int]]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "accuracy": round(self.accuracy, 4),
            "precision": {k: round(v, 4) for k, v in self.precision.items()},
            "recall": {k: round(v, 4) for k, v in self.recall.items()},
            "f1_score": {k: round(v, 4) for k, v in self.f1_score.items()},
            "support": self.support,
            "confusion_matrix": self.confusion_matrix,
        }
    
    def __str__(self) -> str:
        lines = ["=" * 60, "模型评估结果", "=" * 60]
        lines.append(f"\n准确率 (Accuracy): {self.accuracy:.2%}")
        lines.append("\n各类别指标:")
        lines.append(f"{'类别':<20} {'精确率':<10} {'召回率':<10} {'F1分数':<10} {'支持数':<10}")
        lines.append("-" * 60)
        for label in sorted(self.precision.keys()):
            lines.append(
                f"{str(label):<20} "
                f"{self.precision[label]:<10.2%} "
                f"{self.recall[label]:<10.2%} "
                f"{self.f1_score[label]:<10.2%} "
                f"{self.support[label]:<10}"
            )
        return "\n".join(lines)


class ResumeMatcherModel:
    """简历匹配模型"""
    
    def __init__(
        self,
        skills_dict: Optional[SkillsDictionary] = None,
        config: Optional[Dict[str, Any]] = None,
    ):
        self.skills_dict = skills_dict or SkillsDictionary()
        self.config = {**DEFAULT_MODEL_CONFIG, **(config or {})}
        
        # TF-IDF向量化器
        self.tfidf_vectorizer: Optional[TfidfVectorizer] = None
        self.tfidf_matrix: Optional[np.ndarray] = None
        self.document_ids: List[str] = []
        
        # 分类模型（用于评估）
        self.classifier: Optional[MultinomialNB] = None
        
        # 训练数据
        self.training_data: List[Dict[str, Any]] = []
        
        # 技能权重（可训练校准）
        self.skill_weights: Dict[str, float] = {}
        self._init_skill_weights()
    
    def _init_skill_weights(self):
        """初始化技能权重"""
        for skill in self.skills_dict.get_all_skills():
            self.skill_weights[skill.name] = skill.weight
    
    def preprocess_text(self, text: str) -> str:
        """文本预处理"""
        # 转为小写
        text = text.lower()
        
        # 移除特殊字符，但保留一些技术符号
        text = re.sub(r'[^\w\s\.\-\+\#\/]', ' ', text)
        
        # 合并多个空格
        text = re.sub(r'\s+', ' ', text)
        
        return text.strip()
    
    def extract_sentences(self, text: str) -> List[str]:
        """提取句子"""
        # 按标点符号分割句子
        sentences = re.split(r'[。！？.!?\n]+', text)
        return [s.strip() for s in sentences if s.strip()]
    
    def find_evidence_sentence(
        self, 
        text: str, 
        keyword: str, 
        position: int,
        context_chars: int = 100
    ) -> str:
        """查找包含关键词的证据句"""
        sentences = self.extract_sentences(text)
        
        # 先尝试精确匹配
        keyword_lower = keyword.lower()
        for sentence in sentences:
            if keyword_lower in sentence.lower():
                return sentence
        
        # 如果没有精确匹配，返回上下文
        start = max(0, position - context_chars)
        end = min(len(text), position + len(keyword) + context_chars)
        context = text[start:end]
        
        # 清理上下文
        context = re.sub(r'\s+', ' ', context).strip()
        if start > 0:
            context = "..." + context
        if end < len(text):
            context = context + "..."
        
        return context
    
    def extract_job_skills(self, job_doc: Document) -> List[Skill]:
        """从岗位JD中提取所需技能"""
        text = job_doc.content
        extracted = self.skills_dict.extract_skills(text)
        
        # 去重并保持顺序
        seen = set()
        unique_skills = []
        for skill, matched_text, pos in extracted:
            if skill.name not in seen:
                seen.add(skill.name)
                unique_skills.append(skill)
        
        return unique_skills
    
    def calculate_skill_match(
        self,
        resume_doc: Document,
        job_skills: List[Skill],
        job_doc: Document
    ) -> Tuple[float, List[SkillMatch], List[Skill]]:
        """
        计算技能匹配分数
        返回: (技能分数, 匹配到的技能列表, 缺失的技能列表)
        """
        resume_text = resume_doc.content
        
        # 从简历中提取所有技能
        resume_skills_extracted = self.skills_dict.extract_skills(resume_text)
        resume_skill_names = set()
        skill_matches: List[SkillMatch] = []
        
        for skill, matched_text, pos in resume_skills_extracted:
            resume_skill_names.add(skill.name)
            
            # 查找证据句
            evidence = self.find_evidence_sentence(resume_text, matched_text, pos)
            
            skill_matches.append(SkillMatch(
                skill=skill,
                matched_text=matched_text,
                position=pos,
                evidence_sentence=evidence,
                confidence=1.0,
            ))
        
        # 计算与岗位技能的匹配
        matched_job_skills = []
        missing_job_skills = []
        total_weight = 0.0
        matched_weight = 0.0
        
        for job_skill in job_skills:
            weight = self.skill_weights.get(job_skill.name, job_skill.weight)
            total_weight += weight
            
            if job_skill.name in resume_skill_names:
                matched_weight += weight
                matched_job_skills.append(job_skill)
            else:
                missing_job_skills.append(job_skill)
        
        # 计算技能分数
        if total_weight > 0:
            skill_score = matched_weight / total_weight
        else:
            # 如果岗位没有提取到技能，使用简历技能覆盖率
            skill_score = min(1.0, len(resume_skill_names) / 20.0)
        
        # 筛选出与岗位相关的skill_matches
        relevant_skill_matches = [
            sm for sm in skill_matches 
            if sm.skill.name in [js.name for js in job_skills]
        ]
        
        # 按权重排序
        relevant_skill_matches.sort(key=lambda x: x.skill.weight, reverse=True)
        
        return skill_score, relevant_skill_matches, missing_job_skills
    
    def train_tfidf(self, documents: List[Document]) -> None:
        """训练TF-IDF模型"""
        if not documents:
            raise ModelError("没有文档用于训练TF-IDF模型")
        
        # 准备文本
        texts = [self.preprocess_text(doc.content) for doc in documents]
        self.document_ids = [doc.id for doc in documents]
        
        # 创建TF-IDF向量化器
        self.tfidf_vectorizer = TfidfVectorizer(
            max_features=self.config["tfidf_max_features"],
            ngram_range=self.config["tfidf_ngram_range"],
            stop_words=["的", "了", "是", "在", "有", "和", "与", "或", "等", "及"],
        )
        
        # 训练并转换
        self.tfidf_matrix = self.tfidf_vectorizer.fit_transform(texts)
    
    def calculate_tfidf_similarity(
        self,
        resume_doc: Document,
        job_doc: Document
    ) -> float:
        """计算TF-IDF余弦相似度"""
        if self.tfidf_vectorizer is None:
            # 如果没有训练模型，使用临时向量化
            vectorizer = TfidfVectorizer(
                max_features=self.config["tfidf_max_features"],
                ngram_range=self.config["tfidf_ngram_range"],
            )
            
            resume_text = self.preprocess_text(resume_doc.content)
            job_text = self.preprocess_text(job_doc.content)
            
            try:
                tfidf_matrix = vectorizer.fit_transform([resume_text, job_text])
                similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
                return float(similarity)
            except Exception:
                return 0.0
        
        # 使用已训练的模型
        resume_text = self.preprocess_text(resume_doc.content)
        job_text = self.preprocess_text(job_doc.content)
        
        resume_vec = self.tfidf_vectorizer.transform([resume_text])
        job_vec = self.tfidf_vectorizer.transform([job_text])
        
        similarity = cosine_similarity(resume_vec, job_vec)[0][0]
        return float(similarity)
    
    def match(
        self,
        resume_doc: Document,
        job_doc: Document,
    ) -> MatchResult:
        """
        匹配单份简历和单个岗位
        """
        # 1. 提取岗位所需技能
        job_skills = self.extract_job_skills(job_doc)
        
        # 2. 计算技能匹配分数
        skill_score, matched_skills, missing_skills = self.calculate_skill_match(
            resume_doc, job_skills, job_doc
        )
        
        # 3. 计算TF-IDF相似度
        tfidf_score = self.calculate_tfidf_similarity(resume_doc, job_doc)
        
        # 4. 计算综合分数
        skill_weight = self.config["skill_weight"]
        tfidf_weight = self.config["tfidf_weight"]
        total_score = skill_score * skill_weight + tfidf_score * tfidf_weight
        
        # 5. 生成分析内容
        evidence_sentences = [sm.evidence_sentence for sm in matched_skills if sm.evidence_sentence]
        
        # 优势分析
        strengths = self._generate_strengths(matched_skills, skill_score, tfidf_score)
        
        # 劣势分析
        weaknesses = self._generate_weaknesses(missing_skills, skill_score, tfidf_score)
        
        # 改进建议
        suggestions = self._generate_suggestions(missing_skills, matched_skills, job_skills)
        
        # 警告（过度包装或证据不足）
        warnings = self._generate_warnings(matched_skills, resume_doc.content, job_doc.content)
        
        return MatchResult(
            resume_id=resume_doc.id,
            resume_title=resume_doc.title,
            job_id=job_doc.id,
            job_title=job_doc.title,
            total_score=total_score,
            skill_score=skill_score,
            tfidf_score=tfidf_score,
            matched_skills=matched_skills,
            missing_skills=missing_skills,
            evidence_sentences=evidence_sentences,
            strengths=strengths,
            weaknesses=weaknesses,
            suggestions=suggestions,
            warnings=warnings,
        )
    
    def _generate_strengths(
        self, 
        matched_skills: List[SkillMatch], 
        skill_score: float, 
        tfidf_score: float
    ) -> List[str]:
        """生成优势分析"""
        strengths = []
        
        # 高分技能
        high_weight_skills = [sm for sm in matched_skills if sm.skill.weight >= 1.0]
        if high_weight_skills:
            skill_names = [sm.skill.name for sm in high_weight_skills[:5]]
            strengths.append(f"具备核心技能：{', '.join(skill_names)}")
        
        # 技能覆盖率
        if skill_score >= 0.7:
            strengths.append(f"技能匹配度高（{skill_score:.0%}），覆盖岗位大部分核心要求")
        
        # 文本相似度
        if tfidf_score >= 0.5:
            strengths.append(f"简历与岗位描述相似度高（{tfidf_score:.0%}），经历描述贴合度好")
        
        # 按类别统计
        category_counts = defaultdict(int)
        for sm in matched_skills:
            category_counts[sm.skill.category] += 1
        
        for category, count in category_counts.items():
            if count >= 3:
                strengths.append(f"在「{category}」领域有丰富技能储备（{count}项）")
        
        return strengths
    
    def _generate_weaknesses(
        self, 
        missing_skills: List[Skill], 
        skill_score: float, 
        tfidf_score: float
    ) -> List[str]:
        """生成劣势分析"""
        weaknesses = []
        
        # 关键技能缺失
        high_weight_missing = [s for s in missing_skills if s.weight >= 1.0]
        if high_weight_missing:
            skill_names = [s.name for s in high_weight_missing[:5]]
            weaknesses.append(f"缺少核心技能：{', '.join(skill_names)}")
        
        # 技能覆盖率低
        if skill_score < 0.4:
            weaknesses.append(f"技能匹配度较低（{skill_score:.0%}），与岗位要求差距较大")
        
        # 文本相似度低
        if tfidf_score < 0.2:
            weaknesses.append(f"简历描述与岗位要求相似度低（{tfidf_score:.0%}），建议优化经历描述")
        
        # 缺失技能类别分析
        category_missing = defaultdict(list)
        for skill in missing_skills:
            category_missing[skill.category].append(skill.name)
        
        for category, skills in category_missing.items():
            if len(skills) >= 2:
                weaknesses.append(f"在「{category}」领域存在技能缺口：{', '.join(skills[:3])}")
        
        return weaknesses
    
    def _generate_suggestions(
        self, 
        missing_skills: List[Skill], 
        matched_skills: List[SkillMatch],
        job_skills: List[Skill]
    ) -> List[str]:
        """生成改进建议"""
        suggestions = []
        
        # 按优先级排序缺失技能
        sorted_missing = sorted(missing_skills, key=lambda s: s.weight, reverse=True)
        
        if sorted_missing:
            # 最高优先级
            top_skill = sorted_missing[0]
            suggestions.append(f"【高优先级】建议补充「{top_skill.name}」相关经历或项目经验")
            
            # 其他重要技能
            if len(sorted_missing) > 1:
                other_skills = [s.name for s in sorted_missing[1:4]]
                suggestions.append(f"【次优先级】考虑学习或补充：{', '.join(other_skills)}")
        
        # 如果匹配到的技能有，但证据不足
        matched_names = set(sm.skill.name for sm in matched_skills)
        for sm in matched_skills:
            if not sm.evidence_sentence or len(sm.evidence_sentence) < 20:
                suggestions.append(f"建议为「{sm.skill.name}」添加具体的项目描述或成果数据")
                break
        
        # 建议添加量化成果
        if not any("%" in sm.evidence_sentence or "万" in sm.evidence_sentence or "提升" in sm.evidence_sentence for sm in matched_skills if sm.evidence_sentence):
            suggestions.append("建议在简历中添加量化成果（如：性能提升X%、用户增长X万等）")
        
        return suggestions
    
    def _generate_warnings(
        self, 
        matched_skills: List[SkillMatch], 
        resume_text: str, 
        job_text: str
    ) -> List[str]:
        """生成警告（过度包装或证据不足）"""
        warnings = []
        
        # 检查只有技能名称但没有具体描述的情况
        for sm in matched_skills:
            evidence = sm.evidence_sentence
            if evidence:
                # 检查证据句是否只包含技能名称，没有上下文
                evidence_clean = evidence.replace(sm.matched_text, "").strip()
                if len(evidence_clean) < 10:
                    warnings.append(f"技能「{sm.skill.name}」缺乏具体项目描述，可能证据不足")
                    break
        
        # 检查是否过度使用热门词汇
        buzzwords = ["精通", "专家", "资深", "高级", "架构师"]
        buzzword_count = sum(1 for bw in buzzwords if bw in resume_text)
        if buzzword_count >= 5:
            warnings.append(f"简历中使用了 {buzzword_count} 个高级别修饰词，建议增加具体成果支撑")
        
        # 检查技能数量是否异常
        if len(matched_skills) > 30:
            warnings.append(f"简历中匹配到 {len(matched_skills)} 项技能，建议聚焦核心技能，避免简历过长")
        
        return warnings
    
    def match_all(
        self,
        resumes: List[Document],
        jobs: List[Document],
    ) -> Tuple[List[MatchResult], Dict[str, List[MatchResult]]]:
        """
        匹配所有简历和岗位
        返回: (所有匹配结果列表, 按岗位分组的结果字典)
        """
        all_results = []
        results_by_job: Dict[str, List[MatchResult]] = defaultdict(list)
        
        for resume in resumes:
            for job in jobs:
                result = self.match(resume, job)
                all_results.append(result)
                results_by_job[job.id].append(result)
        
        # 对每个岗位的结果按分数排序
        for job_id in results_by_job:
            results_by_job[job_id].sort(key=lambda r: r.total_score, reverse=True)
        
        return all_results, results_by_job
    
    def generate_comparison_matrix(
        self,
        all_results: List[MatchResult],
        resumes: List[Document],
        jobs: List[Document],
    ) -> Dict[str, Any]:
        """
        生成比较矩阵
        """
        resume_ids = [r.id for r in resumes]
        job_ids = [j.id for j in jobs]
        
        # 创建分数矩阵
        score_matrix: Dict[str, Dict[str, float]] = {}
        for resume_id in resume_ids:
            score_matrix[resume_id] = {}
            for job_id in job_ids:
                score_matrix[resume_id][job_id] = 0.0
        
        for result in all_results:
            score_matrix[result.resume_id][result.job_id] = round(result.total_score, 4)
        
        # 每个岗位的最佳简历
        best_resumes: Dict[str, Dict[str, Any]] = {}
        results_by_job = defaultdict(list)
        for result in all_results:
            results_by_job[result.job_id].append(result)
        
        for job_id, results in results_by_job.items():
            if results:
                results_sorted = sorted(results, key=lambda r: r.total_score, reverse=True)
                best = results_sorted[0]
                best_resumes[job_id] = {
                    "job_id": job_id,
                    "job_title": best.job_title,
                    "best_resume_id": best.resume_id,
                    "best_resume_title": best.resume_title,
                    "best_score": round(best.total_score, 4),
                    "matched_skills_count": len(best.matched_skills),
                    "missing_skills_count": len(best.missing_skills),
                    "top_3_resumes": [
                        {
                            "resume_id": r.resume_id,
                            "resume_title": r.resume_title,
                            "score": round(r.total_score, 4),
                        }
                        for r in results_sorted[:3]
                    ],
                }
        
        # 每个简历的最佳岗位
        results_by_resume = defaultdict(list)
        for result in all_results:
            results_by_resume[result.resume_id].append(result)
        
        best_jobs: Dict[str, Dict[str, Any]] = {}
        for resume_id, results in results_by_resume.items():
            if results:
                results_sorted = sorted(results, key=lambda r: r.total_score, reverse=True)
                best = results_sorted[0]
                best_jobs[resume_id] = {
                    "resume_id": resume_id,
                    "resume_title": best.resume_title,
                    "best_job_id": best.job_id,
                    "best_job_title": best.job_title,
                    "best_score": round(best.total_score, 4),
                }
        
        return {
            "score_matrix": score_matrix,
            "resume_ids": resume_ids,
            "job_ids": job_ids,
            "best_resumes_per_job": best_resumes,
            "best_jobs_per_resume": best_jobs,
        }
    
    def add_training_sample(
        self,
        resume_doc: Document,
        job_doc: Document,
        label: str,  # "high_match", "medium_match", "low_match"
    ):
        """添加训练样本"""
        self.training_data.append({
            "resume_id": resume_doc.id,
            "job_id": job_doc.id,
            "resume_content": resume_doc.content,
            "job_content": job_doc.content,
            "label": label,
        })
    
    def train(self, training_data: Optional[List[Dict[str, Any]]] = None) -> ModelEvaluation:
        """
        训练模型并评估
        支持校准技能权重
        """
        if training_data:
            self.training_data.extend(training_data)
        
        if len(self.training_data) < 10:
            raise ModelError(f"训练样本不足，需要至少10个样本，当前: {len(self.training_data)}")
        
        # 准备特征和标签
        texts = []
        labels = []
        
        for sample in self.training_data:
            # 组合简历和岗位文本作为特征
            combined_text = sample["resume_content"] + " [SEP] " + sample["job_content"]
            texts.append(self.preprocess_text(combined_text))
            labels.append(sample["label"])
        
        # 划分训练集和测试集
        X_train, X_test, y_train, y_test = train_test_split(
            texts, labels, test_size=0.3, random_state=42, stratify=labels
        )
        
        # 训练TF-IDF
        vectorizer = TfidfVectorizer(
            max_features=self.config["tfidf_max_features"],
            ngram_range=self.config["tfidf_ngram_range"],
        )
        
        X_train_vec = vectorizer.fit_transform(X_train)
        X_test_vec = vectorizer.transform(X_test)
        
        # 训练朴素贝叶斯分类器
        self.classifier = MultinomialNB()
        self.classifier.fit(X_train_vec, y_train)
        
        # 预测并评估
        y_pred = self.classifier.predict(X_test_vec)
        
        # 计算评估指标
        accuracy = accuracy_score(y_test, y_pred)
        
        # 计算各类别的指标
        from sklearn.metrics import precision_recall_fscore_support
        
        precision, recall, f1, support = precision_recall_fscore_support(
            y_test, y_pred, average=None, labels=sorted(set(labels))
        )
        
        label_list = sorted(set(labels))
        precision_dict = dict(zip(label_list, precision))
        recall_dict = dict(zip(label_list, recall))
        f1_dict = dict(zip(label_list, f1))
        support_dict = dict(zip(label_list, support))
        
        # 校准技能权重（基于训练数据）
        self._calibrate_skill_weights()
        
        return ModelEvaluation(
            accuracy=accuracy,
            precision=precision_dict,
            recall=recall_dict,
            f1_score=f1_dict,
            support=support_dict,
        )
    
    def _calibrate_skill_weights(self):
        """基于训练数据校准技能权重"""
        if not self.training_data:
            return
        
        # 统计高匹配样本中的技能出现频率
        high_match_skills = Counter()
        low_match_skills = Counter()
        total_high = 0
        total_low = 0
        
        for sample in self.training_data:
            resume_text = sample["resume_content"]
            job_text = sample["job_content"]
            label = sample["label"]
            
            # 提取简历中的技能
            resume_skills = self.skills_dict.extract_skills(resume_text)
            resume_skill_names = set(s[0].name for s in resume_skills)
            
            # 提取岗位中的技能
            job_skills = self.skills_dict.extract_skills(job_text)
            job_skill_names = set(s[0].name for s in job_skills)
            
            # 计算匹配的技能
            matched = resume_skill_names & job_skill_names
            
            if label in ["high_match", "good_match"]:
                total_high += 1
                for skill_name in matched:
                    high_match_skills[skill_name] += 1
            else:
                total_low += 1
                for skill_name in matched:
                    low_match_skills[skill_name] += 1
        
        # 计算权重调整因子
        for skill_name in self.skill_weights:
            high_freq = high_match_skills.get(skill_name, 0) / max(total_high, 1)
            low_freq = low_match_skills.get(skill_name, 0) / max(total_low, 1)
            
            # 如果高匹配样本中出现频率显著高于低匹配样本，增加权重
            if high_freq > low_freq + 0.1:
                self.skill_weights[skill_name] *= 1.2
            elif low_freq > high_freq + 0.1:
                self.skill_weights[skill_name] *= 0.8
            
            # 限制权重范围
            self.skill_weights[skill_name] = max(0.5, min(2.0, self.skill_weights[skill_name]))
    
    def save(self, model_dir: str):
        """保存模型"""
        model_path = Path(model_dir)
        model_path.mkdir(parents=True, exist_ok=True)
        
        # 保存配置
        config_path = model_path / "config.json"
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(self.config, f, ensure_ascii=False, indent=2)
        
        # 保存技能权重
        weights_path = model_path / "skill_weights.json"
        with open(weights_path, 'w', encoding='utf-8') as f:
            json.dump(self.skill_weights, f, ensure_ascii=False, indent=2)
        
        # 保存训练数据
        if self.training_data:
            training_path = model_path / "training_data.json"
            with open(training_path, 'w', encoding='utf-8') as f:
                json.dump(self.training_data, f, ensure_ascii=False, indent=2)
        
        # 保存技能词典
        self.skills_dict.save(str(model_path / "skills_dictionary.json"))
    
    @classmethod
    def load(cls, model_dir: str) -> "ResumeMatcherModel":
        """加载模型"""
        model_path = Path(model_dir)
        
        if not model_path.exists():
            return cls()
        
        # 加载配置
        config = {}
        config_path = model_path / "config.json"
        if config_path.exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
        
        # 加载技能词典
        skills_dict = SkillsDictionary.load(str(model_path / "skills_dictionary.json"))
        
        instance = cls(skills_dict=skills_dict, config=config)
        
        # 加载技能权重
        weights_path = model_path / "skill_weights.json"
        if weights_path.exists():
            with open(weights_path, 'r', encoding='utf-8') as f:
                instance.skill_weights = json.load(f)
        
        # 加载训练数据
        training_path = model_path / "training_data.json"
        if training_path.exists():
            with open(training_path, 'r', encoding='utf-8') as f:
                instance.training_data = json.load(f)
        
        return instance

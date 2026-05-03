"""
技能词典模块
支持技能别名归一化、权重管理、类别划分
"""
import re
import json
from pathlib import Path
from typing import Dict, List, Set, Optional, Any, Tuple
from dataclasses import dataclass, field
from collections import defaultdict

import Levenshtein


@dataclass
class Skill:
    """技能数据类"""
    name: str  # 标准名称
    aliases: List[str] = field(default_factory=list)
    category: str = "其他"
    weight: float = 1.0
    description: str = ""
    examples: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "aliases": self.aliases,
            "category": self.category,
            "weight": self.weight,
            "description": self.description,
            "examples": self.examples,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Skill":
        return cls(
            name=data.get("name", ""),
            aliases=data.get("aliases", []),
            category=data.get("category", "其他"),
            weight=data.get("weight", 1.0),
            description=data.get("description", ""),
            examples=data.get("examples", []),
        )


class SkillsDictionary:
    """技能词典类"""
    
    # 默认技能类别
    DEFAULT_CATEGORIES = [
        "编程语言",
        "前端技术",
        "后端技术",
        "数据库",
        "AI/机器学习",
        "数据分析",
        "云服务",
        "DevOps",
        "项目管理",
        "软技能",
        "其他",
    ]
    
    def __init__(self):
        self.skills: Dict[str, Skill] = {}  # 标准名称 -> Skill对象
        self.alias_map: Dict[str, str] = {}  # 别名 -> 标准名称
        self.category_map: Dict[str, List[str]] = defaultdict(list)  # 类别 -> 标准名称列表
        
        # 正则表达式模式缓存
        self._pattern_cache: Dict[str, re.Pattern] = {}
        
        # 初始化默认技能
        self._init_default_skills()
    
    def _init_default_skills(self):
        """初始化默认技能词典"""
        default_skills = [
            # 编程语言
            Skill("Python", aliases=["python", "py", "Python3", "python3"], category="编程语言", weight=1.2),
            Skill("Java", aliases=["java", "J2EE", "j2ee"], category="编程语言", weight=1.1),
            Skill("JavaScript", aliases=["JS", "js", "javascript", "ECMAScript"], category="编程语言", weight=1.0),
            Skill("TypeScript", aliases=["TS", "ts", "typescript"], category="编程语言", weight=1.0),
            Skill("Go", aliases=["Golang", "golang", "go语言"], category="编程语言", weight=1.0),
            Skill("Rust", aliases=["rust"], category="编程语言", weight=0.9),
            Skill("C++", aliases=["cpp", "C plus plus", "c++"], category="编程语言", weight=0.9),
            Skill("C#", aliases=["CSharp", "csharp", "c#"], category="编程语言", weight=0.8),
            Skill("PHP", aliases=["php"], category="编程语言", weight=0.8),
            Skill("R语言", aliases=["R", "r语言", "Rlang"], category="编程语言", weight=1.0),
            Skill("Scala", aliases=["scala"], category="编程语言", weight=0.8),
            Skill("Kotlin", aliases=["kotlin"], category="编程语言", weight=0.8),
            Skill("Swift", aliases=["swift"], category="编程语言", weight=0.7),
            Skill("Objective-C", aliases=["ObjC", "objc", "objective-c"], category="编程语言", weight=0.6),
            
            # 前端技术
            Skill("React", aliases=["React.js", "reactjs", "react.js", "ReactJS", "react"], category="前端技术", weight=1.2),
            Skill("Vue.js", aliases=["Vue", "vue", "vuejs", "VueJS"], category="前端技术", weight=1.1),
            Skill("Angular", aliases=["Angular.js", "angularjs", "AngularJS"], category="前端技术", weight=0.9),
            Skill("Next.js", aliases=["Nextjs", "nextjs", "Next"], category="前端技术", weight=1.0),
            Skill("Node.js", aliases=["Nodejs", "nodejs", "Node"], category="前端技术", weight=1.1),
            Skill("HTML5", aliases=["HTML", "html", "html5"], category="前端技术", weight=0.8),
            Skill("CSS3", aliases=["CSS", "css", "css3"], category="前端技术", weight=0.8),
            Skill("SASS", aliases=["SCSS", "sass", "scss"], category="前端技术", weight=0.7),
            Skill("LESS", aliases=["less"], category="前端技术", weight=0.6),
            Skill("Webpack", aliases=["webpack"], category="前端技术", weight=0.8),
            Skill("Vite", aliases=["vite"], category="前端技术", weight=0.8),
            Skill("TailwindCSS", aliases=["Tailwind", "tailwindcss", "tailwind"], category="前端技术", weight=0.9),
            Skill("Redux", aliases=["redux", "Redux Toolkit"], category="前端技术", weight=0.8),
            Skill("MobX", aliases=["mobx"], category="前端技术", weight=0.6),
            
            # 后端技术
            Skill("Django", aliases=["django"], category="后端技术", weight=1.0),
            Skill("Flask", aliases=["flask"], category="后端技术", weight=0.9),
            Skill("FastAPI", aliases=["fastapi", "Fast Api"], category="后端技术", weight=1.0),
            Skill("Spring Boot", aliases=["SpringBoot", "springboot", "spring boot"], category="后端技术", weight=1.1),
            Skill("Spring", aliases=["spring"], category="后端技术", weight=1.0),
            Skill("Express", aliases=["Express.js", "expressjs"], category="后端技术", weight=0.9),
            Skill("NestJS", aliases=["Nest.js", "nestjs"], category="后端技术", weight=0.8),
            Skill("Ruby on Rails", aliases=["Rails", "rails", "RoR"], category="后端技术", weight=0.7),
            Skill("Laravel", aliases=["laravel"], category="后端技术", weight=0.7),
            Skill("GraphQL", aliases=["graphql"], category="后端技术", weight=0.9),
            Skill("RESTful", aliases=["REST API", "RESTful API", "restful"], category="后端技术", weight=1.0),
            Skill("gRPC", aliases=["grpc"], category="后端技术", weight=0.7),
            
            # 数据库
            Skill("MySQL", aliases=["mysql"], category="数据库", weight=1.0),
            Skill("PostgreSQL", aliases=["Postgres", "postgres", "postgresql"], category="数据库", weight=1.0),
            Skill("MongoDB", aliases=["mongo", "Mongo", "mongodb"], category="数据库", weight=0.9),
            Skill("Redis", aliases=["redis"], category="数据库", weight=1.0),
            Skill("SQLite", aliases=["sqlite"], category="数据库", weight=0.7),
            Skill("Oracle", aliases=["oracle", "Oracle DB"], category="数据库", weight=0.8),
            Skill("SQL Server", aliases=["MSSQL", "mssql", "sql server"], category="数据库", weight=0.7),
            Skill("Elasticsearch", aliases=["ES", "es", "elasticsearch"], category="数据库", weight=0.9),
            Skill("Cassandra", aliases=["cassandra"], category="数据库", weight=0.6),
            Skill("DynamoDB", aliases=["dynamodb", "Dynamo DB"], category="数据库", weight=0.8),
            
            # AI/机器学习
            Skill("机器学习", aliases=["Machine Learning", "ML", "ml", "传统机器学习"], category="AI/机器学习", weight=1.2),
            Skill("深度学习", aliases=["Deep Learning", "DL", "dl", "神经网络"], category="AI/机器学习", weight=1.2),
            Skill("自然语言处理", aliases=["NLP", "nlp", "Natural Language Processing"], category="AI/机器学习", weight=1.1),
            Skill("计算机视觉", aliases=["CV", "cv", "Computer Vision", "图像识别"], category="AI/机器学习", weight=1.1),
            Skill("PyTorch", aliases=["pytorch", "Torch", "torch"], category="AI/机器学习", weight=1.1),
            Skill("TensorFlow", aliases=["tensorflow", "TF", "tf"], category="AI/机器学习", weight=1.1),
            Skill("Keras", aliases=["keras"], category="AI/机器学习", weight=0.9),
            Skill("Scikit-learn", aliases=["sklearn", "scikit learn", "Sklearn"], category="AI/机器学习", weight=1.0),
            Skill("Pandas", aliases=["pandas"], category="AI/机器学习", weight=1.0),
            Skill("NumPy", aliases=["numpy", "Numpy"], category="AI/机器学习", weight=1.0),
            Skill("Matplotlib", aliases=["matplotlib"], category="AI/机器学习", weight=0.8),
            Skill("Seaborn", aliases=["seaborn"], category="AI/机器学习", weight=0.7),
            Skill("OpenCV", aliases=["opencv", "cv2"], category="AI/机器学习", weight=0.9),
            Skill("HuggingFace", aliases=["Hugging Face", "huggingface", "transformers"], category="AI/机器学习", weight=1.1),
            Skill("LangChain", aliases=["langchain", "Lang Chain"], category="AI/机器学习", weight=1.0),
            Skill("LLM", aliases=["大语言模型", "Large Language Model", "大模型"], category="AI/机器学习", weight=1.1),
            Skill("RAG", aliases=["检索增强生成", "Retrieval-Augmented Generation"], category="AI/机器学习", weight=1.0),
            Skill("Fine-tuning", aliases=["微调", "fine tuning"], category="AI/机器学习", weight=0.9),
            Skill("Prompt Engineering", aliases=["提示工程", "prompt engineering"], category="AI/机器学习", weight=0.9),
            Skill("MLOps", aliases=["mlops", "机器学习运维"], category="AI/机器学习", weight=0.9),
            Skill("ONNX", aliases=["onnx"], category="AI/机器学习", weight=0.6),
            Skill("TensorRT", aliases=["tensorrt"], category="AI/机器学习", weight=0.6),
            
            # 数据分析
            Skill("数据分析", aliases=["数据挖掘", "BI", "商业智能", "数据洞察"], category="数据分析", weight=1.1),
            Skill("SQL", aliases=["结构化查询语言", "sql"], category="数据分析", weight=1.0),
            Skill("Excel", aliases=["excel", "Microsoft Excel"], category="数据分析", weight=0.8),
            Skill("Tableau", aliases=["tableau"], category="数据分析", weight=0.9),
            Skill("Power BI", aliases=["PowerBI", "powerbi", "power bi"], category="数据分析", weight=0.9),
            Skill("统计分析", aliases=["统计学", "统计建模", "统计"], category="数据分析", weight=0.9),
            Skill("A/B测试", aliases=["AB测试", "ab测试", "A/B Testing"], category="数据分析", weight=0.8),
            Skill("用户画像", aliases=["用户分群", "用户分析"], category="数据分析", weight=0.7),
            Skill("数据可视化", aliases=["可视化", "图表"], category="数据分析", weight=0.9),
            
            # 云服务
            Skill("AWS", aliases=["亚马逊云", "Amazon Web Services", "aws"], category="云服务", weight=1.0),
            Skill("Azure", aliases=["Microsoft Azure", "azure"], category="云服务", weight=0.9),
            Skill("GCP", aliases=["Google Cloud", "google cloud", "谷歌云"], category="云服务", weight=0.9),
            Skill("阿里云", aliases=["Alibaba Cloud", "aliyun"], category="云服务", weight=0.8),
            Skill("腾讯云", aliases=["Tencent Cloud", "tencent cloud"], category="云服务", weight=0.7),
            Skill("Kubernetes", aliases=["K8s", "k8s", "kubernets"], category="云服务", weight=1.0),
            Skill("Docker", aliases=["docker", "容器化"], category="云服务", weight=1.0),
            Skill("Serverless", aliases=["无服务器", "Lambda", "lambda"], category="云服务", weight=0.8),
            Skill("容器编排", aliases=["容器管理"], category="云服务", weight=0.7),
            
            # DevOps
            Skill("CI/CD", aliases=["持续集成", "持续部署", "CI CD", "ci/cd"], category="DevOps", weight=0.9),
            Skill("Jenkins", aliases=["jenkins"], category="DevOps", weight=0.8),
            Skill("GitLab CI", aliases=["gitlab ci", "GitLab"], category="DevOps", weight=0.8),
            Skill("GitHub Actions", aliases=["github actions", "GHA"], category="DevOps", weight=0.8),
            Skill("Ansible", aliases=["ansible"], category="DevOps", weight=0.7),
            Skill("Terraform", aliases=["terraform"], category="DevOps", weight=0.7),
            Skill("Prometheus", aliases=["prometheus"], category="DevOps", weight=0.7),
            Skill("Grafana", aliases=["grafana"], category="DevOps", weight=0.7),
            Skill("ELK", aliases=["Elasticsearch Logstash Kibana", "elk"], category="DevOps", weight=0.7),
            Skill("Nginx", aliases=["nginx"], category="DevOps", weight=0.8),
            Skill("Linux", aliases=["linux", "Unix", "unix"], category="DevOps", weight=0.9),
            Skill("Shell", aliases=["shell脚本", "bash", "Bash"], category="DevOps", weight=0.8),
            
            # 项目管理
            Skill("敏捷开发", aliases=["Agile", "agile", "Scrum", "scrum"], category="项目管理", weight=0.8),
            Skill("需求分析", aliases=["需求调研", "需求管理"], category="项目管理", weight=0.7),
            Skill("技术文档", aliases=["文档编写", "技术写作"], category="项目管理", weight=0.6),
            Skill("代码审查", aliases=["Code Review", "code review"], category="项目管理", weight=0.7),
            Skill("Jira", aliases=["jira"], category="项目管理", weight=0.6),
            Skill("Confluence", aliases=["confluence"], category="项目管理", weight=0.5),
            Skill("Git", aliases=["git", "版本控制"], category="项目管理", weight=1.0),
            Skill("GitLab", aliases=["gitlab"], category="项目管理", weight=0.7),
            Skill("GitHub", aliases=["github"], category="项目管理", weight=0.7),
            
            # 软技能
            Skill("团队协作", aliases=["团队合作", "协作能力"], category="软技能", weight=0.5),
            Skill("沟通能力", aliases=["沟通技巧", "口头沟通", "书面沟通"], category="软技能", weight=0.5),
            Skill("问题解决", aliases=["解决问题", "troubleshooting"], category="软技能", weight=0.5),
            Skill("学习能力", aliases=["快速学习", "持续学习"], category="软技能", weight=0.4),
            Skill("责任心", aliases=["责任感", "认真负责"], category="软技能", weight=0.4),
            Skill("执行力", aliases=["执行能力", "推动能力"], category="软技能", weight=0.4),
        ]
        
        for skill in default_skills:
            self.add_skill(skill)
    
    def add_skill(self, skill: Skill) -> None:
        """添加技能"""
        # 添加标准名称
        self.skills[skill.name] = skill
        self.category_map[skill.category].append(skill.name)
        
        # 建立别名映射
        self.alias_map[skill.name.lower()] = skill.name
        for alias in skill.aliases:
            normalized_alias = alias.lower()
            self.alias_map[normalized_alias] = skill.name
    
    def get_skill(self, name: str) -> Optional[Skill]:
        """获取技能，支持别名查找"""
        normalized = name.lower()
        
        # 直接查找别名映射
        if normalized in self.alias_map:
            standard_name = self.alias_map[normalized]
            return self.skills.get(standard_name)
        
        # 尝试模糊匹配
        matched = self._fuzzy_match(name)
        if matched:
            return self.skills.get(matched)
        
        return None
    
    def normalize(self, term: str) -> Optional[str]:
        """将术语归一化为标准名称"""
        skill = self.get_skill(term)
        return skill.name if skill else None
    
    def _fuzzy_match(self, term: str, threshold: float = 0.85) -> Optional[str]:
        """模糊匹配技能名称"""
        term_lower = term.lower()
        
        # 检查是否是某个标准名称的子串
        for standard_name in self.skills.keys():
            if term_lower in standard_name.lower() or standard_name.lower() in term_lower:
                return standard_name
        
        # 检查别名
        for alias, standard_name in self.alias_map.items():
            if term_lower in alias or alias in term_lower:
                return standard_name
        
        # 编辑距离匹配
        best_match = None
        best_score = 0.0
        
        for standard_name in self.skills.keys():
            score = Levenshtein.ratio(term_lower, standard_name.lower())
            if score > best_score and score >= threshold:
                best_score = score
                best_match = standard_name
        
        if best_match:
            return best_match
        
        # 对别名进行编辑距离匹配
        for alias, standard_name in self.alias_map.items():
            score = Levenshtein.ratio(term_lower, alias)
            if score > best_score and score >= threshold:
                best_score = score
                best_match = standard_name
        
        return best_match
    
    def extract_skills(self, text: str) -> List[Tuple[Skill, str, int]]:
        """
        从文本中提取技能
        返回: [(Skill对象, 匹配到的原始文本, 起始位置), ...]
        """
        results = []
        
        # 构建所有可能的匹配模式
        all_terms = []
        for standard_name, skill in self.skills.items():
            # 添加标准名称
            all_terms.append((standard_name, standard_name))
            # 添加别名
            for alias in skill.aliases:
                all_terms.append((alias, standard_name))
        
        # 按长度降序排列，优先匹配更长的术语
        all_terms.sort(key=lambda x: len(x[0]), reverse=True)
        
        # 记录已匹配的位置，避免重叠
        matched_positions = set()
        
        for term, standard_name in all_terms:
            # 使用正则表达式查找，支持词边界
            pattern = self._get_pattern(term)
            for match in pattern.finditer(text):
                start, end = match.span()
                
                # 检查是否与已有匹配重叠
                overlap = False
                for pos in matched_positions:
                    if not (end <= pos[0] or start >= pos[1]):
                        overlap = True
                        break
                
                if not overlap:
                    skill = self.skills.get(standard_name)
                    if skill:
                        results.append((skill, match.group(), start))
                        matched_positions.add((start, end))
        
        # 按位置排序
        results.sort(key=lambda x: x[2])
        
        return results
    
    def _contains_chinese(self, text: str) -> bool:
        """检查文本是否包含中文字符"""
        pattern = re.compile(r'[\u4e00-\u9fff]')
        return bool(pattern.search(text))
    
    def _get_pattern(self, term: str) -> re.Pattern:
        """获取或编译正则表达式模式"""
        if term in self._pattern_cache:
            return self._pattern_cache[term]
        
        # 转义特殊字符
        escaped = re.escape(term)
        
        # 构建模式：支持词边界，不区分大小写
        # 对于纯英文术语（不包含中文和特殊字符），使用词边界
        # 词边界 \b 对中文字符不适用，所以中文和混合内容不使用词边界
        cleaned_term = term.replace('.', '').replace('-', '').replace('/', '').replace('_', '').replace(' ', '')
        is_pure_english = cleaned_term.isascii() and cleaned_term.isalpha()
        has_chinese = self._contains_chinese(term)
        
        if is_pure_english and not has_chinese:
            # 纯英文术语，使用词边界
            pattern = re.compile(rf'\b{escaped}\b', re.IGNORECASE)
        else:
            # 中文或包含特殊字符，不使用词边界
            pattern = re.compile(rf'{escaped}', re.IGNORECASE)
        
        self._pattern_cache[term] = pattern
        return pattern
    
    def get_skills_by_category(self, category: str) -> List[Skill]:
        """按类别获取技能列表"""
        skill_names = self.category_map.get(category, [])
        return [self.skills[name] for name in skill_names if name in self.skills]
    
    def get_all_categories(self) -> List[str]:
        """获取所有类别"""
        return list(self.category_map.keys())
    
    def get_all_skills(self) -> List[Skill]:
        """获取所有技能"""
        return list(self.skills.values())
    
    def to_dict(self) -> Dict[str, Any]:
        """导出为字典"""
        return {
            "skills": {name: skill.to_dict() for name, skill in self.skills.items()},
            "categories": self.get_all_categories(),
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SkillsDictionary":
        """从字典加载"""
        instance = cls()
        instance.skills.clear()
        instance.alias_map.clear()
        instance.category_map.clear()
        
        skills_data = data.get("skills", {})
        for skill_data in skills_data.values():
            skill = Skill.from_dict(skill_data)
            instance.add_skill(skill)
        
        return instance
    
    def save(self, file_path: str) -> None:
        """保存到文件"""
        file_path = Path(file_path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(self.to_dict(), f, ensure_ascii=False, indent=2)
    
    @classmethod
    def load(cls, file_path: str) -> "SkillsDictionary":
        """从文件加载"""
        file_path = Path(file_path)
        
        if not file_path.exists():
            return cls()
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return cls.from_dict(data)

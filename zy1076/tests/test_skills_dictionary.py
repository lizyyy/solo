"""
技能词典模块测试
"""
import pytest
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from resume_matcher.skills_dictionary import SkillsDictionary, Skill


class TestSkill:
    """Skill数据类测试"""
    
    def test_skill_creation(self):
        """测试创建Skill对象"""
        skill = Skill(
            name="Python",
            aliases=["python", "py"],
            category="编程语言",
            weight=1.2,
        )
        assert skill.name == "Python"
        assert skill.aliases == ["python", "py"]
        assert skill.category == "编程语言"
        assert skill.weight == 1.2
    
    def test_skill_to_dict(self):
        """测试Skill对象转字典"""
        skill = Skill(
            name="TestSkill",
            aliases=["alias1"],
            category="测试类别",
            weight=1.0,
        )
        skill_dict = skill.to_dict()
        assert skill_dict["name"] == "TestSkill"
        assert skill_dict["aliases"] == ["alias1"]
        assert skill_dict["category"] == "测试类别"
    
    def test_skill_from_dict(self):
        """测试从字典创建Skill对象"""
        skill_data = {
            "name": "FromDict",
            "aliases": ["dict_alias"],
            "category": "字典类别",
            "weight": 0.9,
            "description": "测试描述",
            "examples": ["例子1"],
        }
        skill = Skill.from_dict(skill_data)
        assert skill.name == "FromDict"
        assert skill.aliases == ["dict_alias"]
        assert skill.category == "字典类别"
        assert skill.weight == 0.9


class TestSkillsDictionary:
    """SkillsDictionary类测试"""
    
    def test_initialization(self):
        """测试初始化"""
        skills_dict = SkillsDictionary()
        assert len(skills_dict.get_all_skills()) > 0
        assert len(skills_dict.get_all_categories()) > 0
    
    def test_get_skill_exact(self):
        """测试精确查找技能"""
        skills_dict = SkillsDictionary()
        
        # 测试标准名称
        skill = skills_dict.get_skill("Python")
        assert skill is not None
        assert skill.name == "Python"
        
        # 测试别名
        skill = skills_dict.get_skill("JS")
        assert skill is not None
        assert skill.name == "JavaScript"
        
        skill = skills_dict.get_skill("js")
        assert skill is not None
        assert skill.name == "JavaScript"
    
    def test_normalize_alias(self):
        """测试别名归一化"""
        skills_dict = SkillsDictionary()
        
        # 测试用例
        test_cases = [
            ("JS", "JavaScript"),
            ("js", "JavaScript"),
            ("React.js", "React"),
            ("reactjs", "React"),
            ("PYTHON", "Python"),
            ("py", "Python"),
            ("NLP", "自然语言处理"),
            ("ML", "机器学习"),
            ("BI", "数据分析"),
            ("K8s", "Kubernetes"),
        ]
        
        for alias, expected in test_cases:
            normalized = skills_dict.normalize(alias)
            assert normalized == expected, f"{alias} 应该归一化为 {expected}，实际为 {normalized}"
    
    def test_get_skill_fuzzy(self):
        """测试模糊匹配"""
        skills_dict = SkillsDictionary()
        
        # 测试子串匹配
        skill = skills_dict.get_skill("Pytho")  # 少一个字母
        assert skill is not None
        
        skill = skills_dict.get_skill("Pytorch")
        assert skill is not None
        assert skill.name == "PyTorch"
    
    def test_extract_skills(self):
        """测试从文本提取技能"""
        skills_dict = SkillsDictionary()
        
        test_text = """
        我精通 Python 和 JavaScript，熟练使用 React、Vue.js 进行前端开发。
        有丰富的机器学习和自然语言处理经验，熟悉 TensorFlow 和 PyTorch。
        掌握 SQL 和 MySQL，了解数据分析和 BI 工具。
        """
        
        extracted = skills_dict.extract_skills(test_text)
        skill_names = [s[0].name for s in extracted]
        
        # 检查应该提取到的技能
        expected_skills = ["Python", "JavaScript", "React", "Vue.js", "机器学习", 
                          "自然语言处理", "TensorFlow", "PyTorch", "SQL", "MySQL", "数据分析"]
        
        # 检查关键技能是否被提取
        for expected in expected_skills:
            assert expected in skill_names, f"应该提取到 {expected}"
    
    def test_extract_skills_empty(self):
        """测试空文本提取"""
        skills_dict = SkillsDictionary()
        
        extracted = skills_dict.extract_skills("")
        assert extracted == []
        
        extracted = skills_dict.extract_skills("   ")
        assert extracted == []
    
    def test_extract_skills_no_match(self):
        """测试无匹配技能的文本"""
        skills_dict = SkillsDictionary()
        
        extracted = skills_dict.extract_skills("这是一段没有任何技术术语的普通文本。")
        assert extracted == []
    
    def test_get_skills_by_category(self):
        """测试按类别获取技能"""
        skills_dict = SkillsDictionary()
        
        ai_skills = skills_dict.get_skills_by_category("AI/机器学习")
        assert len(ai_skills) > 0
        
        # 检查是否有机器学习在AI/机器学习类别
        skill_names = [s.name for s in ai_skills]
        assert "机器学习" in skill_names
        assert "深度学习" in skill_names
        assert "自然语言处理" in skill_names
    
    def test_add_skill(self):
        """测试添加技能"""
        skills_dict = SkillsDictionary()
        
        # 创建新技能
        new_skill = Skill(
            name="TestNewSkill",
            aliases=["test_alias"],
            category="测试类别",
            weight=1.5,
        )
        
        skills_dict.add_skill(new_skill)
        
        # 检查是否添加成功
        skill = skills_dict.get_skill("TestNewSkill")
        assert skill is not None
        assert skill.name == "TestNewSkill"
        
        # 检查别名
        skill = skills_dict.get_skill("test_alias")
        assert skill is not None
        assert skill.name == "TestNewSkill"
    
    def test_categories(self):
        """测试类别列表"""
        skills_dict = SkillsDictionary()
        
        categories = skills_dict.get_all_categories()
        
        # 检查核心类别是否存在
        expected_categories = ["编程语言", "前端技术", "后端技术", "数据库", "AI/机器学习", "数据分析"]
        for cat in expected_categories:
            assert cat in categories, f"应该包含类别 {cat}"
    
    def test_save_and_load(self, tmp_path):
        """测试保存和加载"""
        skills_dict = SkillsDictionary()
        
        # 添加一个自定义技能
        custom_skill = Skill(
            name="CustomSkill123",
            aliases=["cs123"],
            category="自定义类别",
            weight=2.0,
        )
        skills_dict.add_skill(custom_skill)
        
        # 保存
        save_path = tmp_path / "skills.json"
        skills_dict.save(str(save_path))
        
        # 加载
        loaded_dict = SkillsDictionary.load(str(save_path))
        
        # 检查自定义技能是否存在
        skill = loaded_dict.get_skill("CustomSkill123")
        assert skill is not None
        assert skill.name == "CustomSkill123"
        
        # 检查别名
        skill = loaded_dict.get_skill("cs123")
        assert skill is not None


class TestSkillWeight:
    """技能权重测试"""
    
    def test_default_weights(self):
        """测试默认权重"""
        skills_dict = SkillsDictionary()
        
        # 检查核心技能权重
        python_skill = skills_dict.get_skill("Python")
        assert python_skill is not None
        assert python_skill.weight >= 1.0  # Python权重应该>=1
        
        ml_skill = skills_dict.get_skill("机器学习")
        assert ml_skill is not None
        assert ml_skill.weight >= 1.0  # 机器学习权重应该>=1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

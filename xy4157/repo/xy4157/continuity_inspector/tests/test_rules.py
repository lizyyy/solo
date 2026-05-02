"""
规则引擎测试
"""

import unittest
from datetime import datetime

from continuity_inspector.models import (
    ProjectData, ScriptNote, CallSheetEntry, ScreenshotItem,
    CostumeRule, PropRule, ContinuityIssue, ShotStatus,
    IssueCategory, IssueSeverity
)
from continuity_inspector.rules.engine import ContinuityEngine


class TestContinuityEngine(unittest.TestCase):
    """连续性规则引擎测试"""
    
    def setUp(self):
        self.engine = ContinuityEngine()
    
    def create_basic_project(self) -> ProjectData:
        """创建基础测试项目"""
        return ProjectData(
            project_name="测试项目",
            production_day="2026-05-01"
        )
    
    def test_costume_continuity_check(self):
        """测试服装连续性检查"""
        project = self.create_basic_project()
        
        project.script_notes = [
            ScriptNote(
                scene_id="1-01",
                shot_number="1",
                take=1,
                status=ShotStatus.SHOT,
                characters=["李雷"],
                costumes={"李雷": "蓝色西装+白衬衫+黑领带"},
                props=[],
                shot_date="2026-05-01"
            ),
            ScriptNote(
                scene_id="1-01",
                shot_number="2",
                take=1,
                status=ShotStatus.SHOT,
                characters=["李雷"],
                costumes={"李雷": "蓝色西装+白衬衫+红领带"},
                props=[],
                shot_date="2026-05-01"
            )
        ]
        
        project.costume_rules = []
        project.prop_rules = []
        
        self.engine.check_costume_continuity(project)
        
        costume_issues = [i for i in project.issues if i.category == IssueCategory.COSTUME_CONTINUITY]
        self.assertGreater(len(costume_issues), 0)
    
    def test_duplicate_shots_check(self):
        """测试重复镜号检查"""
        project = self.create_basic_project()
        
        project.script_notes = [
            ScriptNote(
                scene_id="1-01",
                shot_number="1",
                take=1,
                status=ShotStatus.SHOT,
                characters=["李雷"],
                costumes={},
                props=[],
                shot_date="2026-05-01"
            ),
            ScriptNote(
                scene_id="1-01",
                shot_number="1",
                take=2,
                status=ShotStatus.SHOT,
                characters=["李雷"],
                costumes={},
                props=[],
                shot_date="2026-05-01"
            )
        ]
        
        self.engine.check_duplicate_shots(project)
        
        duplicate_issues = [i for i in project.issues if i.category == IssueCategory.DUPLICATE_SHOT]
        self.assertGreater(len(duplicate_issues), 0)
    
    def test_missing_screenshots_check(self):
        """测试缺失截图检查"""
        project = self.create_basic_project()
        
        project.script_notes = [
            ScriptNote(
                scene_id="1-01",
                shot_number="1",
                take=1,
                status=ShotStatus.SHOT,
                characters=["李雷"],
                costumes={},
                props=[],
                shot_date="2026-05-01"
            ),
            ScriptNote(
                scene_id="1-01",
                shot_number="2",
                take=1,
                status=ShotStatus.SHOT,
                characters=["韩梅梅"],
                costumes={},
                props=[],
                shot_date="2026-05-01"
            )
        ]
        
        project.screenshots = [
            ScreenshotItem(
                file_path="/test/1-01_01.jpg",
                scene_id="1-01",
                shot_number="1"
            )
        ]
        
        self.engine.check_missing_screenshots(project)
        
        missing_issues = [i for i in project.issues if i.category == IssueCategory.MISSING_SCREENSHOT]
        self.assertGreater(len(missing_issues), 0)
        
        missing_2 = any("2" in i.shot_number for i in missing_issues)
        self.assertTrue(missing_2)
    
    def test_naming_consistency_check(self):
        """测试命名一致性检查"""
        project = self.create_basic_project()
        
        project.call_sheet_entries = [
            CallSheetEntry(
                scene_id="1-01",
                shot_number="1",
                description="测试",
                characters=[],
                props=[]
            ),
            CallSheetEntry(
                scene_id="1-01",
                shot_number="2",
                description="测试2",
                characters=[],
                props=[]
            )
        ]
        
        project.script_notes = [
            ScriptNote(
                scene_id="1-01",
                shot_number="1",
                take=1,
                status=ShotStatus.SHOT,
                characters=[],
                costumes={},
                props=[],
                shot_date="2026-05-01"
            ),
            ScriptNote(
                scene_id="1-02",
                shot_number="1",
                take=1,
                status=ShotStatus.SHOT,
                characters=[],
                costumes={},
                props=[],
                shot_date="2026-05-01"
            )
        ]
        
        self.engine.check_naming_consistency(project)
        
        naming_issues = [i for i in project.issues if i.category == IssueCategory.NAMING_INCONSISTENCY]
        self.assertGreater(len(naming_issues), 0)
    
    def test_prop_continuity_check(self):
        """测试道具连续性检查"""
        project = self.create_basic_project()
        
        project.script_notes = [
            ScriptNote(
                scene_id="1-01",
                shot_number="1",
                take=1,
                status=ShotStatus.SHOT,
                characters=["李雷"],
                costumes={},
                props=["旧照片"],
                shot_date="2026-05-01"
            ),
            ScriptNote(
                scene_id="1-01",
                shot_number="2",
                take=1,
                status=ShotStatus.SHOT,
                characters=["李雷"],
                costumes={},
                props=[],
                shot_date="2026-05-01"
            )
        ]
        
        project.prop_rules = [
            PropRule(
                prop_name="旧照片",
                scene_id="1-*",
                required=True
            )
        ]
        
        self.engine.check_prop_continuity(project)
        
        prop_issues = [i for i in project.issues if i.category == IssueCategory.PROP_CONTINUITY]
        self.assertGreater(len(prop_issues), 0)
    
    def test_reshoot_conflicts_check(self):
        """测试跨天补拍冲突检查"""
        project = self.create_basic_project()
        
        project.script_notes = [
            ScriptNote(
                scene_id="1-01",
                shot_number="1",
                take=1,
                status=ShotStatus.SHOT,
                characters=["李雷"],
                costumes={"李雷": "蓝色西装"},
                props=[],
                shot_date="2026-05-01"
            ),
            ScriptNote(
                scene_id="1-01",
                shot_number="1",
                take=2,
                status=ShotStatus.RESHOOT,
                characters=["李雷"],
                costumes={"李雷": "灰色西装"},
                props=[],
                shot_date="2026-05-02"
            )
        ]
        
        self.engine.check_reshoot_conflicts(project)
        
        reshoot_issues = [i for i in project.issues if i.category == IssueCategory.RESHOOT_CONFLICT]
        self.assertGreater(len(reshoot_issues), 0)
    
    def test_scene_order_check(self):
        """测试场次顺序检查"""
        project = self.create_basic_project()
        
        project.call_sheet_entries = [
            CallSheetEntry(
                scene_id="1-01",
                shot_number="3",
                description="镜头3",
                characters=[],
                props=[]
            ),
            CallSheetEntry(
                scene_id="1-01",
                shot_number="1",
                description="镜头1",
                characters=[],
                props=[]
            ),
            CallSheetEntry(
                scene_id="1-01",
                shot_number="2",
                description="镜头2",
                characters=[],
                props=[]
            )
        ]
        
        self.engine.check_scene_order(project)
        
        order_issues = [i for i in project.issues if i.category == IssueCategory.SCENE_ORDER]
        self.assertGreater(len(order_issues), 0)
    
    def test_costume_rule_matching(self):
        """测试服装规则匹配"""
        self.assertTrue(self.engine._costumes_match("蓝色西装+白衬衫", "蓝色西装白衬衫"))
        self.assertTrue(self.engine._costumes_match("蓝色西装", "蓝色西装（备注）"))
        self.assertFalse(self.engine._costumes_match("蓝色西装", "灰色西装"))
    
    def test_scene_matching(self):
        """测试场景匹配"""
        self.assertTrue(self.engine._scene_matches_rule("1-01", "1-*"))
        self.assertTrue(self.engine._scene_matches_rule("1-02", "1-*"))
        self.assertFalse(self.engine._scene_matches_rule("2-01", "1-*"))
        self.assertTrue(self.engine._scene_matches_rule("1-01", "1-01"))
        self.assertFalse(self.engine._scene_matches_rule("1-02", "1-01"))


if __name__ == '__main__':
    unittest.main()

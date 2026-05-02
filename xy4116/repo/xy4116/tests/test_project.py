#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
项目测试模块
测试所有核心功能
"""

import os
import tempfile
import unittest
from datetime import time

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.models import (
    Microphone, ScheduleEntry, ForbiddenBand, ChannelInfo,
    RiskItem, RehearsalPlan, RiskLevel, RiskType
)
from src.frequency_rules import FrequencyRuleEngine
from src.timeline_state import TimelineStateManager
from src.persistence import PlanPersistence
from src.import_export import DataImporter, DataExporter
from src.sample_data import create_sample_plan


class TestModels(unittest.TestCase):
    """测试数据模型"""
    
    def test_microphone_creation(self):
        """测试麦克风创建"""
        mic = Microphone(
            device_id="MIC-001",
            actor_name="测试演员",
            frequency=640.0,
            channel="CH-01",
            battery_level=85.0
        )
        
        self.assertEqual(mic.device_id, "MIC-001")
        self.assertEqual(mic.actor_name, "测试演员")
        self.assertEqual(mic.frequency, 640.0)
        self.assertEqual(mic.battery_level, 85.0)
    
    def test_microphone_dict_conversion(self):
        """测试麦克风字典转换"""
        mic = Microphone(
            device_id="MIC-001",
            actor_name="测试演员",
            frequency=640.5,
            backup_frequency=650.0
        )
        
        data = mic.to_dict()
        mic2 = Microphone.from_dict(data)
        
        self.assertEqual(mic.device_id, mic2.device_id)
        self.assertEqual(mic.actor_name, mic2.actor_name)
        self.assertEqual(mic.frequency, mic2.frequency)
        self.assertEqual(mic.backup_frequency, mic2.backup_frequency)
    
    def test_rehearsal_plan_creation(self):
        """测试彩排方案创建"""
        plan = RehearsalPlan(name="测试方案")
        
        mic = Microphone(actor_name="演员1")
        plan.microphones.append(mic)
        
        schedule = ScheduleEntry(scene_name="场景1")
        plan.schedule.append(schedule)
        
        self.assertEqual(plan.name, "测试方案")
        self.assertEqual(len(plan.microphones), 1)
        self.assertEqual(len(plan.schedule), 1)


class TestFrequencyRules(unittest.TestCase):
    """测试频率规则引擎"""
    
    def setUp(self):
        self.engine = FrequencyRuleEngine()
    
    def test_frequency_spacing_conflict(self):
        """测试频率间隔冲突检测"""
        mics = [
            Microphone(actor_name="演员1", frequency=640.0, is_backup=False),
            Microphone(actor_name="演员2", frequency=640.1, is_backup=False),
        ]
        
        risks = self.engine.check_frequency_spacing(mics)
        
        self.assertEqual(len(risks), 1)
        self.assertEqual(risks[0].risk_type, RiskType.FREQUENCY_CONFLICT)
    
    def test_frequency_spacing_safe(self):
        """测试安全频率间隔"""
        mics = [
            Microphone(actor_name="演员1", frequency=640.0, is_backup=False),
            Microphone(actor_name="演员2", frequency=641.0, is_backup=False),
        ]
        
        risks = self.engine.check_frequency_spacing(mics)
        
        self.assertEqual(len(risks), 0)
    
    def test_forbidden_band_check(self):
        """测试禁用频段检查"""
        mics = [
            Microphone(actor_name="演员1", frequency=640.5, is_backup=False),
        ]
        
        forbidden = [
            ForbiddenBand(name="测试频段", start_freq=640.0, end_freq=641.0, reason="测试")
        ]
        
        risks = self.engine.check_forbidden_bands(mics, forbidden)
        
        self.assertEqual(len(risks), 1)
        self.assertEqual(risks[0].risk_type, RiskType.FORBIDDEN_BAND)
        self.assertEqual(risks[0].level, RiskLevel.CRITICAL)
    
    def test_low_battery_check(self):
        """测试低电量检查"""
        mics = [
            Microphone(actor_name="演员1", battery_level=10.0, is_backup=False),
            Microphone(actor_name="演员2", battery_level=25.0, is_backup=False),
            Microphone(actor_name="演员3", battery_level=50.0, is_backup=False),
        ]
        
        risks = self.engine.check_battery_level(mics)
        
        self.assertEqual(len(risks), 2)
        
        critical = [r for r in risks if r.level == RiskLevel.CRITICAL]
        high = [r for r in risks if r.level == RiskLevel.HIGH]
        
        self.assertEqual(len(critical), 1)
        self.assertEqual(len(high), 1)
    
    def test_third_order_intermodulation(self):
        """测试三阶互调检测"""
        mics = [
            Microphone(actor_name="演员1", frequency=640.0, is_backup=False),
            Microphone(actor_name="演员2", frequency=641.0, is_backup=False),
            Microphone(actor_name="演员3", frequency=639.0, is_backup=False),
        ]
        
        risks = self.engine.check_third_order_intermodulation(mics)
        
        self.assertGreater(len(risks), 0)
    
    def test_backup_availability(self):
        """测试备用通道检查"""
        mics = [
            Microphone(actor_name="演员1", is_backup=False, backup_frequency=None),
            Microphone(actor_name="演员2", is_backup=False, backup_frequency=650.0),
        ]
        
        channels = [
            ChannelInfo(channel_name="CH-01", is_available=True),
        ]
        
        risks = self.engine.check_backup_availability(mics, channels)
        
        no_backup_risks = [r for r in risks if r.risk_type == RiskType.NO_BACKUP]
        self.assertGreater(len(no_backup_risks), 0)


class TestTimelineState(unittest.TestCase):
    """测试时间线状态管理"""
    
    def setUp(self):
        self.manager = TimelineStateManager()
    
    def test_overlapping_scenes(self):
        """测试重叠场景检测"""
        mics = [
            Microphone(id="mic1", actor_name="演员1", frequency=640.0, is_backup=False),
            Microphone(id="mic2", actor_name="演员2", frequency=640.1, is_backup=False),
        ]
        
        schedule = [
            ScheduleEntry(
                scene_name="场景1",
                start_time=time(19, 0),
                end_time=time(19, 30),
                actor_names=["演员1"],
                mic_ids=["mic1"]
            ),
            ScheduleEntry(
                scene_name="场景2",
                start_time=time(19, 15),
                end_time=time(19, 45),
                actor_names=["演员2"],
                mic_ids=["mic2"]
            ),
        ]
        
        risks = self.manager.check_overlapping_scenes(schedule, mics)
        
        self.assertGreater(len(risks), 0)
    
    def test_get_scene_mics(self):
        """测试获取场景麦克风"""
        mics = [
            Microphone(id="mic1", actor_name="演员1"),
            Microphone(id="mic2", actor_name="演员2"),
        ]
        
        entry = ScheduleEntry(
            scene_name="场景1",
            actor_names=["演员1"],
            mic_ids=["mic1"]
        )
        
        scene_mics = self.manager.get_scene_mics(entry, mics)
        
        self.assertEqual(len(scene_mics), 1)
        self.assertEqual(scene_mics[0].actor_name, "演员1")


class TestPersistence(unittest.TestCase):
    """测试持久化"""
    
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.persistence = PlanPersistence(self.temp_dir)
    
    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_save_and_load_plan(self):
        """测试保存和加载方案"""
        plan = create_sample_plan()
        original_name = plan.name
        original_mic_count = len(plan.microphones)
        
        filepath = self.persistence.save_plan(plan)
        
        self.assertTrue(os.path.exists(filepath))
        
        loaded_plan = self.persistence.load_plan(filepath)
        
        self.assertEqual(loaded_plan.name, original_name)
        self.assertEqual(len(loaded_plan.microphones), original_mic_count)
    
    def test_list_saved_plans(self):
        """测试列出保存的方案"""
        plan = RehearsalPlan(name="测试方案")
        self.persistence.save_plan(plan)
        
        plans = self.persistence.list_saved_plans()
        
        self.assertGreater(len(plans), 0)
        self.assertEqual(plans[0]["name"], "测试方案")


class TestImportExport(unittest.TestCase):
    """测试导入导出"""
    
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_export_markdown_report(self):
        """测试导出Markdown报告"""
        plan = create_sample_plan()
        
        engine = FrequencyRuleEngine()
        risks = engine.check_all(
            plan.microphones,
            plan.forbidden_bands,
            plan.channels
        )
        plan.risks = risks
        
        filepath = os.path.join(self.temp_dir, "report.md")
        
        DataExporter.export_markdown_report(plan, filepath, plan.risks)
        
        self.assertTrue(os.path.exists(filepath))
        
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        self.assertIn(plan.name, content)
        self.assertIn("风险", content)
    
    def test_export_risk_csv(self):
        """测试导出风险CSV"""
        plan = create_sample_plan()
        
        engine = FrequencyRuleEngine()
        risks = engine.check_all(
            plan.microphones,
            plan.forbidden_bands,
            plan.channels
        )
        
        filepath = os.path.join(self.temp_dir, "risks.csv")
        
        DataExporter.export_risk_csv(risks, filepath, plan.microphones)
        
        self.assertTrue(os.path.exists(filepath))


class TestSampleData(unittest.TestCase):
    """测试示例数据"""
    
    def test_create_sample_plan(self):
        """测试创建示例方案"""
        plan = create_sample_plan()
        
        self.assertIsNotNone(plan)
        self.assertGreater(len(plan.microphones), 0)
        self.assertGreater(len(plan.schedule), 0)
        self.assertGreater(len(plan.forbidden_bands), 0)
        self.assertGreater(len(plan.channels), 0)
        
        self.assertIn("茶馆", plan.name)


class TestFullWorkflow(unittest.TestCase):
    """测试完整工作流"""
    
    def test_complete_check_workflow(self):
        """测试完整检查流程"""
        plan = create_sample_plan()
        
        engine = FrequencyRuleEngine()
        timeline_manager = TimelineStateManager()
        
        freq_risks = engine.check_all(
            plan.microphones,
            plan.forbidden_bands,
            plan.channels
        )
        
        timeline_risks = timeline_manager.check_all(
            plan.schedule,
            plan.microphones
        )
        
        all_risks = freq_risks + timeline_risks
        
        self.assertGreater(len(all_risks), 0)
        
        plan.risks = all_risks
        
        unresolved = [r for r in all_risks if not r.is_resolved]
        self.assertGreater(len(unresolved), 0)
        
        for risk in all_risks:
            risk.is_resolved = True
        
        all_resolved = all([r.is_resolved for r in all_risks])
        self.assertTrue(all_resolved)


if __name__ == '__main__':
    unittest.main(verbosity=2)

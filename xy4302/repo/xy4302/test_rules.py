import unittest
from datetime import datetime

from models import (
    Actor, Prop, Scene, PropUsage, Cue, ShowData, Alert,
    AlertType, CheckStatus
)
from rules import (
    PropConflictChecker, ActorPresenceChecker, PhotoChecker,
    TransitionTimeChecker, RuleEngine
)


class TestPropConflictChecker(unittest.TestCase):
    
    def setUp(self):
        self.show_data = ShowData()
        
        scene1 = Scene(id="scene_1", name="开场", act=1, scene_number=1)
        scene2 = Scene(id="scene_2", name="中场", act=1, scene_number=2)
        
        self.show_data.scenes = {
            "scene_1": scene1,
            "scene_2": scene2
        }
        
        self.show_data.props = {
            "prop_1": Prop(id="prop_1", name="茶壶")
        }
        
    def test_prop_conflict_detection(self):
        scene1 = self.show_data.scenes["scene_1"]
        scene2 = self.show_data.scenes["scene_2"]
        
        scene1.props = [
            PropUsage(prop_id="prop_1", prop_name="茶壶", usage_type="上场",
                      scene_id="scene_1", scene_name="开场")
        ]
        scene2.props = [
            PropUsage(prop_id="prop_1", prop_name="茶壶", usage_type="上场",
                      scene_id="scene_2", scene_name="中场")
        ]
        
        checker = PropConflictChecker()
        alerts = checker.check(self.show_data)
        
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0].alert_type, AlertType.PROP_CONFLICT)
        
    def test_no_conflict_with_exit(self):
        scene1 = self.show_data.scenes["scene_1"]
        scene2 = self.show_data.scenes["scene_2"]
        
        scene1.props = [
            PropUsage(prop_id="prop_1", prop_name="茶壶", usage_type="上场",
                      scene_id="scene_1", scene_name="开场")
        ]
        scene2.props = [
            PropUsage(prop_id="prop_1", prop_name="茶壶", usage_type="撤场",
                      scene_id="scene_2", scene_name="中场")
        ]
        
        checker = PropConflictChecker()
        alerts = checker.check(self.show_data)
        
        self.assertEqual(len(alerts), 0)


class TestActorPresenceChecker(unittest.TestCase):
    
    def setUp(self):
        self.show_data = ShowData()
        
        self.show_data.actors = {
            "actor_1": Actor(id="actor_1", name="王利发", is_present=True),
            "actor_2": Actor(id="actor_2", name="秦仲义", is_present=False)
        }
        
        scene1 = Scene(id="scene_1", name="开场", act=1, scene_number=1)
        self.show_data.scenes = {"scene_1": scene1}
        
    def test_actor_missing_with_cue(self):
        scene1 = self.show_data.scenes["scene_1"]
        scene1.cues = [
            Cue(id="cue_1", scene_id="scene_1", cue_type="演员",
                content="秦仲义上场", actor_id="actor_2", actor_name="秦仲义")
        ]
        
        checker = ActorPresenceChecker()
        alerts = checker.check(self.show_data)
        
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0].alert_type, AlertType.ACTOR_MISSING)
        
    def test_actor_missing_with_prop(self):
        scene1 = self.show_data.scenes["scene_1"]
        scene1.props = [
            PropUsage(prop_id="prop_1", prop_name="账本", usage_type="上场",
                      scene_id="scene_1", scene_name="开场",
                      actor_id="actor_2", actor_name="秦仲义")
        ]
        
        checker = ActorPresenceChecker()
        alerts = checker.check(self.show_data)
        
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0].alert_type, AlertType.ACTOR_MISSING)
        
    def test_present_actor_no_alert(self):
        scene1 = self.show_data.scenes["scene_1"]
        scene1.cues = [
            Cue(id="cue_1", scene_id="scene_1", cue_type="演员",
                content="王利发上场", actor_id="actor_1", actor_name="王利发")
        ]
        
        checker = ActorPresenceChecker()
        alerts = checker.check(self.show_data)
        
        self.assertEqual(len(alerts), 0)


class TestPhotoChecker(unittest.TestCase):
    
    def setUp(self):
        self.show_data = ShowData()
        
        scene1 = Scene(id="scene_1", name="开场", act=1, scene_number=1)
        self.show_data.scenes = {"scene_1": scene1}
        
    def test_photo_missing(self):
        self.show_data.props = {
            "prop_1": Prop(id="prop_1", name="茶壶", photo_path=None)
        }
        
        scene1 = self.show_data.scenes["scene_1"]
        scene1.props = [
            PropUsage(prop_id="prop_1", prop_name="茶壶", usage_type="上场",
                      scene_id="scene_1", scene_name="开场")
        ]
        
        checker = PhotoChecker()
        alerts = checker.check(self.show_data)
        
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0].alert_type, AlertType.PHOTO_MISSING)
        
    def test_photo_present_no_alert(self):
        self.show_data.props = {
            "prop_1": Prop(id="prop_1", name="茶壶", photo_path="/path/to/photo.jpg")
        }
        
        scene1 = self.show_data.scenes["scene_1"]
        scene1.props = [
            PropUsage(prop_id="prop_1", prop_name="茶壶", usage_type="上场",
                      scene_id="scene_1", scene_name="开场")
        ]
        
        checker = PhotoChecker()
        alerts = checker.check(self.show_data)
        
        self.assertEqual(len(alerts), 0)


class TestTransitionTimeChecker(unittest.TestCase):
    
    def setUp(self):
        self.show_data = ShowData()
        
        scene1 = Scene(id="scene_1", name="开场", act=1, scene_number=1)
        scene2 = Scene(id="scene_2", name="中场", act=1, scene_number=2)
        
        self.show_data.scenes = {
            "scene_1": scene1,
            "scene_2": scene2
        }
        
    def test_complex_transition_alert(self):
        scene1 = self.show_data.scenes["scene_1"]
        scene2 = self.show_data.scenes["scene_2"]
        
        scene1.props = [
            PropUsage(prop_id=f"prop_{i}", prop_name=f"道具{i}", usage_type="上场",
                      scene_id="scene_1", scene_name="开场")
            for i in range(5)
        ]
        
        scene2.props = [
            PropUsage(prop_id=f"prop_{i+10}", prop_name=f"新道具{i}", usage_type="上场",
                      scene_id="scene_2", scene_name="中场")
            for i in range(5)
        ]
        
        checker = TransitionTimeChecker(min_transition_seconds=60)
        alerts = checker.check(self.show_data)
        
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0].alert_type, AlertType.TRANSITION_SHORT)


class TestRuleEngine(unittest.TestCase):
    
    def setUp(self):
        self.show_data = ShowData()
        
        scene1 = Scene(id="scene_1", name="开场", act=1, scene_number=1)
        scene2 = Scene(id="scene_2", name="中场", act=1, scene_number=2)
        
        self.show_data.scenes = {
            "scene_1": scene1,
            "scene_2": scene2
        }
        
        self.show_data.actors = {
            "actor_1": Actor(id="actor_1", name="王利发", is_present=True),
            "actor_2": Actor(id="actor_2", name="秦仲义", is_present=False)
        }
        
        self.show_data.props = {
            "prop_1": Prop(id="prop_1", name="茶壶"),
            "prop_2": Prop(id="prop_2", name="账本", photo_path="/path/to/photo.jpg")
        }
        
    def test_run_all_checks(self):
        scene1 = self.show_data.scenes["scene_1"]
        scene2 = self.show_data.scenes["scene_2"]
        
        scene1.props = [
            PropUsage(prop_id="prop_1", prop_name="茶壶", usage_type="上场",
                      scene_id="scene_1", scene_name="开场")
        ]
        scene2.props = [
            PropUsage(prop_id="prop_1", prop_name="茶壶", usage_type="上场",
                      scene_id="scene_2", scene_name="中场",
                      actor_id="actor_2", actor_name="秦仲义")
        ]
        
        scene2.cues = [
            Cue(id="cue_1", scene_id="scene_2", cue_type="演员",
                content="秦仲义上场", actor_id="actor_2", actor_name="秦仲义")
        ]
        
        engine = RuleEngine()
        alerts = engine.run_all_checks(self.show_data)
        
        self.assertGreater(len(alerts), 0)
        
    def test_filter_alerts(self):
        self.show_data.alerts = [
            Alert(alert_type=AlertType.PROP_CONFLICT, message="冲突1", resolved=False),
            Alert(alert_type=AlertType.ACTOR_MISSING, message="演员缺失", resolved=False),
            Alert(alert_type=AlertType.PROP_CONFLICT, message="冲突2", resolved=True),
        ]
        
        engine = RuleEngine()
        
        filtered = engine.filter_alerts(
            self.show_data.alerts,
            alert_types=[AlertType.PROP_CONFLICT]
        )
        self.assertEqual(len(filtered), 2)
        
        filtered = engine.filter_alerts(
            self.show_data.alerts,
            resolved=False
        )
        self.assertEqual(len(filtered), 2)
        
    def test_alert_stats(self):
        self.show_data.alerts = [
            Alert(alert_type=AlertType.PROP_CONFLICT, message="冲突1", check_status=CheckStatus.CHECKED),
            Alert(alert_type=AlertType.PROP_CONFLICT, message="冲突2", check_status=CheckStatus.PENDING),
            Alert(alert_type=AlertType.ACTOR_MISSING, message="演员缺失"),
        ]
        
        engine = RuleEngine()
        stats = engine.get_alert_stats(self.show_data.alerts)
        
        self.assertEqual(stats["total"], 3)
        self.assertEqual(stats["by_type"]["prop_conflict"], 2)
        self.assertEqual(stats["by_type"]["actor_missing"], 1)


if __name__ == '__main__':
    unittest.main()

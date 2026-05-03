import unittest
from datetime import datetime

from models import (
    Actor, Prop, Scene, PropUsage, Cue, Transition, Alert, ShowData,
    AlertType, CheckStatus
)


class TestModels(unittest.TestCase):
    
    def test_actor_creation(self):
        actor = Actor(id="actor_1", name="王利发", is_present=True, notes="茶馆老板")
        self.assertEqual(actor.id, "actor_1")
        self.assertEqual(actor.name, "王利发")
        self.assertTrue(actor.is_present)
        self.assertEqual(actor.notes, "茶馆老板")
        
    def test_actor_absent(self):
        actor = Actor(id="actor_2", name="秦仲义", is_present=False)
        self.assertFalse(actor.is_present)
        
    def test_prop_creation(self):
        prop = Prop(id="prop_1", name="茶壶", photo_path="/path/to/photo.jpg")
        self.assertEqual(prop.id, "prop_1")
        self.assertEqual(prop.name, "茶壶")
        self.assertEqual(prop.photo_path, "/path/to/photo.jpg")
        
    def test_scene_creation(self):
        scene = Scene(
            id="scene_1",
            name="开场 - 茶馆清晨",
            act=1,
            scene_number=1,
            duration=15
        )
        self.assertEqual(scene.id, "scene_1")
        self.assertEqual(scene.act, 1)
        self.assertEqual(scene.scene_number, 1)
        self.assertEqual(scene.duration, 15)
        
    def test_prop_usage(self):
        usage = PropUsage(
            prop_id="prop_1",
            prop_name="茶壶",
            usage_type="上场",
            scene_id="scene_1",
            scene_name="开场",
            actor_id="actor_1",
            actor_name="王利发",
            check_status=CheckStatus.PENDING
        )
        self.assertEqual(usage.prop_id, "prop_1")
        self.assertEqual(usage.usage_type, "上场")
        self.assertEqual(usage.check_status, CheckStatus.PENDING)
        
    def test_cue_creation(self):
        cue = Cue(
            id="cue_1",
            scene_id="scene_1",
            cue_type="灯光",
            content="开场灯光渐亮"
        )
        self.assertEqual(cue.cue_type, "灯光")
        self.assertEqual(cue.content, "开场灯光渐亮")
        
    def test_alert_creation(self):
        alert = Alert(
            alert_type=AlertType.PROP_CONFLICT,
            message="道具冲突: 茶壶在两个场景同时上场",
            scene_id="scene_2",
            prop_id="prop_1"
        )
        self.assertEqual(alert.alert_type, AlertType.PROP_CONFLICT)
        self.assertFalse(alert.resolved)
        self.assertEqual(alert.check_status, CheckStatus.PENDING)
        
    def test_show_data_creation(self):
        show_data = ShowData(show_name="《茶馆》第一幕")
        self.assertEqual(show_data.show_name, "《茶馆》第一幕")
        self.assertEqual(len(show_data.scenes), 0)
        self.assertEqual(len(show_data.actors), 0)
        self.assertEqual(len(show_data.props), 0)
        
    def test_check_status_enum(self):
        self.assertEqual(CheckStatus.PENDING.value, "pending")
        self.assertEqual(CheckStatus.CHECKED.value, "checked")
        self.assertEqual(CheckStatus.ISSUE.value, "issue")
        
    def test_alert_type_enum(self):
        self.assertEqual(AlertType.PROP_CONFLICT.value, "prop_conflict")
        self.assertEqual(AlertType.ACTOR_MISSING.value, "actor_missing")
        self.assertEqual(AlertType.PHOTO_MISSING.value, "photo_missing")
        self.assertEqual(AlertType.TRANSITION_SHORT.value, "transition_short")


if __name__ == '__main__':
    unittest.main()

import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.algorithms.collision_avoidance import (
    CollisionDetectionSystem,
    CollisionAvoidanceSystem,
    NarrowPassageManager,
    RiskLevel,
    RobotState
)


class TestCollisionDetectionSystem:
    
    def setup_method(self):
        self.detector = CollisionDetectionSystem(
            safety_distance=2.0,
            warning_distance=4.0,
            robot_radius=0.5
        )
    
    def test_calculate_distance(self):
        pos1 = (0.0, 0.0)
        pos2 = (3.0, 4.0)
        
        distance = self.detector.calculate_distance(pos1, pos2)
        
        assert distance == pytest.approx(5.0)
    
    def test_calculate_distance_zero(self):
        pos1 = (1.0, 2.0)
        pos2 = (1.0, 2.0)
        
        distance = self.detector.calculate_distance(pos1, pos2)
        
        assert distance == 0.0
    
    def test_predict_position_stationary(self):
        robot = RobotState(
            id="R001",
            x=0.0,
            y=0.0,
            vx=0.0,
            vy=0.0,
            orientation=0.0,
            radius=0.5,
            status="idle",
            path=[],
            current_path_index=0
        )
        
        new_pos = self.detector.predict_position(robot, 1.0)
        
        assert new_pos[0] == pytest.approx(0.0)
        assert new_pos[1] == pytest.approx(0.0)
    
    def test_predict_position_with_path(self):
        robot = RobotState(
            id="R001",
            x=0.0,
            y=0.0,
            vx=1.0,
            vy=0.0,
            orientation=0.0,
            radius=0.5,
            status="moving",
            path=[(0.0, 0.0), (5.0, 0.0), (5.0, 5.0)],
            current_path_index=1
        )
        
        new_pos = self.detector.predict_position(robot, 2.0)
        
        assert new_pos[0] == pytest.approx(5.0)
        assert new_pos[1] == pytest.approx(0.0)
    
    def test_check_pair_collision_no_risk(self):
        robot1 = RobotState(
            id="R001",
            x=0.0,
            y=0.0,
            vx=0.0,
            vy=0.0,
            orientation=0.0,
            radius=0.5,
            status="idle",
            path=[]
        )
        
        robot2 = RobotState(
            id="R002",
            x=10.0,
            y=10.0,
            vx=0.0,
            vy=0.0,
            orientation=0.0,
            radius=0.5,
            status="idle",
            path=[]
        )
        
        risk = self.detector.check_pair_collision(robot1, robot2)
        
        assert risk is None
    
    def test_check_pair_collision_critical(self):
        robot1 = RobotState(
            id="R001",
            x=0.0,
            y=0.0,
            vx=1.0,
            vy=0.0,
            orientation=0.0,
            radius=0.5,
            status="moving",
            path=[(0.0, 0.0), (10.0, 0.0)]
        )
        
        robot2 = RobotState(
            id="R002",
            x=3.0,
            y=0.0,
            vx=-1.0,
            vy=0.0,
            orientation=180.0,
            radius=0.5,
            status="moving",
            path=[(3.0, 0.0), (-10.0, 0.0)]
        )
        
        risk = self.detector.check_pair_collision(robot1, robot2)
        
        assert risk is not None
        assert risk.risk_level == RiskLevel.CRITICAL
    
    def test_detect_all_collisions(self):
        robot1 = RobotState(
            id="R001",
            x=0.0,
            y=0.0,
            vx=0.0,
            vy=0.0,
            orientation=0.0,
            radius=0.5,
            status="idle",
            path=[]
        )
        
        robot2 = RobotState(
            id="R002",
            x=20.0,
            y=0.0,
            vx=0.0,
            vy=0.0,
            orientation=0.0,
            radius=0.5,
            status="idle",
            path=[]
        )
        
        robot3 = RobotState(
            id="R003",
            x=2.5,
            y=2.5,
            vx=0.0,
            vy=0.0,
            orientation=0.0,
            radius=0.5,
            status="idle",
            path=[]
        )
        
        robots = [robot1, robot2, robot3]
        risks = self.detector.detect_all_collisions(robots)
        
        assert isinstance(risks, list)


class TestCollisionAvoidanceSystem:
    
    def setup_method(self):
        self.avoider = CollisionAvoidanceSystem(
            safety_distance=2.0,
            robot_radius=0.5
        )
    
    def test_resolve_collision_critical(self):
        class MockRisk:
            risk_level = RiskLevel.CRITICAL
            robot1_id = "R001"
            robot2_id = "R002"
        
        robots = {
            "R001": RobotState(
                id="R001",
                x=0.0,
                y=0.0,
                vx=1.0,
                vy=0.0,
                orientation=0.0,
                radius=0.5,
                status="moving",
                path=[]
            ),
            "R002": RobotState(
                id="R002",
                x=3.0,
                y=0.0,
                vx=-1.0,
                vy=0.0,
                orientation=180.0,
                radius=0.5,
                status="moving",
                path=[]
            )
        }
        
        actions = self.avoider.resolve_collision(MockRisk(), robots)
        
        assert "R001" in actions
        assert "R002" in actions
        assert actions["R001"]["action"] == "STOP"
        assert actions["R002"]["action"] == "STOP"
    
    def test_determine_priority(self):
        robot1 = RobotState(
            id="R001",
            x=0.0,
            y=0.0,
            vx=0.0,
            vy=0.0,
            orientation=0.0,
            radius=0.5,
            status="charging",
            path=[]
        )
        
        robot2 = RobotState(
            id="R002",
            x=3.0,
            y=0.0,
            vx=0.0,
            vy=0.0,
            orientation=0.0,
            radius=0.5,
            status="moving",
            path=[]
        )
        
        priority = self.avoider._determine_priority(robot1, robot2)
        
        assert priority == "R001"


class TestNarrowPassageManager:
    
    def setup_method(self):
        self.manager = NarrowPassageManager(
            passage_width_threshold=2.0,
            safety_margin=0.5
        )
    
    def test_register_narrow_passage(self):
        self.manager.register_narrow_passage(
            passage_id="P001",
            start_pos=(0.0, 0.0),
            end_pos=(10.0, 0.0),
            width=1.5
        )
        
        assert "P001" in self.manager.passage_registry
        passage = self.manager.passage_registry["P001"]
        assert passage["is_occupied"] == False
    
    def test_request_passage_available(self):
        self.manager.register_narrow_passage(
            passage_id="P001",
            start_pos=(0.0, 0.0),
            end_pos=(10.0, 0.0),
            width=1.5
        )
        
        result = self.manager.request_passage("P001", "R001")
        
        assert result["allowed"] == True
        assert self.manager.passage_registry["P001"]["is_occupied"] == True
        assert self.manager.passage_registry["P001"]["current_robot"] == "R001"
    
    def test_request_passage_occupied(self):
        self.manager.register_narrow_passage(
            passage_id="P001",
            start_pos=(0.0, 0.0),
            end_pos=(10.0, 0.0),
            width=1.5
        )
        
        self.manager.request_passage("P001", "R001")
        result = self.manager.request_passage("P001", "R002")
        
        assert result["allowed"] == False
        assert result["queue_position"] == 1
    
    def test_release_passage(self):
        self.manager.register_narrow_passage(
            passage_id="P001",
            start_pos=(0.0, 0.0),
            end_pos=(10.0, 0.0),
            width=1.5
        )
        
        self.manager.request_passage("P001", "R001")
        self.manager.request_passage("P001", "R002")
        
        result = self.manager.release_passage("P001", "R001")
        
        assert result["success"] == True
        assert self.manager.passage_registry["P001"]["current_robot"] == "R002"
    
    def test_release_passage_wrong_owner(self):
        self.manager.register_narrow_passage(
            passage_id="P001",
            start_pos=(0.0, 0.0),
            end_pos=(10.0, 0.0),
            width=1.5
        )
        
        self.manager.request_passage("P001", "R001")
        result = self.manager.release_passage("P001", "R002")
        
        assert result["success"] == False

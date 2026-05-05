import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.algorithms.pathfinding import PathfindingAlgorithm
from backend.app.algorithms.task_assignment import (
    TaskAssignmentAlgorithm,
    TaskAssignment,
    Robot as AssignmentRobot,
    Task as AssignmentTask
)


class TestTaskAssignmentAlgorithm:
    
    def setup_method(self):
        self.grid = [
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0]
        ]
        self.pathfinder = PathfindingAlgorithm(self.grid, grid_size=1)
        self.assignment = TaskAssignmentAlgorithm(self.pathfinder)
    
    def test_calculate_cost_idle_robot(self):
        robot = AssignmentRobot(
            id="R001",
            x=0.5,
            y=0.5,
            status="idle",
            battery=100.0,
            max_payload=50.0
        )
        
        task = AssignmentTask(
            id="T001",
            priority=3,
            start_x=2.5,
            start_y=2.5,
            end_x=4.5,
            end_y=4.5,
            cargo_weight=10.0
        )
        
        cost = self.assignment.calculate_cost(robot, task)
        
        assert cost > 0
        assert cost != float('inf')
    
    def test_calculate_cost_low_battery(self):
        robot = AssignmentRobot(
            id="R001",
            x=0.5,
            y=0.5,
            status="idle",
            battery=15.0,
            max_payload=50.0
        )
        
        task = AssignmentTask(
            id="T001",
            priority=3,
            start_x=2.5,
            start_y=2.5,
            end_x=4.5,
            end_y=4.5,
            cargo_weight=10.0
        )
        
        cost = self.assignment.calculate_cost(robot, task)
        
        assert cost == float('inf')
    
    def test_calculate_cost_overweight(self):
        robot = AssignmentRobot(
            id="R001",
            x=0.5,
            y=0.5,
            status="idle",
            battery=100.0,
            max_payload=10.0
        )
        
        task = AssignmentTask(
            id="T001",
            priority=3,
            start_x=2.5,
            start_y=2.5,
            end_x=4.5,
            end_y=4.5,
            cargo_weight=20.0
        )
        
        cost = self.assignment.calculate_cost(robot, task)
        
        assert cost == float('inf')
    
    def test_calculate_cost_busy_robot(self):
        robot = AssignmentRobot(
            id="R001",
            x=0.5,
            y=0.5,
            status="moving",
            battery=100.0,
            max_payload=50.0
        )
        
        task = AssignmentTask(
            id="T001",
            priority=3,
            start_x=2.5,
            start_y=2.5,
            end_x=4.5,
            end_y=4.5,
            cargo_weight=10.0
        )
        
        cost = self.assignment.calculate_cost(robot, task)
        
        assert cost == float('inf')
    
    def test_greedy_assignment_basic(self):
        robots = [
            AssignmentRobot(
                id="R001",
                x=0.5,
                y=0.5,
                status="idle",
                battery=100.0,
                max_payload=50.0
            ),
            AssignmentRobot(
                id="R002",
                x=5.5,
                y=5.5,
                status="idle",
                battery=100.0,
                max_payload=50.0
            )
        ]
        
        tasks = [
            AssignmentTask(
                id="T001",
                priority=3,
                start_x=1.5,
                start_y=1.5,
                end_x=3.5,
                end_y=3.5,
                cargo_weight=10.0
            ),
            AssignmentTask(
                id="T002",
                priority=3,
                start_x=4.5,
                start_y=4.5,
                end_x=2.5,
                end_y=2.5,
                cargo_weight=10.0
            )
        ]
        
        assignments = self.assignment.greedy_assignment(robots, tasks)
        
        assert len(assignments) >= 0
        
        robot_ids = set()
        task_ids = set()
        for a in assignments:
            robot_ids.add(a.robot_id)
            task_ids.add(a.task_id)
        
        assert len(robot_ids) == len(assignments)
        assert len(task_ids) == len(assignments)
    
    def test_greedy_assignment_priority(self):
        robots = [
            AssignmentRobot(
                id="R001",
                x=0.5,
                y=0.5,
                status="idle",
                battery=100.0,
                max_payload=50.0
            )
        ]
        
        tasks = [
            AssignmentTask(
                id="T_LOW",
                priority=5,
                start_x=1.5,
                start_y=1.5,
                end_x=2.5,
                end_y=2.5,
                cargo_weight=10.0
            ),
            AssignmentTask(
                id="T_HIGH",
                priority=1,
                start_x=1.5,
                start_y=1.5,
                end_x=2.5,
                end_y=2.5,
                cargo_weight=10.0
            )
        ]
        
        assignments = self.assignment.greedy_assignment(robots, tasks)
        
        assert len(assignments) == 1
        assert assignments[0].task_id == "T_HIGH"
    
    def test_auction_assignment(self):
        robots = [
            AssignmentRobot(
                id="R001",
                x=0.5,
                y=0.5,
                status="idle",
                battery=100.0,
                max_payload=50.0
            ),
            AssignmentRobot(
                id="R002",
                x=3.5,
                y=3.5,
                status="idle",
                battery=100.0,
                max_payload=50.0
            )
        ]
        
        tasks = [
            AssignmentTask(
                id="T001",
                priority=3,
                start_x=1.5,
                start_y=1.5,
                end_x=4.5,
                end_y=4.5,
                cargo_weight=10.0
            )
        ]
        
        assignments = self.assignment.auction_assignment(robots, tasks)
        
        assert len(assignments) == 1
        
        task = assignments[0]
        assert task.robot_id in ["R001", "R002"]
    
    def test_calculate_assignment_metrics(self):
        robot = AssignmentRobot(
            id="R001",
            x=0.5,
            y=0.5,
            status="idle",
            battery=100.0,
            max_payload=50.0
        )
        
        task = AssignmentTask(
            id="T001",
            priority=3,
            start_x=1.5,
            start_y=1.5,
            end_x=2.5,
            end_y=2.5,
            cargo_weight=10.0
        )
        
        assignments = [
            TaskAssignment(
                task_id="T001",
                robot_id="R001",
                cost=100.0,
                path=[(0.5, 0.5), (1.5, 1.5), (2.5, 2.5)]
            )
        ]
        
        metrics = self.assignment.calculate_assignment_metrics(assignments, [task])
        
        assert metrics["total_assigned"] == 1
        assert metrics["total_tasks"] == 1
        assert metrics["assignment_rate"] == 1.0
        assert metrics["average_cost"] == 100.0
        assert metrics["total_distance"] > 0
    
    def test_calculate_assignment_metrics_empty(self):
        metrics = self.assignment.calculate_assignment_metrics([], [])
        
        assert metrics["total_assigned"] == 0
        assert metrics["total_tasks"] == 0
        assert metrics["assignment_rate"] == 0.0
        assert metrics["average_cost"] == 0.0
        assert metrics["total_distance"] == 0.0

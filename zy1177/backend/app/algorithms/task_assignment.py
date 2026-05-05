from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
import math


@dataclass
class TaskAssignment:
    task_id: str
    robot_id: str
    cost: float
    path: List[Tuple[float, float]]


@dataclass
class Robot:
    id: str
    x: float
    y: float
    status: str
    battery: float
    max_payload: float


@dataclass
class Task:
    id: str
    priority: int
    start_x: float
    start_y: float
    end_x: float
    end_y: float
    cargo_weight: float
    deadline: Optional[float] = None


class TaskAssignmentAlgorithm:
    def __init__(self, pathfinder):
        self.pathfinder = pathfinder
    
    def calculate_cost(
        self, 
        robot: Robot, 
        task: Task,
        current_time: float = 0
    ) -> float:
        if robot.status not in ['idle', 'waiting']:
            return float('inf')
        
        if robot.battery < 20:
            return float('inf')
        
        if task.cargo_weight > robot.max_payload:
            return float('inf')
        
        path_to_start = self.pathfinder.a_star(
            (robot.x, robot.y),
            (task.start_x, task.start_y)
        )
        
        if not path_to_start:
            return float('inf')
        
        path_start_to_end = self.pathfinder.a_star(
            (task.start_x, task.start_y),
            (task.end_x, task.end_y)
        )
        
        if not path_start_to_end:
            return float('inf')
        
        distance_to_start = self.pathfinder.calculate_path_length(path_to_start)
        distance_task = self.pathfinder.calculate_path_length(path_start_to_end)
        total_distance = distance_to_start + distance_task
        
        time_penalty = 0
        if task.deadline:
            estimated_time = total_distance / 1.0
            if current_time + estimated_time > task.deadline:
                time_penalty = 1000
        
        priority_penalty = (10 - task.priority) * 10
        
        battery_penalty = (100 - robot.battery) * 0.5
        
        total_cost = (
            total_distance + 
            time_penalty + 
            priority_penalty + 
            battery_penalty
        )
        
        return total_cost
    
    def greedy_assignment(
        self,
        robots: List[Robot],
        tasks: List[Task],
        current_time: float = 0
    ) -> List[TaskAssignment]:
        assignments = []
        assigned_robots = set()
        assigned_tasks = set()
        
        cost_matrix = {}
        for robot in robots:
            if robot.id in assigned_robots:
                continue
            for task in tasks:
                if task.id in assigned_tasks:
                    continue
                cost = self.calculate_cost(robot, task, current_time)
                if cost < float('inf'):
                    cost_matrix[(robot.id, task.id)] = cost
        
        sorted_tasks = sorted(tasks, key=lambda t: -t.priority)
        
        for task in sorted_tasks:
            if task.id in assigned_tasks:
                continue
            
            best_robot = None
            best_cost = float('inf')
            best_path = None
            
            for robot in robots:
                if robot.id in assigned_robots:
                    continue
                
                cost_key = (robot.id, task.id)
                if cost_key in cost_matrix:
                    cost = cost_matrix[cost_key]
                    if cost < best_cost:
                        path_to_start = self.pathfinder.a_star(
                            (robot.x, robot.y),
                            (task.start_x, task.start_y)
                        )
                        path_task = self.pathfinder.a_star(
                            (task.start_x, task.start_y),
                            (task.end_x, task.end_y)
                        )
                        full_path = path_to_start + path_task
                        
                        best_cost = cost
                        best_robot = robot
                        best_path = full_path
            
            if best_robot and best_path:
                assignments.append(TaskAssignment(
                    task_id=task.id,
                    robot_id=best_robot.id,
                    cost=best_cost,
                    path=best_path
                ))
                assigned_robots.add(best_robot.id)
                assigned_tasks.add(task.id)
        
        return assignments
    
    def auction_assignment(
        self,
        robots: List[Robot],
        tasks: List[Task],
        current_time: float = 0
    ) -> List[TaskAssignment]:
        assignments = []
        
        for task in tasks:
            bids = []
            for robot in robots:
                cost = self.calculate_cost(robot, task, current_time)
                if cost < float('inf'):
                    bids.append((robot, -cost))
            
            if bids:
                bids.sort(key=lambda x: -x[1])
                winner = bids[0][0]
                
                path_to_start = self.pathfinder.a_star(
                    (winner.x, winner.y),
                    (task.start_x, task.start_y)
                )
                path_task = self.pathfinder.a_star(
                    (task.start_x, task.start_y),
                    (task.end_x, task.end_y)
                )
                full_path = path_to_start + path_task
                
                assignments.append(TaskAssignment(
                    task_id=task.id,
                    robot_id=winner.id,
                    cost=-bids[0][1],
                    path=full_path
                ))
                
                robots = [r for r in robots if r.id != winner.id]
        
        return assignments
    
    def calculate_assignment_metrics(
        self,
        assignments: List[TaskAssignment],
        tasks: List[Task]
    ) -> Dict:
        if not assignments:
            return {
                "total_assigned": 0,
                "total_tasks": len(tasks),
                "assignment_rate": 0.0,
                "average_cost": 0.0,
                "total_distance": 0.0
            }
        
        total_distance = sum(
            self.pathfinder.calculate_path_length(a.path) 
            for a in assignments
        )
        
        return {
            "total_assigned": len(assignments),
            "total_tasks": len(tasks),
            "assignment_rate": len(assignments) / len(tasks) if tasks else 0.0,
            "average_cost": sum(a.cost for a in assignments) / len(assignments),
            "total_distance": total_distance
        }

import json
import math
from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime
from sqlalchemy.orm import Session
import uuid

from ..models.warehouse_map import WarehouseMap
from ..models.robot import Robot, RobotStatus
from ..models.order import Order, OrderStatus
from ..models.task import Task, TaskStatus, TaskType
from ..models.scheduling_batch import (
    SchedulingBatch, 
    SchedulingStatus,
    SchedulingAlgorithm
)
from ..models.replay_frame import ReplayFrame, RobotState as FrameRobotState
from ..models.collision_risk import CollisionRisk, RiskLevel, RiskType
from ..algorithms.pathfinding import PathfindingAlgorithm
from ..algorithms.task_assignment import (
    TaskAssignmentAlgorithm,
    TaskAssignment,
    Robot as AssignmentRobot,
    Task as AssignmentTask
)
from ..algorithms.collision_avoidance import (
    CollisionDetectionSystem,
    CollisionAvoidanceSystem,
    NarrowPassageManager,
    RobotState as AlgorithmRobotState
)


class SchedulingService:
    def __init__(self, db: Session):
        self.db = db
        self.pathfinder = None
        self.assignment_algorithm = None
        self.collision_detector = None
        self.collision_avoider = None
        self.narrow_passage_manager = None
    
    def _initialize_algorithms(self, warehouse_map: WarehouseMap):
        map_data = json.loads(warehouse_map.map_data)
        grid = self._build_grid(map_data, warehouse_map.width, warehouse_map.height)
        
        self.pathfinder = PathfindingAlgorithm(grid, warehouse_map.grid_size)
        self.assignment_algorithm = TaskAssignmentAlgorithm(self.pathfinder)
        self.collision_detector = CollisionDetectionSystem(
            safety_distance=2.0,
            warning_distance=4.0,
            robot_radius=0.5
        )
        self.collision_avoider = CollisionAvoidanceSystem(
            safety_distance=2.0,
            robot_radius=0.5
        )
        self.narrow_passage_manager = NarrowPassageManager(
            passage_width_threshold=2.0
        )
        
        narrow_passages = map_data.get('narrow_passages', [])
        for i, passage in enumerate(narrow_passages):
            self.narrow_passage_manager.register_narrow_passage(
                passage_id=f"passage_{i}",
                start_pos=(passage.get('start_x', 0), passage.get('start_y', 0)),
                end_pos=(passage.get('end_x', 0), passage.get('end_y', 0)),
                width=passage.get('width', 1.5)
            )
    
    def _build_grid(self, map_data: Dict, width: int, height: int) -> List[List[int]]:
        grid = [[0 for _ in range(width)] for _ in range(height)]
        
        for shelf in map_data.get('shelves', []):
            x = int(shelf.get('x', 0))
            y = int(shelf.get('y', 0))
            shelf_width = int(shelf.get('width', 1))
            shelf_height = int(shelf.get('height', 1))
            
            for i in range(shelf_width):
                for j in range(shelf_height):
                    grid_y = y + j
                    grid_x = x + i
                    if 0 <= grid_y < height and 0 <= grid_x < width:
                        grid[grid_y][grid_x] = 1
        
        for obstacle in map_data.get('obstacles', []):
            x = int(obstacle.get('x', 0))
            y = int(obstacle.get('y', 0))
            if 0 <= y < height and 0 <= x < width:
                grid[y][x] = 2
        
        return grid
    
    def create_batch(
        self,
        warehouse_map_id: int,
        name: str,
        description: str = "",
        algorithm: str = "greedy"
    ) -> SchedulingBatch:
        warehouse_map = self.db.query(WarehouseMap).filter(
            WarehouseMap.id == warehouse_map_id
        ).first()
        
        if not warehouse_map:
            raise ValueError(f"Warehouse map with id {warehouse_map_id} not found")
        
        robots = self.db.query(Robot).filter(
            Robot.warehouse_map_id == warehouse_map_id,
            Robot.is_active == True
        ).all()
        
        orders = self.db.query(Order).filter(
            Order.warehouse_map_id == warehouse_map_id,
            Order.status == OrderStatus.PENDING
        ).all()
        
        try:
            algo_enum = SchedulingAlgorithm[algorithm.upper()]
        except KeyError:
            algo_enum = SchedulingAlgorithm.GREEDY
        
        batch = SchedulingBatch(
            batch_id=f"batch_{uuid.uuid4().hex[:8]}",
            name=name,
            description=description,
            warehouse_map_id=warehouse_map_id,
            algorithm=algo_enum,
            status=SchedulingStatus.PENDING,
            total_robots=len(robots),
            total_orders=len(orders),
            total_tasks=len(orders) * 2,
            config=json.dumps({
                "algorithm": algorithm,
                "safety_distance": 2.0,
                "max_speed": 1.0
            }, ensure_ascii=False)
        )
        
        self.db.add(batch)
        self.db.commit()
        self.db.refresh(batch)
        
        return batch
    
    def run_scheduling(
        self,
        batch_id: int
    ) -> Dict:
        batch = self.db.query(SchedulingBatch).filter(
            SchedulingBatch.id == batch_id
        ).first()
        
        if not batch:
            raise ValueError(f"Batch with id {batch_id} not found")
        
        warehouse_map = self.db.query(WarehouseMap).filter(
            WarehouseMap.id == batch.warehouse_map_id
        ).first()
        
        if not warehouse_map:
            raise ValueError("Warehouse map not found")
        
        self._initialize_algorithms(warehouse_map)
        
        robots = self.db.query(Robot).filter(
            Robot.warehouse_map_id == batch.warehouse_map_id,
            Robot.is_active == True
        ).all()
        
        orders = self.db.query(Order).filter(
            Order.warehouse_map_id == batch.warehouse_map_id,
            Order.status == OrderStatus.PENDING
        ).all()
        
        batch.status = SchedulingStatus.RUNNING
        batch.start_time = datetime.utcnow()
        self.db.commit()
        
        assignment_robots = [
            AssignmentRobot(
                id=r.robot_id,
                x=r.current_x,
                y=r.current_y,
                status=r.status.value,
                battery=r.battery_level,
                max_payload=r.payload_capacity
            ) for r in robots
        ]
        
        tasks = []
        for order in orders:
            tasks.append(AssignmentTask(
                id=f"{order.order_id}_pickup",
                priority=order.priority,
                start_x=order.pickup_location_x,
                start_y=order.pickup_location_y,
                end_x=order.pickup_location_x,
                end_y=order.pickup_location_y,
                cargo_weight=order.cargo_weight
            ))
            tasks.append(AssignmentTask(
                id=f"{order.order_id}_dropoff",
                priority=order.priority,
                start_x=order.pickup_location_x,
                start_y=order.pickup_location_y,
                end_x=order.dropoff_location_x,
                end_y=order.dropoff_location_y,
                cargo_weight=order.cargo_weight
            ))
        
        if batch.algorithm == SchedulingAlgorithm.GREEDY:
            assignments = self.assignment_algorithm.greedy_assignment(
                assignment_robots, tasks
            )
        else:
            assignments = self.assignment_algorithm.auction_assignment(
                assignment_robots, tasks
            )
        
        assigned_tasks = {}
        for assignment in assignments:
            robot_id = assignment.robot_id
            if robot_id not in assigned_tasks:
                assigned_tasks[robot_id] = []
            assigned_tasks[robot_id].append(assignment)
        
        return {
            "batch_id": batch.batch_id,
            "total_assignments": len(assignments),
            "assigned_robots": len(assigned_tasks),
            "assignments": [
                {
                    "task_id": a.task_id,
                    "robot_id": a.robot_id,
                    "cost": a.cost,
                    "path_length": self.pathfinder.calculate_path_length(a.path)
                } for a in assignments
            ]
        }


class ReplayService:
    def __init__(self, db: Session):
        self.db = db
    
    def generate_replay_frames(
        self,
        batch_id: int,
        time_step: float = 0.5
    ) -> Dict:
        batch = self.db.query(SchedulingBatch).filter(
            SchedulingBatch.id == batch_id
        ).first()
        
        if not batch:
            raise ValueError(f"Batch with id {batch_id} not found")
        
        warehouse_map = self.db.query(WarehouseMap).filter(
            WarehouseMap.id == batch.warehouse_map_id
        ).first()
        
        if not warehouse_map:
            raise ValueError("Warehouse map not found")
        
        robots = self.db.query(Robot).filter(
            Robot.warehouse_map_id == batch.warehouse_map_id
        ).all()
        
        tasks = self.db.query(Task).filter(
            Task.batch_id == batch_id
        ).all()
        
        frame_number = 0
        total_frames = 0
        collision_risks_count = 0
        
        robot_states = {}
        for robot in robots:
            robot_states[robot.id] = {
                "x": robot.current_x,
                "y": robot.current_y,
                "orientation": robot.orientation,
                "status": robot.status.value,
                "battery": robot.battery_level,
                "speed": robot.current_speed,
                "path": [],
                "path_index": 0
            }
        
        for task in tasks:
            if task.assigned_robot_id and task.path:
                path = json.loads(task.path)
                if path:
                    robot_states[task.assigned_robot_id]["path"] = path
                    robot_states[task.assigned_robot_id]["path_index"] = 0
        
        max_iterations = 1000
        for iteration in range(max_iterations):
            active_robots = False
            
            for robot in robots:
                state = robot_states[robot.id]
                path = state["path"]
                path_index = state["path_index"]
                
                if not path or path_index >= len(path):
                    state["status"] = "idle"
                    frame = ReplayFrame(
                        batch_id=batch.id,
                        robot_id=robot.id,
                        frame_number=frame_number,
                        x=state["x"],
                        y=state["y"],
                        z=0.0,
                        orientation=state["orientation"],
                        speed=0.0,
                        battery_level=state["battery"],
                        state=FrameRobotState.IDLE
                    )
                    self.db.add(frame)
                    continue
                
                active_robots = True
                
                target_x, target_y = path[path_index]
                dx = target_x - state["x"]
                dy = target_y - state["y"]
                distance = math.sqrt(dx * dx + dy * dy)
                
                move_distance = state["speed"] * time_step if state["speed"] > 0 else 1.0 * time_step
                
                if move_distance >= distance:
                    state["x"] = target_x
                    state["y"] = target_y
                    state["path_index"] += 1
                else:
                    ratio = move_distance / distance
                    state["x"] += dx * ratio
                    state["y"] += dy * ratio
                
                if distance > 0:
                    state["orientation"] = math.atan2(dy, dx)
                
                state["battery"] -= 0.01
                
                frame_state = FrameRobotState.MOVING
                if state["path_index"] >= len(path):
                    frame_state = FrameRobotState.IDLE
                
                frame = ReplayFrame(
                    batch_id=batch.id,
                    robot_id=robot.id,
                    frame_number=frame_number,
                    x=state["x"],
                    y=state["y"],
                    z=0.0,
                    orientation=state["orientation"],
                    speed=state["speed"] if state["speed"] > 0 else 1.0,
                    battery_level=state["battery"],
                    state=frame_state
                )
                self.db.add(frame)
            
            frame_number += 1
            total_frames = frame_number
            
            if not active_robots:
                break
        
        batch.status = SchedulingStatus.COMPLETED
        batch.end_time = datetime.utcnow()
        batch.metrics = json.dumps({
            "total_frames": total_frames,
            "total_distance": 0,
            "collision_risks": collision_risks_count,
            "avg_battery_usage": 0.01 * total_frames
        }, ensure_ascii=False)
        
        self.db.commit()
        
        return {
            "batch_id": batch.batch_id,
            "total_frames": total_frames,
            "total_robots": len(robots)
        }
    
    def get_replay_frames(
        self,
        batch_id: int,
        start_frame: int = 0,
        end_frame: int = None
    ) -> List[Dict]:
        query = self.db.query(ReplayFrame).filter(
            ReplayFrame.batch_id == batch_id
        )
        
        if start_frame > 0:
            query = query.filter(ReplayFrame.frame_number >= start_frame)
        
        if end_frame is not None:
            query = query.filter(ReplayFrame.frame_number <= end_frame)
        
        frames = query.order_by(
            ReplayFrame.frame_number,
            ReplayFrame.robot_id
        ).all()
        
        result = {}
        for frame in frames:
            if frame.frame_number not in result:
                result[frame.frame_number] = {
                    "frame_number": frame.frame_number,
                    "robots": []
                }
            result[frame.frame_number]["robots"].append({
                "robot_id": frame.robot_id,
                "x": frame.x,
                "y": frame.y,
                "z": frame.z,
                "orientation": frame.orientation,
                "speed": frame.speed,
                "battery_level": frame.battery_level,
                "state": frame.state.value if hasattr(frame.state, 'value') else frame.state
            })
        
        return list(result.values())
    
    def compare_batches(
        self,
        batch_id1: int,
        batch_id2: int
    ) -> Dict:
        batch1 = self.db.query(SchedulingBatch).filter(
            SchedulingBatch.id == batch_id1
        ).first()
        
        batch2 = self.db.query(SchedulingBatch).filter(
            SchedulingBatch.id == batch_id2
        ).first()
        
        if not batch1 or not batch2:
            raise ValueError("One or both batches not found")
        
        metrics1 = json.loads(batch1.metrics) if batch1.metrics else {}
        metrics2 = json.loads(batch2.metrics) if batch2.metrics else {}
        
        frames1_count = self.db.query(ReplayFrame).filter(
            ReplayFrame.batch_id == batch_id1
        ).count()
        
        frames2_count = self.db.query(ReplayFrame).filter(
            ReplayFrame.batch_id == batch_id2
        ).count()
        
        risks1 = self.db.query(CollisionRisk).filter(
            CollisionRisk.batch_id == batch_id1
        ).all()
        
        risks2 = self.db.query(CollisionRisk).filter(
            CollisionRisk.batch_id == batch_id2
        ).all()
        
        return {
            "batch1": {
                "id": batch1.batch_id,
                "name": batch1.name,
                "algorithm": batch1.algorithm.value,
                "total_frames": metrics1.get("total_frames", frames1_count),
                "total_robots": batch1.total_robots,
                "total_orders": batch1.total_orders,
                "collision_risks": len(risks1),
                "start_time": batch1.start_time.isoformat() if batch1.start_time else None,
                "end_time": batch1.end_time.isoformat() if batch1.end_time else None
            },
            "batch2": {
                "id": batch2.batch_id,
                "name": batch2.name,
                "algorithm": batch2.algorithm.value,
                "total_frames": metrics2.get("total_frames", frames2_count),
                "total_robots": batch2.total_robots,
                "total_orders": batch2.total_orders,
                "collision_risks": len(risks2),
                "start_time": batch2.start_time.isoformat() if batch2.start_time else None,
                "end_time": batch2.end_time.isoformat() if batch2.end_time else None
            },
            "comparison": {
                "frames_difference": metrics2.get("total_frames", frames2_count) - metrics1.get("total_frames", frames1_count),
                "risks_difference": len(risks2) - len(risks1),
                "better_batch": batch1.batch_id if len(risks1) < len(risks2) else batch2.batch_id
            }
        }

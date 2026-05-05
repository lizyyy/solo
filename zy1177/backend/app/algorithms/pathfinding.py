import heapq
import math
from typing import List, Tuple, Dict, Optional
from dataclasses import dataclass


@dataclass
class Node:
    x: int
    y: int
    g: float = 0
    h: float = 0
    f: float = 0
    parent: Optional['Node'] = None
    
    def __lt__(self, other):
        return self.f < other.f
    
    def __eq__(self, other):
        return self.x == other.x and self.y == other.y
    
    def __hash__(self):
        return hash((self.x, self.y))


class PathfindingAlgorithm:
    def __init__(self, grid: List[List[int]], grid_size: float = 1.0):
        self.grid = grid
        self.grid_size = grid_size
        self.width = len(grid[0]) if grid else 0
        self.height = len(grid) if grid else 0
    
    def heuristic(self, a: Tuple[int, int], b: Tuple[int, int]) -> float:
        dx = abs(a[0] - b[0])
        dy = abs(a[1] - b[1])
        return math.sqrt(dx * dx + dy * dy)
    
    def get_neighbors(self, node: Node, allow_diagonal: bool = True) -> List[Tuple[int, int]]:
        directions = [
            (0, -1), (0, 1), (-1, 0), (1, 0),
        ]
        if allow_diagonal:
            directions.extend([(-1, -1), (-1, 1), (1, -1), (1, 1)])
        
        neighbors = []
        for dx, dy in directions:
            nx = node.x + dx
            ny = node.y + dy
            if 0 <= nx < self.width and 0 <= ny < self.height:
                if self.grid[ny][nx] == 0:
                    neighbors.append((nx, ny))
        return neighbors
    
    def a_star(
        self, 
        start: Tuple[float, float], 
        goal: Tuple[float, float],
        allow_diagonal: bool = True,
        robot_radius: float = 0.5
    ) -> List[Tuple[float, float]]:
        start_grid = (
            int(start[0] / self.grid_size),
            int(start[1] / self.grid_size)
        )
        goal_grid = (
            int(goal[0] / self.grid_size),
            int(goal[1] / self.grid_size)
        )
        
        if start_grid[0] < 0 or start_grid[0] >= self.width or \
           start_grid[1] < 0 or start_grid[1] >= self.height:
            return []
        
        if goal_grid[0] < 0 or goal_grid[0] >= self.width or \
           goal_grid[1] < 0 or goal_grid[1] >= self.height:
            return []
        
        if self.grid[start_grid[1]][start_grid[0]] != 0:
            return []
        
        if self.grid[goal_grid[1]][goal_grid[0]] != 0:
            return []
        
        open_set = []
        closed_set = set()
        
        start_node = Node(start_grid[0], start_grid[1])
        goal_node = Node(goal_grid[0], goal_grid[1])
        
        start_node.g = 0
        start_node.h = self.heuristic(start_grid, goal_grid)
        start_node.f = start_node.g + start_node.h
        
        heapq.heappush(open_set, start_node)
        
        while open_set:
            current_node = heapq.heappop(open_set)
            
            if current_node == goal_node:
                path = []
                while current_node:
                    path.append((
                        current_node.x * self.grid_size + self.grid_size / 2,
                        current_node.y * self.grid_size + self.grid_size / 2
                    ))
                    current_node = current_node.parent
                return path[::-1]
            
            closed_set.add(current_node)
            
            for neighbor_pos in self.get_neighbors(current_node, allow_diagonal):
                neighbor = Node(neighbor_pos[0], neighbor_pos[1])
                
                if neighbor in closed_set:
                    continue
                
                dx = neighbor.x - current_node.x
                dy = neighbor.y - current_node.y
                move_cost = math.sqrt(dx * dx + dy * dy) * self.grid_size
                
                tentative_g = current_node.g + move_cost
                
                if neighbor not in open_set:
                    neighbor.g = tentative_g
                    neighbor.h = self.heuristic(neighbor_pos, goal_grid)
                    neighbor.f = neighbor.g + neighbor.h
                    neighbor.parent = current_node
                    heapq.heappush(open_set, neighbor)
                elif tentative_g < neighbor.g:
                    neighbor.g = tentative_g
                    neighbor.f = neighbor.g + neighbor.h
                    neighbor.parent = current_node
        
        return []
    
    def smooth_path(self, path: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
        if len(path) <= 2:
            return path
        
        smoothed = [path[0]]
        current_index = 0
        
        while current_index < len(path) - 1:
            farthest_reachable = current_index + 1
            
            for j in range(len(path) - 1, current_index, -1):
                if self._is_line_clear(path[current_index], path[j]):
                    farthest_reachable = j
                    break
            
            if farthest_reachable > current_index + 1:
                smoothed.append(path[farthest_reachable])
                current_index = farthest_reachable
            else:
                smoothed.append(path[current_index + 1])
                current_index += 1
        
        return smoothed
    
    def _is_line_clear(self, start: Tuple[float, float], end: Tuple[float, float]) -> bool:
        start_x, start_y = start
        end_x, end_y = end
        
        steps = max(
            int(abs(end_x - start_x) / self.grid_size) + 1,
            int(abs(end_y - start_y) / self.grid_size) + 1
        )
        
        for i in range(steps + 1):
            t = i / steps
            x = start_x + (end_x - start_x) * t
            y = start_y + (end_y - start_y) * t
            
            grid_x = int(x / self.grid_size)
            grid_y = int(y / self.grid_size)
            
            if grid_x < 0 or grid_x >= self.width or \
               grid_y < 0 or grid_y >= self.height:
                return False
            
            if self.grid[grid_y][grid_x] != 0:
                return False
        
        return True
    
    def calculate_path_length(self, path: List[Tuple[float, float]]) -> float:
        if len(path) < 2:
            return 0
        
        total = 0
        for i in range(1, len(path)):
            dx = path[i][0] - path[i-1][0]
            dy = path[i][1] - path[i-1][1]
            total += math.sqrt(dx * dx + dy * dy)
        return total

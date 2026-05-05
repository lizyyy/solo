import pytest
import math
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.algorithms.pathfinding import PathfindingAlgorithm, Node


class TestPathfindingAlgorithm:
    
    def setup_method(self):
        self.grid = [
            [0, 0, 0, 0, 0],
            [0, 1, 1, 1, 0],
            [0, 0, 0, 0, 0],
            [0, 1, 1, 1, 0],
            [0, 0, 0, 0, 0]
        ]
        self.pathfinder = PathfindingAlgorithm(self.grid, grid_size=1)
    
    def test_heuristic_calculation(self):
        a = (0, 0)
        b = (3, 4)
        
        expected = math.sqrt(3**2 + 4**2)
        result = self.pathfinder.heuristic(a, b)
        
        assert result == pytest.approx(expected)
    
    def test_node_comparison(self):
        node1 = Node(x=1, y=2, f=5.0)
        node2 = Node(x=3, y=4, f=3.0)
        
        assert node2 < node1
        assert node1 > node2
    
    def test_node_equality(self):
        node1 = Node(x=1, y=2)
        node2 = Node(x=1, y=2)
        node3 = Node(x=2, y=1)
        
        assert node1 == node2
        assert node1 != node3
    
    def test_get_neighbors(self):
        node = Node(x=2, y=2)
        neighbors = self.pathfinder.get_neighbors(node, allow_diagonal=False)
        
        assert len(neighbors) >= 0
        
        for nx, ny in neighbors:
            assert 0 <= nx < 5
            assert 0 <= ny < 5
            assert self.grid[ny][nx] == 0
    
    def test_a_star_simple_path(self):
        simple_grid = [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0]
        ]
        simple_pathfinder = PathfindingAlgorithm(simple_grid, grid_size=1)
        
        start = (0.5, 0.5)
        goal = (2.5, 2.5)
        
        path = simple_pathfinder.a_star(start, goal)
        
        assert len(path) >= 2
        assert path[0][0] == pytest.approx(0.5)
        assert path[0][1] == pytest.approx(0.5)
        assert path[-1][0] == pytest.approx(2.5)
        assert path[-1][1] == pytest.approx(2.5)
    
    def test_a_star_with_obstacles(self):
        path = self.pathfinder.a_star(
            (0.5, 0.5),
            (0.5, 4.5),
            allow_diagonal=False
        )
        
        assert len(path) > 0
        
        for x, y in path:
            grid_x = int(x)
            grid_y = int(y)
            assert self.grid[grid_y][grid_x] == 0
    
    def test_a_star_start_blocked(self):
        blocked_grid = [
            [1, 0, 0],
            [0, 0, 0],
            [0, 0, 0]
        ]
        blocked_pathfinder = PathfindingAlgorithm(blocked_grid, grid_size=1)
        
        path = blocked_pathfinder.a_star(
            (0.5, 0.5),
            (2.5, 2.5)
        )
        
        assert len(path) == 0
    
    def test_a_star_goal_blocked(self):
        blocked_grid = [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 1]
        ]
        blocked_pathfinder = PathfindingAlgorithm(blocked_grid, grid_size=1)
        
        path = blocked_pathfinder.a_star(
            (0.5, 0.5),
            (2.5, 2.5)
        )
        
        assert len(path) == 0
    
    def test_path_length_calculation(self):
        path = [(0, 0), (3, 0), (3, 4)]
        
        length = self.pathfinder.calculate_path_length(path)
        
        expected = 3 + 4
        assert length == pytest.approx(expected)
    
    def test_path_length_empty(self):
        path = []
        assert self.pathfinder.calculate_path_length(path) == 0
    
    def test_path_length_single_point(self):
        path = [(0, 0)]
        assert self.pathfinder.calculate_path_length(path) == 0
    
    def test_smooth_path(self):
        simple_grid = [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0]
        ]
        simple_pathfinder = PathfindingAlgorithm(simple_grid, grid_size=1)
        
        original_path = [(0.5, 0.5), (1.5, 0.5), (2.5, 0.5), (3.5, 0.5), (4.5, 0.5)]
        
        smoothed = simple_pathfinder.smooth_path(original_path)
        
        assert len(smoothed) <= len(original_path)
        assert smoothed[0] == original_path[0]
        assert smoothed[-1] == original_path[-1]

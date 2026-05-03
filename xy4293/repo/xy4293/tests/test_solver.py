#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
方案搜索模块测试 - Solver Tests

测试串并联方案求解和优化。
"""

import pytest

from pvchecker.solver import (
    ConfigurationSolver,
    Optimizer,
    SolutionType,
    SolutionScore,
    ConfigurationSolution,
)
from pvchecker.pvcalc import CalculationError


class TestConfigurationSolver:
    """串并联方案求解器测试"""
    
    def test_solve_basic(self, test_module, test_inverter, test_roof_zones):
        """测试基本方案求解"""
        solver = ConfigurationSolver(
            module=test_module,
            inverter=test_inverter,
            roof_zones=test_roof_zones,
            min_temp=-10.0,
            max_temp=60.0
        )
        
        solutions = solver.solve()
        
        assert len(solutions) >= 2
        assert all(isinstance(s, ConfigurationSolution) for s in solutions)
        
        for sol in solutions:
            assert sol.modules_per_string > 0
            assert sol.strings_in_parallel > 0
            assert sol.total_modules == sol.modules_per_string * sol.strings_in_parallel
    
    def test_solution_types(self, test_module, test_inverter, test_roof_zones):
        """测试方案类型"""
        solver = ConfigurationSolver(
            module=test_module,
            inverter=test_inverter,
            roof_zones=test_roof_zones,
        )
        
        solutions = solver.solve()
        
        solution_types = [s.solution_type for s in solutions]
        
        assert SolutionType.MIN_SERIES in solution_types
        assert SolutionType.MAX_SERIES in solution_types
    
    def test_total_modules(self, test_module, test_inverter, test_roof_zones):
        """测试总组件数计算"""
        solver = ConfigurationSolver(
            module=test_module,
            inverter=test_inverter,
            roof_zones=test_roof_zones,
        )
        
        expected_total = sum(z.module_count for z in test_roof_zones)
        
        assert solver.total_modules == expected_total
    
    def test_voltage_in_mppt_range(self, test_module, test_inverter, test_roof_zones):
        """测试MPPT电压范围检查"""
        solver = ConfigurationSolver(
            module=test_module,
            inverter=test_inverter,
            roof_zones=test_roof_zones,
        )
        
        solutions = solver.solve()
        
        for sol in solutions:
            if sol.voltage_in_mppt_range:
                assert sol.estimated_v_mp >= test_inverter.v_min
                assert sol.estimated_voc_high_temp <= test_inverter.v_max
    
    def test_estimated_losses(self, test_module, test_inverter, test_roof_zones):
        """测试损失估算"""
        solver = ConfigurationSolver(
            module=test_module,
            inverter=test_inverter,
            roof_zones=test_roof_zones,
        )
        
        solutions = solver.solve()
        
        for sol in solutions:
            assert 0 <= sol.estimated_shading_loss_percent <= 30
            assert 0 <= sol.estimated_cable_loss_percent <= 20
    
    def test_score_calculation(self, test_module, test_inverter, test_roof_zones):
        """测试方案评分"""
        solver = ConfigurationSolver(
            module=test_module,
            inverter=test_inverter,
            roof_zones=test_roof_zones,
        )
        
        solutions = solver.solve()
        
        for sol in solutions:
            assert isinstance(sol.score, SolutionScore)
            assert 0 <= sol.score.total_score <= 100
            assert 0 <= sol.score.efficiency_score <= 100
            assert 0 <= sol.score.cost_score <= 100
            assert 0 <= sol.score.risk_score <= 100
            assert 0 <= sol.score.voltage_match_score <= 100
    
    def test_adjust_solution(self, test_module, test_inverter, test_roof_zones):
        """测试方案调整"""
        solver = ConfigurationSolver(
            module=test_module,
            inverter=test_inverter,
            roof_zones=test_roof_zones,
        )
        
        solutions = solver.solve()
        original = solutions[0]
        
        adjusted = solver.adjust_solution(
            solution=original,
            new_modules_per_string=original.modules_per_string + 1,
            cable_length=100.0,
            cable_cross_section=10.0
        )
        
        assert adjusted.solution_type == SolutionType.OPTIMAL
        assert "已调整" in adjusted.name
        assert adjusted.modules_per_string == original.modules_per_string + 1


class TestOptimizer:
    """方案优化器测试"""
    
    def test_get_recommendation(self, test_module, test_inverter, test_roof_zones):
        """测试获取推荐方案"""
        solver = ConfigurationSolver(
            module=test_module,
            inverter=test_inverter,
            roof_zones=test_roof_zones,
        )
        
        solutions = solver.solve()
        optimizer = Optimizer(solutions)
        
        recommendation = optimizer.get_recommendation()
        
        assert 'recommended' in recommendation
        assert 'analysis' in recommendation
        assert 'comparison' in recommendation
        
        recommended = recommendation['recommended']
        assert isinstance(recommended, ConfigurationSolution)
        
        analysis = recommendation['analysis']
        assert 'strengths' in analysis
        assert 'weaknesses' in analysis
        assert 'suggestions' in analysis
        assert 'overall_score' in analysis
        assert 'score_breakdown' in analysis
    
    def test_compare_solutions(self, test_module, test_inverter, test_roof_zones):
        """测试方案对比"""
        solver = ConfigurationSolver(
            module=test_module,
            inverter=test_inverter,
            roof_zones=test_roof_zones,
        )
        
        solutions = solver.solve()
        optimizer = Optimizer(solutions)
        
        comparison = optimizer.compare_solutions()
        
        assert 'solutions_compared' in comparison
        assert comparison['solutions_compared'] == len(solutions)
        assert 'best_by' in comparison
        assert 'detailed_comparison' in comparison
    
    def test_get_solution_by_type(self, test_module, test_inverter, test_roof_zones):
        """测试按类型获取方案"""
        solver = ConfigurationSolver(
            module=test_module,
            inverter=test_inverter,
            roof_zones=test_roof_zones,
        )
        
        solutions = solver.solve()
        optimizer = Optimizer(solutions)
        
        min_series = optimizer.get_solution_by_type(SolutionType.MIN_SERIES)
        max_series = optimizer.get_solution_by_type(SolutionType.MAX_SERIES)
        
        assert min_series is not None
        assert max_series is not None
        assert min_series.solution_type == SolutionType.MIN_SERIES
        assert max_series.solution_type == SolutionType.MAX_SERIES

import pulp
import numpy as np
import time
import logging
from typing import Dict, List, Tuple, Optional, Any
from .models import Ingredient, RecipeResult, Constraint


class ConstraintSolver:
    def __init__(self, config: Dict[str, Any], logger: logging.Logger):
        self.config = config
        self.logger = logger
        self.constraints_config = config['constraints']
        
    def solve(self, ingredients: List[Ingredient]) -> RecipeResult:
        self.logger.info("开始配方优化求解...")
        start_time = time.time()
        
        if len(ingredients) < 2:
            return self._create_failure_result(ingredients, "可用食材不足，至少需要2种食材进行配方组合")
        
        try:
            result = self._run_optimization(ingredients)
            result.optimization_time = time.time() - start_time
            
            if result.is_feasible:
                self.logger.info(f"配方优化成功！耗时: {result.optimization_time:.2f}秒")
                self.logger.info(f"最优配方: {result.ingredients}")
                self.logger.info(f"蛋白: {result.total_protein:.2f}g, 钠: {result.total_sodium:.2f}mg, 成本: ${result.total_cost:.2f}")
            else:
                self.logger.warning(f"配方优化失败: {result.notes}")
                
            return result
            
        except Exception as e:
            elapsed = time.time() - start_time
            self.logger.error(f"配方优化出错: {str(e)}")
            return self._create_failure_result(ingredients, f"优化过程出错: {str(e)}", elapsed)
    
    def _run_optimization(self, ingredients: List[Ingredient]) -> RecipeResult:
        prob = pulp.LpProblem("食品营养配方优化", pulp.LpMinimize)
        
        ingredient_vars = {}
        for ing in ingredients:
            var_name = f"x_{ing.id}_{ing.name.replace(' ', '_')}"
            ingredient_vars[ing.id] = pulp.LpVariable(
                var_name, lowBound=0, cat='Continuous'
            )
        
        total_cost = pulp.lpSum([
            ingredient_vars[ing.id] * (ing.cost / ing.weight)
            for ing in ingredients
        ])
        prob += total_cost, "最小化总成本"
        
        target_protein = self.constraints_config['target_protein']
        total_protein = pulp.lpSum([
            ingredient_vars[ing.id] * (ing.protein / ing.weight)
            for ing in ingredients
        ])
        prob += total_protein >= target_protein['min'], "蛋白质下限"
        prob += total_protein <= target_protein['max'], "蛋白质上限"
        
        target_sodium = self.constraints_config['target_sodium']
        total_sodium = pulp.lpSum([
            ingredient_vars[ing.id] * (ing.sodium / ing.weight)
            for ing in ingredients
        ])
        prob += total_sodium >= target_sodium['min'], "钠含量下限"
        prob += total_sodium <= target_sodium['max'], "钠含量上限"
        
        target_cost = self.constraints_config['target_cost']
        prob += total_cost <= target_cost['max'], "总成本上限"
        
        target_weight = self.constraints_config['total_weight']
        total_weight = pulp.lpSum([ingredient_vars[ing.id] for ing in ingredients])
        prob += total_weight >= target_weight['min'], "总重量下限"
        prob += total_weight <= target_weight['max'], "总重量上限"
        
        categories = {}
        for ing in ingredients:
            if ing.category not in categories:
                categories[ing.category] = []
            categories[ing.category].append(ing)
        
        for cat, cat_ingredients in categories.items():
            cat_sum = pulp.lpSum([ingredient_vars[ing.id] for ing in cat_ingredients])
            prob += cat_sum <= 80.0, f"{cat}类上限"
            if len(cat_ingredients) > 0:
                prob += cat_sum >= 5.0, f"{cat}类下限"
        
        self.logger.info(f"正在求解线性规划问题，包含 {len(ingredients)} 个食材变量...")
        status = prob.solve(pulp.PULP_CBC_CMD(msg=False))
        
        if pulp.LpStatus[status] == 'Optimal':
            return self._build_result(prob, ingredients, ingredient_vars, total_cost, total_protein, total_sodium)
        else:
            return self._analyze_infeasibility(ingredients, status)
    
    def _build_result(self, prob, ingredients: List[Ingredient], 
                     ingredient_vars, total_cost, total_protein, total_sodium) -> RecipeResult:
        
        proportions = {}
        selected_ingredients = []
        
        for ing in ingredients:
            var_value = pulp.value(ingredient_vars[ing.id])
            if var_value is not None and var_value > 0.001:
                proportions[ing.name] = round(var_value, 4)
                selected_ingredients.append(ing.name)
        
        final_total_weight = sum(proportions.values())
        final_protein = pulp.value(total_protein)
        final_sodium = pulp.value(total_sodium)
        final_cost = pulp.value(total_cost)
        
        constraints = self._evaluate_constraints(final_protein, final_sodium, final_cost, final_total_weight)
        
        return RecipeResult(
            ingredients=selected_ingredients,
            proportions=proportions,
            total_protein=final_protein,
            total_sodium=final_sodium,
            total_cost=final_cost,
            total_weight=final_total_weight,
            constraints=constraints,
            is_feasible=True,
            optimization_time=0.0
        )
    
    def _evaluate_constraints(self, protein: float, sodium: float, 
                             cost: float, weight: float) -> List[Constraint]:
        constraints = []
        
        target_protein = self.constraints_config['target_protein']
        constraints.append(Constraint(
            name="蛋白质",
            min_value=target_protein['min'],
            max_value=target_protein['max'],
            unit=target_protein['unit'],
            current_value=protein,
            is_satisfied=target_protein['min'] <= protein <= target_protein['max']
        ))
        
        target_sodium = self.constraints_config['target_sodium']
        constraints.append(Constraint(
            name="钠含量",
            min_value=target_sodium['min'],
            max_value=target_sodium['max'],
            unit=target_sodium['unit'],
            current_value=sodium,
            is_satisfied=target_sodium['min'] <= sodium <= target_sodium['max']
        ))
        
        target_cost = self.constraints_config['target_cost']
        constraints.append(Constraint(
            name="总成本",
            min_value=target_cost['min'],
            max_value=target_cost['max'],
            unit=target_cost['unit'],
            current_value=cost,
            is_satisfied=target_cost['min'] <= cost <= target_cost['max']
        ))
        
        target_weight = self.constraints_config['total_weight']
        constraints.append(Constraint(
            name="总重量",
            min_value=target_weight['min'],
            max_value=target_weight['max'],
            unit=target_weight['unit'],
            current_value=weight,
            is_satisfied=target_weight['min'] <= weight <= target_weight['max']
        ))
        
        return constraints
    
    def _analyze_infeasibility(self, ingredients: List[Ingredient], status: int) -> RecipeResult:
        status_str = pulp.LpStatus[status]
        
        reasons = []
        
        protein_values = [ing.protein for ing in ingredients]
        sodium_values = [ing.sodium for ing in ingredients]
        cost_values = [ing.cost for ing in ingredients]
        
        target_protein = self.constraints_config['target_protein']
        max_achievable_protein = max(protein_values) * 1.0
        
        if max_achievable_protein < target_protein['min']:
            reasons.append(f"无法达到蛋白质要求：食材最高蛋白含量 {max_achievable_protein:.1f}g < 目标 {target_protein['min']}g")
        
        if min(sodium_values) > self.constraints_config['target_sodium']['max']:
            reasons.append(f"无法满足钠含量上限：食材最低钠含量 {min(sodium_values):.1f}mg > 目标上限")
        
        if min(cost_values) * (self.constraints_config['total_weight']['min'] / 100) > self.constraints_config['target_cost']['max']:
            reasons.append(f"成本约束过于严格：最低成本食材组合也超出预算")
        
        if len(ingredients) < 2:
            reasons.append("食材种类太少，无法形成有效的配方组合")
        
        if not reasons:
            reasons.append(f"优化器返回状态: {status_str}")
        
        notes = " | ".join(reasons)
        
        return RecipeResult(
            ingredients=[],
            proportions={},
            total_protein=0,
            total_sodium=0,
            total_cost=0,
            total_weight=0,
            constraints=[],
            is_feasible=False,
            optimization_time=0.0,
            notes=notes
        )
    
    def _create_failure_result(self, ingredients: List[Ingredient], reason: str, 
                              elapsed: float = 0.0) -> RecipeResult:
        return RecipeResult(
            ingredients=[],
            proportions={},
            total_protein=0,
            total_sodium=0,
            total_cost=0,
            total_weight=0,
            constraints=[],
            is_feasible=False,
            optimization_time=elapsed,
            notes=reason
        )
    
    def generate_alternative_solutions(self, ingredients: List[Ingredient], 
                                       num_solutions: int = 3) -> List[RecipeResult]:
        self.logger.info(f"尝试生成 {num_solutions} 个替代配方方案...")
        results = []
        
        for i in range(num_solutions):
            if i == 0:
                result = self.solve(ingredients)
            else:
                excluded_ingredients = results[0].ingredients[:i] if results else []
                filtered_ingredients = [
                    ing for ing in ingredients 
                    if ing.name not in excluded_ingredients
                ]
                result = self.solve(filtered_ingredients)
            
            if result.is_feasible:
                results.append(result)
        
        return results

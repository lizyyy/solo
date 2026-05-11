class NutritionEngine {
    calculateTargetProtein(weight) {
        const dailyLow = weight * CONSTANTS.PROTEIN_PER_KG_LOW;
        const dailyHigh = weight * CONSTANTS.PROTEIN_PER_KG_HIGH;
        const mealLow = dailyLow / CONSTANTS.MEALS_PER_DAY;
        const mealHigh = dailyHigh / CONSTANTS.MEALS_PER_DAY;
        return {
            dailyLow: parseFloat(dailyLow.toFixed(1)),
            dailyHigh: parseFloat(dailyHigh.toFixed(1)),
            mealLow: parseFloat(mealLow.toFixed(1)),
            mealHigh: parseFloat(mealHigh.toFixed(1)),
            mealTarget: parseFloat(((mealLow + mealHigh) / 2).toFixed(1))
        };
    }

    getSaltLimit(elder, rules) {
        let limit = CONSTANTS.SALT_LIMIT_PER_MEAL;
        rules.forEach(rule => {
            if (rule.name.includes('极低盐') || rule.description.includes('0.5')) {
                limit = Math.min(limit, 0.5);
            } else if (rule.name.includes('低盐') || rule.description.includes('3克')) {
                limit = Math.min(limit, 1.0);
            }
        });
        return parseFloat(limit.toFixed(2));
    }
}

class RuleEngine {
    checkDishAgainstRules(dish, rules) {
        const violations = [];
        const warnings = [];

        rules.forEach(rule => {
            const dishIngredients = dish.ingredients || [];
            
            if (rule.avoid && rule.avoid.length > 0) {
                const matchedAvoid = rule.avoid.filter(avoid =>
                    dishIngredients.some(ing =>
                        ing.includes(avoid) || avoid.includes(ing)
                    )
                );

                if (matchedAvoid.length > 0) {
                    if (rule.type === 'allergy') {
                        violations.push({
                            rule: rule,
                            dish: dish,
                            type: 'allergy',
                            message: `菜品"${dish.name}"包含${matchedAvoid.join('、')}，违反${rule.name}规则`,
                            severity: 'critical'
                        });
                    } else if (rule.type === 'chronic') {
                        violations.push({
                            rule: rule,
                            dish: dish,
                            type: 'chronic',
                            message: `菜品"${dish.name}"包含${matchedAvoid.join('、')}，不适合${rule.name}`,
                            severity: 'high'
                        });
                    } else {
                        warnings.push({
                            rule: rule,
                            dish: dish,
                            type: rule.type,
                            message: `菜品"${dish.name}"包含${matchedAvoid.join('、')}，可能不符合${rule.name}偏好`,
                            severity: 'medium'
                        });
                    }
                }
            }

            if (rule.include && rule.include.length > 0) {
                const hasRequired = rule.include.some(include =>
                    dishIngredients.some(ing =>
                        ing.includes(include) || include.includes(ing)
                    )
                );

                if (!hasRequired && dish.category === 'main') {
                    warnings.push({
                        rule: rule,
                        dish: dish,
                        type: 'preference',
                        message: `菜品"${dish.name}"不包含${rule.include.join('、')}，可能不符合${rule.name}`,
                        severity: 'low'
                    });
                }
            }
        });

        return { violations, warnings };
    }

    checkMealPlanAgainstRules(mealPlan, rules) {
        const allViolations = [];
        const allWarnings = [];

        mealPlan.dishes.forEach(dish => {
            const result = this.checkDishAgainstRules(dish, rules);
            allViolations.push(...result.violations);
            allWarnings.push(...result.warnings);
        });

        return { violations: allViolations, warnings: allWarnings };
    }
}

class CostEngine {
    calculateTotalCost(dishes) {
        return parseFloat(dishes.reduce((sum, dish) => sum + (dish.cost || 0), 0).toFixed(2));
    }

    checkBudget(mealPlan, budget) {
        const totalCost = mealPlan.totalCost;
        const isOverBudget = totalCost > budget;
        const difference = parseFloat((totalCost - budget).toFixed(2));

        return {
            isOverBudget,
            difference,
            percentage: budget > 0 ? parseFloat(((totalCost / budget) * 100).toFixed(1)) : 0
        };
    }
}

class MealGenerator {
    constructor() {
        this.nutritionEngine = new NutritionEngine();
        this.ruleEngine = new RuleEngine();
        this.costEngine = new CostEngine();
    }

    generateMealPlan(elder, dishes, date, mealType) {
        const rules = dataStore.getRulesByIds(elder.ruleIds || []);
        const proteinTarget = this.nutritionEngine.calculateTargetProtein(elder.weight);
        const saltLimit = this.nutritionEngine.getSaltLimit(elder, rules);
        const budget = elder.budget;

        const availableDishes = this.filterDishesByRules(dishes, rules);

        const mealPlans = this.createMultiplePlans(availableDishes, elder, rules);

        const validatedPlans = mealPlans.map(plan => {
            return this.validatePlan(plan, elder, rules, proteinTarget, saltLimit, budget, date, mealType);
        });

        validatedPlans.sort((a, b) => {
            const statusOrder = { success: 0, warning: 1, blocked: 2 };
            if (statusOrder[a.status] !== statusOrder[b.status]) {
                return statusOrder[a.status] - statusOrder[b.status];
            }
            return a.combinedScore - b.combinedScore;
        });

        return {
            bestPlan: validatedPlans[0] || null,
            alternatives: validatedPlans.slice(1, 3),
            allPlans: validatedPlans,
            proteinTarget,
            saltLimit,
            budget
        };
    }

    filterDishesByRules(dishes, rules) {
        return dishes.filter(dish => {
            const result = this.ruleEngine.checkDishAgainstRules(dish, rules);
            return result.violations.length === 0;
        });
    }

    createMultiplePlans(availableDishes, elder, rules) {
        const plans = [];

        const byCategory = {
            main: availableDishes.filter(d => d.category === 'main'),
            side: availableDishes.filter(d => d.category === 'side'),
            soup: availableDishes.filter(d => d.category === 'soup'),
            staple: availableDishes.filter(d => d.category === 'staple')
        };

        if (byCategory.main.length > 0 && byCategory.staple.length > 0) {
            plans.push({
                dishes: [
                    byCategory.main[0],
                    byCategory.staple[0],
                    ...(byCategory.side.length > 0 ? [byCategory.side[0]] : []),
                    ...(byCategory.soup.length > 0 ? [byCategory.soup[0]] : [])
                ]
            });
        }

        if (byCategory.main.length > 1 && byCategory.staple.length > 0) {
            plans.push({
                dishes: [
                    byCategory.main[1],
                    byCategory.staple[0],
                    ...(byCategory.side.length > 1 ? [byCategory.side[1]] : byCategory.side),
                    ...(byCategory.soup.length > 0 ? [byCategory.soup[0]] : [])
                ]
            });
        }

        if (byCategory.staple.length > 1) {
            plans.push({
                dishes: [
                    ...(byCategory.main.length > 0 ? [byCategory.main[0]] : []),
                    byCategory.staple[1],
                    ...(byCategory.side.length > 0 ? [byCategory.side[0]] : []),
                    ...(byCategory.soup.length > 1 ? [byCategory.soup[1]] : byCategory.soup)
                ]
            });
        }

        const uniquePlans = [];
        const seen = new Set();
        plans.forEach(plan => {
            const key = plan.dishes.map(d => d.id).sort().join(',');
            if (!seen.has(key) && plan.dishes.length > 0) {
                seen.add(key);
                uniquePlans.push(plan);
            }
        });

        return uniquePlans;
    }

    validatePlan(plan, elder, rules, proteinTarget, saltLimit, budget, date, mealType) {
        const result = {
            elderId: elder.id,
            elderName: elder.name,
            date,
            mealType,
            dishes: plan.dishes,
            issues: [],
            warnings: [],
            blockedReasons: [],
            status: 'success',
            combinedScore: 0
        };

        result.totalSalt = parseFloat(plan.dishes.reduce((sum, d) => sum + (d.salt || 0), 0).toFixed(2));
        result.totalProtein = parseFloat(plan.dishes.reduce((sum, d) => sum + (d.protein || 0), 0).toFixed(2));
        result.totalCost = this.costEngine.calculateTotalCost(plan.dishes);

        const ruleCheck = this.ruleEngine.checkMealPlanAgainstRules(plan, rules);
        
        if (ruleCheck.violations.length > 0) {
            result.blockedReasons.push(...ruleCheck.violations.map(v => v.message));
            result.status = 'blocked';
        }

        result.warnings.push(...ruleCheck.warnings.map(w => w.message));

        if (result.totalSalt > saltLimit) {
            result.issues.push(`总盐量${result.totalSalt}克，超过限制${saltLimit}克（超出${(result.totalSalt - saltLimit).toFixed(2)}克）`);
            result.combinedScore += (result.totalSalt - saltLimit) * 10;
        }

        if (result.totalProtein < proteinTarget.mealLow) {
            result.issues.push(`蛋白质${result.totalProtein}克，低于目标${proteinTarget.mealLow}克（缺少${(proteinTarget.mealLow - result.totalProtein).toFixed(1)}克）`);
            result.combinedScore += (proteinTarget.mealLow - result.totalProtein) * 2;
        } else if (result.totalProtein > proteinTarget.mealHigh) {
            result.warnings.push(`蛋白质${result.totalProtein}克，略高于推荐上限${proteinTarget.mealHigh}克`);
        }

        const budgetCheck = this.costEngine.checkBudget(result, budget);
        if (budgetCheck.isOverBudget) {
            result.issues.push(`成本${result.totalCost}元，超出预算${budget}元（超出${budgetCheck.difference}元，占${budgetCheck.percentage}%）`);
            result.combinedScore += budgetCheck.difference * 5;
        }

        if (result.status !== 'blocked') {
            if (result.issues.length > 0) {
                result.status = 'warning';
            } else {
                result.combinedScore += Math.abs(result.totalProtein - proteinTarget.mealTarget);
                result.combinedScore += result.totalCost * 0.5;
            }
        }

        if (result.dishes.length === 0) {
            result.status = 'blocked';
            result.blockedReasons.push('没有可用的菜品能够满足所有忌口规则，请检查菜品库或调整忌口设置');
        }

        return result;
    }

    comparePlans(plans, proteinTarget, saltLimit, budget) {
        return plans.map(plan => ({
            ...plan,
            comparison: {
                salt: {
                    value: plan.totalSalt,
                    limit: saltLimit,
                    status: plan.totalSalt <= saltLimit ? 'good' : 'bad'
                },
                protein: {
                    value: plan.totalProtein,
                    target: proteinTarget.mealTarget,
                    status: plan.totalProtein >= proteinTarget.mealLow && plan.totalProtein <= proteinTarget.mealHigh ? 'good' : 
                            plan.totalProtein < proteinTarget.mealLow ? 'low' : 'high'
                },
                cost: {
                    value: plan.totalCost,
                    budget: budget,
                    status: plan.totalCost <= budget ? 'good' : 'bad'
                }
            }
        }));
    }
}

const nutritionEngine = new NutritionEngine();
const ruleEngine = new RuleEngine();
const costEngine = new CostEngine();
const mealGenerator = new MealGenerator();

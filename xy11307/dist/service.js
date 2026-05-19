"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.service = exports.CanteenService = void 0;
const database_1 = require("./database");
class CanteenService {
    checkConflicts(elder, menuItem) {
        const conflicts = [];
        if (elder.chronicConditions.includes('糖尿病') && !menuItem.isSuitableFor.diabetes) {
            conflicts.push('菜品不适合糖尿病患者');
        }
        if (elder.chronicConditions.includes('高血压') && !menuItem.isSuitableFor.hypertension) {
            conflicts.push('菜品不适合高血压患者');
        }
        if (elder.dietaryRestrictions.includes('素食') && !menuItem.isSuitableFor.vegetarian) {
            conflicts.push('菜品不适合素食者');
        }
        elder.dietaryRestrictions.forEach(restriction => {
            const lowerRestriction = restriction.toLowerCase();
            if (menuItem.ingredients.some(i => i.toLowerCase().includes(lowerRestriction))) {
                conflicts.push(`菜品含忌口食材: ${restriction}`);
            }
        });
        return conflicts;
    }
    createMealPlan(elderId, menuItemId, date, mealType) {
        const elder = database_1.db.getElderById(elderId);
        if (!elder) {
            return { success: false, error: '老人不存在' };
        }
        const menuItem = database_1.db.getMenuItemById(menuItemId);
        if (!menuItem) {
            return { success: false, error: '菜品不存在' };
        }
        const existingPlans = database_1.db.getMealPlansByElderAndDate(elderId, date);
        if (existingPlans.some(p => p.mealType === mealType && p.status !== 'cancelled')) {
            return { success: false, error: '该日期该餐次已有配餐计划' };
        }
        const conflicts = this.checkConflicts(elder, menuItem);
        const mealPlan = database_1.db.addMealPlan({
            elderId,
            menuItemId,
            date,
            mealType,
            status: conflicts.length > 0 ? 'planned' : 'confirmed',
        });
        if (conflicts.length > 0) {
            database_1.db.addConflictsToMealPlan(mealPlan.id, conflicts);
        }
        return { success: true, mealPlan, conflicts };
    }
    modifyMealPlan(mealPlanId, newMenuItemId) {
        const existingPlan = database_1.db.getMealPlanById(mealPlanId);
        if (!existingPlan) {
            return { success: false, error: '配餐计划不存在' };
        }
        if (existingPlan.status === 'cancelled') {
            return { success: false, error: '已取消的配餐计划不能修改' };
        }
        const elder = database_1.db.getElderById(existingPlan.elderId);
        if (!elder) {
            return { success: false, error: '老人信息不存在' };
        }
        const newMenuItem = database_1.db.getMenuItemById(newMenuItemId);
        if (!newMenuItem) {
            return { success: false, error: '新菜品不存在' };
        }
        const conflicts = this.checkConflicts(elder, newMenuItem);
        const updatedPlan = database_1.db.updateMealPlan(mealPlanId, {
            menuItemId: newMenuItemId,
            status: 'modified',
            conflicts: [],
        });
        if (updatedPlan && conflicts.length > 0) {
            database_1.db.addConflictsToMealPlan(mealPlanId, conflicts);
        }
        return { success: true, mealPlan: updatedPlan, conflicts };
    }
    cancelMealPlan(mealPlanId) {
        const existingPlan = database_1.db.getMealPlanById(mealPlanId);
        if (!existingPlan) {
            return { success: false, error: '配餐计划不存在' };
        }
        const updatedPlan = database_1.db.updateMealPlan(mealPlanId, { status: 'cancelled' });
        return { success: true, mealPlan: updatedPlan };
    }
    createDeliveryFromMealPlan(mealPlanId) {
        const mealPlan = database_1.db.getMealPlanById(mealPlanId);
        if (!mealPlan) {
            return { success: false, error: '配餐计划不存在' };
        }
        if (mealPlan.status === 'cancelled') {
            return { success: false, error: '配餐计划已取消' };
        }
        const elder = database_1.db.getElderById(mealPlan.elderId);
        if (!elder) {
            return { success: false, error: '老人信息不存在' };
        }
        const existingDeliveries = database_1.db.getDeliveries();
        if (existingDeliveries.some(d => d.mealPlanId === mealPlanId)) {
            return { success: false, error: '该配餐计划已有配送记录' };
        }
        const delivery = database_1.db.addDelivery({
            mealPlanId,
            elderId: mealPlan.elderId,
            date: mealPlan.date,
            route: elder.deliveryRoute,
            status: 'pending',
        });
        return { success: true, delivery };
    }
    updateDeliveryStatus(deliveryId, status, notes) {
        const delivery = database_1.db.getDeliveryById(deliveryId);
        if (!delivery) {
            return { success: false, error: '配送记录不存在' };
        }
        const updatedDelivery = database_1.db.updateDeliveryStatus(deliveryId, status, notes);
        return { success: true, delivery: updatedDelivery };
    }
    getDeliveriesByRouteAndDate(route, date) {
        return database_1.db.getDeliveries().filter(d => d.route === route && d.date === date);
    }
    createFollowUp(elderId, date, options) {
        const elder = database_1.db.getElderById(elderId);
        if (!elder) {
            return { success: false, error: '老人不存在' };
        }
        if (options.mealPlanId && !database_1.db.getMealPlanById(options.mealPlanId)) {
            return { success: false, error: '配餐计划不存在' };
        }
        const followUp = database_1.db.addFollowUp({
            elderId,
            date,
            mealPlanId: options.mealPlanId,
            satisfaction: options.satisfaction,
            feedback: options.feedback,
            issues: options.issues,
        });
        return { success: true, followUp };
    }
    getElderMealHistory(elderId, limit) {
        const plans = database_1.db.getMealPlans()
            .filter(p => p.elderId === elderId)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return limit ? plans.slice(0, limit) : plans;
    }
    getDailyReport(date) {
        const plans = database_1.db.getMealPlans().filter(p => p.date === date);
        const deliveries = database_1.db.getDeliveries().filter(d => d.date === date);
        return {
            totalPlans: plans.length,
            confirmedPlans: plans.filter(p => p.status === 'confirmed').length,
            plansWithConflicts: plans.filter(p => p.conflicts.length > 0).length,
            totalDeliveries: deliveries.length,
            pendingDeliveries: deliveries.filter(d => d.status === 'pending').length,
            delivered: deliveries.filter(d => d.status === 'delivered').length,
        };
    }
}
exports.CanteenService = CanteenService;
exports.service = new CanteenService();

import {
  Dish,
  StoreInventory,
  HeadquartersNotice,
  ShelfVerificationResult,
  AffectedDish,
  AffectedStore,
  RelatedComboDish,
  VerificationIssue,
  VerificationSummary
} from './types.js';

export class DishShelfVerifier {
  private dishes: Dish[] = [];
  private inventory: StoreInventory[] = [];
  private notices: HeadquartersNotice[] = [];
  private effectiveDate: string;

  constructor(effectiveDate?: string) {
    this.effectiveDate = effectiveDate || new Date().toISOString().split('T')[0];
  }

  loadData(dishes: Dish[], inventory: StoreInventory[], notices: HeadquartersNotice[]): void {
    this.dishes = dishes;
    this.inventory = inventory;
    this.notices = notices;
  }

  verify(): ShelfVerificationResult {
    const targetDishIds = this.getTargetDishIds();
    const affectedDishes = this.processAffectedDishes(targetDishIds);
    const summary = this.generateSummary(affectedDishes);

    return {
      verificationId: `VER-${Date.now()}`,
      verificationDate: this.effectiveDate,
      affectedDishes,
      summary
    };
  }

  private getTargetDishIds(): string[] {
    const dishIds: Set<string> = new Set();
    
    this.notices
      .filter(notice => notice.noticeType === '下架通知')
      .forEach(notice => {
        notice.targetDishIds.forEach(id => dishIds.add(id));
      });

    return Array.from(dishIds);
  }

  private processAffectedDishes(targetDishIds: string[]): AffectedDish[] {
    const affectedDishes: AffectedDish[] = [];

    for (const dishId of targetDishIds) {
      const dish = this.dishes.find(d => d.dishId === dishId);
      if (!dish) {
        continue;
      }

      const affectedStores = this.getAffectedStores(dishId);
      const relatedComboDishes = this.findRelatedComboDishes(dishId);
      const scheduledInfo = this.checkScheduledConflict(dish);
      const impactLevel = this.calculateImpactLevel(dish, affectedStores, relatedComboDishes);
      const reason = this.generateReason(dish, affectedStores, relatedComboDishes, scheduledInfo);

      affectedDishes.push({
        dishId: dish.dishId,
        dishName: dish.dishName,
        dishType: dish.dishType,
        reason,
        impactLevel,
        affectedStores,
        relatedComboDishes,
        scheduledInfo
      });
    }

    return affectedDishes;
  }

  private getAffectedStores(dishId: string): AffectedStore[] {
    const dish = this.dishes.find(d => d.dishId === dishId);
    if (!dish) return [];

    return this.inventory
      .filter(inv => inv.dishId === dishId && inv.stockQuantity > 0)
      .map(inv => ({
        storeId: inv.storeId,
        storeName: inv.storeName,
        remainingStock: inv.stockQuantity,
        unit: inv.unit,
        stockValue: inv.stockQuantity * dish.price
      }));
  }

  private findRelatedComboDishes(componentDishId: string): RelatedComboDish[] {
    return this.dishes
      .filter(dish => 
        dish.isCombo && 
        dish.comboComponents && 
        dish.comboComponents.includes(componentDishId)
      )
      .map(dish => ({
        dishId: dish.dishId,
        dishName: dish.dishName,
        status: dish.status
      }));
  }

  private checkScheduledConflict(dish: Dish) {
    if (dish.status !== '定时上架' || !dish.scheduledOnTime) {
      return { isScheduled: false };
    }

    const scheduledDate = new Date(dish.scheduledOnTime);
    const effectiveDate = new Date(this.effectiveDate);
    
    if (scheduledDate <= effectiveDate) {
      return {
        isScheduled: true,
        scheduledTime: dish.scheduledOnTime,
        conflictDescription: `该菜品定于 ${dish.scheduledOnTime} 上架，与下架通知冲突`
      };
    }

    return {
      isScheduled: true,
      scheduledTime: dish.scheduledOnTime
    };
  }

  private calculateImpactLevel(
    dish: Dish,
    affectedStores: AffectedStore[],
    relatedComboDishes: RelatedComboDish[]
  ): '高' | '中' | '低' {
    const totalStockValue = affectedStores.reduce((sum, s) => sum + s.stockValue, 0);
    const hasComboImpact = relatedComboDishes.length > 0;
    const hasScheduledConflict = dish.status === '定时上架';

    if (totalStockValue > 10000 || hasComboImpact || hasScheduledConflict) {
      return '高';
    } else if (totalStockValue > 1000 || affectedStores.length > 5) {
      return '中';
    }
    return '低';
  }

  private generateReason(
    dish: Dish,
    affectedStores: AffectedStore[],
    relatedComboDishes: RelatedComboDish[],
    scheduledInfo: { isScheduled: boolean; scheduledTime?: string; conflictDescription?: string }
  ): string {
    const reasons: string[] = [];
    
    const notice = this.notices.find(n => 
      n.noticeType === '下架通知' && n.targetDishIds.includes(dish.dishId)
    );
    if (notice) {
      reasons.push(`总部下架通知: ${notice.reason}`);
    }

    if (affectedStores.length > 0) {
      const totalStock = affectedStores.reduce((sum, s) => sum + s.remainingStock, 0);
      reasons.push(`${affectedStores.length}家门店剩余库存共${totalStock}${affectedStores[0]?.unit || ''}`);
    }

    if (relatedComboDishes.length > 0) {
      reasons.push(`影响${relatedComboDishes.length}个组合菜: ${relatedComboDishes.map(c => c.dishName).join(', ')}`);
    }

    if (scheduledInfo.conflictDescription) {
      reasons.push(scheduledInfo.conflictDescription);
    }

    return reasons.join('; ');
  }

  private generateSummary(affectedDishes: AffectedDish[]): VerificationSummary {
    const issues: VerificationIssue[] = [];
    const affectedStoreSet = new Set<string>();
    let totalStockValue = 0;
    let highImpactCount = 0;
    let mediumImpactCount = 0;
    let lowImpactCount = 0;
    let comboDishImpactCount = 0;
    let scheduledConflictCount = 0;

    for (const dish of affectedDishes) {
      for (const store of dish.affectedStores) {
        affectedStoreSet.add(store.storeId);
        totalStockValue += store.stockValue;

        if (store.remainingStock > 100) {
          issues.push({
            type: '库存预警',
            severity: store.remainingStock > 500 ? 'error' : 'warning',
            message: `${store.storeName} 剩余 ${dish.dishName} 库存${store.remainingStock}${store.unit}，需尽快处理`,
            dishId: dish.dishId,
            storeId: store.storeId
          });
        }
      }

      if (dish.impactLevel === '高') highImpactCount++;
      else if (dish.impactLevel === '中') mediumImpactCount++;
      else lowImpactCount++;

      if (dish.relatedComboDishes.length > 0) {
        comboDishImpactCount++;
        issues.push({
          type: '组合菜影响',
          severity: 'warning',
          message: `${dish.dishName} 下架将影响 ${dish.relatedComboDishes.length} 个组合菜`,
          dishId: dish.dishId
        });
      }

      if (dish.scheduledInfo?.conflictDescription) {
        scheduledConflictCount++;
        issues.push({
          type: '定时上架冲突',
          severity: 'error',
          message: `${dish.dishName}: ${dish.scheduledInfo.conflictDescription}`,
          dishId: dish.dishId
        });
      }
    }

    const allNoticeDishIds = new Set(this.getTargetDishIds());
    const dishesNotFound = Array.from(allNoticeDishIds).filter(
      id => !this.dishes.find(d => d.dishId === id)
    );
    for (const dishId of dishesNotFound) {
      issues.push({
        type: '数据异常',
        severity: 'error',
        message: `菜品ID ${dishId} 在菜品表中未找到`,
        dishId
      });
    }

    return {
      totalAffectedDishes: affectedDishes.length,
      totalAffectedStores: affectedStoreSet.size,
      totalStockValue,
      highImpactCount,
      mediumImpactCount,
      lowImpactCount,
      comboDishImpactCount,
      scheduledConflictCount,
      issues
    };
  }
}

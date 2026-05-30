const GameEngine = (function() {
    function buyIngredient(ingredientKey, quantity) {
        const state = GameState.getState();
        const ingredientsData = GameState.getIngredientsData();
        const ingredient = ingredientsData[ingredientKey];
        
        if (!ingredient) {
            GameState.addLog(`❌ 无效的食材: ${ingredientKey}`, 'error');
            return { success: false, error: 'invalid_ingredient' };
        }

        const priceMultiplier = state.currentEvent?.impact?.priceMultiplier || 1;
        const unitPrice = state.ingredientPrices[ingredientKey] * priceMultiplier;
        const totalCost = unitPrice * quantity;

        if (state.cash < totalCost) {
            const overdraftAmount = state.cash - totalCost;
            GameState.addPendingRecord('overdraft', {
                action: 'buy_ingredient',
                ingredientKey,
                quantity,
                unitPrice,
                amount: overdraftAmount,
                newCash: state.cash - totalCost
            }, `购买${ingredient.name} x${quantity} 现金不足，透支 ¥${Math.abs(overdraftAmount).toFixed(2)}`);
            return { success: false, error: 'insufficient_funds', pending: true };
        }

        state.cash -= totalCost;
        state.statistics.totalCost += totalCost;

        if (!state.inventory[ingredientKey]) {
            state.inventory[ingredientKey] = [];
        }

        state.inventory[ingredientKey].push({
            quantity,
            price: unitPrice,
            purchaseRound: state.round,
            remainingLife: ingredient.perishTime
        });

        GameState.addLog(`✅ 购买 ${ingredient.emoji}${ingredient.name} x${quantity}，单价 ¥${unitPrice.toFixed(2)}，花费 ¥${totalCost.toFixed(2)}`, 'success');
        GameState.saveToStorage();
        return { success: true, cost: totalCost };
    }

    function getIngredientInventory(ingredientKey) {
        const state = GameState.getState();
        const items = state.inventory[ingredientKey] || [];
        let totalQuantity = 0;
        let totalValue = 0;

        items.forEach(item => {
            totalQuantity += item.quantity;
            totalValue += item.quantity * item.price;
        });

        return { quantity: totalQuantity, value: totalValue, items };
    }

    function getAllInventorySummary() {
        const state = GameState.getState();
        const ingredientsData = GameState.getIngredientsData();
        const summary = {};

        Object.keys(ingredientsData).forEach(key => {
            const inv = getIngredientInventory(key);
            summary[key] = {
                ...ingredientsData[key],
                quantity: inv.quantity,
                value: inv.value
            };
        });

        return summary;
    }

    function buyFund(fundKey, shares) {
        const state = GameState.getState();
        const fundsData = GameState.getFundsData();
        const fund = fundsData[fundKey];

        if (!fund) {
            GameState.addLog(`❌ 无效的基金: ${fundKey}`, 'error');
            return { success: false, error: 'invalid_fund' };
        }

        if (shares <= 0) {
            return { success: false, error: 'invalid_shares' };
        }

        const fundState = state.funds[fundKey];
        const totalCost = fundState.currentPrice * shares;

        if (state.cash < totalCost) {
            const overdraftAmount = state.cash - totalCost;
            GameState.addPendingRecord('overdraft', {
                action: 'buy_fund',
                fundKey,
                shares,
                price: fundState.currentPrice,
                amount: overdraftAmount,
                newCash: state.cash - totalCost
            }, `购买${fund.name} ${shares}份 现金不足，透支 ¥${Math.abs(overdraftAmount).toFixed(2)}`);
            return { success: false, error: 'insufficient_funds', pending: true };
        }

        const totalShares = fundState.shares + shares;
        const totalCostBasis = fundState.avgCost * fundState.shares + totalCost;
        const newAvgCost = totalShares > 0 ? totalCostBasis / totalShares : 0;

        state.cash -= totalCost;
        fundState.shares = totalShares;
        fundState.avgCost = newAvgCost;

        GameState.addLog(`📈 买入 ${fund.emoji}${fund.name} ${shares}份，单价 ¥${fundState.currentPrice.toFixed(2)}，花费 ¥${totalCost.toFixed(2)}`, 'success');
        GameState.saveToStorage();
        return { success: true, cost: totalCost };
    }

    function sellFund(fundKey, shares) {
        const state = GameState.getState();
        const fundsData = GameState.getFundsData();
        const fund = fundsData[fundKey];

        if (!fund) {
            GameState.addLog(`❌ 无效的基金: ${fundKey}`, 'error');
            return { success: false, error: 'invalid_fund' };
        }

        const fundState = state.funds[fundKey];

        if (fundState.shares < shares) {
            GameState.addLog(`❌ ${fund.name} 份额不足`, 'error');
            return { success: false, error: 'insufficient_shares' };
        }

        const totalRevenue = fundState.currentPrice * shares;
        const costBasis = fundState.avgCost * shares;
        const realizedGain = totalRevenue - costBasis;

        const remainingShares = fundState.shares - shares;
        if (remainingShares === 0) {
            fundState.avgCost = 0;
        }

        state.cash += totalRevenue;
        fundState.shares = remainingShares;
        state.statistics.fundRealizedGain += realizedGain;

        const gainText = realizedGain >= 0 ? `盈利 ¥${realizedGain.toFixed(2)}` : `亏损 ¥${Math.abs(realizedGain).toFixed(2)}`;
        GameState.addLog(`📉 卖出 ${fund.emoji}${fund.name} ${shares}份，单价 ¥${fundState.currentPrice.toFixed(2)}，收入 ¥${totalRevenue.toFixed(2)}，${gainText}`, 
            realizedGain >= 0 ? 'success' : 'warning');
        GameState.saveToStorage();
        return { success: true, revenue: totalRevenue, realizedGain };
    }

    function processOrder(orderId) {
        const state = GameState.getState();
        const recipes = GameState.getRecipes();
        const order = state.orders.find(o => o.id === orderId);

        if (!order) {
            GameState.addLog(`❌ 订单不存在`, 'error');
            return { success: false, error: 'order_not_found' };
        }

        if (order.status !== 'pending') {
            GameState.addLog(`❌ 订单已处理`, 'error');
            return { success: false, error: 'order_already_processed' };
        }

        const recipe = recipes[order.recipeKey];
        const ingredientsNeeded = { ...recipe.ingredients };
        const inventoryToUse = [];

        for (const [ingKey, quantityNeeded] of Object.entries(ingredientsNeeded)) {
            const inventory = state.inventory[ingKey] || [];
            let remainingNeeded = quantityNeeded;

            const sortedInventory = [...inventory].sort((a, b) => a.remainingLife - b.remainingLife);

            for (const item of sortedInventory) {
                if (remainingNeeded <= 0) break;
                
                const useQty = Math.min(item.quantity, remainingNeeded);
                if (useQty > 0) {
                    inventoryToUse.push({
                        item,
                        ingredientKey: ingKey,
                        quantity: useQty
                    });
                    remainingNeeded -= useQty;
                }
            }

            if (remainingNeeded > 0) {
                const ingredientsData = GameState.getIngredientsData();
                GameState.addLog(`❌ 食材不足，需要 ${ingredientsData[ingKey].name} x${remainingNeeded}`, 'error');
                return { success: false, error: 'insufficient_ingredients' };
            }
        }

        for (const use of inventoryToUse) {
            use.item.quantity -= use.quantity;
        }

        Object.keys(state.inventory).forEach(ingKey => {
            state.inventory[ingKey] = state.inventory[ingKey].filter(item => item.quantity > 0);
        });

        state.cash += order.price;
        state.statistics.totalRevenue += order.price;
        state.statistics.totalOrdersCompleted++;
        order.status = 'completed';

        GameState.addLog(`✅ 完成订单 ${recipe.emoji}${recipe.name}，收入 ¥${order.price.toFixed(2)}`, 'success');
        GameState.saveToStorage();
        return { success: true, revenue: order.price };
    }

    function processAllOrders() {
        const state = GameState.getState();
        const results = [];

        for (const order of state.orders) {
            if (order.status === 'pending') {
                const result = processOrder(order.id);
                results.push({ order, result });
            }
        }

        return results;
    }

    function nextRound() {
        const state = GameState.getState();
        
        updateFundPrices();
        processPerishables();
        decreaseOrderPatience();
        const newEvent = generateMarketEvent();
        updateIngredientPrices();
        GameState.generateOrders();
        
        state.round++;
        state.phase = 'preparation';
        
        GameState.addLog(`--- 第 ${state.round} 回合开始 ---`, 'info');
        GameState.addLog(`📰 ${newEvent.name}: ${newEvent.effect}`, 'info');
        
        calculateUnrealizedGains();
        GameState.saveSnapshot(`回合 ${state.round}`);
        GameState.saveToStorage();
        
        return { newRound: state.round, event: newEvent };
    }

    function updateFundPrices() {
        const state = GameState.getState();
        const fundsData = GameState.getFundsData();
        const eventMultiplier = state.currentEvent?.impact?.fundReturnMultiplier || 1;

        Object.keys(fundsData).forEach(key => {
            const fund = fundsData[key];
            const fundState = state.funds[key];
            
            const baseReturn = fund.expectedReturn * eventMultiplier;
            const randomFactor = (Math.random() - 0.5) * 2 * fund.volatility;
            const totalReturn = baseReturn + randomFactor;
            
            const newPrice = Math.max(1, fundState.currentPrice * (1 + totalReturn));
            fundState.currentPrice = Math.round(newPrice * 100) / 100;
        });
    }

    function processPerishables() {
        const state = GameState.getState();
        const ingredientsData = GameState.getIngredientsData();
        let wastedCount = 0;
        let wastedValue = 0;

        Object.keys(state.inventory).forEach(ingKey => {
            const items = state.inventory[ingKey];
            const perishedItems = [];

            items.forEach(item => {
                item.remainingLife--;
                if (item.remainingLife <= 0) {
                    perishedItems.push(item);
                    wastedCount += item.quantity;
                    wastedValue += item.quantity * item.price;
                }
            });

            if (perishedItems.length > 0) {
                const ingredient = ingredientsData[ingKey];
                GameState.addLog(`🗑️ ${ingredient.emoji}${ingredient.name} 变质 x${wastedCount}，损失 ¥${wastedValue.toFixed(2)}`, 'warning');
                state.statistics.ingredientsWasted += wastedValue;
            }

            state.inventory[ingKey] = items.filter(item => item.remainingLife > 0);
        });
    }

    function decreaseOrderPatience() {
        const state = GameState.getState();

        state.orders.forEach(order => {
            if (order.status === 'pending') {
                order.patience--;
                if (order.patience <= 0) {
                    order.status = 'expired';
                    state.statistics.totalOrdersFailed++;
                    GameState.addLog(`⏰ 订单 ${order.emoji}${order.recipeName} 超时取消，顾客等待时间过长`, 'warning');
                }
            }
        });
    }

    function generateMarketEvent() {
        const state = GameState.getState();
        const events = GameState.getMarketEvents();
        
        const rand = Math.random();
        let cumulative = 0;
        let selectedEvent = events[0];

        for (const event of events) {
            cumulative += event.probability;
            if (rand < cumulative) {
                selectedEvent = event;
                break;
            }
        }

        state.currentEvent = selectedEvent;
        return selectedEvent;
    }

    function updateIngredientPrices() {
        const state = GameState.getState();
        const ingredientsData = GameState.getIngredientsData();

        Object.keys(ingredientsData).forEach(key => {
            const basePrice = ingredientsData[key].basePrice;
            const fluctuation = (Math.random() - 0.5) * 0.2;
            state.ingredientPrices[key] = Math.round(basePrice * (1 + fluctuation) * 100) / 100;
        });
    }

    function calculateUnrealizedGains() {
        const state = GameState.getState();
        let totalUnrealized = 0;

        Object.keys(state.funds).forEach(key => {
            const fundState = state.funds[key];
            const marketValue = fundState.shares * fundState.currentPrice;
            const costBasis = fundState.shares * fundState.avgCost;
            totalUnrealized += (marketValue - costBasis);
        });

        state.statistics.fundUnrealizedGain = totalUnrealized;
        return totalUnrealized;
    }

    function generateReport() {
        const state = GameState.getState();
        const portfolio = GameState.getPortfolioValue();
        const recipes = GameState.getRecipes();
        
        const totalReturn = portfolio.total - state.initialCash;
        const returnRate = (totalReturn / state.initialCash) * 100;

        const orderStats = {
            completed: state.statistics.totalOrdersCompleted,
            failed: state.statistics.totalOrdersFailed,
            total: state.statistics.totalOrdersCompleted + state.statistics.totalOrdersFailed,
            successRate: 0
        };
        if (orderStats.total > 0) {
            orderStats.successRate = (orderStats.completed / orderStats.total) * 100;
        }

        const fundStats = {
            realizedGain: state.statistics.fundRealizedGain,
            unrealizedGain: calculateUnrealizedGains(),
            totalGain: state.statistics.fundRealizedGain + calculateUnrealizedGains()
        };

        const inventoryDetails = [];
        const inventorySummary = getAllInventorySummary();
        Object.entries(inventorySummary).forEach(([key, data]) => {
            if (data.quantity > 0) {
                inventoryDetails.push({
                    key,
                    name: data.name,
                    emoji: data.emoji,
                    quantity: data.quantity,
                    value: data.value,
                    category: data.category
                });
            }
        });

        const fundAllocation = [];
        const fundsData = GameState.getFundsData();
        Object.entries(state.funds).forEach(([key, fundState]) => {
            if (fundState.shares > 0) {
                const fund = fundsData[key];
                const marketValue = fundState.shares * fundState.currentPrice;
                const costBasis = fundState.shares * fundState.avgCost;
                fundAllocation.push({
                    key,
                    name: fund.name,
                    emoji: fund.emoji,
                    category: fund.category,
                    shares: fundState.shares,
                    avgCost: fundState.avgCost,
                    currentPrice: fundState.currentPrice,
                    marketValue,
                    costBasis,
                    gain: marketValue - costBasis
                });
            }
        });

        const assetAllocation = {
            cash: portfolio.cash,
            ingredients: portfolio.ingredientsValue,
            funds: portfolio.fundsValue,
            cashPercent: (portfolio.cash / portfolio.total) * 100,
            ingredientsPercent: (portfolio.ingredientsValue / portfolio.total) * 100,
            fundsPercent: (portfolio.fundsValue / portfolio.total) * 100
        };

        const insights = [];
        if (assetAllocation.cashPercent > 50) {
            insights.push({ type: 'warning', text: '现金占比过高，可能存在资金闲置' });
        }
        if (assetAllocation.fundsPercent < 20 && state.round > 3) {
            insights.push({ type: 'info', text: '基金配置比例较低，可考虑分散投资' });
        }
        if (orderStats.successRate < 70 && orderStats.total > 5) {
            insights.push({ type: 'warning', text: '订单成功率偏低，需关注食材储备和订单处理节奏' });
        }
        if (state.statistics.ingredientsWasted > 50) {
            insights.push({ type: 'warning', text: `食材浪费较多 (¥${state.statistics.ingredientsWasted.toFixed(2)})，需优化采购量` });
        }
        if (fundStats.totalGain > 0) {
            insights.push({ type: 'success', text: `投资收益良好，累计盈利 ¥${fundStats.totalGain.toFixed(2)}` });
        } else if (fundStats.totalGain < 0) {
            insights.push({ type: 'warning', text: `投资出现浮亏 ¥${Math.abs(fundStats.totalGain).toFixed(2)}，需关注风险` });
        }

        return {
            round: state.round,
            portfolio: {
                ...portfolio,
                totalReturn,
                returnRate
            },
            orders: orderStats,
            funds: fundStats,
            inventory: inventoryDetails,
            fundAllocation,
            assetAllocation,
            statistics: {
                ...state.statistics,
                grossMargin: state.statistics.totalRevenue > 0 
                    ? ((state.statistics.totalRevenue - state.statistics.totalCost) / state.statistics.totalRevenue) * 100 
                    : 0
            },
            insights,
            recommendations: generateRecommendations(assetAllocation, orderStats, fundStats)
        };
    }

    function generateRecommendations(assetAllocation, orderStats, fundStats) {
        const recommendations = [];

        if (assetAllocation.cashPercent > 40) {
            recommendations.push({
                area: '资金配置',
                priority: 'high',
                text: '适当减少现金持有，增加食材采购或基金投资以提高资金使用效率'
            });
        }

        if (orderStats.successRate < 80) {
            recommendations.push({
                area: '运营管理',
                priority: 'high',
                text: '建立安全库存，确保热门食材充足供应，提高订单完成率'
            });
        }

        if (fundStats.realizedGain === 0 && fundStats.unrealizedGain !== 0) {
            recommendations.push({
                area: '投资策略',
                priority: 'medium',
                text: '考虑适时止盈或止损，锁定投资收益'
            });
        }

        recommendations.push({
            area: '风险控制',
            priority: 'medium',
            text: '关注食材保质期，采用先进先出策略减少浪费'
        });

        return recommendations;
    }

    return {
        buyIngredient,
        getIngredientInventory,
        getAllInventorySummary,
        buyFund,
        sellFund,
        processOrder,
        processAllOrders,
        nextRound,
        generateReport,
        calculateUnrealizedGains
    };
})();

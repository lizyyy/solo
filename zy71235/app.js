const TradingGame = (function() {
    'use strict';

    const GamePhase = {
        PREPARE: 'prepare',
        TRADING: 'trading',
        PAUSED: 'paused',
        SETTLED: 'settled'
    };

    const OrderSide = {
        BUY: 'buy',
        SELL: 'sell'
    };

    const OrderType = {
        LIMIT: 'limit',
        MARKET: 'market'
    };

    const OrderStatus = {
        PENDING: 'pending',
        PARTIAL: 'partial',
        FILLED: 'filled',
        CANCELLED: 'cancelled',
        REJECTED: 'rejected'
    };

    const ViolationSeverity = {
        HIGH: 'high',
        MEDIUM: 'medium',
        LOW: 'low'
    };

    const CircuitBreakerLevel = {
        NONE: 'none',
        LEVEL1: 'level1',
        LEVEL2: 'level2',
        MARKET: 'market'
    };

    class Stock {
        constructor(data) {
            this.code = data.code;
            this.name = data.name;
            this.basePrice = data.basePrice;
            this.currentPrice = data.basePrice;
            this.previousClose = data.basePrice;
            this.upperLimit = data.basePrice * 1.1;
            this.lowerLimit = data.basePrice * 0.9;
            this.circuitBreaker = data.circuitBreaker || {
                level1: 0.05,
                level2: 0.07,
                cooldown: 300
            };
            this.halted = false;
            this.haltReason = null;
            this.haltStartTime = null;
            this.askOrders = [];
            this.bidOrders = [];
            this.priceHistory = [{ time: Date.now(), price: this.basePrice }];
            this.volume = 0;
            this.turnover = 0;
        }

        getPriceChange() {
            return this.currentPrice - this.previousClose;
        }

        getPriceChangePercent() {
            return ((this.currentPrice - this.previousClose) / this.previousClose) * 100;
        }

        checkCircuitBreaker() {
            const changePercent = Math.abs(this.getPriceChangePercent()) / 100;
            if (changePercent >= this.circuitBreaker.level2) {
                return CircuitBreakerLevel.LEVEL2;
            } else if (changePercent >= this.circuitBreaker.level1) {
                return CircuitBreakerLevel.LEVEL1;
            }
            return CircuitBreakerLevel.NONE;
        }

        updatePrice(price) {
            this.currentPrice = Math.max(this.lowerLimit, Math.min(this.upperLimit, price));
            this.priceHistory.push({ time: Date.now(), price: this.currentPrice });
        }
    }

    class Order {
        constructor(data) {
            this.id = data.id || `ORD${Date.now()}${Math.random().toString(36).substr(2, 6)}`;
            this.stockCode = data.stockCode;
            this.side = data.side;
            this.type = data.type;
            this.price = parseFloat(data.price);
            this.quantity = parseInt(data.quantity);
            this.filledQuantity = 0;
            this.status = OrderStatus.PENDING;
            this.createTime = data.createTime || Date.now();
            this.updateTime = this.createTime;
            this.trades = [];
            this.version = data.version || 1;
            this.remark = data.remark || '';
        }

        get remainingQuantity() {
            return this.quantity - this.filledQuantity;
        }

        get isFilled() {
            return this.filledQuantity >= this.quantity;
        }
    }

    class Trade {
        constructor(data) {
            this.id = data.id || `TRD${Date.now()}${Math.random().toString(36).substr(2, 6)}`;
            this.stockCode = data.stockCode;
            this.buyOrderId = data.buyOrderId;
            this.sellOrderId = data.sellOrderId;
            this.price = parseFloat(data.price);
            this.quantity = parseInt(data.quantity);
            this.amount = this.price * this.quantity;
            this.time = data.time || Date.now();
            this.version = data.version || 1;
        }
    }

    class Position {
        constructor(data) {
            this.stockCode = data.stockCode;
            this.stockName = data.stockName;
            this.quantity = parseInt(data.quantity) || 0;
            this.availableQuantity = parseInt(data.availableQuantity) || 0;
            this.frozenQuantity = parseInt(data.frozenQuantity) || 0;
            this.costPrice = parseFloat(data.costPrice) || 0;
            this.currentPrice = parseFloat(data.currentPrice) || 0;
        }

        get marketValue() {
            return this.quantity * this.currentPrice;
        }

        get profit() {
            return (this.currentPrice - this.costPrice) * this.quantity;
        }

        get profitPercent() {
            if (this.costPrice === 0) return 0;
            return ((this.currentPrice - this.costPrice) / this.costPrice) * 100;
        }
    }

    class Account {
        constructor(initialCash = 1000000) {
            this.initialCash = initialCash;
            this.availableCash = initialCash;
            this.frozenCash = 0;
            this.positions = new Map();
            this.cashHistory = [{ time: Date.now(), cash: initialCash }];
        }

        get totalCash() {
            return this.availableCash + this.frozenCash;
        }

        get totalAssets() {
            let positionValue = 0;
            this.positions.forEach(pos => {
                positionValue += pos.marketValue;
            });
            return this.totalCash + positionValue;
        }

        get positionValue() {
            let value = 0;
            this.positions.forEach(pos => {
                value += pos.marketValue;
            });
            return value;
        }

        get totalProfit() {
            return this.totalAssets - this.initialCash;
        }

        get totalProfitPercent() {
            return (this.totalProfit / this.initialCash) * 100;
        }

        freezeCash(amount) {
            if (this.availableCash < amount) {
                return false;
            }
            this.availableCash -= amount;
            this.frozenCash += amount;
            return true;
        }

        unfreezeCash(amount) {
            if (this.frozenCash < amount) {
                amount = this.frozenCash;
            }
            this.frozenCash -= amount;
            this.availableCash += amount;
            return true;
        }

        updatePosition(stockCode, stockName, quantity, price, side) {
            let position = this.positions.get(stockCode);
            if (!position) {
                position = new Position({
                    stockCode,
                    stockName,
                    quantity: 0,
                    availableQuantity: 0,
                    costPrice: price
                });
                this.positions.set(stockCode, position);
            }

            if (side === OrderSide.BUY) {
                const totalCost = position.costPrice * position.quantity + price * quantity;
                const totalQuantity = position.quantity + quantity;
                position.costPrice = totalQuantity > 0 ? totalCost / totalQuantity : 0;
                position.quantity += quantity;
                position.availableQuantity += quantity;
            } else {
                position.quantity -= quantity;
                position.availableQuantity -= quantity;
                if (position.quantity <= 0) {
                    this.positions.delete(stockCode);
                }
            }
        }

        freezePosition(stockCode, quantity) {
            const position = this.positions.get(stockCode);
            if (!position || position.availableQuantity < quantity) {
                return false;
            }
            position.availableQuantity -= quantity;
            position.frozenQuantity += quantity;
            return true;
        }

        unfreezePosition(stockCode, quantity) {
            const position = this.positions.get(stockCode);
            if (!position || position.frozenQuantity < quantity) {
                return false;
            }
            position.frozenQuantity -= quantity;
            position.availableQuantity += quantity;
            return true;
        }
    }

    class Violation {
        constructor(data) {
            this.id = data.id || `VIO${Date.now()}${Math.random().toString(36).substr(2, 6)}`;
            this.type = data.type;
            this.severity = data.severity;
            this.description = data.description;
            this.time = data.time || Date.now();
            this.penalty = data.penalty || 0;
            this.orderId = data.orderId;
            this.stockCode = data.stockCode;
        }
    }

    class Score {
        constructor() {
            this.baseScore = 100;
            this.profitScore = 0;
            this.complianceScore = 0;
            this.violationScore = 0;
            this.circuitScore = 0;
            this.finalScore = 100;
            this.violationCount = 0;
            this.severeViolationCount = 0;
        }

        calculate(account, violations, circuitBreakerEvents) {
            const profitPercent = account.totalProfitPercent;
            this.profitScore = Math.max(0, Math.min(50, Math.floor(profitPercent * 2)));

            this.violationScore = violations.reduce((sum, v) => sum + v.penalty, 0);
            this.violationCount = violations.length;
            this.severeViolationCount = violations.filter(v => v.severity === ViolationSeverity.HIGH).length;

            const maxComplianceScore = 30;
            this.complianceScore = Math.max(0, maxComplianceScore - this.severeViolationCount * 10 - this.violationCount * 2);

            const circuitHandled = circuitBreakerEvents.filter(e => e.handled).length;
            const circuitTotal = circuitBreakerEvents.length;
            this.circuitScore = circuitTotal > 0 ? Math.floor((circuitHandled / circuitTotal) * 20) : 20;

            this.finalScore = this.baseScore + this.profitScore + this.complianceScore + this.circuitScore - this.violationScore;
            this.finalScore = Math.max(0, Math.min(200, this.finalScore));

            return this.finalScore;
        }
    }

    class EventLog {
        constructor(type, data, description) {
            this.id = `EVT${Date.now()}${Math.random().toString(36).substr(2, 6)}`;
            this.type = type;
            this.time = Date.now();
            this.data = data;
            this.description = description;
            this.snapshot = null;
        }
    }

    class DataImportManager {
        constructor(game) {
            this.game = game;
            this.importedFiles = new Map();
            this.pendingFiles = [];
            this.duplicateMode = 'skip';
        }

        detectFileType(filename) {
            const lower = filename.toLowerCase();
            if (lower.includes('stock') || lower.includes('股票')) return 'stocks';
            if (lower.includes('order') || lower.includes('订单')) return 'orders';
            if (lower.includes('rule') || lower.includes('规则')) return 'rules';
            if (lower.includes('fund') || lower.includes('资金')) return 'funds';
            if (lower.includes('news') || lower.includes('新闻')) return 'news';
            if (lower.includes('report') || lower.includes('报告')) return 'reports';
            if (lower.includes('trade') || lower.includes('成交')) return 'trades';
            if (lower.includes('position') || lower.includes('持仓')) return 'positions';
            return 'unknown';
        }

        generateFileHash(content, filename) {
            let hash = 0;
            const str = filename + content;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return `HASH${Math.abs(hash).toString(16).toUpperCase()}`;
        }

        checkDuplicate(fileHash, filename) {
            if (this.importedFiles.has(fileHash)) {
                const existing = this.importedFiles.get(fileHash);
                return {
                    isDuplicate: true,
                    existingFile: existing,
                    fileHash
                };
            }
            
            const sameNameFiles = Array.from(this.importedFiles.values()).filter(f => f.filename === filename);
            if (sameNameFiles.length > 0) {
                return {
                    isDuplicate: true,
                    existingFile: sameNameFiles[sameNameFiles.length - 1],
                    fileHash,
                    isSameName: true
                };
            }
            
            return { isDuplicate: false, fileHash };
        }

        async processFiles(files) {
            this.pendingFiles = [];
            
            for (const file of files) {
                const content = await this.readFile(file);
                const fileHash = this.generateFileHash(content, file.name);
                const duplicateCheck = this.checkDuplicate(fileHash, file.name);
                const fileType = this.detectFileType(file.name);
                
                let parsedData = null;
                try {
                    parsedData = this.parseFileContent(content, file.name);
                } catch (e) {
                    this.game.showToast(`解析文件 ${file.name} 失败: ${e.message}`, 'error');
                    continue;
                }
                
                this.pendingFiles.push({
                    file,
                    content,
                    fileHash,
                    fileType,
                    parsedData,
                    isDuplicate: duplicateCheck.isDuplicate,
                    existingFile: duplicateCheck.existingFile,
                    isSameName: duplicateCheck.isSameName || false,
                    version: duplicateCheck.isDuplicate ? (duplicateCheck.existingFile.version || 1) + 1 : 1
                });
            }
            
            return this.pendingFiles;
        }

        async readFile(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e);
                reader.readAsText(file);
            });
        }

        parseFileContent(content, filename) {
            if (filename.endsWith('.json')) {
                return JSON.parse(content);
            } else if (filename.endsWith('.csv')) {
                return this.parseCSV(content);
            } else {
                return { rawContent: content };
            }
        }

        parseCSV(content) {
            const lines = content.split('\n').filter(line => line.trim());
            if (lines.length === 0) return [];
            
            const headers = lines[0].split(',').map(h => h.trim());
            const data = [];
            
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                const row = {};
                headers.forEach((header, idx) => {
                    row[header] = values[idx] || '';
                });
                data.push(row);
            }
            
            return data;
        }

        confirmImport(mode) {
            this.duplicateMode = mode;
            const results = {
                imported: [],
                skipped: [],
                updated: [],
                appended: []
            };
            
            for (const pendingFile of this.pendingFiles) {
                if (pendingFile.isDuplicate) {
                    if (mode === 'skip') {
                        results.skipped.push(pendingFile);
                        continue;
                    } else if (mode === 'overwrite') {
                        this.importedFiles.delete(pendingFile.existingFile.fileHash);
                        results.updated.push(pendingFile);
                    } else if (mode === 'append') {
                        results.appended.push(pendingFile);
                    }
                } else {
                    results.imported.push(pendingFile);
                }
                
                this.applyImportedData(pendingFile);
                
                this.importedFiles.set(pendingFile.fileHash, {
                    filename: pendingFile.file.name,
                    fileHash: pendingFile.fileHash,
                    fileType: pendingFile.fileType,
                    importTime: Date.now(),
                    version: pendingFile.version,
                    data: pendingFile.parsedData,
                    mode: mode
                });
            }
            
            this.pendingFiles = [];
            return results;
        }

        applyImportedData(pendingFile) {
            const { fileType, parsedData, isDuplicate, version } = pendingFile;
            
            switch (fileType) {
                case 'stocks':
                    this.importStocks(parsedData, version);
                    break;
                case 'orders':
                    this.importOrders(parsedData, version);
                    break;
                case 'rules':
                    this.importRules(parsedData);
                    break;
                case 'funds':
                    this.importFunds(parsedData);
                    break;
                case 'news':
                    this.importNews(parsedData, version);
                    break;
                case 'trades':
                    this.importTrades(parsedData, version);
                    break;
                case 'positions':
                    this.importPositions(parsedData);
                    break;
                default:
                    console.log(`Unknown file type: ${fileType}`);
            }
        }

        importStocks(data, version) {
            const stocks = Array.isArray(data) ? data : (data.stocks || []);
            stocks.forEach(stockData => {
                if (!stockData.code) return;
                
                const stock = new Stock({
                    code: stockData.code,
                    name: stockData.name || stockData.code,
                    basePrice: parseFloat(stockData.basePrice || stockData.price || 10),
                    circuitBreaker: stockData.circuitBreaker || {
                        level1: parseFloat(stockData.level1) || 0.05,
                        level2: parseFloat(stockData.level2) || 0.07,
                        cooldown: parseInt(stockData.cooldown) || 300
                    }
                });
                
                if (stockData.remark) {
                    stock.remark = stockData.remark;
                }
                
                stock.version = version;
                this.game.stocks.set(stock.code, stock);
                
                if (!this.game.selectedStock) {
                    this.game.selectedStock = stock.code;
                }
            });
            
            this.game.logEvent('system', { count: stocks.length, version }, `导入了 ${stocks.length} 只股票（版本${version}）`);
        }

        importOrders(data, version) {
            const orders = Array.isArray(data) ? data : (data.orders || []);
            orders.forEach(orderData => {
                if (!orderData.stockCode) return;
                
                const order = new Order({
                    stockCode: orderData.stockCode,
                    side: orderData.side || orderData.direction,
                    type: orderData.type || 'limit',
                    price: parseFloat(orderData.price),
                    quantity: parseInt(orderData.quantity),
                    version: version,
                    remark: orderData.remark || ''
                });
                
                if (orderData.receipt) {
                    order.receipt = orderData.receipt;
                }
                
                const validation = this.game.validateOrder(order);
                if (!validation.valid) {
                    this.game.addViolation({
                        type: 'IMPORT_ORDER_VIOLATION',
                        severity: ViolationSeverity.MEDIUM,
                        description: `导入订单违规: ${validation.message}`,
                        penalty: 2,
                        orderId: order.id,
                        stockCode: order.stockCode
                    });
                }
                
                this.game.pendingOrders.push(order);
            });
            
            this.game.logEvent('system', { count: orders.length, version }, `导入了 ${orders.length} 条订单（版本${version}）`);
        }

        importRules(data) {
            const rules = data.rules || data;
            if (rules.circuitBreaker) {
                this.game.rules.circuitBreaker = { ...this.game.rules.circuitBreaker, ...rules.circuitBreaker };
            }
            if (rules.priceLimit) {
                this.game.rules.priceLimit = rules.priceLimit;
            }
            if (rules.tradingHours) {
                this.game.rules.tradingHours = rules.tradingHours;
            }
            
            this.game.logEvent('system', { rules }, '更新了交易规则');
        }

        importFunds(data) {
            const funds = data.funds || data;
            if (funds.initialCash) {
                this.game.account = new Account(parseFloat(funds.initialCash));
            }
            if (funds.availableCash !== undefined) {
                this.game.account.availableCash = parseFloat(funds.availableCash);
            }
            if (funds.frozenCash !== undefined) {
                this.game.account.frozenCash = parseFloat(funds.frozenCash);
            }
            
            this.game.logEvent('system', { funds }, '更新了资金账户');
        }

        importNews(data, version) {
            const news = Array.isArray(data) ? data : (data.news || []);
            news.forEach(item => {
                const newsItem = {
                    id: item.id || `NEWS${Date.now()}${Math.random().toString(36).substr(2, 6)}`,
                    time: item.time ? new Date(item.time).getTime() : Date.now(),
                    title: item.title,
                    content: item.content,
                    importance: item.importance || 'normal',
                    affectedStocks: item.affectedStocks || [],
                    priceImpact: parseFloat(item.priceImpact) || 0,
                    version: version,
                    remark: item.remark || '',
                    triggered: false
                };
                
                if (item.receipt) {
                    newsItem.receipt = item.receipt;
                }
                
                this.game.newsEvents.push(newsItem);
            });
            
            this.game.newsEvents.sort((a, b) => a.time - b.time);
            this.game.logEvent('system', { count: news.length, version }, `导入了 ${news.length} 条新闻事件（版本${version}）`);
        }

        importTrades(data, version) {
            const trades = Array.isArray(data) ? data : (data.trades || []);
            trades.forEach(tradeData => {
                const trade = new Trade({
                    stockCode: tradeData.stockCode,
                    buyOrderId: tradeData.buyOrderId,
                    sellOrderId: tradeData.sellOrderId,
                    price: parseFloat(tradeData.price),
                    quantity: parseInt(tradeData.quantity),
                    version: version
                });
                this.game.trades.push(trade);
            });
            
            this.game.logEvent('system', { count: trades.length, version }, `导入了 ${trades.length} 条成交记录（版本${version}）`);
        }

        importPositions(data) {
            const positions = Array.isArray(data) ? data : (data.positions || []);
            positions.forEach(posData => {
                const position = new Position({
                    stockCode: posData.stockCode,
                    stockName: posData.stockName,
                    quantity: parseInt(posData.quantity),
                    availableQuantity: parseInt(posData.availableQuantity),
                    costPrice: parseFloat(posData.costPrice),
                    currentPrice: parseFloat(posData.currentPrice)
                });
                this.game.account.positions.set(position.stockCode, position);
            });
            
            this.game.logEvent('system', { count: positions.length }, `导入了 ${positions.length} 个持仓`);
        }
    }

    class MatchingEngine {
        constructor(game) {
            this.game = game;
        }

        matchOrder(order) {
            const stock = this.game.stocks.get(order.stockCode);
            if (!stock) return null;

            const trades = [];

            if (order.side === OrderSide.BUY) {
                stock.askOrders.sort((a, b) => a.price - b.price);
                
                for (const askOrder of stock.askOrders) {
                    if (order.remainingQuantity <= 0) break;
                    if (askOrder.remainingQuantity <= 0) continue;
                    
                    if (order.type === OrderType.MARKET || order.price >= askOrder.price) {
                        const tradeQuantity = Math.min(order.remainingQuantity, askOrder.remainingQuantity);
                        const tradePrice = askOrder.price;
                        
                        const trade = this.executeTrade(order, askOrder, tradeQuantity, tradePrice);
                        trades.push(trade);
                        
                        stock.updatePrice(tradePrice);
                    }
                }
            } else {
                stock.bidOrders.sort((a, b) => b.price - a.price);
                
                for (const bidOrder of stock.bidOrders) {
                    if (order.remainingQuantity <= 0) break;
                    if (bidOrder.remainingQuantity <= 0) continue;
                    
                    if (order.type === OrderType.MARKET || order.price <= bidOrder.price) {
                        const tradeQuantity = Math.min(order.remainingQuantity, bidOrder.remainingQuantity);
                        const tradePrice = bidOrder.price;
                        
                        const trade = this.executeTrade(bidOrder, order, tradeQuantity, tradePrice);
                        trades.push(trade);
                        
                        stock.updatePrice(tradePrice);
                    }
                }
            }

            if (order.remainingQuantity > 0 && order.type === OrderType.LIMIT) {
                if (order.side === OrderSide.BUY) {
                    stock.bidOrders.push(order);
                    stock.bidOrders.sort((a, b) => b.price - a.price);
                } else {
                    stock.askOrders.push(order);
                    stock.askOrders.sort((a, b) => a.price - b.price);
                }
            }

            return trades;
        }

        executeTrade(buyOrder, sellOrder, quantity, price) {
            const trade = new Trade({
                stockCode: buyOrder.stockCode,
                buyOrderId: buyOrder.id,
                sellOrderId: sellOrder.id,
                price: price,
                quantity: quantity
            });

            buyOrder.filledQuantity += quantity;
            sellOrder.filledQuantity += quantity;
            buyOrder.updateTime = Date.now();
            sellOrder.updateTime = Date.now();
            buyOrder.trades.push(trade.id);
            sellOrder.trades.push(trade.id);

            if (buyOrder.isFilled) {
                buyOrder.status = OrderStatus.FILLED;
            } else {
                buyOrder.status = OrderStatus.PARTIAL;
            }

            if (sellOrder.isFilled) {
                sellOrder.status = OrderStatus.FILLED;
            } else {
                sellOrder.status = OrderStatus.PARTIAL;
            }

            this.game.account.unfreezeCash(buyOrder.price * quantity);
            this.game.account.availableCash -= price * quantity;
            this.game.account.unfreezePosition(sellOrder.stockCode, quantity);
            this.game.account.updatePosition(
                buyOrder.stockCode,
                this.game.stocks.get(buyOrder.stockCode).name,
                quantity,
                price,
                OrderSide.BUY
            );
            this.game.account.updatePosition(
                sellOrder.stockCode,
                this.game.stocks.get(sellOrder.stockCode).name,
                quantity,
                price,
                OrderSide.SELL
            );
            this.game.account.availableCash += price * quantity;

            const stock = this.game.stocks.get(buyOrder.stockCode);
            stock.volume += quantity;
            stock.turnover += price * quantity;

            return trade;
        }

        checkPriceLimit(order, stock) {
            if (order.type === OrderType.MARKET) return true;
            return order.price >= stock.lowerLimit && order.price <= stock.upperLimit;
        }
    }

    class CircuitBreakerManager {
        constructor(game) {
            this.game = game;
            this.activeBreakers = new Map();
            this.events = [];
        }

        checkAllStocks() {
            let marketTriggered = false;
            let haltedCount = 0;
            const totalStocks = this.game.stocks.size;

            this.game.stocks.forEach((stock, code) => {
                if (stock.halted) {
                    haltedCount++;
                    this.checkCooldown(stock);
                    return;
                }

                const level = stock.checkCircuitBreaker();
                if (level !== CircuitBreakerLevel.NONE) {
                    this.triggerBreaker(stock, level);
                }
            });

            if (haltedCount / totalStocks >= 0.7) {
                this.triggerMarketWideBreaker();
            }
        }

        triggerBreaker(stock, level) {
            stock.halted = true;
            stock.haltReason = level === CircuitBreakerLevel.LEVEL1 ? '一级熔断' : '二级熔断';
            stock.haltStartTime = Date.now();

            this.activeBreakers.set(stock.code, {
                stock,
                level,
                startTime: Date.now(),
                cooldownEnd: Date.now() + stock.circuitBreaker.cooldown * 1000,
                handled: false
            });

            const event = {
                stockCode: stock.code,
                level,
                time: Date.now(),
                handled: false,
                price: stock.currentPrice,
                changePercent: stock.getPriceChangePercent()
            };
            this.events.push(event);

            this.game.logEvent('circuit', { stock, level }, 
                `${stock.name}(${stock.code}) 触发${stock.haltReason}，当前价格 ${stock.currentPrice.toFixed(2)}，涨跌幅 ${stock.getPriceChangePercent().toFixed(2)}%`);

            this.game.showToast(`${stock.name} 触发${stock.haltReason}！`, 'warning');

            this.cancelOrdersForStock(stock.code, level);
        }

        triggerMarketWideBreaker() {
            if (this.game.marketHalted) return;

            this.game.marketHalted = true;
            this.game.marketHaltTime = Date.now();

            this.game.logEvent('circuit', { market: true }, 
                '全市场熔断触发！超过70%的股票已停牌');

            this.game.showToast('⚠️ 全市场熔断触发！', 'error');

            this.game.stocks.forEach(stock => {
                if (!stock.halted) {
                    stock.halted = true;
                    stock.haltReason = '全市场熔断';
                    stock.haltStartTime = Date.now();
                }
                this.cancelOrdersForStock(stock.code, CircuitBreakerLevel.MARKET);
            });
        }

        cancelOrdersForStock(stockCode, level) {
            const stock = this.game.stocks.get(stockCode);
            
            const cancelOrders = (orders) => {
                orders.forEach(order => {
                    if (order.status === OrderStatus.PENDING || order.status === OrderStatus.PARTIAL) {
                        order.status = OrderStatus.CANCELLED;
                        order.updateTime = Date.now();
                        
                        if (order.side === OrderSide.BUY) {
                            this.game.account.unfreezeCash(order.price * order.remainingQuantity);
                        } else {
                            this.game.account.unfreezePosition(stockCode, order.remainingQuantity);
                        }

                        this.game.addViolation({
                            type: 'CIRCUIT_BREAKER_CANCEL',
                            severity: level === CircuitBreakerLevel.MARKET ? ViolationSeverity.MEDIUM : ViolationSeverity.LOW,
                            description: `${stock.name}(${stockCode}) 触发熔断，订单 ${order.id} 被自动撤销`,
                            penalty: 0,
                            orderId: order.id,
                            stockCode: stockCode
                        });
                    }
                });
            };

            cancelOrders(stock.bidOrders);
            cancelOrders(stock.askOrders);

            stock.bidOrders = stock.bidOrders.filter(o => o.status === OrderStatus.FILLED);
            stock.askOrders = stock.askOrders.filter(o => o.status === OrderStatus.FILLED);
        }

        checkCooldown(stock) {
            const breaker = this.activeBreakers.get(stock.code);
            if (!breaker) return;

            if (Date.now() >= breaker.cooldownEnd) {
                stock.halted = false;
                stock.haltReason = null;
                stock.haltStartTime = null;
                this.activeBreakers.delete(stock.code);

                this.game.logEvent('circuit', { stock, resumed: true }, 
                    `${stock.name}(${stock.code}) 熔断冷却结束，恢复交易`);

                this.game.showToast(`${stock.name} 恢复交易`, 'info');

                const event = this.events.find(e => e.stockCode === stock.code && !e.handled);
                if (event) {
                    event.handled = true;
                }
            }
        }

        checkLiquidity() {
            let lowLiquidityCount = 0;
            const illiquidStocks = [];

            this.game.stocks.forEach((stock, code) => {
                const totalOrders = stock.askOrders.length + stock.bidOrders.length;
                const spread = stock.askOrders.length > 0 && stock.bidOrders.length > 0
                    ? stock.askOrders[0].price - stock.bidOrders[0].price
                    : Infinity;

                if (totalOrders < 5 || spread > stock.currentPrice * 0.02) {
                    lowLiquidityCount++;
                    illiquidStocks.push(code);
                }
            });

            const liquidityPercent = lowLiquidityCount / this.game.stocks.size;

            if (liquidityPercent >= 0.5) {
                this.game.liquidityStatus = 'drained';
            } else if (liquidityPercent >= 0.3) {
                this.game.liquidityStatus = 'tight';
            } else {
                this.game.liquidityStatus = 'normal';
            }

            return {
                status: this.game.liquidityStatus,
                illiquidStocks,
                percent: liquidityPercent
            };
        }
    }

    class RiskManager {
        constructor(game) {
            this.game = game;
        }

        validateOrder(order) {
            const stock = this.game.stocks.get(order.stockCode);
            if (!stock) {
                return { valid: false, message: `股票 ${order.stockCode} 不存在` };
            }

            if (this.game.phase !== GamePhase.TRADING) {
                return { valid: false, message: '当前不在交易时段' };
            }

            if (stock.halted) {
                this.game.addViolation({
                    type: 'TRADING_DURING_HALT',
                    severity: ViolationSeverity.HIGH,
                    description: `在 ${stock.name}(${stock.code}) 停牌期间尝试下单`,
                    penalty: 10,
                    orderId: order.id,
                    stockCode: order.stockCode
                });
                return { valid: false, message: `${stock.name} 已停牌，禁止交易` };
            }

            if (this.game.marketHalted) {
                this.game.addViolation({
                    type: 'TRADING_DURING_MARKET_HALT',
                    severity: ViolationSeverity.HIGH,
                    description: '在全市场熔断期间尝试下单',
                    penalty: 15,
                    orderId: order.id,
                    stockCode: order.stockCode
                });
                return { valid: false, message: '全市场熔断，禁止交易' };
            }

            if (order.type === OrderType.LIMIT) {
                if (order.price < stock.lowerLimit || order.price > stock.upperLimit) {
                    this.game.addViolation({
                        type: 'PRICE_LIMIT_VIOLATION',
                        severity: ViolationSeverity.MEDIUM,
                        description: `订单价格 ${order.price} 超出涨跌停限制 [${stock.lowerLimit.toFixed(2)}, ${stock.upperLimit.toFixed(2)}]`,
                        penalty: 5,
                        orderId: order.id,
                        stockCode: order.stockCode
                    });
                    return { valid: false, message: `价格超出涨跌停限制` };
                }
            }

            const quantity = order.quantity * 100;

            if (order.side === OrderSide.BUY) {
                const amount = order.type === OrderType.MARKET 
                    ? stock.currentPrice * quantity * 1.1 
                    : order.price * quantity;
                
                if (this.game.account.availableCash < amount) {
                    this.game.addViolation({
                        type: 'INSUFFICIENT_CASH',
                        severity: ViolationSeverity.HIGH,
                        description: `资金不足，需要 ¥${amount.toFixed(2)}，可用 ¥${this.game.account.availableCash.toFixed(2)}`,
                        penalty: 8,
                        orderId: order.id,
                        stockCode: order.stockCode
                    });
                    return { valid: false, message: '可用资金不足' };
                }
            } else {
                const position = this.game.account.positions.get(order.stockCode);
                if (!position || position.availableQuantity < quantity) {
                    const available = position ? position.availableQuantity : 0;
                    this.game.addViolation({
                        type: 'INSUFFICIENT_POSITION',
                        severity: ViolationSeverity.HIGH,
                        description: `持仓不足，需要 ${quantity} 股，可用 ${available} 股`,
                        penalty: 8,
                        orderId: order.id,
                        stockCode: order.stockCode
                    });
                    return { valid: false, message: '可用持仓不足' };
                }
            }

            return { valid: true };
        }

        checkPriceLimitTrading(trade, stock) {
            const isUpperLimit = trade.price >= stock.upperLimit * 0.999;
            const isLowerLimit = trade.price <= stock.lowerLimit * 1.001;

            if (isUpperLimit || isLowerLimit) {
                const buyOrder = this.game.pendingOrders.find(o => o.id === trade.buyOrderId) ||
                    this.game.orders.find(o => o.id === trade.buyOrderId);
                const sellOrder = this.game.pendingOrders.find(o => o.id === trade.sellOrderId) ||
                    this.game.orders.find(o => o.id === trade.sellOrderId);

                const isBuyViolation = buyOrder && buyOrder.type === OrderType.MARKET && isUpperLimit;
                const isSellViolation = sellOrder && sellOrder.type === OrderType.MARKET && isLowerLimit;

                if (isBuyViolation || isSellViolation) {
                    this.game.addViolation({
                        type: 'MARKET_ORDER_AT_LIMIT',
                        severity: ViolationSeverity.MEDIUM,
                        description: `市价单在${isUpperLimit ? '涨停' : '跌停'}价位成交，可能造成滑点损失`,
                        penalty: 3,
                        orderId: isBuyViolation ? buyOrder.id : sellOrder.id,
                        stockCode: trade.stockCode
                    });
                }
            }
        }
    }

    class NewsManager {
        constructor(game) {
            this.game = game;
            this.currentIndex = 0;
        }

        checkAndTriggerNews(currentTime) {
            while (this.currentIndex < this.game.newsEvents.length) {
                const news = this.game.newsEvents[this.currentIndex];
                if (news.time <= currentTime && !news.triggered) {
                    this.triggerNews(news);
                    this.currentIndex++;
                } else {
                    break;
                }
            }
        }

        triggerNews(news) {
            news.triggered = true;

            this.game.displayNews(news);

            if (news.affectedStocks && news.priceImpact !== 0) {
                news.affectedStocks.forEach(code => {
                    const stock = this.game.stocks.get(code);
                    if (stock && !stock.halted) {
                        const newPrice = stock.currentPrice * (1 + news.priceImpact);
                        stock.updatePrice(newPrice);
                        
                        this.game.logEvent('news', { news, stock, priceImpact: news.priceImpact },
                            `新闻"${news.title}"影响 ${stock.name}(${code})，价格波动 ${(news.priceImpact * 100).toFixed(2)}%`);
                    }
                });
            }

            this.game.logEvent('news', { news }, `新闻发布: ${news.title}`);
        }
    }

    class ReplayManager {
        constructor(game) {
            this.game = game;
            this.currentIndex = -1;
            this.autoPlayInterval = null;
        }

        getEvents() {
            return this.game.eventLog;
        }

        goTo(index) {
            const events = this.getEvents();
            if (index < 0 || index >= events.length) return null;
            
            this.currentIndex = index;
            const event = events[index];
            
            if (!event.snapshot) {
                event.snapshot = this.createSnapshot(event);
            }
            
            return event;
        }

        next() {
            return this.goTo(this.currentIndex + 1);
        }

        prev() {
            return this.goTo(this.currentIndex - 1);
        }

        startAutoPlay(interval = 2000) {
            this.stopAutoPlay();
            this.autoPlayInterval = setInterval(() => {
                const event = this.next();
                if (!event) {
                    this.stopAutoPlay();
                } else {
                    this.game.displayReplayEvent(event);
                }
            }, interval);
        }

        stopAutoPlay() {
            if (this.autoPlayInterval) {
                clearInterval(this.autoPlayInterval);
                this.autoPlayInterval = null;
            }
        }

        createSnapshot(event) {
            return {
                time: event.time,
                phase: this.game.phase,
                account: {
                    availableCash: this.game.account.availableCash,
                    frozenCash: this.game.account.frozenCash,
                    totalAssets: this.game.account.totalAssets
                },
                positions: Array.from(this.game.account.positions.entries()).map(([code, pos]) => ({
                    code,
                    name: pos.stockName,
                    quantity: pos.quantity,
                    availableQuantity: pos.availableQuantity,
                    costPrice: pos.costPrice,
                    currentPrice: pos.currentPrice,
                    marketValue: pos.marketValue
                })),
                stocks: Array.from(this.game.stocks.entries()).map(([code, stock]) => ({
                    code,
                    name: stock.name,
                    price: stock.currentPrice,
                    change: stock.getPriceChangePercent(),
                    halted: stock.halted,
                    haltReason: stock.haltReason
                })),
                score: { ...this.game.score }
            };
        }

        getProgress() {
            const events = this.getEvents();
            return {
                current: this.currentIndex + 1,
                total: events.length
            };
        }
    }

    class ReportExporter {
        constructor(game) {
            this.game = game;
        }

        generateReport() {
            const report = {
                basicInfo: {
                    gameTime: new Date().toISOString(),
                    duration: this.game.gameTime,
                    phase: this.game.phase,
                    score: this.game.score.finalScore
                },
                accountSummary: {
                    initialCash: this.game.account.initialCash,
                    finalCash: this.game.account.totalCash,
                    positionValue: this.game.account.positionValue,
                    totalAssets: this.game.account.totalAssets,
                    totalProfit: this.game.account.totalProfit,
                    totalProfitPercent: this.game.account.totalProfitPercent
                },
                scoreBreakdown: {
                    baseScore: this.game.score.baseScore,
                    profitScore: this.game.score.profitScore,
                    complianceScore: this.game.score.complianceScore,
                    violationScore: this.game.score.violationScore,
                    circuitScore: this.game.score.circuitScore,
                    finalScore: this.game.score.finalScore
                },
                positions: Array.from(this.game.account.positions.values()).map(pos => ({
                    stockCode: pos.stockCode,
                    stockName: pos.stockName,
                    quantity: pos.quantity,
                    availableQuantity: pos.availableQuantity,
                    costPrice: pos.costPrice,
                    currentPrice: pos.currentPrice,
                    marketValue: pos.marketValue,
                    profit: pos.profit,
                    profitPercent: pos.profitPercent
                })),
                trades: this.game.trades.map(t => ({
                    id: t.id,
                    time: new Date(t.time).toLocaleTimeString(),
                    stockCode: t.stockCode,
                    price: t.price,
                    quantity: t.quantity,
                    amount: t.amount,
                    buyOrderId: t.buyOrderId,
                    sellOrderId: t.sellOrderId
                })),
                violations: this.game.violations.map(v => ({
                    id: v.id,
                    time: new Date(v.time).toLocaleTimeString(),
                    type: v.type,
                    severity: v.severity,
                    description: v.description,
                    penalty: v.penalty,
                    orderId: v.orderId,
                    stockCode: v.stockCode
                })),
                circuitBreakerEvents: this.game.circuitBreakerManager.events.map(e => ({
                    stockCode: e.stockCode,
                    level: e.level,
                    time: new Date(e.time).toLocaleTimeString(),
                    price: e.price,
                    changePercent: e.changePercent,
                    handled: e.handled
                })),
                newsEvents: this.game.newsEvents.filter(n => n.triggered).map(n => ({
                    time: new Date(n.time).toLocaleTimeString(),
                    title: n.title,
                    content: n.content,
                    importance: n.importance,
                    affectedStocks: n.affectedStocks,
                    priceImpact: n.priceImpact
                })),
                analysis: this.generateAnalysis()
            };

            return report;
        }

        generateAnalysis() {
            const violations = this.game.violations;
            const highSeverity = violations.filter(v => v.severity === ViolationSeverity.HIGH).length;
            const mediumSeverity = violations.filter(v => v.severity === ViolationSeverity.MEDIUM).length;
            const lowSeverity = violations.filter(v => v.severity === ViolationSeverity.LOW).length;

            const violationTypes = {};
            violations.forEach(v => {
                violationTypes[v.type] = (violationTypes[v.type] || 0) + 1;
            });

            const profitPercent = this.game.account.totalProfitPercent;
            let performanceRating = 'C';
            if (this.game.score.finalScore >= 150) performanceRating = 'S';
            else if (this.game.score.finalScore >= 120) performanceRating = 'A';
            else if (this.game.score.finalScore >= 100) performanceRating = 'B';
            else if (this.game.score.finalScore >= 80) performanceRating = 'C';
            else performanceRating = 'D';

            const suggestions = [];
            if (highSeverity > 0) {
                suggestions.push('存在严重违规行为，需要重点学习交易规则和风控要求');
            }
            if (violationTypes['PRICE_LIMIT_VIOLATION']) {
                suggestions.push('注意涨跌停价格限制，下单前请检查价格范围');
            }
            if (violationTypes['INSUFFICIENT_CASH'] || violationTypes['INSUFFICIENT_POSITION']) {
                suggestions.push('下单前请确保资金和持仓充足，避免透支交易');
            }
            if (violationTypes['TRADING_DURING_HALT']) {
                suggestions.push('关注股票停牌状态，熔断期间禁止交易');
            }
            if (profitPercent < 0) {
                suggestions.push('本次交易出现亏损，建议复盘交易决策，优化入场时机');
            }
            if (suggestions.length === 0) {
                suggestions.push('表现优秀，继续保持！可以尝试更复杂的交易策略');
            }

            return {
                performanceRating,
                violationSummary: {
                    high: highSeverity,
                    medium: mediumSeverity,
                    low: lowSeverity,
                    total: violations.length
                },
                violationTypes,
                suggestions,
                keyObservations: [
                    `最终资产: ¥${this.game.account.totalAssets.toFixed(2)} (${profitPercent >= 0 ? '+' : ''}${profitPercent.toFixed(2)}%)`,
                    `总成交量: ${this.game.trades.length} 笔`,
                    `成交额: ¥${this.game.trades.reduce((sum, t) => sum + t.amount, 0).toFixed(2)}`,
                    `触发熔断: ${this.game.circuitBreakerManager.events.length} 次`
                ]
            };
        }

        exportAsJSON() {
            const report = this.generateReport();
            const dataStr = JSON.stringify(report, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            this.downloadFile(blob, `交易报告_${new Date().toISOString().slice(0, 10)}.json`);
        }

        exportAsCSV() {
            const report = this.generateReport();
            let csv = '';

            csv += '=== 账户概览 ===\n';
            csv += '项目,数值\n';
            csv += `初始资金,${report.accountSummary.initialCash}\n`;
            csv += `最终资产,${report.accountSummary.totalAssets}\n`;
            csv += `总盈亏,${report.accountSummary.totalProfit}\n`;
            csv += `收益率,${report.accountSummary.totalProfitPercent}%\n`;
            csv += `最终得分,${report.scoreBreakdown.finalScore}\n\n`;

            csv += '=== 评分明细 ===\n';
            csv += '项目,分值\n';
            csv += `基础分,${report.scoreBreakdown.baseScore}\n`;
            csv += `盈利加分,${report.scoreBreakdown.profitScore}\n`;
            csv += `合规加分,${report.scoreBreakdown.complianceScore}\n`;
            csv += `违规扣分,${report.scoreBreakdown.violationScore}\n`;
            csv += `熔断应对,${report.scoreBreakdown.circuitScore}\n`;
            csv += `最终得分,${report.scoreBreakdown.finalScore}\n\n`;

            csv += '=== 持仓明细 ===\n';
            csv += '股票代码,股票名称,持仓数量,可用数量,成本价,现价,市值,盈亏,盈亏比例\n';
            report.positions.forEach(pos => {
                csv += `${pos.stockCode},${pos.stockName},${pos.quantity},${pos.availableQuantity},${pos.costPrice},${pos.currentPrice},${pos.marketValue},${pos.profit},${pos.profitPercent}%\n`;
            });
            csv += '\n';

            csv += '=== 成交记录 ===\n';
            csv += '成交ID,时间,股票代码,价格,数量,金额\n';
            report.trades.forEach(t => {
                csv += `${t.id},${t.time},${t.stockCode},${t.price},${t.quantity},${t.amount}\n`;
            });
            csv += '\n';

            csv += '=== 违规记录 ===\n';
            csv += '违规ID,时间,类型,严重程度,描述,扣分\n';
            report.violations.forEach(v => {
                csv += `${v.id},${v.time},${v.type},${v.severity},${v.description},${v.penalty}\n`;
            });
            csv += '\n';

            csv += '=== 分析建议 ===\n';
            csv += '评级,' + report.analysis.performanceRating + '\n';
            csv += '建议\n';
            report.analysis.suggestions.forEach(s => {
                csv += s + '\n';
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            this.downloadFile(blob, `交易报告_${new Date().toISOString().slice(0, 10)}.csv`);
        }

        exportAsHTML() {
            const report = this.generateReport();
            const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>股票熔断交易日 - 交易报告</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
        h1 { color: #1a1a2e; border-bottom: 3px solid #00d4ff; padding-bottom: 10px; }
        h2 { color: #16213e; margin-top: 30px; }
        h3 { color: #667eea; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
        .summary-item { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
        .summary-label { font-size: 12px; color: #888; margin-bottom: 8px; }
        .summary-value { font-size: 24px; font-weight: bold; color: #00d4ff; }
        .summary-value.positive { color: #11998e; }
        .summary-value.negative { color: #eb3349; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; background: white; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f0f0f0; font-weight: 600; color: #1a1a2e; }
        tr:hover { background: #fafafa; }
        .rating { display: inline-block; padding: 8px 24px; font-size: 32px; font-weight: bold; border-radius: 8px; }
        .rating-S { background: linear-gradient(135deg, #ffd700, #ffed4e); color: #333; }
        .rating-A { background: linear-gradient(135deg, #11998e, #38ef7d); color: white; }
        .rating-B { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
        .rating-C { background: linear-gradient(135deg, #f093fb, #f5576c); color: white; }
        .rating-D { background: linear-gradient(135deg, #eb3349, #f45c43); color: white; }
        .score-bar { height: 30px; background: #e0e0e0; border-radius: 15px; overflow: hidden; margin: 10px 0; }
        .score-fill { height: 100%; background: linear-gradient(90deg, #667eea, #00d4ff); transition: width 0.3s; }
        .violation-high { color: #eb3349; font-weight: bold; }
        .violation-medium { color: #f5576c; }
        .violation-low { color: #667eea; }
        .suggestions { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
        .suggestions li { margin: 8px 0; }
        .observations { background: #d1ecf1; border-left: 4px solid #00d4ff; padding: 15px; margin: 15px 0; }
    </style>
</head>
<body>
    <h1>📈 股票熔断交易日 - 交易报告</h1>
    <p style="color: #888;">报告生成时间: ${new Date().toLocaleString()}</p>
    
    <h2>综合评级</h2>
    <div style="text-align: center; margin: 20px 0;">
        <span class="rating rating-${report.analysis.performanceRating}">${report.analysis.performanceRating}</span>
    </div>
    
    <h2>账户概览</h2>
    <div class="summary">
        <div class="summary-item">
            <div class="summary-label">初始资金</div>
            <div class="summary-value">¥${report.accountSummary.initialCash.toLocaleString()}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">最终资产</div>
            <div class="summary-value ${report.accountSummary.totalProfit >= 0 ? 'positive' : 'negative'}">¥${report.accountSummary.totalAssets.toLocaleString()}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">总盈亏</div>
            <div class="summary-value ${report.accountSummary.totalProfit >= 0 ? 'positive' : 'negative'}">${report.accountSummary.totalProfit >= 0 ? '+' : ''}¥${report.accountSummary.totalProfit.toLocaleString()}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">收益率</div>
            <div class="summary-value ${report.accountSummary.totalProfitPercent >= 0 ? 'positive' : 'negative'}">${report.accountSummary.totalProfitPercent >= 0 ? '+' : ''}${report.accountSummary.totalProfitPercent.toFixed(2)}%</div>
        </div>
    </div>
    
    <h2>评分明细</h2>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>基础分</span>
            <span style="font-weight: bold;">${report.scoreBreakdown.baseScore}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>盈利加分</span>
            <span style="font-weight: bold; color: #11998e;">+${report.scoreBreakdown.profitScore}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>合规加分</span>
            <span style="font-weight: bold; color: #11998e;">+${report.scoreBreakdown.complianceScore}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>违规扣分</span>
            <span style="font-weight: bold; color: #eb3349;">-${report.scoreBreakdown.violationScore}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>熔断应对</span>
            <span style="font-weight: bold;">+${report.scoreBreakdown.circuitScore}</span>
        </div>
        <hr>
        <div style="display: flex; justify-content: space-between; font-size: 18px; margin-top: 10px;">
            <span>最终得分</span>
            <span style="font-weight: bold; color: #00d4ff;">${report.scoreBreakdown.finalScore}</span>
        </div>
        <div class="score-bar">
            <div class="score-fill" style="width: ${Math.min(100, report.scoreBreakdown.finalScore / 2)}%"></div>
        </div>
    </div>
    
    <h2>持仓明细</h2>
    <table>
        <tr><th>股票代码</th><th>股票名称</th><th>持仓数量</th><th>可用数量</th><th>成本价</th><th>现价</th><th>市值</th><th>盈亏</th><th>盈亏比例</th></tr>
        ${report.positions.map(pos => `
        <tr>
            <td>${pos.stockCode}</td>
            <td>${pos.stockName}</td>
            <td>${pos.quantity}</td>
            <td>${pos.availableQuantity}</td>
            <td>¥${pos.costPrice.toFixed(2)}</td>
            <td>¥${pos.currentPrice.toFixed(2)}</td>
            <td>¥${pos.marketValue.toLocaleString()}</td>
            <td style="color: ${pos.profit >= 0 ? '#11998e' : '#eb3349'}">${pos.profit >= 0 ? '+' : ''}¥${pos.profit.toFixed(2)}</td>
            <td style="color: ${pos.profitPercent >= 0 ? '#11998e' : '#eb3349'}">${pos.profitPercent >= 0 ? '+' : ''}${pos.profitPercent.toFixed(2)}%</td>
        </tr>`).join('')}
    </table>
    
    <h2>违规统计</h2>
    <div class="summary">
        <div class="summary-item">
            <div class="summary-label">严重违规</div>
            <div class="summary-value violation-high">${report.analysis.violationSummary.high}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">中等违规</div>
            <div class="summary-value violation-medium">${report.analysis.violationSummary.medium}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">轻微违规</div>
            <div class="summary-value violation-low">${report.analysis.violationSummary.low}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">总计</div>
            <div class="summary-value">${report.analysis.violationSummary.total}</div>
        </div>
    </div>
    
    <h2>违规记录</h2>
    <table>
        <tr><th>时间</th><th>类型</th><th>严重程度</th><th>描述</th><th>扣分</th></tr>
        ${report.violations.map(v => `
        <tr>
            <td>${v.time}</td>
            <td>${v.type}</td>
            <td class="violation-${v.severity}">${v.severity === 'high' ? '严重' : v.severity === 'medium' ? '中等' : '轻微'}</td>
            <td>${v.description}</td>
            <td style="color: #eb3349;">-${v.penalty}</td>
        </tr>`).join('')}
    </table>
    
    <h2>关键观察</h2>
    <div class="observations">
        <ul>
            ${report.analysis.keyObservations.map(o => `<li>${o}</li>`).join('')}
        </ul>
    </div>
    
    <h2>改进建议</h2>
    <div class="suggestions">
        <ul>
            ${report.analysis.suggestions.map(s => `<li>${s}</li>`).join('')}
        </ul>
    </div>
    
    <h2>成交记录</h2>
    <table>
        <tr><th>成交ID</th><th>时间</th><th>股票代码</th><th>价格</th><th>数量</th><th>金额</th></tr>
        ${report.trades.map(t => `
        <tr>
            <td>${t.id}</td>
            <td>${t.time}</td>
            <td>${t.stockCode}</td>
            <td>¥${t.price.toFixed(2)}</td>
            <td>${t.quantity}</td>
            <td>¥${t.amount.toLocaleString()}</td>
        </tr>`).join('')}
    </table>
</body>
</html>`;

            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            this.downloadFile(blob, `交易报告_${new Date().toISOString().slice(0, 10)}.html`);
        }

        downloadFile(blob, filename) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }

    class Game {
        constructor() {
            this.phase = GamePhase.PREPARE;
            this.gameTime = 0;
            this.startTime = null;
            this.gameLoopInterval = null;
            this.simulatedTime = null;
            
            this.stocks = new Map();
            this.selectedStock = null;
            
            this.account = new Account(1000000);
            this.orders = [];
            this.pendingOrders = [];
            this.trades = [];
            this.violations = [];
            this.newsEvents = [];
            this.eventLog = [];
            
            this.marketHalted = false;
            this.marketHaltTime = null;
            this.liquidityStatus = 'normal';
            
            this.score = new Score();
            
            this.rules = {
                circuitBreaker: {
                    level1: 0.05,
                    level2: 0.07,
                    marketThreshold: 0.7,
                    cooldown: 300
                },
                priceLimit: 0.1,
                tradingHours: {
                    start: '09:30',
                    end: '15:00'
                }
            };
            
            this.importManager = new DataImportManager(this);
            this.matchingEngine = new MatchingEngine(this);
            this.circuitBreakerManager = new CircuitBreakerManager(this);
            this.riskManager = new RiskManager(this);
            this.newsManager = new NewsManager(this);
            this.replayManager = new ReplayManager(this);
            this.reportExporter = new ReportExporter(this);
            
            this.init();
        }

        init() {
            this.bindEvents();
            this.render();
            this.loadDefaultData();
        }

        loadDefaultData() {
            const defaultStocks = [
                { code: '600001', name: '示例银行', basePrice: 15.50, level1: 0.05, level2: 0.07, cooldown: 60 },
                { code: '600002', name: '科技创新', basePrice: 42.80, level1: 0.05, level2: 0.07, cooldown: 60 },
                { code: '600003', name: '地产发展', basePrice: 8.65, level1: 0.05, level2: 0.07, cooldown: 60 },
                { code: '600004', name: '医药健康', basePrice: 25.30, level1: 0.05, level2: 0.07, cooldown: 60 },
                { code: '600005', name: '消费零售', basePrice: 18.90, level1: 0.05, level2: 0.07, cooldown: 60 }
            ];
            defaultStocks.forEach(s => {
                const stock = new Stock({
                    code: s.code,
                    name: s.name,
                    basePrice: s.basePrice,
                    circuitBreaker: { level1: s.level1, level2: s.level2, cooldown: s.cooldown }
                });
                this.stocks.set(stock.code, stock);
            });
            this.selectedStock = '600001';
            this.generateInitialOrders();
            this.generateNewsEvents();
        }

        generateInitialOrders() {
            this.stocks.forEach(stock => {
                const basePrice = stock.basePrice;
                for (let i = 1; i <= 5; i++) {
                    const bidPrice = +(basePrice * (1 - i * 0.002)).toFixed(2);
                    const askPrice = +(basePrice * (1 + i * 0.002)).toFixed(2);
                    stock.bidOrders.push(new Order({
                        stockCode: stock.code,
                        side: OrderSide.BUY,
                        type: OrderType.LIMIT,
                        price: bidPrice,
                        quantity: Math.floor(Math.random() * 50) + 10
                    }));
                    stock.askOrders.push(new Order({
                        stockCode: stock.code,
                        side: OrderSide.SELL,
                        type: OrderType.LIMIT,
                        price: askPrice,
                        quantity: Math.floor(Math.random() * 50) + 10
                    }));
                }
                stock.bidOrders.sort((a, b) => b.price - a.price);
                stock.askOrders.sort((a, b) => a.price - b.price);
            });
        }

        generateNewsEvents() {
            const baseTime = Date.now();
            this.newsEvents = [
                {
                    id: 'NEWS001',
                    time: baseTime + 30000,
                    title: '央行宣布降准0.5个百分点',
                    content: '中国人民银行决定于下周一起下调金融机构存款准备金率0.5个百分点，释放长期资金约1万亿元。',
                    importance: 'important',
                    affectedStocks: ['600001', '600003'],
                    priceImpact: 0.03
                },
                {
                    id: 'NEWS002',
                    time: baseTime + 60000,
                    title: '科技行业监管政策收紧',
                    content: '监管部门发布新规，加强对科技企业数据安全和反垄断监管。',
                    importance: 'important',
                    affectedStocks: ['600002'],
                    priceImpact: -0.04
                },
                {
                    id: 'NEWS003',
                    time: baseTime + 90000,
                    title: '医药集采结果公布，价格降幅超预期',
                    content: '最新一轮药品集中采购结果显示，平均降价幅度达到56%。',
                    importance: 'warning',
                    affectedStocks: ['600004'],
                    priceImpact: -0.06
                },
                {
                    id: 'NEWS004',
                    time: baseTime + 120000,
                    title: '消费数据回暖，零售板块受益',
                    content: '最新社会消费品零售总额同比增长8.5%，超出市场预期。',
                    importance: 'normal',
                    affectedStocks: ['600005'],
                    priceImpact: 0.025
                },
                {
                    id: 'NEWS005',
                    time: baseTime + 150000,
                    title: '突发：某大型银行出现流动性紧张',
                    content: '市场传言某大型银行面临短期流动性压力，引发市场担忧。',
                    importance: 'important',
                    affectedStocks: ['600001', '600002', '600003', '600004', '600005'],
                    priceImpact: -0.08
                }
            ];
        }

        bindEvents() {
            document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileSelect(e));
            document.getElementById('confirmImportBtn').addEventListener('click', () => this.handleConfirmImport());
            
            document.getElementById('startBtn').addEventListener('click', () => this.startGame());
            document.getElementById('pauseBtn').addEventListener('click', () => this.pauseGame());
            document.getElementById('resumeBtn').addEventListener('click', () => this.resumeGame());
            document.getElementById('settleBtn').addEventListener('click', () => this.settleGame());
            document.getElementById('resetBtn').addEventListener('click', () => this.resetGame());
            document.getElementById('helpBtn').addEventListener('click', () => this.showHelp());
            
            document.getElementById('orderForm').addEventListener('submit', (e) => this.handleOrderSubmit(e));
            
            document.getElementById('orderStock').addEventListener('change', (e) => this.updatePriceLimits(e.target.value));
            document.getElementById('orderbookStock').addEventListener('change', (e) => {
                this.selectedStock = e.target.value;
                this.renderOrderbook();
            });
            
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
            });
            
            document.querySelectorAll('[data-quick]').forEach(btn => {
                btn.addEventListener('click', (e) => this.handleQuickTrade(e.target.dataset.quick));
            });
            document.getElementById('quickStock').addEventListener('change', (e) => {
                this.selectedStock = e.target.value;
            });
            
            document.getElementById('replayPrevBtn').addEventListener('click', () => this.handleReplayPrev());
            document.getElementById('replayNextBtn').addEventListener('click', () => this.handleReplayNext());
            document.getElementById('replayAutoBtn').addEventListener('click', () => this.handleReplayAuto());
            
            document.getElementById('exportReportBtn').addEventListener('click', () => this.showExportOptions());
            document.getElementById('modalOverlay').addEventListener('click', (e) => {
                if (e.target.id === 'modalOverlay') this.closeModal();
            });
        }

        switchTab(tabName) {
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === tabName);
            });
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.toggle('active', pane.id === tabName + 'Tab');
            });
            
            if (tabName === 'replay') {
                this.updateReplayDisplay();
            }
        }

        async handleFileSelect(e) {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;
            
            const pendingFiles = await this.importManager.processFiles(files);
            this.displayPendingFiles(pendingFiles);
            
            e.target.value = '';
        }

        displayPendingFiles(pendingFiles) {
            const fileListEl = document.getElementById('fileList');
            const importOptionsEl = document.getElementById('importOptions');
            
            fileListEl.innerHTML = '';
            let hasDuplicates = false;
            
            pendingFiles.forEach(pf => {
                const div = document.createElement('div');
                div.className = 'file-item' + (pf.isDuplicate ? ' duplicate' : '');
                
                let statusClass = 'status-new';
                let statusText = '新文件';
                
                if (pf.isDuplicate) {
                    hasDuplicates = true;
                    statusClass = 'status-duplicate';
                    statusText = pf.isSameName ? '同名文件' : '重复文件';
                }
                
                div.innerHTML = `
                    <span>${pf.file.name} <span class="version-badge">v${pf.version}</span></span>
                    <span class="file-status ${statusClass}">${statusText}</span>
                `;
                fileListEl.appendChild(div);
            });
            
            importOptionsEl.style.display = 'block';
        }

        handleConfirmImport() {
            const mode = document.querySelector('input[name="duplicateMode"]:checked').value;
            const results = this.importManager.confirmImport(mode);
            
            let message = `导入完成：新增 ${results.imported.length} 个`;
            if (results.updated.length) message += `，更新 ${results.updated.length} 个`;
            if (results.appended.length) message += `，追加 ${results.appended.length} 个`;
            if (results.skipped.length) message += `，跳过 ${results.skipped.length} 个`;
            
            this.showToast(message, 'success');
            
            document.getElementById('importOptions').style.display = 'none';
            document.getElementById('fileList').innerHTML = '';
            
            this.render();
        }

        startGame() {
            if (this.stocks.size === 0) {
                this.showToast('请先导入股票池数据', 'error');
                return;
            }
            
            this.phase = GamePhase.TRADING;
            this.startTime = Date.now();
            this.simulatedTime = Date.now();
            
            document.getElementById('startBtn').disabled = true;
            document.getElementById('pauseBtn').disabled = false;
            document.getElementById('settleBtn').disabled = false;
            
            this.gameLoopInterval = setInterval(() => this.gameLoop(), 1000);
            
            this.showToast('交易开始！', 'success');
            this.logEvent('system', { phase: this.phase }, '交易时段开始');
            this.render();
        }

        pauseGame() {
            if (this.phase !== GamePhase.TRADING) return;
            
            this.phase = GamePhase.PAUSED;
            clearInterval(this.gameLoopInterval);
            
            document.getElementById('pauseBtn').disabled = true;
            document.getElementById('resumeBtn').disabled = false;
            
            this.showToast('交易已暂停', 'warning');
            this.logEvent('system', { phase: this.phase }, '交易暂停');
            this.render();
        }

        resumeGame() {
            if (this.phase !== GamePhase.PAUSED) return;
            
            this.phase = GamePhase.TRADING;
            this.gameLoopInterval = setInterval(() => this.gameLoop(), 1000);
            
            document.getElementById('resumeBtn').disabled = true;
            document.getElementById('pauseBtn').disabled = false;
            
            this.showToast('交易已恢复', 'success');
            this.logEvent('system', { phase: this.phase }, '交易恢复');
            this.render();
        }

        settleGame() {
            if (this.phase === GamePhase.SETTLED) return;
            
            this.phase = GamePhase.SETTLED;
            clearInterval(this.gameLoopInterval);
            
            this.stocks.forEach(stock => {
                stock.halted = false;
            });
            this.marketHalted = false;
            
            this.score.calculate(this.account, this.violations, this.circuitBreakerManager.events);
            
            document.getElementById('pauseBtn').disabled = true;
            document.getElementById('resumeBtn').disabled = true;
            document.getElementById('settleBtn').disabled = true;
            document.getElementById('exportReportBtn').disabled = false;
            
            this.showToast('交易已结算！', 'success');
            this.logEvent('system', { phase: this.phase, score: this.score.finalScore }, `交易结算完成，最终得分: ${this.score.finalScore}`);
            this.render();
        }

        resetGame() {
            if (!confirm('确定要重置游戏吗？所有数据将被清除。')) return;
            
            clearInterval(this.gameLoopInterval);
            this.replayManager.stopAutoPlay();
            
            this.phase = GamePhase.PREPARE;
            this.gameTime = 0;
            this.startTime = null;
            this.simulatedTime = null;
            
            this.stocks.clear();
            this.selectedStock = null;
            this.account = new Account(1000000);
            this.orders = [];
            this.pendingOrders = [];
            this.trades = [];
            this.violations = [];
            this.newsEvents = [];
            this.eventLog = [];
            this.marketHalted = false;
            this.marketHaltTime = null;
            this.liquidityStatus = 'normal';
            this.score = new Score();
            
            this.importManager = new DataImportManager(this);
            this.circuitBreakerManager = new CircuitBreakerManager(this);
            this.newsManager = new NewsManager(this);
            this.replayManager = new ReplayManager(this);
            
            document.getElementById('startBtn').disabled = false;
            document.getElementById('pauseBtn').disabled = true;
            document.getElementById('resumeBtn').disabled = true;
            document.getElementById('settleBtn').disabled = true;
            document.getElementById('exportReportBtn').disabled = true;
            
            this.loadDefaultData();
            this.showToast('游戏已重置', 'info');
            this.render();
        }

        gameLoop() {
            if (this.phase !== GamePhase.TRADING) return;
            
            this.gameTime = Date.now() - this.startTime;
            this.simulatedTime += 1000;
            
            this.newsManager.checkAndTriggerNews(this.simulatedTime);
            
            this.circuitBreakerManager.checkAllStocks();
            
            this.circuitBreakerManager.checkLiquidity();
            
            this.simulateMarketActivity();
            
            this.score.calculate(this.account, this.violations, this.circuitBreakerManager.events);
            
            this.render();
        }

        simulateMarketActivity() {
            if (this.marketHalted) return;
            
            this.stocks.forEach(stock => {
                if (stock.halted) return;
                
                if (Math.random() < 0.3) {
                    const side = Math.random() < 0.5 ? OrderSide.BUY : OrderSide.SELL;
                    const price = +(stock.currentPrice * (1 + (Math.random() - 0.5) * 0.01)).toFixed(2);
                    const quantity = Math.floor(Math.random() * 20) + 5;
                    
                    const order = new Order({
                        stockCode: stock.code,
                        side,
                        type: OrderType.LIMIT,
                        price,
                        quantity
                    });
                    
                    if (side === OrderSide.BUY) {
                        stock.bidOrders.push(order);
                        stock.bidOrders.sort((a, b) => b.price - a.price);
                    } else {
                        stock.askOrders.push(order);
                        stock.askOrders.sort((a, b) => a.price - b.price);
                    }
                }
                
                if (Math.random() < 0.2) {
                    const targetSide = Math.random() < 0.5 ? OrderSide.BUY : OrderSide.SELL;
                    const orders = targetSide === OrderSide.BUY ? stock.bidOrders : stock.askOrders;
                    
                    if (orders.length > 0) {
                        const marketOrder = new Order({
                            stockCode: stock.code,
                            side: targetSide === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY,
                            type: OrderType.MARKET,
                            price: stock.currentPrice,
                            quantity: Math.floor(Math.random() * 10) + 1
                        });
                        
                        const trades = this.matchingEngine.matchOrder(marketOrder);
                        if (trades && trades.length > 0) {
                            trades.forEach(t => {
                                this.trades.push(t);
                                this.riskManager.checkPriceLimitTrading(t, stock);
                                this.logEvent('trade', { trade: t, stock }, 
                                    `成交: ${stock.name} ${targetSide === OrderSide.BUY ? '卖出' : '买入'} ${t.quantity}手 @ ¥${t.price}`);
                            });
                        }
                    }
                }
                
                if (stock.bidOrders.length > 0 && stock.askOrders.length > 0) {
                    const bestBid = stock.bidOrders[0];
                    const bestAsk = stock.askOrders[0];
                    
                    if (bestBid.price >= bestAsk.price) {
                        const tradeQuantity = Math.min(bestBid.remainingQuantity, bestAsk.remainingQuantity);
                        const tradePrice = (bestBid.price + bestAsk.price) / 2;
                        
                        const trade = this.matchingEngine.executeTrade(bestBid, bestAsk, tradeQuantity, tradePrice);
                        this.trades.push(trade);
                        stock.updatePrice(tradePrice);
                        this.riskManager.checkPriceLimitTrading(trade, stock);
                        
                        this.logEvent('trade', { trade, stock }, 
                            `撮合成交: ${stock.name} ${tradeQuantity}手 @ ¥${tradePrice.toFixed(2)}`);
                    }
                }
            });
        }

        validateOrder(order) {
            return this.riskManager.validateOrder(order);
        }

        handleOrderSubmit(e) {
            e.preventDefault();
            
            const stockCode = document.getElementById('orderStock').value;
            const side = document.querySelector('input[name="orderSide"]:checked').value;
            const type = document.getElementById('orderType').value;
            const price = parseFloat(document.getElementById('orderPrice').value);
            const quantity = parseInt(document.getElementById('orderQuantity').value);
            
            const order = new Order({
                stockCode,
                side,
                type,
                price,
                quantity
            });
            
            const validation = this.validateOrder(order);
            if (!validation.valid) {
                document.getElementById('orderError').textContent = validation.message;
                document.getElementById('orderError').style.display = 'block';
                setTimeout(() => {
                    document.getElementById('orderError').style.display = 'none';
                }, 3000);
                return;
            }
            
            const stock = this.stocks.get(stockCode);
            const qtyShares = quantity * 100;
            const amount = type === OrderType.MARKET 
                ? stock.currentPrice * qtyShares * 1.1 
                : price * qtyShares;
            
            if (side === OrderSide.BUY) {
                if (!this.account.freezeCash(amount)) {
                    this.showToast('资金冻结失败', 'error');
                    return;
                }
            } else {
                if (!this.account.freezePosition(stockCode, qtyShares)) {
                    this.showToast('持仓冻结失败', 'error');
                    return;
                }
            }
            
            const trades = this.matchingEngine.matchOrder(order);
            
            if (trades && trades.length > 0) {
                trades.forEach(t => {
                    this.trades.push(t);
                    this.riskManager.checkPriceLimitTrading(t, stock);
                    this.logEvent('trade', { trade: t, stock, order }, 
                        `订单成交: ${stock.name} ${side === OrderSide.BUY ? '买入' : '卖出'} ${t.quantity}手 @ ¥${t.price}`);
                });
                this.showToast(`成交 ${trades.length} 笔`, 'success');
            } else if (order.type === OrderType.LIMIT && order.remainingQuantity > 0) {
                this.showToast('限价单已挂单', 'info');
            }
            
            this.orders.push(order);
            
            this.logEvent('order', { order, stock }, 
                `下单: ${side === OrderSide.BUY ? '买入' : '卖出'} ${stock.name} ${quantity}手 @ ¥${price}`);
            
            e.target.reset();
            document.getElementById('orderQuantity').value = '1';
            this.updatePriceLimits(stockCode);
            this.render();
        }

        handleQuickTrade(action) {
            const stockCode = document.getElementById('quickStock').value;
            if (!stockCode) {
                this.showToast('请先选择股票', 'error');
                return;
            }
            
            const stock = this.stocks.get(stockCode);
            if (!stock || stock.halted) {
                this.showToast('该股票无法交易', 'error');
                return;
            }
            
            let side, price, type;
            
            switch (action) {
                case 'buy1':
                    side = OrderSide.BUY;
                    price = stock.askOrders.length > 0 ? stock.askOrders[0].price : stock.currentPrice;
                    type = OrderType.LIMIT;
                    break;
                case 'buyMarket':
                    side = OrderSide.BUY;
                    price = stock.currentPrice;
                    type = OrderType.MARKET;
                    break;
                case 'sell1':
                    side = OrderSide.SELL;
                    price = stock.bidOrders.length > 0 ? stock.bidOrders[0].price : stock.currentPrice;
                    type = OrderType.LIMIT;
                    break;
                case 'sellMarket':
                    side = OrderSide.SELL;
                    price = stock.currentPrice;
                    type = OrderType.MARKET;
                    break;
            }
            
            document.getElementById('orderStock').value = stockCode;
            document.querySelector(`input[name="orderSide"][value="${side}"]`).checked = true;
            document.getElementById('orderType').value = type;
            document.getElementById('orderPrice').value = price.toFixed(2);
            document.getElementById('orderPrice').disabled = type === OrderType.MARKET;
            
            this.updatePriceLimits(stockCode);
        }

        updatePriceLimits(stockCode) {
            const stock = this.stocks.get(stockCode);
            if (stock) {
                document.getElementById('priceUpLimit').textContent = stock.upperLimit.toFixed(2);
                document.getElementById('priceDownLimit').textContent = stock.lowerLimit.toFixed(2);
            } else {
                document.getElementById('priceUpLimit').textContent = '--';
                document.getElementById('priceDownLimit').textContent = '--';
            }
        }

        cancelOrder(orderId) {
            const order = this.orders.find(o => o.id === orderId);
            if (!order || order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PARTIAL) {
                this.showToast('订单无法撤销', 'error');
                return;
            }
            
            order.status = OrderStatus.CANCELLED;
            order.updateTime = Date.now();
            
            if (order.side === OrderSide.BUY) {
                this.account.unfreezeCash(order.price * order.remainingQuantity * 100);
            } else {
                this.account.unfreezePosition(order.stockCode, order.remainingQuantity * 100);
            }
            
            const stock = this.stocks.get(order.stockCode);
            if (stock) {
                if (order.side === OrderSide.BUY) {
                    stock.bidOrders = stock.bidOrders.filter(o => o.id !== orderId);
                } else {
                    stock.askOrders = stock.askOrders.filter(o => o.id !== orderId);
                }
            }
            
            this.logEvent('order', { order, cancelled: true }, `订单 ${orderId} 已撤销`);
            this.showToast('订单已撤销', 'info');
            this.render();
        }

        addViolation(data) {
            const violation = new Violation(data);
            this.violations.push(violation);
            
            this.logEvent('violation', { violation }, 
                `违规[${violation.severity}]: ${violation.description} (扣${violation.penalty}分)`);
            
            this.showToast(`违规: ${violation.description}`, 'error');
            return violation;
        }

        logEvent(type, data, description) {
            const event = new EventLog(type, data, description);
            this.eventLog.push(event);
            return event;
        }

        render() {
            this.renderTime();
            this.renderPhase();
            this.renderStockPool();
            this.renderOrderbook();
            this.renderAccount();
            this.renderCircuitStatus();
            this.renderPositions();
            this.renderOrders();
            this.renderTrades();
            this.renderViolations();
            this.renderScore();
            this.renderStockSelects();
            this.drawChart();
        }

        renderTime() {
            if (this.phase === GamePhase.PREPARE) {
                document.getElementById('timeDisplay').textContent = '--:--:--';
                return;
            }
            
            const seconds = Math.floor(this.gameTime / 1000);
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            document.getElementById('timeDisplay').textContent = 
                `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:00`;
        }

        renderPhase() {
            const indicator = document.getElementById('phaseIndicator');
            indicator.className = 'phase-badge';
            
            switch (this.phase) {
                case GamePhase.PREPARE:
                    indicator.classList.add('phase-prepare');
                    indicator.textContent = '准备阶段';
                    break;
                case GamePhase.TRADING:
                    indicator.classList.add('phase-trading');
                    indicator.textContent = '交易中';
                    break;
                case GamePhase.PAUSED:
                    indicator.classList.add('phase-paused');
                    indicator.textContent = '已暂停';
                    break;
                case GamePhase.SETTLED:
                    indicator.classList.add('phase-settled');
                    indicator.textContent = '已结算';
                    break;
            }
        }

        renderStockPool() {
            const container = document.getElementById('stockPool');
            container.innerHTML = '';
            
            this.stocks.forEach(stock => {
                const change = stock.getPriceChange();
                const changePercent = stock.getPriceChangePercent();
                const priceClass = change >= 0 ? 'up' : 'down';
                
                const card = document.createElement('div');
                card.className = 'stock-card' + 
                    (stock.code === this.selectedStock ? ' selected' : '') +
                    (stock.halted ? ' halted' : '');
                card.onclick = () => {
                    this.selectedStock = stock.code;
                    document.getElementById('orderbookStock').value = stock.code;
                    this.updatePriceLimits(stock.code);
                    this.render();
                };
                
                card.innerHTML = `
                    <div class="stock-header">
                        <span class="stock-code">${stock.code}</span>
                        ${stock.version ? `<span class="version-badge">v${stock.version}</span>` : ''}
                    </div>
                    <div class="stock-name">${stock.name}</div>
                    <div class="stock-price ${priceClass}">${stock.currentPrice.toFixed(2)}</div>
                    <div class="stock-change">
                        <span class="change-value ${priceClass}">${change >= 0 ? '+' : ''}${change.toFixed(2)}</span>
                        <span class="change-value ${priceClass}">${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%</span>
                    </div>
                    ${stock.halted ? `<span class="stock-halt-badge">${stock.haltReason}</span>` : ''}
                `;
                
                container.appendChild(card);
            });
        }

        renderOrderbook() {
            const stock = this.stocks.get(this.selectedStock);
            if (!stock) return;
            
            const askEl = document.getElementById('askOrders');
            const bidEl = document.getElementById('bidOrders');
            
            askEl.innerHTML = '';
            bidEl.innerHTML = '';
            
            const askLevels = new Map();
            stock.askOrders.forEach(order => {
                if (order.status === OrderStatus.PENDING || order.status === OrderStatus.PARTIAL) {
                    askLevels.set(order.price, (askLevels.get(order.price) || 0) + order.remainingQuantity);
                }
            });
            
            const askSorted = Array.from(askLevels.entries()).sort((a, b) => b[0] - a[0]);
            askSorted.forEach(([price, qty]) => {
                const div = document.createElement('div');
                div.className = 'order-item';
                div.innerHTML = `<span class="order-price">${price.toFixed(2)}</span><span>${qty}</span>`;
                div.onclick = () => {
                    document.getElementById('orderSide').value = 'sell';
                    document.getElementById('orderPrice').value = price.toFixed(2);
                };
                askEl.appendChild(div);
            });
            
            const bidLevels = new Map();
            stock.bidOrders.forEach(order => {
                if (order.status === OrderStatus.PENDING || order.status === OrderStatus.PARTIAL) {
                    bidLevels.set(order.price, (bidLevels.get(order.price) || 0) + order.remainingQuantity);
                }
            });
            
            const bidSorted = Array.from(bidLevels.entries()).sort((a, b) => b[0] - a[0]);
            bidSorted.forEach(([price, qty]) => {
                const div = document.createElement('div');
                div.className = 'order-item';
                div.innerHTML = `<span class="order-price">${price.toFixed(2)}</span><span>${qty}</span>`;
                div.onclick = () => {
                    document.getElementById('orderSide').value = 'buy';
                    document.getElementById('orderPrice').value = price.toFixed(2);
                };
                bidEl.appendChild(div);
            });
        }

        renderAccount() {
            document.getElementById('availableCash').textContent = 
                `¥${this.account.availableCash.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            document.getElementById('frozenCash').textContent = 
                `¥${this.account.frozenCash.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            document.getElementById('positionValue').textContent = 
                `¥${this.account.positionValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            document.getElementById('totalAssets').textContent = 
                `¥${this.account.totalAssets.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        }

        renderCircuitStatus() {
            const cbLevel1 = document.getElementById('cbLevel1');
            const cbLevel2 = document.getElementById('cbLevel2');
            const cbMarket = document.getElementById('cbMarket');
            const liquidityStatus = document.getElementById('liquidityStatus');
            
            let level1Triggered = false;
            let level2Triggered = false;
            
            this.stocks.forEach(stock => {
                const level = stock.checkCircuitBreaker();
                if (level === CircuitBreakerLevel.LEVEL1) level1Triggered = true;
                if (level === CircuitBreakerLevel.LEVEL2) level2Triggered = true;
            });
            
            cbLevel1.className = 'status-badge ' + (level1Triggered ? 'status-warning' : 'status-normal');
            cbLevel1.textContent = level1Triggered ? '已触发' : '未触发';
            
            cbLevel2.className = 'status-badge ' + (level2Triggered ? 'status-danger' : 'status-normal');
            cbLevel2.textContent = level2Triggered ? '已触发' : '未触发';
            
            cbMarket.className = 'status-badge ' + (this.marketHalted ? 'status-danger' : 'status-normal');
            cbMarket.textContent = this.marketHalted ? '已触发' : '未触发';
            
            let liquidityClass = 'status-normal';
            let liquidityText = '正常';
            
            if (this.liquidityStatus === 'tight') {
                liquidityClass = 'status-warning';
                liquidityText = '偏紧';
            } else if (this.liquidityStatus === 'drained') {
                liquidityClass = 'status-danger';
                liquidityText = '枯竭';
            }
            
            liquidityStatus.className = 'status-badge ' + liquidityClass;
            liquidityStatus.textContent = liquidityText;
        }

        renderPositions() {
            const tbody = document.getElementById('positionsTable');
            tbody.innerHTML = '';
            
            if (this.account.positions.size === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><div class="empty-state-icon">📊</div>暂无持仓</td></tr>';
                return;
            }
            
            this.account.positions.forEach(pos => {
                const stock = this.stocks.get(pos.stockCode);
                if (stock) {
                    pos.currentPrice = stock.currentPrice;
                }
                
                const tr = document.createElement('tr');
                const profitClass = pos.profit >= 0 ? 'side-buy' : 'side-sell';
                tr.innerHTML = `
                    <td>${pos.stockCode}</td>
                    <td>${pos.stockName}</td>
                    <td>${pos.quantity}</td>
                    <td>${pos.availableQuantity}</td>
                    <td>${pos.costPrice.toFixed(2)}</td>
                    <td>${pos.currentPrice.toFixed(2)}</td>
                    <td class="${profitClass}">${pos.profit >= 0 ? '+' : ''}${pos.profit.toFixed(2)}</td>
                    <td class="${profitClass}">${pos.profitPercent >= 0 ? '+' : ''}${pos.profitPercent.toFixed(2)}%</td>
                `;
                tbody.appendChild(tr);
            });
        }

        renderOrders() {
            const tbody = document.getElementById('ordersTable');
            tbody.innerHTML = '';
            
            if (this.orders.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><div class="empty-state-icon">📝</div>暂无委托</td></tr>';
                return;
            }
            
            [...this.orders].reverse().forEach(order => {
                const stock = this.stocks.get(order.stockCode);
                const tr = document.createElement('tr');
                const sideClass = order.side === OrderSide.BUY ? 'side-buy' : 'side-sell';
                const statusClass = 'status-' + order.status;
                
                let cancelBtn = '';
                if (order.status === OrderStatus.PENDING || order.status === OrderStatus.PARTIAL) {
                    cancelBtn = `<button class="action-btn cancel" onclick="game.cancelOrder('${order.id}')">撤销</button>`;
                }
                
                tr.innerHTML = `
                    <td>${order.id}</td>
                    <td>${new Date(order.createTime).toLocaleTimeString()}</td>
                    <td>${stock ? stock.name : order.stockCode}</td>
                    <td class="${sideClass}">${order.side === OrderSide.BUY ? '买入' : '卖出'}</td>
                    <td>${order.type === OrderType.MARKET ? '市价' : order.price.toFixed(2)}</td>
                    <td>${order.quantity}${order.filledQuantity > 0 ? ` (${order.filledQuantity})` : ''}</td>
                    <td class="${statusClass}">${this.getStatusText(order.status)}</td>
                    <td>${cancelBtn}${order.version ? `<span class="version-badge">v${order.version}</span>` : ''}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        renderTrades() {
            const tbody = document.getElementById('tradesTable');
            tbody.innerHTML = '';
            if (this.trades.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><div class="empty-state-icon">💹</div>暂无成交</td></tr>';
                return;
            }
            [...this.trades].reverse().forEach(trade => {
                const stock = this.stocks.get(trade.stockCode);
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${trade.id}</td>
                    <td>${new Date(trade.time).toLocaleTimeString()}</td>
                    <td>${stock ? stock.name : trade.stockCode}</td>
                    <td class="side-buy">买入</td>
                    <td>${trade.price.toFixed(2)}</td>
                    <td>${trade.quantity}</td>
                    <td>${trade.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        renderViolations() {
            const tbody = document.getElementById('violationsTable');
            tbody.innerHTML = '';
            if (this.violations.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><div class="empty-state-icon">✅</div>暂无违规记录</td></tr>';
                return;
            }
            [...this.violations].reverse().forEach(v => {
                const tr = document.createElement('tr');
                const severityClass = 'severity-' + v.severity;
                const severityText = v.severity === ViolationSeverity.HIGH ? '严重' : v.severity === ViolationSeverity.MEDIUM ? '中等' : '轻微';
                tr.innerHTML = `
                    <td>${new Date(v.time).toLocaleTimeString()}</td>
                    <td>${v.type}</td>
                    <td class="${severityClass}">${severityText}</td>
                    <td>${v.description}</td>
                    <td style="color: #eb3349;">-${v.penalty}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        renderScore() {
            document.getElementById('scoreValue').textContent = this.score.finalScore;
            document.getElementById('baseScore').textContent = this.score.baseScore;
            document.getElementById('profitScore').textContent = `+${this.score.profitScore}`;
            document.getElementById('complianceScore').textContent = `+${this.score.complianceScore}`;
            document.getElementById('violationScore').textContent = `-${this.score.violationScore}`;
            document.getElementById('circuitScore').textContent = `+${this.score.circuitScore}`;
            document.getElementById('finalScore').textContent = this.score.finalScore;
        }

        renderStockSelects() {
            const selects = ['orderStock', 'orderbookStock', 'quickStock'];
            const stockOptions = Array.from(this.stocks.entries()).map(([code, stock]) => 
                `<option value="${code}" ${code === this.selectedStock ? 'selected' : ''}>${code} - ${stock.name}</option>`
            ).join('');
            selects.forEach(id => {
                const el = document.getElementById(id);
                const currentValue = el.value;
                el.innerHTML = '<option value="">选择股票</option>' + stockOptions;
                if (currentValue) el.value = currentValue;
            });
        }

        drawChart() {
            const canvas = document.getElementById('chartCanvas');
            if (!canvas || !this.selectedStock) return;
            const ctx = canvas.getContext('2d');
            const stock = this.stocks.get(this.selectedStock);
            if (!stock) return;
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            const width = canvas.width;
            const height = canvas.height;
            const padding = 40;
            ctx.clearRect(0, 0, width, height);
            const priceHistory = stock.priceHistory.slice(-50);
            if (priceHistory.length < 2) return;
            const prices = priceHistory.map(p => p.price);
            const minPrice = Math.min(...prices) * 0.99;
            const maxPrice = Math.max(...prices) * 1.01;
            const priceRange = maxPrice - minPrice;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            for (let i = 0; i <= 4; i++) {
                const y = padding + (height - 2 * padding) * (i / 4);
                ctx.beginPath();
                ctx.moveTo(padding, y);
                ctx.lineTo(width - padding, y);
                ctx.stroke();
                const price = maxPrice - priceRange * (i / 4);
                ctx.fillStyle = '#888';
                ctx.font = '10px monospace';
                ctx.textAlign = 'right';
                ctx.fillText(price.toFixed(2), padding - 5, y + 3);
            }
            const gradient = ctx.createLinearGradient(0, padding, 0, height - padding);
            gradient.addColorStop(0, 'rgba(0, 212, 255, 0.3)');
            gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
            ctx.beginPath();
            ctx.moveTo(padding, height - padding);
            priceHistory.forEach((p, i) => {
                const x = padding + (width - 2 * padding) * (i / (priceHistory.length - 1));
                const y = padding + (height - 2 * padding) * (1 - (p.price - minPrice) / priceRange);
                ctx.lineTo(x, y);
            });
            ctx.lineTo(width - padding, height - padding);
            ctx.closePath();
            ctx.fillStyle = gradient;
            ctx.fill();
            ctx.beginPath();
            priceHistory.forEach((p, i) => {
                const x = padding + (width - 2 * padding) * (i / (priceHistory.length - 1));
                const y = padding + (height - 2 * padding) * (1 - (p.price - minPrice) / priceRange);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.strokeStyle = '#00d4ff';
            ctx.lineWidth = 2;
            ctx.stroke();
            const lastPrice = prices[prices.length - 1];
            const lastY = padding + (height - 2 * padding) * (1 - (lastPrice - minPrice) / priceRange);
            ctx.beginPath();
            ctx.arc(width - padding, lastY, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#00d4ff';
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`${stock.code} ${stock.name}`, padding, 20);
            ctx.fillStyle = lastPrice >= stock.previousClose ? '#f45c43' : '#38ef7d';
            ctx.fillText(`¥${lastPrice.toFixed(2)}`, padding + 120, 20);
        }

        getStatusText(status) {
            const statusMap = {
                [OrderStatus.PENDING]: '待成交',
                [OrderStatus.PARTIAL]: '部分成交',
                [OrderStatus.FILLED]: '已成交',
                [OrderStatus.CANCELLED]: '已撤销',
                [OrderStatus.REJECTED]: '已拒绝'
            };
            return statusMap[status] || status;
        }

        displayNews(news) {
            const feed = document.getElementById('newsFeed');
            const div = document.createElement('div');
            div.className = 'news-item ' + (news.importance === 'important' ? 'important' : news.importance === 'warning' ? 'warning' : '');
            div.innerHTML = `
                <div class="news-time">${new Date(news.time).toLocaleTimeString()}</div>
                <div class="news-title">${news.title}</div>
                <div class="news-content">${news.content}</div>
            `;
            feed.insertBefore(div, feed.firstChild);
            while (feed.children.length > 20) feed.removeChild(feed.lastChild);
        }

        showToast(message, type = 'info') {
            const container = document.getElementById('toastContainer');
            const toast = document.createElement('div');
            toast.className = 'toast ' + type;
            toast.textContent = message;
            container.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                toast.style.transition = 'all 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        showModal(content) {
            const overlay = document.getElementById('modalOverlay');
            const modalContent = document.getElementById('modalContent');
            modalContent.innerHTML = '<button class="modal-close" onclick="game.closeModal()">&times;</button>' + content;
            overlay.style.display = 'flex';
        }

        closeModal() {
            document.getElementById('modalOverlay').style.display = 'none';
        }

        showHelp() {
            const content = `
                <h2>📈 股票熔断交易日 - 帮助文档</h2>
                <h3>🎮 游戏目标</h3>
                <p>作为交易员，在波动市场中完成交易，应对涨跌停、熔断和流动性枯竭。</p>
                <h3>📋 游戏流程</h3>
                <ol>
                    <li><strong>准备阶段</strong>: 导入股票池、订单簿、熔断规则、资金、新闻事件</li>
                    <li><strong>交易阶段</strong>: 点击"开始交易"进入交易时段</li>
                    <li><strong>暂停/恢复</strong>: 可随时暂停交易</li>
                    <li><strong>结算阶段</strong>: 点击"结算"结束交易，计算得分</li>
                    <li><strong>复盘阶段</strong>: 在"事件回放"标签页回顾交易过程</li>
                </ol>
                <h3>📂 材料导入</h3>
                <p>支持JSON/CSV格式: 股票池、订单簿、熔断规则、资金、新闻事件、成交记录、持仓</p>
                <p><strong>重复文件处理</strong>: 跳过、覆盖、追加三种模式，带版本号管理</p>
                <h3>⚡ 交易规则</h3>
                <ul>
                    <li><strong>涨跌停</strong>: ±10%</li>
                    <li><strong>一级熔断</strong>: ±5%，暂停60秒</li>
                    <li><strong>二级熔断</strong>: ±7%，暂停60秒</li>
                    <li><strong>全市场熔断</strong>: 70%股票停牌时触发</li>
                    <li><strong>流动性枯竭</strong>: 50%股票流动性不足时触发</li>
                </ul>
                <h3>⚠️ 违规扣分</h3>
                <ul>
                    <li>停牌期间交易: 严重 -10分</li>
                    <li>全市场熔断期间交易: 严重 -15分</li>
                    <li>资金/持仓不足: 严重 -8分</li>
                    <li>价格超出涨跌停: 中等 -5分</li>
                </ul>
                <h3>📊 评分规则</h3>
                <ul>
                    <li>基础分: 100分</li>
                    <li>盈利加分: 每盈利1%加2分，最高50分</li>
                    <li>合规加分: 最高30分</li>
                    <li>违规扣分: 各项违规总和</li>
                    <li>熔断应对: 最高20分</li>
                </ul>
            `;
            this.showModal(content);
        }

        showExportOptions() {
            const content = `
                <h2>📊 导出交易报告</h2>
                <p>请选择导出格式:</p>
                <div style="display: flex; gap: 16px; margin: 20px 0;">
                    <button class="btn btn-primary" onclick="game.exportReport('json')">JSON 格式</button>
                    <button class="btn btn-primary" onclick="game.exportReport('csv')">CSV 格式</button>
                    <button class="btn btn-primary" onclick="game.exportReport('html')">HTML 格式</button>
                </div>
            `;
            this.showModal(content);
        }

        exportReport(format) {
            switch (format) {
                case 'json': this.reportExporter.exportAsJSON(); break;
                case 'csv': this.reportExporter.exportAsCSV(); break;
                case 'html': this.reportExporter.exportAsHTML(); break;
            }
            this.closeModal();
            this.showToast('报告导出成功', 'success');
        }

        handleReplayPrev() {
            const event = this.replayManager.prev();
            if (event) this.displayReplayEvent(event);
            else this.showToast('已经是第一条记录', 'info');
            this.updateReplayProgress();
        }

        handleReplayNext() {
            const event = this.replayManager.next();
            if (event) this.displayReplayEvent(event);
            else this.showToast('已经是最后一条记录', 'info');
            this.updateReplayProgress();
        }

        handleReplayAuto() {
            const btn = document.getElementById('replayAutoBtn');
            if (this.replayManager.autoPlayInterval) {
                this.replayManager.stopAutoPlay();
                btn.textContent = '自动播放';
                btn.classList.remove('btn-warning');
                btn.classList.add('btn-primary');
            } else {
                this.replayManager.startAutoPlay(2000);
                btn.textContent = '停止播放';
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-warning');
            }
        }

        updateReplayProgress() {
            const progress = this.replayManager.getProgress();
            document.getElementById('replayProgress').textContent = `${progress.current} / ${progress.total}`;
        }

        updateReplayDisplay() {
            this.updateReplayProgress();
            if (this.eventLog.length > 0 && this.replayManager.currentIndex < 0) {
                this.displayReplayEvent(this.eventLog[0]);
                this.replayManager.currentIndex = 0;
                this.updateReplayProgress();
            }
        }

        displayReplayEvent(event) {
            const container = document.getElementById('replayContent');
            if (!event) {
                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎬</div>暂无回放记录</div>';
                return;
            }
            let typeText = '系统事件', typeClass = '';
            switch (event.type) {
                case 'order': typeText = '订单事件'; typeClass = 'order'; break;
                case 'trade': typeText = '成交事件'; typeClass = 'trade'; break;
                case 'violation': typeText = '违规事件'; typeClass = 'violation'; break;
                case 'circuit': typeText = '熔断事件'; typeClass = 'circuit'; break;
                case 'news': typeText = '新闻事件'; typeClass = 'news'; break;
            }
            let snapshotHtml = '';
            if (event.snapshot) {
                snapshotHtml = `
                    <div class="replay-snapshot">
                        <div><strong>📊 当时状态快照:</strong></div>
                        <div>总资产: ¥${event.snapshot.account.totalAssets.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                        <div>可用资金: ¥${event.snapshot.account.availableCash.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                        <div>持仓数量: ${event.snapshot.positions.length} 只</div>
                        <div>股票状态: ${event.snapshot.stocks.filter(s => s.halted).length} 只停牌</div>
                        <div>当前得分: ${event.snapshot.score.finalScore}</div>
                    </div>
                `;
            }
            container.innerHTML = `
                <div class="replay-event ${typeClass}">
                    <div class="replay-time">${new Date(event.time).toLocaleString()}</div>
                    <div class="replay-type">${typeText}</div>
                    <div class="replay-description">${event.description}</div>
                    ${snapshotHtml}
                </div>
            `;
        }
    }

    let game;
    document.addEventListener('DOMContentLoaded', () => {
        game = new Game();
        window.game = game;
    });

    return {
        Game,
        GamePhase,
        OrderSide,
        OrderType,
        OrderStatus,
        ViolationSeverity,
        CircuitBreakerLevel
    };
})();

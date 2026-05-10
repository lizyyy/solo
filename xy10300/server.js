const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DATA_FILE = path.join(DATA_DIR, 'database.json');

function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        return getInitialData();
    }
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return getInitialData();
    }
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getInitialData() {
    const today = new Date();
    const addDays = (days) => {
        const date = new Date(today);
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    };

    return {
        stores: [
            { id: 'A', name: 'A店（市中心店）', location: '上海市黄浦区南京东路100号' },
            { id: 'B', name: 'B店（大学城店）', location: '上海市杨浦区邯郸路220号' },
            { id: 'C', name: 'C店（商务区店）', location: '上海市浦东新区陆家嘴环路1000号' }
        ],
        products: [
            { id: 'M001', name: '光明纯牛奶250ml', category: '牛奶', shelfLife: 7, unit: '盒' },
            { id: 'M002', name: '蒙牛特仑苏250ml', category: '牛奶', shelfLife: 6, unit: '盒' },
            { id: 'F001', name: '全家海苔饭团', category: '饭团', shelfLife: 2, unit: '个' },
            { id: 'F002', name: '全家金枪鱼饭团', category: '饭团', shelfLife: 2, unit: '个' },
            { id: 'B001', name: '红烧排骨便当', category: '便当', shelfLife: 1, unit: '份' },
            { id: 'B002', name: '照烧鸡排便当', category: '便当', shelfLife: 1, unit: '份' }
        ],
        batches: [
            {
                id: 'B-20260507-001',
                productId: 'M001',
                storeId: 'A',
                quantity: 50,
                originalQuantity: 50,
                productionDate: addDays(-5),
                expiryDate: addDays(2),
                purchasePrice: 3.5,
                status: 'normal',
                createdAt: new Date().toISOString()
            },
            {
                id: 'B-20260507-002',
                productId: 'F001',
                storeId: 'A',
                quantity: 30,
                originalQuantity: 30,
                productionDate: addDays(-1),
                expiryDate: addDays(1),
                purchasePrice: 5.8,
                status: 'urgent',
                createdAt: new Date().toISOString()
            },
            {
                id: 'B-20260507-003',
                productId: 'B001',
                storeId: 'B',
                quantity: 20,
                originalQuantity: 20,
                productionDate: addDays(0),
                expiryDate: addDays(1),
                purchasePrice: 12.5,
                status: 'normal',
                createdAt: new Date().toISOString()
            },
            {
                id: 'B-20260507-004',
                productId: 'M002',
                storeId: 'C',
                quantity: 40,
                originalQuantity: 40,
                productionDate: addDays(-4),
                expiryDate: addDays(2),
                purchasePrice: 4.2,
                status: 'normal',
                createdAt: new Date().toISOString()
            },
            {
                id: 'B-20260507-005',
                productId: 'F002',
                storeId: 'A',
                quantity: 25,
                originalQuantity: 25,
                productionDate: addDays(-1),
                expiryDate: addDays(0),
                purchasePrice: 6.5,
                status: 'critical',
                createdAt: new Date().toISOString()
            }
        ],
        transfers: [],
        operations: [],
        nextBatchNo: 6,
        nextTransferNo: 1
    };
}

function generateBatchId(data) {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const id = `B-${today}-${String(data.nextBatchNo).padStart(3, '0')}`;
    data.nextBatchNo++;
    return id;
}

function generateTransferId(data) {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const id = `T-${today}-${String(data.nextTransferNo).padStart(3, '0')}`;
    data.nextTransferNo++;
    return id;
}

function getBatchStatus(expiryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    
    if (daysLeft <= 0) return 'expired';
    if (daysLeft === 1) return 'critical';
    if (daysLeft <= 3) return 'urgent';
    return 'normal';
}

function addOperation(data, type, description, details) {
    data.operations.push({
        id: `OP-${Date.now()}`,
        type,
        description,
        details,
        timestamp: new Date().toISOString()
    });
}

app.get('/api/data', (req, res) => {
    const data = loadData();
    res.json(data);
});

app.post('/api/batches', (req, res) => {
    const data = loadData();
    const { productId, storeId, quantity, productionDate, expiryDate, purchasePrice } = req.body;

    if (!productId || !storeId || !quantity || !productionDate || !expiryDate || purchasePrice === undefined) {
        return res.status(400).json({ error: '缺少必要字段' });
    }

    const product = data.products.find(p => p.id === productId);
    if (!product) {
        return res.status(400).json({ error: '商品不存在' });
    }

    const store = data.stores.find(s => s.id === storeId);
    if (!store) {
        return res.status(400).json({ error: '门店不存在' });
    }

    const prodDate = new Date(productionDate);
    const expDate = new Date(expiryDate);
    if (expDate <= prodDate) {
        return res.status(400).json({ error: '有效期必须晚于生产日期' });
    }

    if (quantity <= 0) {
        return res.status(400).json({ error: '数量必须大于0' });
    }

    if (purchasePrice < 0) {
        return res.status(400).json({ error: '进价不能为负数' });
    }

    const batch = {
        id: generateBatchId(data),
        productId,
        storeId,
        quantity: parseInt(quantity),
        originalQuantity: parseInt(quantity),
        productionDate,
        expiryDate,
        purchasePrice: parseFloat(purchasePrice),
        status: getBatchStatus(expiryDate),
        createdAt: new Date().toISOString()
    };

    data.batches.push(batch);
    addOperation(data, 'batch_create', `新增批次 ${batch.id}`, { batch, product, store });
    saveData(data);

    res.json({ success: true, batch });
});

app.post('/api/batches/import', (req, res) => {
    const data = loadData();
    const { batches } = req.body;

    if (!Array.isArray(batches) || batches.length === 0) {
        return res.status(400).json({ error: '没有要导入的批次数据' });
    }

    const results = { success: [], failed: [] };

    for (const item of batches) {
        const { productId, storeId, quantity, productionDate, expiryDate, purchasePrice } = item;

        if (!productId || !storeId || !quantity || !productionDate || !expiryDate || purchasePrice === undefined) {
            results.failed.push({ item, reason: '缺少必要字段' });
            continue;
        }

        const product = data.products.find(p => p.id === productId);
        if (!product) {
            results.failed.push({ item, reason: `商品 ${productId} 不存在` });
            continue;
        }

        const store = data.stores.find(s => s.id === storeId);
        if (!store) {
            results.failed.push({ item, reason: `门店 ${storeId} 不存在` });
            continue;
        }

        const prodDate = new Date(productionDate);
        const expDate = new Date(expiryDate);
        if (expDate <= prodDate) {
            results.failed.push({ item, reason: '有效期必须晚于生产日期' });
            continue;
        }

        if (quantity <= 0) {
            results.failed.push({ item, reason: '数量必须大于0' });
            continue;
        }

        const batch = {
            id: generateBatchId(data),
            productId,
            storeId,
            quantity: parseInt(quantity),
            originalQuantity: parseInt(quantity),
            productionDate,
            expiryDate,
            purchasePrice: parseFloat(purchasePrice),
            status: getBatchStatus(expiryDate),
            createdAt: new Date().toISOString()
        };

        data.batches.push(batch);
        results.success.push(batch);
        addOperation(data, 'batch_import', `导入批次 ${batch.id}`, { batch, product, store });
    }

    saveData(data);
    res.json({ success: true, results });
});

app.post('/api/transfers', (req, res) => {
    const data = loadData();
    const { fromStoreId, toStoreId, items, reason, initiator } = req.body;

    if (!fromStoreId || !toStoreId || !items || items.length === 0) {
        return res.status(400).json({ error: '缺少必要字段' });
    }

    if (fromStoreId === toStoreId) {
        return res.status(400).json({ error: '调出门店和调入门店不能相同' });
    }

    const fromStore = data.stores.find(s => s.id === fromStoreId);
    const toStore = data.stores.find(s => s.id === toStoreId);
    if (!fromStore || !toStore) {
        return res.status(400).json({ error: '门店不存在' });
    }

    const transferItems = [];
    const validationErrors = [];

    for (const item of items) {
        const { batchId, quantity } = item;

        if (!batchId || !quantity) {
            validationErrors.push({ item, reason: '缺少批次ID或数量' });
            continue;
        }

        const batch = data.batches.find(b => b.id === batchId);
        if (!batch) {
            validationErrors.push({ item, reason: `批次 ${batchId} 不存在` });
            continue;
        }

        if (batch.storeId !== fromStoreId) {
            validationErrors.push({ item, reason: `批次 ${batchId} 不属于调出门店 ${fromStoreId}` });
            continue;
        }

        if (batch.status === 'expired') {
            validationErrors.push({ item, reason: `批次 ${batchId} 已过期，不能调拨` });
            continue;
        }

        if (quantity > batch.quantity) {
            validationErrors.push({ item, reason: `批次 ${batchId} 库存不足，当前库存: ${batch.quantity}` });
            continue;
        }

        if (quantity <= 0) {
            validationErrors.push({ item, reason: '调拨数量必须大于0' });
            continue;
        }

        const existingTransfer = data.transfers.find(t => 
            t.status === 'pending' && 
            t.items.some(i => i.batchId === batchId)
        );
        if (existingTransfer) {
            validationErrors.push({ item, reason: `批次 ${batchId} 已在待处理调拨单 ${existingTransfer.id} 中` });
            continue;
        }

        transferItems.push({
            batchId,
            productId: batch.productId,
            quantity: parseInt(quantity),
            unitPrice: batch.purchasePrice
        });
    }

    if (validationErrors.length > 0) {
        return res.status(400).json({ error: '部分商品校验失败', validationErrors });
    }

    const transfer = {
        id: generateTransferId(data),
        fromStoreId,
        toStoreId,
        items: transferItems,
        reason: reason || '',
        initiator: initiator || '系统管理员',
        status: 'pending',
        createdAt: new Date().toISOString(),
        approvedAt: null,
        approvedBy: null,
        receivedAt: null,
        receivedBy: null
    };

    data.transfers.push(transfer);
    addOperation(data, 'transfer_create', `创建调拨单 ${transfer.id}`, { transfer, fromStore, toStore });
    saveData(data);

    res.json({ success: true, transfer });
});

app.post('/api/transfers/:id/approve', (req, res) => {
    const data = loadData();
    const { id } = req.params;
    const { approver } = req.body;

    const transfer = data.transfers.find(t => t.id === id);
    if (!transfer) {
        return res.status(404).json({ error: '调拨单不存在' });
    }

    if (transfer.status !== 'pending') {
        return res.status(400).json({ error: `调拨单状态为 ${transfer.status}，不能审批` });
    }

    for (const item of transfer.items) {
        const batch = data.batches.find(b => b.id === item.batchId);
        if (!batch || batch.quantity < item.quantity) {
            return res.status(400).json({ error: `批次 ${item.batchId} 库存不足` });
        }
    }

    for (const item of transfer.items) {
        const batch = data.batches.find(b => b.id === item.batchId);
        batch.quantity -= item.quantity;
    }

    transfer.status = 'approved';
    transfer.approvedAt = new Date().toISOString();
    transfer.approvedBy = approver || '审批人';

    addOperation(data, 'transfer_approve', `审批调拨单 ${transfer.id}`, { transfer });
    saveData(data);

    res.json({ success: true, transfer });
});

app.post('/api/transfers/:id/reject', (req, res) => {
    const data = loadData();
    const { id } = req.params;
    const { reason, rejector } = req.body;

    const transfer = data.transfers.find(t => t.id === id);
    if (!transfer) {
        return res.status(404).json({ error: '调拨单不存在' });
    }

    if (transfer.status !== 'pending') {
        return res.status(400).json({ error: `调拨单状态为 ${transfer.status}，不能驳回` });
    }

    transfer.status = 'rejected';
    transfer.rejectReason = reason || '';
    transfer.rejectedAt = new Date().toISOString();
    transfer.rejectedBy = rejector || '驳回人';

    addOperation(data, 'transfer_reject', `驳回调拨单 ${transfer.id}`, { transfer, reason });
    saveData(data);

    res.json({ success: true, transfer });
});

app.post('/api/transfers/:id/receive', (req, res) => {
    const data = loadData();
    const { id } = req.params;
    const { receiver } = req.body;

    const transfer = data.transfers.find(t => t.id === id);
    if (!transfer) {
        return res.status(404).json({ error: '调拨单不存在' });
    }

    if (transfer.status !== 'approved') {
        return res.status(400).json({ error: `调拨单状态为 ${transfer.status}，不能收货` });
    }

    for (const item of transfer.items) {
        const originalBatch = data.batches.find(b => b.id === item.batchId);
        const newBatchId = generateBatchId(data);
        
        const newBatch = {
            id: newBatchId,
            productId: item.productId,
            storeId: transfer.toStoreId,
            quantity: item.quantity,
            originalQuantity: item.quantity,
            productionDate: originalBatch.productionDate,
            expiryDate: originalBatch.expiryDate,
            purchasePrice: item.unitPrice,
            status: getBatchStatus(originalBatch.expiryDate),
            createdAt: new Date().toISOString(),
            sourceBatchId: item.batchId,
            sourceTransferId: transfer.id
        };

        data.batches.push(newBatch);
    }

    transfer.status = 'completed';
    transfer.receivedAt = new Date().toISOString();
    transfer.receivedBy = receiver || '收货人';

    addOperation(data, 'transfer_complete', `完成调拨单 ${transfer.id} 收货`, { transfer });
    saveData(data);

    res.json({ success: true, transfer });
});

app.post('/api/batches/:id/discount', (req, res) => {
    const data = loadData();
    const { id } = req.params;
    const { quantity, discountRate, operator } = req.body;

    const batch = data.batches.find(b => b.id === id);
    if (!batch) {
        return res.status(404).json({ error: '批次不存在' });
    }

    if (!quantity || quantity <= 0) {
        return res.status(400).json({ error: '数量必须大于0' });
    }

    if (quantity > batch.quantity) {
        return res.status(400).json({ error: `库存不足，当前库存: ${batch.quantity}` });
    }

    if (!discountRate || discountRate <= 0 || discountRate > 1) {
        return res.status(400).json({ error: '折扣率必须在0-1之间' });
    }

    batch.quantity -= quantity;

    addOperation(data, 'discount_sale', `批次 ${id} 折扣售卖 ${quantity} 件`, {
        batch,
        quantity,
        discountRate,
        operator: operator || '操作员'
    });
    saveData(data);

    res.json({ success: true, batch });
});

app.post('/api/batches/:id/discard', (req, res) => {
    const data = loadData();
    const { id } = req.params;
    const { quantity, reason, operator } = req.body;

    const batch = data.batches.find(b => b.id === id);
    if (!batch) {
        return res.status(404).json({ error: '批次不存在' });
    }

    if (!quantity || quantity <= 0) {
        return res.status(400).json({ error: '数量必须大于0' });
    }

    if (quantity > batch.quantity) {
        return res.status(400).json({ error: `库存不足，当前库存: ${batch.quantity}` });
    }

    batch.quantity -= quantity;

    addOperation(data, 'discard', `批次 ${id} 报损 ${quantity} 件`, {
        batch,
        quantity,
        reason: reason || '',
        operator: operator || '操作员'
    });
    saveData(data);

    res.json({ success: true, batch });
});

app.get('/api/inventory/diff', (req, res) => {
    const data = loadData();
    
    const inventoryMap = {};
    
    for (const batch of data.batches) {
        const key = `${batch.storeId}-${batch.productId}`;
        if (!inventoryMap[key]) {
            inventoryMap[key] = {
                storeId: batch.storeId,
                productId: batch.productId,
                quantity: 0,
                batches: []
            };
        }
        inventoryMap[key].quantity += batch.quantity;
        inventoryMap[key].batches.push({
            id: batch.id,
            quantity: batch.quantity,
            expiryDate: batch.expiryDate,
            status: batch.status
        });
    }

    const result = [];
    for (const key in inventoryMap) {
        const item = inventoryMap[key];
        const store = data.stores.find(s => s.id === item.storeId);
        const product = data.products.find(p => p.id === item.productId);
        
        const urgentBatches = item.batches.filter(b => b.status === 'urgent' || b.status === 'critical');
        
        result.push({
            ...item,
            storeName: store?.name,
            productName: product?.name,
            category: product?.category,
            unit: product?.unit,
            hasUrgent: urgentBatches.length > 0,
            urgentCount: urgentBatches.reduce((sum, b) => sum + b.quantity, 0)
        });
    }

    res.json(result);
});

app.get('/api/report', (req, res) => {
    const data = loadData();
    
    const transfersByStatus = {
        pending: 0,
        approved: 0,
        completed: 0,
        rejected: 0
    };
    
    let totalTransferQuantity = 0;
    let totalTransferValue = 0;
    
    for (const transfer of data.transfers) {
        transfersByStatus[transfer.status] = (transfersByStatus[transfer.status] || 0) + 1;
        
        for (const item of transfer.items) {
            totalTransferQuantity += item.quantity;
            totalTransferValue += item.quantity * item.unitPrice;
        }
    }

    let totalDiscountQuantity = 0;
    let totalDiscountValue = 0;
    let totalDiscardQuantity = 0;
    let totalDiscardValue = 0;

    for (const op of data.operations) {
        if (op.type === 'discount_sale') {
            totalDiscountQuantity += op.details.quantity;
            totalDiscountValue += op.details.quantity * op.details.batch.purchasePrice * (1 - op.details.discountRate);
        } else if (op.type === 'discard') {
            totalDiscardQuantity += op.details.quantity;
            totalDiscardValue += op.details.quantity * op.details.batch.purchasePrice;
        }
    }

    const urgentInventory = data.batches
        .filter(b => (b.status === 'urgent' || b.status === 'critical') && b.quantity > 0)
        .map(b => {
            const product = data.products.find(p => p.id === b.productId);
            const store = data.stores.find(s => s.id === b.storeId);
            return {
                ...b,
                productName: product?.name,
                storeName: store?.name
            };
        });

    res.json({
        transfersByStatus,
        totalTransferQuantity,
        totalTransferValue,
        totalDiscountQuantity,
        totalDiscountValue,
        totalDiscardQuantity,
        totalDiscardValue,
        urgentInventory,
        totalBatches: data.batches.length,
        totalOperations: data.operations.length
    });
});

app.post('/api/reset', (req, res) => {
    const data = getInitialData();
    saveData(data);
    res.json({ success: true, message: '数据已重置' });
});

app.listen(PORT, () => {
    console.log(`连锁门店临期调拨台服务运行在 http://localhost:${PORT}`);
    console.log(`访问页面: http://localhost:${PORT}`);
});

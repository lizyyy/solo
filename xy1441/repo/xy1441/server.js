const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8080;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const BATCHES_FILE = path.join(DATA_DIR, 'batches.json');
const SLOTS_FILE = path.join(DATA_DIR, 'slots.json');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function readData(file, defaultValue) {
    ensureDataDir();
    if (!fs.existsSync(file)) {
        return defaultValue;
    }
    const content = fs.readFileSync(file, 'utf8');
    return content ? JSON.parse(content) : defaultValue;
}

function writeData(file, data) {
    ensureDataDir();
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

let batches = readData(BATCHES_FILE, []);
let slots = readData(SLOTS_FILE, []);
let records = readData(RECORDS_FILE, []);

function generatePickupCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function saveAllData() {
    writeData(BATCHES_FILE, batches);
    writeData(SLOTS_FILE, slots);
    writeData(RECORDS_FILE, records);
}

function validatePhoneLastFour(phone) {
    return /^\d{4}$/.test(phone);
}

function validatePickupCode(code) {
    return /^\d{6}$/.test(code);
}

app.get('/api/batches', (req, res) => {
    res.json({ success: true, data: batches });
});

app.post('/api/batches', (req, res) => {
    const { batchName, slotCount } = req.body;
    
    if (!batchName || batchName.trim() === '') {
        return res.json({ success: false, message: '批次名称不能为空' });
    }
    
    if (!slotCount || slotCount < 1 || slotCount > 100) {
        return res.json({ success: false, message: '格口数量必须在1-100之间' });
    }
    
    const batchId = Date.now().toString();
    const today = new Date().toISOString().split('T')[0];
    
    const newBatch = {
        id: batchId,
        name: batchName.trim(),
        date: today,
        slotCount: parseInt(slotCount),
        createdAt: new Date().toISOString()
    };
    
    batches.push(newBatch);
    saveAllData();
    
    res.json({ success: true, data: newBatch, message: '批次创建成功' });
});

app.delete('/api/batches/:batchId', (req, res) => {
    const { batchId } = req.params;
    
    const batchIndex = batches.findIndex(b => b.id === batchId);
    if (batchIndex === -1) {
        return res.json({ success: false, message: '批次不存在' });
    }
    
    batches.splice(batchIndex, 1);
    slots = slots.filter(s => s.batchId !== batchId);
    records = records.filter(r => r.batchId !== batchId);
    
    saveAllData();
    res.json({ success: true, message: '批次已删除' });
});

app.get('/api/batches/:batchId/slots', (req, res) => {
    const { batchId } = req.params;
    
    const batchSlots = slots.filter(s => s.batchId === batchId);
    res.json({ success: true, data: batchSlots });
});

app.post('/api/slots', (req, res) => {
    const { batchId, slotNumber, foodName, phoneLastFour } = req.body;
    
    if (!batchId || !slots) {
        return res.json({ success: false, message: '参数不完整' });
    }
    
    const batch = batches.find(b => b.id === batchId);
    if (!batch) {
        return res.json({ success: false, message: '批次不存在' });
    }
    
    if (!slotNumber || slotNumber < 1 || slotNumber > batch.slotCount) {
        return res.json({ success: false, message: `格口号必须在1-${batch.slotCount}之间` });
    }
    
    if (!foodName || foodName.trim() === '') {
        return res.json({ success: false, message: '餐品名称不能为空' });
    }
    
    if (!validatePhoneLastFour(phoneLastFour)) {
        return res.json({ success: false, message: '手机号后四位必须是4位数字' });
    }
    
    const existingSlot = slots.find(s => s.batchId === batchId && s.slotNumber === slotNumber);
    if (existingSlot) {
        return res.json({ success: false, message: '该格口已被占用' });
    }
    
    const slotId = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
    const pickupCode = generatePickupCode();
    
    const newSlot = {
        id: slotId,
        batchId: batchId,
        slotNumber: parseInt(slotNumber),
        foodName: foodName.trim(),
        phoneLastFour: phoneLastFour,
        pickupCode: pickupCode,
        status: 'pending',
        createdAt: new Date().toISOString(),
        pickedAt: null
    };
    
    slots.push(newSlot);
    saveAllData();
    
    res.json({ 
        success: true, 
        data: newSlot, 
        message: `格口${slotNumber}录入成功，取餐码：${pickupCode}` 
    });
});

app.put('/api/slots/:slotId/pickup', (req, res) => {
    const { slotId } = req.params;
    const { phoneLastFour, pickupCode } = req.body;
    
    const slot = slots.find(s => s.id === slotId);
    if (!slot) {
        return res.json({ success: false, message: '格口不存在' });
    }
    
    if (slot.status === 'picked') {
        return res.json({ success: false, message: '该餐品已被取走，不能重复取餐' });
    }
    
    if (slot.status === 'contacted') {
        return res.json({ success: false, message: '该餐品已标记为待联系，请联系值班员处理' });
    }
    
    if (slot.phoneLastFour !== phoneLastFour) {
        return res.json({ success: false, message: '手机号后四位不正确' });
    }
    
    if (slot.pickupCode !== pickupCode) {
        return res.json({ success: false, message: '取餐码不正确' });
    }
    
    slot.status = 'picked';
    slot.pickedAt = new Date().toISOString();
    
    const recordId = Date.now().toString();
    const newRecord = {
        id: recordId,
        batchId: slot.batchId,
        slotId: slot.id,
        slotNumber: slot.slotNumber,
        foodName: slot.foodName,
        phoneLastFour: slot.phoneLastFour,
        pickupCode: slot.pickupCode,
        action: 'pickup',
        timestamp: new Date().toISOString()
    };
    
    records.push(newRecord);
    saveAllData();
    
    res.json({ 
        success: true, 
        data: { slot, record: newRecord }, 
        message: '取餐成功！' 
    });
});

app.post('/api/pickup', (req, res) => {
    const { phoneLastFour, pickupCode } = req.body;
    
    if (!validatePhoneLastFour(phoneLastFour)) {
        return res.json({ success: false, message: '手机号后四位必须是4位数字' });
    }
    
    if (!validatePickupCode(pickupCode)) {
        return res.json({ success: false, message: '取餐码必须是6位数字' });
    }
    
    const slot = slots.find(
        s => s.phoneLastFour === phoneLastFour && 
             s.pickupCode === pickupCode && 
             s.status === 'pending'
    );
    
    if (!slot) {
        const pickedSlot = slots.find(
            s => s.phoneLastFour === phoneLastFour && s.pickupCode === pickupCode
        );
        if (pickedSlot) {
            if (pickedSlot.status === 'picked') {
                return res.json({ success: false, message: '该餐品已被取走，不能重复取餐' });
            }
            if (pickedSlot.status === 'contacted') {
                return res.json({ success: false, message: '该餐品已标记为待联系，请联系值班员处理' });
            }
        }
        return res.json({ success: false, message: '未找到匹配的餐品，请检查手机号后四位和取餐码' });
    }
    
    slot.status = 'picked';
    slot.pickedAt = new Date().toISOString();
    
    const recordId = Date.now().toString();
    const newRecord = {
        id: recordId,
        batchId: slot.batchId,
        slotId: slot.id,
        slotNumber: slot.slotNumber,
        foodName: slot.foodName,
        phoneLastFour: slot.phoneLastFour,
        pickupCode: slot.pickupCode,
        action: 'pickup',
        timestamp: new Date().toISOString()
    };
    
    records.push(newRecord);
    saveAllData();
    
    res.json({ 
        success: true, 
        data: { slot, record: newRecord }, 
        message: '取餐成功！' 
    });
});

app.get('/api/records', (req, res) => {
    const { date } = req.query;
    
    let filteredRecords = records;
    if (date) {
        filteredRecords = records.filter(r => r.timestamp.startsWith(date));
    }
    
    res.json({ success: true, data: filteredRecords });
});

app.get('/api/exception', (req, res) => {
    const { date } = req.query;
    const today = date || new Date().toISOString().split('T')[0];
    
    const todaySlots = slots.filter(s => {
        const batch = batches.find(b => b.id === s.batchId);
        return batch && batch.date === today && s.status === 'pending';
    });
    
    const now = new Date();
    const timeoutSlots = todaySlots.filter(s => {
        const created = new Date(s.createdAt);
        const diffHours = (now - created) / (1000 * 60 * 60);
        return diffHours > 4;
    });
    
    const contactedSlots = slots.filter(s => {
        const batch = batches.find(b => b.id === s.batchId);
        return batch && batch.date === today && s.status === 'contacted';
    });
    
    res.json({ 
        success: true, 
        data: { 
            timeoutSlots: timeoutSlots,
            contactedSlots: contactedSlots
        } 
    });
});

app.post('/api/exception/mark-contact', (req, res) => {
    const { slotIds } = req.body;
    
    if (!slotIds || !Array.isArray(slotIds) || slotIds.length === 0) {
        return res.json({ success: false, message: '请选择要标记的格口' });
    }
    
    const updatedSlots = [];
    const errors = [];
    
    for (const slotId of slotIds) {
        const slot = slots.find(s => s.id === slotId);
        if (!slot) {
            errors.push(`格口 ${slotId} 不存在`);
            continue;
        }
        if (slot.status !== 'pending') {
            errors.push(`格口 ${slot.slotNumber} 状态不是待取餐，无法标记`);
            continue;
        }
        
        slot.status = 'contacted';
        
        const recordId = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
        const newRecord = {
            id: recordId,
            batchId: slot.batchId,
            slotId: slot.id,
            slotNumber: slot.slotNumber,
            foodName: slot.foodName,
            phoneLastFour: slot.phoneLastFour,
            pickupCode: slot.pickupCode,
            action: 'mark_contacted',
            timestamp: new Date().toISOString()
        };
        
        records.push(newRecord);
        updatedSlots.push(slot);
    }
    
    saveAllData();
    
    if (updatedSlots.length === 0) {
        return res.json({ success: false, message: errors[0] || '没有格口被标记' });
    }
    
    res.json({ 
        success: true, 
        data: updatedSlots, 
        message: `成功标记 ${updatedSlots.length} 个格口为待联系` 
    });
});

app.get('/api/export/csv', (req, res) => {
    const { date } = req.query;
    const today = date || new Date().toISOString().split('T')[0];
    
    const todayBatches = batches.filter(b => b.date === today);
    const todaySlotIds = [];
    todayBatches.forEach(b => {
        const batchSlots = slots.filter(s => s.batchId === b.id);
        batchSlots.forEach(s => todaySlotIds.push(s.id));
    });
    
    const todayRecords = records.filter(r => todaySlotIds.includes(r.slotId));
    
    let csvContent = '序号,批次名称,格口号,餐品名称,手机号后四位,取餐码,操作类型,操作时间\n';
    
    todayRecords.forEach((record, index) => {
        const batch = batches.find(b => b.id === record.batchId);
        const batchName = batch ? batch.name : '未知批次';
        const action = record.action === 'pickup' ? '取餐' : '标记待联系';
        
        csvContent += `${index + 1},${batchName},${record.slotNumber},${record.foodName},${record.phoneLastFour},${record.pickupCode},${action},${record.timestamp}\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=pickup-records-${today}.csv`);
    res.send('\uFEFF' + csvContent);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`共享冷藏柜取餐登记系统已启动`);
    console.log(`服务地址: http://localhost:${PORT}`);
    console.log(`值班员页面: http://localhost:${PORT}/staff.html`);
    console.log(`取餐页面: http://localhost:${PORT}/pickup.html`);
    console.log(`异常处理页面: http://localhost:${PORT}/exception.html`);
});

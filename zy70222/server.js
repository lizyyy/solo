const express = require('express');
const cors = require('cors');
const { readData, writeData, generateId } = require('./models');
const initData = require('./init-data');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: '博物馆临展借展保险台服务运行中' });
});

app.post('/api/init-data', (req, res) => {
    try {
        initData();
        res.json({ success: true, message: '示例数据初始化完成' });
    } catch (error) {
        res.status(500).json({ success: false, message: '初始化失败', error: error.message });
    }
});

function validateRequiredFields(data, requiredFields) {
    const missing = [];
    const invalid = [];
    for (const field of requiredFields) {
        if (data[field] === undefined || data[field] === null || data[field] === '') {
            missing.push(field);
        }
    }
    return { missing, invalid };
}

function validateExhibit(data) {
    const { missing } = validateRequiredFields(data, ['exhibitNo', 'name', 'category', 'era', 'location', 'value']);
    const errors = {};
    if (missing.length > 0) {
        errors.missingFields = missing;
    }
    if (data.value && isNaN(Number(data.value))) {
        errors.value = '估价必须是数字';
    }
    return Object.keys(errors).length > 0 ? errors : null;
}

function validateContract(data) {
    const { missing } = validateRequiredFields(data, ['contractNo', 'exhibitId', 'borrowerInstitution', 'lenderInstitution', 'startDate', 'endDate', 'insuranceAmount']);
    const errors = {};
    if (missing.length > 0) {
        errors.missingFields = missing;
    }
    if (data.insuranceAmount && isNaN(Number(data.insuranceAmount))) {
        errors.insuranceAmount = '保险金额必须是数字';
    }
    if (data.startDate && data.endDate && new Date(data.startDate) > new Date(data.endDate)) {
        errors.dates = '开始日期不能晚于结束日期';
    }
    return Object.keys(errors).length > 0 ? errors : null;
}

function validateInsurance(data) {
    const { missing } = validateRequiredFields(data, ['policyNo', 'contractId', 'exhibitId', 'insuranceCompany', 'startDate', 'endDate', 'amount']);
    const errors = {};
    if (missing.length > 0) {
        errors.missingFields = missing;
    }
    if (data.amount && isNaN(Number(data.amount))) {
        errors.amount = '保险金额必须是数字';
    }
    if (data.premium && isNaN(Number(data.premium))) {
        errors.premium = '保费必须是数字';
    }
    return Object.keys(errors).length > 0 ? errors : null;
}

function validateShipment(data) {
    const { missing } = validateRequiredFields(data, ['shipmentNo', 'contractId', 'exhibitId', 'logisticsCompany', 'departureDate', 'expectedArrivalDate']);
    const errors = {};
    if (missing.length > 0) {
        errors.missingFields = missing;
    }
    return Object.keys(errors).length > 0 ? errors : null;
}

function validateCheckpoint(data) {
    const { missing } = validateRequiredFields(data, ['shipmentId', 'checkpointNo', 'checkpointType', 'checkpointName', 'operator']);
    const errors = {};
    if (missing.length > 0) {
        errors.missingFields = missing;
    }
    return Object.keys(errors).length > 0 ? errors : null;
}

function checkDuplicate(dataList, field, value, excludeId = null) {
    return dataList.some(item => item[field] === value && item.id !== excludeId);
}

app.get('/api/exhibits', (req, res) => {
    const exhibits = readData('exhibits.json');
    res.json({ success: true, data: exhibits });
});

app.get('/api/exhibits/:id', (req, res) => {
    const exhibits = readData('exhibits.json');
    const exhibit = exhibits.find(e => e.id === req.params.id);
    if (!exhibit) {
        return res.status(404).json({ success: false, message: '展品不存在' });
    }
    res.json({ success: true, data: exhibit });
});

app.post('/api/exhibits', (req, res) => {
    const data = req.body;
    const validationErrors = validateExhibit(data);
    if (validationErrors) {
        return res.status(400).json({ success: false, message: '数据验证失败', errors: validationErrors });
    }

    const exhibits = readData('exhibits.json');
    if (checkDuplicate(exhibits, 'exhibitNo', data.exhibitNo)) {
        return res.status(409).json({ success: false, message: '展品编号已存在', errorType: 'duplicate' });
    }

    const newExhibit = {
        id: generateId('EXH'),
        ...data,
        value: Number(data.value),
        status: data.status || 'in_stock',
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString()
    };

    exhibits.push(newExhibit);
    writeData('exhibits.json', exhibits);
    res.json({ success: true, data: newExhibit });
});

app.put('/api/exhibits/:id', (req, res) => {
    const data = req.body;
    const exhibits = readData('exhibits.json');
    const index = exhibits.findIndex(e => e.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ success: false, message: '展品不存在' });
    }

    const validationErrors = validateExhibit(data);
    if (validationErrors) {
        return res.status(400).json({ success: false, message: '数据验证失败', errors: validationErrors });
    }

    if (checkDuplicate(exhibits, 'exhibitNo', data.exhibitNo, req.params.id)) {
        return res.status(409).json({ success: false, message: '展品编号已存在', errorType: 'duplicate' });
    }

    exhibits[index] = {
        ...exhibits[index],
        ...data,
        value: Number(data.value),
        updateTime: new Date().toISOString()
    };
    writeData('exhibits.json', exhibits);
    res.json({ success: true, data: exhibits[index] });
});

app.delete('/api/exhibits/:id', (req, res) => {
    const exhibits = readData('exhibits.json');
    const contracts = readData('contracts.json');
    const hasRelated = contracts.some(c => c.exhibitId === req.params.id);
    if (hasRelated) {
        return res.status(400).json({ success: false, message: '存在关联的借展合同，无法删除' });
    }

    const filtered = exhibits.filter(e => e.id !== req.params.id);
    if (filtered.length === exhibits.length) {
        return res.status(404).json({ success: false, message: '展品不存在' });
    }
    writeData('exhibits.json', filtered);
    res.json({ success: true });
});

app.get('/api/contracts', (req, res) => {
    const contracts = readData('contracts.json');
    res.json({ success: true, data: contracts });
});

app.get('/api/contracts/:id', (req, res) => {
    const contracts = readData('contracts.json');
    const contract = contracts.find(c => c.id === req.params.id);
    if (!contract) {
        return res.status(404).json({ success: false, message: '合同不存在' });
    }
    res.json({ success: true, data: contract });
});

app.post('/api/contracts', (req, res) => {
    const data = req.body;
    const validationErrors = validateContract(data);
    if (validationErrors) {
        return res.status(400).json({ success: false, message: '数据验证失败', errors: validationErrors });
    }

    const contracts = readData('contracts.json');
    if (checkDuplicate(contracts, 'contractNo', data.contractNo)) {
        return res.status(409).json({ success: false, message: '合同编号已存在', errorType: 'duplicate' });
    }

    const exhibits = readData('exhibits.json');
    const exhibit = exhibits.find(e => e.id === data.exhibitId);
    if (!exhibit) {
        return res.status(400).json({ success: false, message: '关联的展品不存在' });
    }

    const newContract = {
        id: generateId('CTR'),
        ...data,
        insuranceAmount: Number(data.insuranceAmount),
        status: data.status || 'active',
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString()
    };

    contracts.push(newContract);
    writeData('contracts.json', contracts);
    res.json({ success: true, data: newContract });
});

app.put('/api/contracts/:id', (req, res) => {
    const data = req.body;
    const contracts = readData('contracts.json');
    const index = contracts.findIndex(c => c.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ success: false, message: '合同不存在' });
    }

    const validationErrors = validateContract(data);
    if (validationErrors) {
        return res.status(400).json({ success: false, message: '数据验证失败', errors: validationErrors });
    }

    if (checkDuplicate(contracts, 'contractNo', data.contractNo, req.params.id)) {
        return res.status(409).json({ success: false, message: '合同编号已存在', errorType: 'duplicate' });
    }

    contracts[index] = {
        ...contracts[index],
        ...data,
        insuranceAmount: Number(data.insuranceAmount),
        updateTime: new Date().toISOString()
    };
    writeData('contracts.json', contracts);
    res.json({ success: true, data: contracts[index] });
});

app.delete('/api/contracts/:id', (req, res) => {
    const contracts = readData('contracts.json');
    const insurances = readData('insurances.json');
    const shipments = readData('shipments.json');
    const hasRelated = insurances.some(i => i.contractId === req.params.id) || shipments.some(s => s.contractId === req.params.id);
    if (hasRelated) {
        return res.status(400).json({ success: false, message: '存在关联的保险或运输记录，无法删除' });
    }

    const filtered = contracts.filter(c => c.id !== req.params.id);
    if (filtered.length === contracts.length) {
        return res.status(404).json({ success: false, message: '合同不存在' });
    }
    writeData('contracts.json', filtered);
    res.json({ success: true });
});

app.get('/api/insurances', (req, res) => {
    const insurances = readData('insurances.json');
    res.json({ success: true, data: insurances });
});

app.get('/api/insurances/:id', (req, res) => {
    const insurances = readData('insurances.json');
    const insurance = insurances.find(i => i.id === req.params.id);
    if (!insurance) {
        return res.status(404).json({ success: false, message: '保险记录不存在' });
    }
    res.json({ success: true, data: insurance });
});

app.post('/api/insurances', (req, res) => {
    const data = req.body;
    const validationErrors = validateInsurance(data);
    if (validationErrors) {
        return res.status(400).json({ success: false, message: '数据验证失败', errors: validationErrors });
    }

    const insurances = readData('insurances.json');
    if (checkDuplicate(insurances, 'policyNo', data.policyNo)) {
        return res.status(409).json({ success: false, message: '保单号已存在', errorType: 'duplicate' });
    }

    const contracts = readData('contracts.json');
    const contract = contracts.find(c => c.id === data.contractId);
    if (!contract) {
        return res.status(400).json({ success: false, message: '关联的合同不存在' });
    }

    if (Number(data.amount) !== contract.insuranceAmount) {
        return res.status(400).json({ 
            success: false, 
            message: `保险金额与合同约定不一致，合同约定金额为: ${contract.insuranceAmount}`,
            errorType: 'mismatch',
            expectedAmount: contract.insuranceAmount
        });
    }

    const newInsurance = {
        id: generateId('INS'),
        ...data,
        amount: Number(data.amount),
        premium: data.premium ? Number(data.premium) : 0,
        status: data.status || 'active',
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString()
    };

    insurances.push(newInsurance);
    writeData('insurances.json', insurances);
    res.json({ success: true, data: newInsurance });
});

app.put('/api/insurances/:id', (req, res) => {
    const data = req.body;
    const insurances = readData('insurances.json');
    const index = insurances.findIndex(i => i.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ success: false, message: '保险记录不存在' });
    }

    const validationErrors = validateInsurance(data);
    if (validationErrors) {
        return res.status(400).json({ success: false, message: '数据验证失败', errors: validationErrors });
    }

    if (checkDuplicate(insurances, 'policyNo', data.policyNo, req.params.id)) {
        return res.status(409).json({ success: false, message: '保单号已存在', errorType: 'duplicate' });
    }

    insurances[index] = {
        ...insurances[index],
        ...data,
        amount: Number(data.amount),
        premium: data.premium ? Number(data.premium) : 0,
        updateTime: new Date().toISOString()
    };
    writeData('insurances.json', insurances);
    res.json({ success: true, data: insurances[index] });
});

app.delete('/api/insurances/:id', (req, res) => {
    const insurances = readData('insurances.json');
    const filtered = insurances.filter(i => i.id !== req.params.id);
    if (filtered.length === insurances.length) {
        return res.status(404).json({ success: false, message: '保险记录不存在' });
    }
    writeData('insurances.json', filtered);
    res.json({ success: true });
});

app.get('/api/shipments', (req, res) => {
    const shipments = readData('shipments.json');
    res.json({ success: true, data: shipments });
});

app.get('/api/shipments/:id', (req, res) => {
    const shipments = readData('shipments.json');
    const shipment = shipments.find(s => s.id === req.params.id);
    if (!shipment) {
        return res.status(404).json({ success: false, message: '运输批次不存在' });
    }
    res.json({ success: true, data: shipment });
});

app.post('/api/shipments', (req, res) => {
    const data = req.body;
    const validationErrors = validateShipment(data);
    if (validationErrors) {
        return res.status(400).json({ success: false, message: '数据验证失败', errors: validationErrors });
    }

    const shipments = readData('shipments.json');
    if (checkDuplicate(shipments, 'shipmentNo', data.shipmentNo)) {
        return res.status(409).json({ success: false, message: '运输批次号已存在', errorType: 'duplicate' });
    }

    const contracts = readData('contracts.json');
    const contract = contracts.find(c => c.id === data.contractId);
    if (!contract) {
        return res.status(400).json({ success: false, message: '关联的合同不存在' });
    }

    const newShipment = {
        id: generateId('SHP'),
        ...data,
        status: data.status || 'in_transit',
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString()
    };

    shipments.push(newShipment);
    writeData('shipments.json', shipments);
    res.json({ success: true, data: newShipment });
});

app.put('/api/shipments/:id', (req, res) => {
    const data = req.body;
    const shipments = readData('shipments.json');
    const index = shipments.findIndex(s => s.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ success: false, message: '运输批次不存在' });
    }

    const validationErrors = validateShipment(data);
    if (validationErrors) {
        return res.status(400).json({ success: false, message: '数据验证失败', errors: validationErrors });
    }

    if (checkDuplicate(shipments, 'shipmentNo', data.shipmentNo, req.params.id)) {
        return res.status(409).json({ success: false, message: '运输批次号已存在', errorType: 'duplicate' });
    }

    shipments[index] = {
        ...shipments[index],
        ...data,
        updateTime: new Date().toISOString()
    };
    writeData('shipments.json', shipments);
    res.json({ success: true, data: shipments[index] });
});

app.delete('/api/shipments/:id', (req, res) => {
    const shipments = readData('shipments.json');
    const checkpoints = readData('checkpoints.json');
    const hasRelated = checkpoints.some(c => c.shipmentId === req.params.id);
    if (hasRelated) {
        return res.status(400).json({ success: false, message: '存在关联的点交记录，无法删除' });
    }

    const filtered = shipments.filter(s => s.id !== req.params.id);
    if (filtered.length === shipments.length) {
        return res.status(404).json({ success: false, message: '运输批次不存在' });
    }
    writeData('shipments.json', filtered);
    res.json({ success: true });
});

app.get('/api/checkpoints', (req, res) => {
    const checkpoints = readData('checkpoints.json');
    res.json({ success: true, data: checkpoints });
});

app.get('/api/checkpoints/shipment/:shipmentId', (req, res) => {
    const checkpoints = readData('checkpoints.json');
    const filtered = checkpoints.filter(c => c.shipmentId === req.params.shipmentId);
    res.json({ success: true, data: filtered });
});

app.post('/api/checkpoints', (req, res) => {
    const data = req.body;
    const validationErrors = validateCheckpoint(data);
    if (validationErrors) {
        return res.status(400).json({ success: false, message: '数据验证失败', errors: validationErrors });
    }

    const checkpoints = readData('checkpoints.json');
    if (checkDuplicate(checkpoints, 'checkpointNo', data.checkpointNo)) {
        return res.status(409).json({ success: false, message: '点交编号已存在', errorType: 'duplicate' });
    }

    const shipments = readData('shipments.json');
    const shipment = shipments.find(s => s.id === data.shipmentId);
    if (!shipment) {
        return res.status(400).json({ success: false, message: '关联的运输批次不存在' });
    }

    const newCheckpoint = {
        id: generateId('CKP'),
        ...data,
        timestamp: data.timestamp || new Date().toISOString(),
        status: data.status || 'pending',
        createTime: new Date().toISOString()
    };

    checkpoints.push(newCheckpoint);
    writeData('checkpoints.json', checkpoints);
    res.json({ success: true, data: newCheckpoint });
});

app.put('/api/checkpoints/:id', (req, res) => {
    const data = req.body;
    const checkpoints = readData('checkpoints.json');
    const index = checkpoints.findIndex(c => c.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ success: false, message: '点交记录不存在' });
    }

    checkpoints[index] = {
        ...checkpoints[index],
        ...data
    };
    writeData('checkpoints.json', checkpoints);
    res.json({ success: true, data: checkpoints[index] });
});

app.put('/api/checkpoints/:id/confirm', (req, res) => {
    const checkpoints = readData('checkpoints.json');
    const index = checkpoints.findIndex(c => c.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ success: false, message: '点交记录不存在' });
    }

    if (!checkpoints[index].signature) {
        return res.status(400).json({ success: false, message: '点交记录必须有签名才能确认' });
    }

    checkpoints[index].status = 'confirmed';
    writeData('checkpoints.json', checkpoints);
    res.json({ success: true, data: checkpoints[index] });
});

app.put('/api/checkpoints/:id/reject', (req, res) => {
    const checkpoints = readData('checkpoints.json');
    const index = checkpoints.findIndex(c => c.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ success: false, message: '点交记录不存在' });
    }

    if (!req.body.rejectReason) {
        return res.status(400).json({ success: false, message: '拒绝时必须提供拒绝原因' });
    }

    checkpoints[index].status = 'rejected';
    checkpoints[index].rejectReason = req.body.rejectReason;
    writeData('checkpoints.json', checkpoints);
    res.json({ success: true, data: checkpoints[index] });
});

app.delete('/api/checkpoints/:id', (req, res) => {
    const checkpoints = readData('checkpoints.json');
    const filtered = checkpoints.filter(c => c.id !== req.params.id);
    if (filtered.length === checkpoints.length) {
        return res.status(404).json({ success: false, message: '点交记录不存在' });
    }
    writeData('checkpoints.json', filtered);
    res.json({ success: true });
});

app.get('/api/export/:type', (req, res) => {
    const type = req.params.type;
    let data;
    let filename;

    switch (type) {
        case 'exhibits':
            data = readData('exhibits.json');
            filename = `展品档案_${new Date().toISOString().slice(0, 10)}.json`;
            break;
        case 'contracts':
            data = readData('contracts.json');
            filename = `借展合同_${new Date().toISOString().slice(0, 10)}.json`;
            break;
        case 'insurances':
            data = readData('insurances.json');
            filename = `保险登记_${new Date().toISOString().slice(0, 10)}.json`;
            break;
        case 'shipments':
            data = readData('shipments.json');
            filename = `运输批次_${new Date().toISOString().slice(0, 10)}.json`;
            break;
        case 'checkpoints':
            data = readData('checkpoints.json');
            filename = `点交记录_${new Date().toISOString().slice(0, 10)}.json`;
            break;
        case 'all':
            data = {
                exhibits: readData('exhibits.json'),
                contracts: readData('contracts.json'),
                insurances: readData('insurances.json'),
                shipments: readData('shipments.json'),
                checkpoints: readData('checkpoints.json')
            };
            filename = `博物馆临展借展保险台数据_${new Date().toISOString().slice(0, 10)}.json`;
            break;
        default:
            return res.status(400).json({ success: false, message: '无效的导出类型' });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.json({ success: true, data, filename });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`博物馆临展借展保险台服务运行在 http://localhost:${PORT}`);
});

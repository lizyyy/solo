const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const XLSX = require('xlsx');
const fs = require('fs');

const app = express();
const PORT = 8888;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        return {
            materials: [],
            patients: [],
            doctors: [],
            appointments: [],
            surgeries: [],
            materialUsage: [],
            recalledLots: []
        };
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function isExpired(expiryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    return expiry < today;
}

app.get('/api/materials', (req, res) => {
    const data = loadData();
    const materials = data.materials.map(m => ({
        ...m,
        isExpired: isExpired(m.expiryDate),
        isLowStock: m.quantity <= m.minStock
    }));
    res.json(materials);
});

app.post('/api/materials', (req, res) => {
    const data = loadData();
    const { lotNumber, name, type, manufacturer, expiryDate, quantity, minStock } = req.body;
    
    if (data.materials.find(m => m.lotNumber === lotNumber)) {
        return res.status(400).json({ error: '该批号已存在' });
    }
    
    const newMaterial = {
        id: Date.now().toString(),
        lotNumber,
        name,
        type,
        manufacturer,
        expiryDate,
        quantity: parseInt(quantity),
        minStock: parseInt(minStock) || 10,
        createdAt: new Date().toISOString()
    };
    
    data.materials.push(newMaterial);
    saveData(data);
    res.json(newMaterial);
});

app.get('/api/patients', (req, res) => {
    const data = loadData();
    res.json(data.patients);
});

app.post('/api/patients', (req, res) => {
    const data = loadData();
    const { patientId, name, phone, gender, age } = req.body;
    
    if (data.patients.find(p => p.patientId === patientId)) {
        return res.status(400).json({ error: '该患者ID已存在' });
    }
    
    const newPatient = {
        id: Date.now().toString(),
        patientId,
        name,
        phone,
        gender,
        age: parseInt(age),
        createdAt: new Date().toISOString()
    };
    
    data.patients.push(newPatient);
    saveData(data);
    res.json(newPatient);
});

app.get('/api/doctors', (req, res) => {
    const data = loadData();
    res.json(data.doctors);
});

app.post('/api/doctors', (req, res) => {
    const data = loadData();
    const { doctorId, name, department, phone } = req.body;
    
    if (data.doctors.find(d => d.doctorId === doctorId)) {
        return res.status(400).json({ error: '该医生ID已存在' });
    }
    
    const newDoctor = {
        id: Date.now().toString(),
        doctorId,
        name,
        department,
        phone,
        createdAt: new Date().toISOString()
    };
    
    data.doctors.push(newDoctor);
    saveData(data);
    res.json(newDoctor);
});

app.get('/api/appointments', (req, res) => {
    const data = loadData();
    res.json(data.appointments);
});

app.post('/api/appointments', (req, res) => {
    const data = loadData();
    const { patientId, doctorId, appointmentDate, description } = req.body;
    
    const patient = data.patients.find(p => p.patientId === patientId);
    if (!patient) {
        return res.status(400).json({ error: '患者不存在' });
    }
    
    const doctor = data.doctors.find(d => d.doctorId === doctorId);
    if (!doctor) {
        return res.status(400).json({ error: '医生不存在' });
    }
    
    const newAppointment = {
        id: Date.now().toString(),
        appointmentNo: 'APT' + Date.now(),
        patientId,
        patientName: patient.name,
        doctorId,
        doctorName: doctor.name,
        appointmentDate,
        description,
        status: '待手术',
        createdAt: new Date().toISOString()
    };
    
    data.appointments.push(newAppointment);
    saveData(data);
    res.json(newAppointment);
});

app.get('/api/surgeries', (req, res) => {
    const data = loadData();
    const surgeries = data.surgeries.map(s => ({
        ...s,
        materials: data.materialUsage
            .filter(u => u.surgeryId === s.id)
            .map(u => ({
                ...u,
                materialName: data.materials.find(m => m.lotNumber === u.lotNumber)?.name
            }))
    }));
    res.json(surgeries);
});

app.post('/api/surgeries', (req, res) => {
    const data = loadData();
    const { appointmentId, surgeryDate, materials } = req.body;
    
    const appointment = data.appointments.find(a => a.id === appointmentId);
    if (!appointment) {
        return res.status(400).json({ error: '预约不存在' });
    }
    
    for (const item of materials) {
        const material = data.materials.find(m => m.lotNumber === item.lotNumber);
        if (!material) {
            return res.status(400).json({ error: `材料批号 ${item.lotNumber} 不存在` });
        }
        
        if (isExpired(material.expiryDate)) {
            return res.status(400).json({ 
                error: `材料批号 ${item.lotNumber} (${material.name}) 已过期`,
                type: 'expired'
            });
        }
        
        if (material.quantity < item.quantity) {
            return res.status(400).json({ 
                error: `材料批号 ${item.lotNumber} (${material.name}) 库存不足，当前库存: ${material.quantity}`,
                type: 'lowStock'
            });
        }
    }
    
    const existingUsage = data.materialUsage.filter(u => u.surgeryId);
    for (const item of materials) {
        const usageInOther = existingUsage.find(u => u.lotNumber === item.lotNumber);
        if (usageInOther) {
            const surgery = data.surgeries.find(s => s.id === usageInOther.surgeryId);
            if (surgery) {
                return res.status(400).json({ 
                    error: `材料批号 ${item.lotNumber} 已在手术 ${surgery.surgeryNo} 中使用，不可重复登记`,
                    type: 'duplicate'
                });
            }
        }
    }
    
    const newSurgery = {
        id: Date.now().toString(),
        surgeryNo: 'OP' + Date.now(),
        appointmentId,
        appointmentNo: appointment.appointmentNo,
        patientId: appointment.patientId,
        patientName: appointment.patientName,
        doctorId: appointment.doctorId,
        doctorName: appointment.doctorName,
        surgeryDate,
        status: '已完成',
        createdAt: new Date().toISOString()
    };
    
    const newUsages = materials.map(item => {
        const material = data.materials.find(m => m.lotNumber === item.lotNumber);
        material.quantity -= item.quantity;
        
        return {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            surgeryId: newSurgery.id,
            lotNumber: item.lotNumber,
            materialName: material.name,
            quantity: item.quantity,
            usedAt: new Date().toISOString()
        };
    });
    
    appointment.status = '已完成';
    data.surgeries.push(newSurgery);
    data.materialUsage.push(...newUsages);
    saveData(data);
    
    res.json({
        surgery: newSurgery,
        usages: newUsages
    });
});

app.delete('/api/surgeries/:id', (req, res) => {
    const data = loadData();
    const surgery = data.surgeries.find(s => s.id === req.params.id);
    
    if (!surgery) {
        return res.status(404).json({ error: '手术记录不存在' });
    }
    
    const usages = data.materialUsage.filter(u => u.surgeryId === req.params.id);
    if (usages.length > 0) {
        return res.status(400).json({ 
            error: '该手术已关联材料使用记录，为保证追溯完整性，不可随意删除。如需撤销，请联系系统管理员。',
            type: 'protected'
        });
    }
    
    data.surgeries = data.surgeries.filter(s => s.id !== req.params.id);
    saveData(data);
    res.json({ success: true });
});

app.get('/api/stock-alerts', (req, res) => {
    const data = loadData();
    const alerts = [];
    
    for (const material of data.materials) {
        if (material.quantity <= material.minStock) {
            alerts.push({
                type: 'lowStock',
                material,
                message: `库存不足，当前: ${material.quantity}，最低库存: ${material.minStock}`
            });
        }
        if (isExpired(material.expiryDate)) {
            alerts.push({
                type: 'expired',
                material,
                message: `已过期，过期日期: ${material.expiryDate}`
            });
        }
    }
    
    res.json(alerts);
});

app.get('/api/recall/:lotNumber', (req, res) => {
    const data = loadData();
    const lotNumber = req.params.lotNumber;
    
    const material = data.materials.find(m => m.lotNumber === lotNumber);
    if (!material) {
        return res.status(404).json({ error: '该批号不存在' });
    }
    
    const usages = data.materialUsage.filter(u => u.lotNumber === lotNumber);
    const affectedPatients = usages.map(u => {
        const surgery = data.surgeries.find(s => s.id === u.surgeryId);
        const patient = data.patients.find(p => p.patientId === surgery?.patientId);
        return {
            surgery,
            patient,
            usage: u
        };
    }).filter(x => x.surgery && x.patient);
    
    res.json({
        material,
        affectedCount: affectedPatients.length,
        affectedPatients
    });
});

app.post('/api/recall', (req, res) => {
    const data = loadData();
    const { lotNumber, reason } = req.body;
    
    const material = data.materials.find(m => m.lotNumber === lotNumber);
    if (!material) {
        return res.status(404).json({ error: '该批号不存在' });
    }
    
    const recall = {
        id: Date.now().toString(),
        lotNumber,
        materialName: material.name,
        reason,
        recallDate: new Date().toISOString()
    };
    
    data.recalledLots.push(recall);
    saveData(data);
    res.json(recall);
});

app.get('/api/trace/lot/:lotNumber', (req, res) => {
    const data = loadData();
    const lotNumber = req.params.lotNumber;
    
    const material = data.materials.find(m => m.lotNumber === lotNumber);
    if (!material) {
        return res.status(404).json({ error: '该批号不存在' });
    }
    
    const usages = data.materialUsage.filter(u => u.lotNumber === lotNumber);
    const chain = usages.map(u => {
        const surgery = data.surgeries.find(s => s.id === u.surgeryId);
        const patient = data.patients.find(p => p.patientId === surgery?.patientId);
        const doctor = data.doctors.find(d => d.doctorId === surgery?.doctorId);
        return {
            material: { lotNumber, name: material.name },
            surgery,
            patient,
            doctor,
            usage: u
        };
    });
    
    res.json({
        material,
        chain
    });
});

app.get('/api/trace/patient/:patientId', (req, res) => {
    const data = loadData();
    const patientId = req.params.patientId;
    
    const patient = data.patients.find(p => p.patientId === patientId);
    if (!patient) {
        return res.status(404).json({ error: '该患者不存在' });
    }
    
    const surgeries = data.surgeries.filter(s => s.patientId === patientId);
    const chain = surgeries.map(s => {
        const doctor = data.doctors.find(d => d.doctorId === s.doctorId);
        const usages = data.materialUsage.filter(u => u.surgeryId === s.id);
        const materials = usages.map(u => {
            const material = data.materials.find(m => m.lotNumber === u.lotNumber);
            return {
                lotNumber: u.lotNumber,
                name: material?.name,
                quantity: u.quantity
            };
        });
        return {
            patient,
            surgery: s,
            doctor,
            materials
        };
    });
    
    res.json({
        patient,
        chain
    });
});

app.get('/api/export/trace', (req, res) => {
    const data = loadData();
    const { type, keyword } = req.query;
    
    let records = [];
    
    if (type === 'lot' && keyword) {
        const material = data.materials.find(m => m.lotNumber === keyword);
        if (material) {
            const usages = data.materialUsage.filter(u => u.lotNumber === keyword);
            records = usages.map(u => {
                const surgery = data.surgeries.find(s => s.id === u.surgeryId);
                const patient = data.patients.find(p => p.patientId === surgery?.patientId);
                const doctor = data.doctors.find(d => d.doctorId === surgery?.doctorId);
                return {
                    '材料批号': keyword,
                    '材料名称': material.name,
                    '制造商': material.manufacturer,
                    '过期日期': material.expiryDate,
                    '患者ID': patient?.patientId || '',
                    '患者姓名': patient?.name || '',
                    '患者电话': patient?.phone || '',
                    '手术编号': surgery?.surgeryNo || '',
                    '手术日期': surgery?.surgeryDate || '',
                    '医生ID': doctor?.doctorId || '',
                    '医生姓名': doctor?.name || '',
                    '使用数量': u.quantity,
                    '使用时间': u.usedAt
                };
            });
        }
    } else if (type === 'patient' && keyword) {
        const patient = data.patients.find(p => p.patientId === keyword);
        if (patient) {
            const surgeries = data.surgeries.filter(s => s.patientId === keyword);
            surgeries.forEach(s => {
                const doctor = data.doctors.find(d => d.doctorId === s.doctorId);
                const usages = data.materialUsage.filter(u => u.surgeryId === s.id);
                usages.forEach(u => {
                    const material = data.materials.find(m => m.lotNumber === u.lotNumber);
                    records.push({
                        '患者ID': patient.patientId,
                        '患者姓名': patient.name,
                        '患者电话': patient.phone,
                        '手术编号': s.surgeryNo,
                        '手术日期': s.surgeryDate,
                        '医生ID': doctor?.doctorId || '',
                        '医生姓名': doctor?.name || '',
                        '材料批号': u.lotNumber,
                        '材料名称': material?.name || '',
                        '制造商': material?.manufacturer || '',
                        '过期日期': material?.expiryDate || '',
                        '使用数量': u.quantity,
                        '使用时间': u.usedAt
                    });
                });
            });
        }
    } else {
        const allUsages = data.materialUsage;
        allUsages.forEach(u => {
            const material = data.materials.find(m => m.lotNumber === u.lotNumber);
            const surgery = data.surgeries.find(s => s.id === u.surgeryId);
            const patient = data.patients.find(p => p.patientId === surgery?.patientId);
            const doctor = data.doctors.find(d => d.doctorId === surgery?.doctorId);
            records.push({
                '患者ID': patient?.patientId || '',
                '患者姓名': patient?.name || '',
                '患者电话': patient?.phone || '',
                '手术编号': surgery?.surgeryNo || '',
                '手术日期': surgery?.surgeryDate || '',
                '医生ID': doctor?.doctorId || '',
                '医生姓名': doctor?.name || '',
                '材料批号': u.lotNumber,
                '材料名称': material?.name || '',
                '制造商': material?.manufacturer || '',
                '过期日期': material?.expiryDate || '',
                '使用数量': u.quantity,
                '使用时间': u.usedAt
            });
        });
    }
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(records);
    XLSX.utils.book_append_sheet(wb, ws, '追溯记录');
    
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=追溯记录表.xlsx');
    res.send(excelBuffer);
});

app.get('/api/data/init', (req, res) => {
    const today = new Date();
    const nextYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    
    const data = {
        materials: [
            {
                id: '1',
                lotNumber: 'IMPL-2024-001',
                name: '诺贝尔Active植体',
                type: '植体',
                manufacturer: 'Nobel Biocare',
                expiryDate: nextYear.toISOString().split('T')[0],
                quantity: 50,
                minStock: 10,
                createdAt: new Date().toISOString()
            },
            {
                id: '2',
                lotNumber: 'IMPL-2023-199',
                name: 'Straumann植体',
                type: '植体',
                manufacturer: 'Straumann',
                expiryDate: lastMonth.toISOString().split('T')[0],
                quantity: 5,
                minStock: 10,
                createdAt: new Date().toISOString()
            },
            {
                id: '3',
                lotNumber: 'ABUT-2024-015',
                name: '钛合金基台',
                type: '基台',
                manufacturer: 'Dentsply Sirona',
                expiryDate: nextYear.toISOString().split('T')[0],
                quantity: 30,
                minStock: 15,
                createdAt: new Date().toISOString()
            },
            {
                id: '4',
                lotNumber: 'BONE-2024-008',
                name: 'Bio-Oss骨粉',
                type: '骨粉',
                manufacturer: 'Geistlich',
                expiryDate: nextYear.toISOString().split('T')[0],
                quantity: 8,
                minStock: 10,
                createdAt: new Date().toISOString()
            }
        ],
        patients: [
            {
                id: '1',
                patientId: 'P001',
                name: '张三',
                phone: '13800138001',
                gender: '男',
                age: 45,
                createdAt: new Date().toISOString()
            },
            {
                id: '2',
                patientId: 'P002',
                name: '李四',
                phone: '13800138002',
                gender: '女',
                age: 52,
                createdAt: new Date().toISOString()
            },
            {
                id: '3',
                patientId: 'P003',
                name: '王五',
                phone: '13800138003',
                gender: '男',
                age: 38,
                createdAt: new Date().toISOString()
            }
        ],
        doctors: [
            {
                id: '1',
                doctorId: 'D001',
                name: '王医生',
                department: '口腔种植科',
                phone: '13900139001',
                createdAt: new Date().toISOString()
            },
            {
                id: '2',
                doctorId: 'D002',
                name: '李医生',
                department: '口腔种植科',
                phone: '13900139002',
                createdAt: new Date().toISOString()
            }
        ],
        appointments: [
            {
                id: '1',
                appointmentNo: 'APT001',
                patientId: 'P001',
                patientName: '张三',
                doctorId: 'D001',
                doctorName: '王医生',
                appointmentDate: new Date().toISOString().split('T')[0],
                description: '下颌种植手术',
                status: '已完成',
                createdAt: new Date().toISOString()
            },
            {
                id: '2',
                appointmentNo: 'APT002',
                patientId: 'P002',
                patientName: '李四',
                doctorId: 'D002',
                doctorName: '李医生',
                appointmentDate: new Date().toISOString().split('T')[0],
                description: '上颌种植+骨增量',
                status: '待手术',
                createdAt: new Date().toISOString()
            }
        ],
        surgeries: [
            {
                id: '1',
                surgeryNo: 'OP001',
                appointmentId: '1',
                appointmentNo: 'APT001',
                patientId: 'P001',
                patientName: '张三',
                doctorId: 'D001',
                doctorName: '王医生',
                surgeryDate: new Date().toISOString().split('T')[0],
                status: '已完成',
                createdAt: new Date().toISOString()
            }
        ],
        materialUsage: [
            {
                id: '1',
                surgeryId: '1',
                lotNumber: 'IMPL-2024-001',
                materialName: '诺贝尔Active植体',
                quantity: 2,
                usedAt: new Date().toISOString()
            },
            {
                id: '2',
                surgeryId: '1',
                lotNumber: 'ABUT-2024-015',
                materialName: '钛合金基台',
                quantity: 2,
                usedAt: new Date().toISOString()
            }
        ],
        recalledLots: []
    };
    
    saveData(data);
    res.json({ success: true, message: '样例数据已初始化' });
});

app.listen(PORT, () => {
    console.log(`牙科种植材料追溯台系统运行在 http://localhost:${PORT}`);
});

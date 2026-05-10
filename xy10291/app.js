const App = (function() {
    const STORAGE_KEYS = {
        BOATS: 'kayak_boats',
        WEATHER: 'kayak_weather',
        WATER: 'kayak_water',
        VISITORS: 'kayak_visitors',
        RECORDS: 'kayak_records'
    };

    const BOAT_TYPES = ['单人艇', '双人艇', '三人艇', '休闲艇', '竞速艇'];
    const WEATHER_CONDITIONS = ['晴朗', '多云', '阴天', '小雨', '中雨', '大雨', '雷暴', '大风', '雾'];
    const WATER_FLOW = ['平缓', '缓慢', '中等', '湍急', '危险'];
    const VISITOR_EXPERIENCE = ['首次体验', '初级', '中级', '高级', '专业'];
    const RECORD_STATUS = ['checked', 'confirmed', 'rejected', 'modified'];

    const SAFETY_RULES = {
        maxWindSpeed: 12,
        maxWaterLevel: 5.0,
        minWaterLevel: 1.0,
        dangerousWeather: ['大雨', '雷暴', '大风', '雾'],
        warningWeather: ['阴天', '小雨', '中雨']
    };

    let currentCheckResult = null;
    let currentCheckRecordId = null;

    function generateId(prefix) {
        return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function formatDate(date) {
        const d = new Date(date);
        return d.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatDateShort(date) {
        const d = new Date(date);
        return d.toLocaleDateString('zh-CN');
    }

    function isToday(date) {
        const today = new Date();
        const checkDate = new Date(date);
        return today.toDateString() === checkDate.toDateString();
    }

    function Storage() {}

    Storage.get = function(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Storage get error:', e);
            return [];
        }
    };

    Storage.set = function(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Storage set error:', e);
            return false;
        }
    };

    Storage.clearAll = function() {
        Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    };

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function Modal() {}

    Modal.show = function(title, bodyContent, footerActions) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = bodyContent;
        document.getElementById('modal-footer').innerHTML = footerActions;
        document.getElementById('modal-overlay').classList.remove('hidden');
    };

    Modal.hide = function() {
        document.getElementById('modal-overlay').classList.add('hidden');
    };

    function BoatManager() {}

    BoatManager.getAll = function() {
        return Storage.get(STORAGE_KEYS.BOATS);
    };

    BoatManager.getById = function(id) {
        return this.getAll().find(b => b.id === id);
    };

    BoatManager.add = function(boat) {
        const boats = this.getAll();
        const existing = boats.find(b => b.boatNumber === boat.boatNumber);
        if (existing) {
            return { success: false, error: '艇号已存在，请勿重复添加' };
        }
        const newBoat = {
            id: generateId('boat'),
            ...boat,
            createdAt: new Date().toISOString(),
            lastCheck: new Date().toISOString()
        };
        boats.push(newBoat);
        Storage.set(STORAGE_KEYS.BOATS, boats);
        return { success: true, boat: newBoat };
    };

    BoatManager.update = function(id, updates) {
        const boats = this.getAll();
        const index = boats.findIndex(b => b.id === id);
        if (index === -1) {
            return { success: false, error: '艇只不存在' };
        }
        if (updates.boatNumber) {
            const existing = boats.find(b => b.boatNumber === updates.boatNumber && b.id !== id);
            if (existing) {
                return { success: false, error: '艇号已存在' };
            }
        }
        boats[index] = {
            ...boats[index],
            ...updates,
            lastCheck: new Date().toISOString()
        };
        Storage.set(STORAGE_KEYS.BOATS, boats);
        return { success: true, boat: boats[index] };
    };

    BoatManager.delete = function(id) {
        const boats = this.getAll().filter(b => b.id !== id);
        Storage.set(STORAGE_KEYS.BOATS, boats);
        return { success: true };
    };

    BoatManager.isSafe = function(boat, passengers = 1) {
        if (boat.status !== 'available') {
            return { safe: false, reason: '艇只状态不可用' };
        }
        if (boat.lifeJackets < passengers) {
            return { safe: false, reason: `救生衣数量不足（需${passengers}件，实际${boat.lifeJackets}件）` };
        }
        return { safe: true };
    };

    function EnvironmentManager() {}

    EnvironmentManager.getLatestWeather = function() {
        const weather = Storage.get(STORAGE_KEYS.WEATHER);
        if (weather.length === 0) return null;
        return weather.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    };

    EnvironmentManager.getLatestWater = function() {
        const water = Storage.get(STORAGE_KEYS.WATER);
        if (water.length === 0) return null;
        return water.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    };

    EnvironmentManager.getAllWeather = function() {
        return Storage.get(STORAGE_KEYS.WEATHER).sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );
    };

    EnvironmentManager.getAllWater = function() {
        return Storage.get(STORAGE_KEYS.WATER).sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );
    };

    EnvironmentManager.addWeather = function(data) {
        const weather = Storage.get(STORAGE_KEYS.WEATHER);
        const newEntry = {
            id: generateId('weather'),
            ...data,
            createdAt: new Date().toISOString()
        };
        weather.push(newEntry);
        Storage.set(STORAGE_KEYS.WEATHER, weather);
        return { success: true, data: newEntry };
    };

    EnvironmentManager.addWater = function(data) {
        const water = Storage.get(STORAGE_KEYS.WATER);
        const newEntry = {
            id: generateId('water'),
            ...data,
            createdAt: new Date().toISOString()
        };
        water.push(newEntry);
        Storage.set(STORAGE_KEYS.WATER, water);
        return { success: true, data: newEntry };
    };

    EnvironmentManager.assessWeather = function(weather) {
        if (!weather) return { level: 'missing', message: '暂无天气数据' };
        
        if (SAFETY_RULES.dangerousWeather.includes(weather.condition)) {
            return { level: 'danger', message: `天气状况危险：${weather.condition}` };
        }
        if (weather.windSpeed > SAFETY_RULES.maxWindSpeed) {
            return { level: 'danger', message: `风速超标：${weather.windSpeed}m/s（限${SAFETY_RULES.maxWindSpeed}m/s）` };
        }
        if (SAFETY_RULES.warningWeather.includes(weather.condition)) {
            return { level: 'warning', message: `天气需注意：${weather.condition}` };
        }
        if (weather.windSpeed > SAFETY_RULES.maxWindSpeed * 0.7) {
            return { level: 'warning', message: `风速较高：${weather.windSpeed}m/s` };
        }
        return { level: 'safe', message: '天气状况良好' };
    };

    EnvironmentManager.assessWater = function(water) {
        if (!water) return { level: 'missing', message: '暂无水位数据' };
        
        if (water.level > SAFETY_RULES.maxWaterLevel) {
            return { level: 'danger', message: `水位过高：${water.level}m（限${SAFETY_RULES.maxWaterLevel}m）` };
        }
        if (water.level < SAFETY_RULES.minWaterLevel) {
            return { level: 'danger', message: `水位过低：${water.level}m（最低${SAFETY_RULES.minWaterLevel}m）` };
        }
        if (water.flow === '湍急' || water.flow === '危险') {
            return { level: 'danger', message: `水流状况危险：${water.flow}` };
        }
        if (water.level > SAFETY_RULES.maxWaterLevel * 0.8 || water.flow === '中等') {
            return { level: 'warning', message: '水位或水流需注意' };
        }
        return { level: 'safe', message: '水位水流正常' };
    };

    function VisitorManager() {}

    VisitorManager.getAll = function() {
        return Storage.get(STORAGE_KEYS.VISITORS);
    };

    VisitorManager.getById = function(id) {
        return this.getAll().find(v => v.id === id);
    };

    VisitorManager.add = function(visitor) {
        const visitors = this.getAll();
        const existing = visitors.find(v => v.phone === visitor.phone);
        if (existing) {
            return { success: false, error: '手机号已存在' };
        }
        const newVisitor = {
            id: generateId('visitor'),
            ...visitor,
            rentalCount: 0,
            createdAt: new Date().toISOString()
        };
        visitors.push(newVisitor);
        Storage.set(STORAGE_KEYS.VISITORS, visitors);
        return { success: true, visitor: newVisitor };
    };

    VisitorManager.update = function(id, updates) {
        const visitors = this.getAll();
        const index = visitors.findIndex(v => v.id === id);
        if (index === -1) {
            return { success: false, error: '游客不存在' };
        }
        if (updates.phone) {
            const existing = visitors.find(v => v.phone === updates.phone && v.id !== id);
            if (existing) {
                return { success: false, error: '手机号已存在' };
            }
        }
        visitors[index] = { ...visitors[index], ...updates };
        Storage.set(STORAGE_KEYS.VISITORS, visitors);
        return { success: true, visitor: visitors[index] };
    };

    VisitorManager.incrementRentalCount = function(id) {
        const visitors = this.getAll();
        const visitor = visitors.find(v => v.id === id);
        if (visitor) {
            visitor.rentalCount = (visitor.rentalCount || 0) + 1;
            Storage.set(STORAGE_KEYS.VISITORS, visitors);
        }
    };

    VisitorManager.assessExperience = function(visitor, weatherLevel, waterLevel) {
        const experienceOrder = ['首次体验', '初级', '中级', '高级', '专业'];
        const visitorLevel = experienceOrder.indexOf(visitor.experience);
        
        if (weatherLevel === 'danger' || waterLevel === 'danger') {
            if (visitorLevel < 3) {
                return { level: 'danger', message: `环境危险，${visitor.experience}经验不足` };
            }
            return { level: 'warning', message: '环境危险，需专业人员陪同' };
        }
        
        if (weatherLevel === 'warning' || waterLevel === 'warning') {
            if (visitorLevel < 1) {
                return { level: 'warning', message: '环境需注意，建议有经验者陪同' };
            }
        }
        
        return { level: 'safe', message: '经验等级符合要求' };
    };

    function SafetyEngine() {}

    SafetyEngine.runCheck = function(boatId, visitorId, passengers, duration, notes) {
        const result = {
            id: generateId('check'),
            boatId,
            visitorId,
            passengers: parseInt(passengers),
            duration: parseInt(duration),
            notes,
            checkTime: new Date().toISOString(),
            items: [],
            overall: 'pass',
            canRent: true,
            reason: ''
        };

        const boat = BoatManager.getById(boatId);
        if (!boat) {
            result.items.push({
                name: '艇只档案',
                status: 'fail',
                message: '来源记录缺失：艇只不存在'
            });
            result.overall = 'fail';
            result.canRent = false;
            result.reason = '艇只来源记录缺失';
            return result;
        }

        const visitor = VisitorManager.getById(visitorId);
        if (!visitor) {
            result.items.push({
                name: '游客档案',
                status: 'fail',
                message: '来源记录缺失：游客不存在'
            });
            result.overall = 'fail';
            result.canRent = false;
            result.reason = '游客来源记录缺失';
            return result;
        }

        const latestWeather = EnvironmentManager.getLatestWeather();
        const latestWater = EnvironmentManager.getLatestWater();

        const boatCheck = BoatManager.isSafe(boat, passengers);
        result.items.push({
            name: '艇只安全检查',
            status: boatCheck.safe ? 'pass' : 'fail',
            message: boatCheck.safe ? 
                `艇只${boat.boatNumber}状态正常，救生衣${boat.lifeJackets}件（需${passengers}件）` : 
                boatCheck.reason,
            details: {
                boatNumber: boat.boatNumber,
                boatType: boat.type,
                status: boat.status,
                lifeJackets: boat.lifeJackets,
                required: passengers
            }
        });
        if (!boatCheck.safe) {
            result.overall = 'fail';
            result.canRent = false;
        }

        const weatherAssessment = EnvironmentManager.assessWeather(latestWeather);
        result.items.push({
            name: '天气状况检查',
            status: weatherAssessment.level === 'danger' ? 'fail' : 
                   weatherAssessment.level === 'warning' ? 'warning' : 
                   weatherAssessment.level === 'missing' ? 'fail' : 'pass',
            message: weatherAssessment.message,
            details: latestWeather ? {
                condition: latestWeather.condition,
                windSpeed: latestWeather.windSpeed,
                temperature: latestWeather.temperature
            } : null
        });
        if (weatherAssessment.level === 'danger' || weatherAssessment.level === 'missing') {
            result.overall = 'fail';
            result.canRent = false;
        } else if (weatherAssessment.level === 'warning' && result.overall === 'pass') {
            result.overall = 'warning';
        }

        const waterAssessment = EnvironmentManager.assessWater(latestWater);
        result.items.push({
            name: '水位水流检查',
            status: waterAssessment.level === 'danger' ? 'fail' : 
                   waterAssessment.level === 'warning' ? 'warning' : 
                   waterAssessment.level === 'missing' ? 'fail' : 'pass',
            message: waterAssessment.message,
            details: latestWater ? {
                level: latestWater.level,
                flow: latestWater.flow
            } : null
        });
        if (waterAssessment.level === 'danger' || waterAssessment.level === 'missing') {
            result.overall = 'fail';
            result.canRent = false;
        } else if (waterAssessment.level === 'warning' && result.overall === 'pass') {
            result.overall = 'warning';
        }

        const expAssessment = VisitorManager.assessExperience(
            visitor, 
            weatherAssessment.level, 
            waterAssessment.level
        );
        result.items.push({
            name: '游客经验匹配',
            status: expAssessment.level === 'danger' ? 'fail' : 
                   expAssessment.level === 'warning' ? 'warning' : 'pass',
            message: expAssessment.message,
            details: {
                name: visitor.name,
                experience: visitor.experience,
                rentalCount: visitor.rentalCount || 0
            }
        });
        if (expAssessment.level === 'danger') {
            result.overall = 'fail';
            result.canRent = false;
        } else if (expAssessment.level === 'warning' && result.overall === 'pass') {
            result.overall = 'warning';
        }

        if (passengers > boat.capacity) {
            result.items.push({
                name: '载客容量检查',
                status: 'fail',
                message: `超载：艇只容量${boat.capacity}人，实际${passengers}人`
            });
            result.overall = 'fail';
            result.canRent = false;
        } else {
            result.items.push({
                name: '载客容量检查',
                status: 'pass',
                message: `容量符合：${passengers}人 ≤ ${boat.capacity}人`
            });
        }

        if (result.canRent) {
            result.reason = result.overall === 'warning' ? 
                '通过但需注意安全提示' : '所有检查项通过';
        } else {
            result.reason = result.items.find(i => i.status === 'fail')?.message || '存在安全隐患';
        }

        return result;
    };

    function RecordManager() {}

    RecordManager.getAll = function() {
        return Storage.get(STORAGE_KEYS.RECORDS).sort((a, b) => 
            new Date(b.checkTime) - new Date(a.checkTime)
        );
    };

    RecordManager.getById = function(id) {
        return this.getAll().find(r => r.id === id);
    };

    RecordManager.save = function(checkResult) {
        const records = Storage.get(STORAGE_KEYS.RECORDS);
        
        const existing = records.find(r => 
            r.boatId === checkResult.boatId && 
            r.visitorId === checkResult.visitorId &&
            Math.abs(new Date(r.checkTime) - new Date(checkResult.checkTime)) < 60000 &&
            r.status !== 'rejected'
        );
        
        if (existing) {
            return { 
                success: false, 
                error: '重复提交：1分钟内已有相同的检查记录',
                existingRecord: existing
            };
        }

        const record = {
            ...checkResult,
            status: 'checked',
            createdAt: new Date().toISOString(),
            history: [{
                action: 'created',
                time: new Date().toISOString(),
                note: '安全检查完成'
            }]
        };

        records.push(record);
        Storage.set(STORAGE_KEYS.RECORDS, records);
        return { success: true, record };
    };

    RecordManager.confirm = function(id) {
        const records = Storage.get(STORAGE_KEYS.RECORDS);
        const record = records.find(r => r.id === id);
        
        if (!record) {
            return { success: false, error: '记录不存在' };
        }
        
        if (record.status === 'confirmed') {
            return { success: false, error: '状态冲突：该记录已确认' };
        }
        
        if (record.status === 'rejected') {
            return { success: false, error: '状态冲突：已拒绝的记录无法确认' };
        }

        const boat = BoatManager.getById(record.boatId);
        if (!boat) {
            return { success: false, error: '来源记录缺失：艇只已被删除' };
        }
        const visitor = VisitorManager.getById(record.visitorId);
        if (!visitor) {
            return { success: false, error: '来源记录缺失：游客已被删除' };
        }

        record.status = 'confirmed';
        record.confirmedAt = new Date().toISOString();
        record.history.push({
            action: 'confirmed',
            time: new Date().toISOString(),
            note: '租赁已确认'
        });
        
        VisitorManager.incrementRentalCount(record.visitorId);
        
        Storage.set(STORAGE_KEYS.RECORDS, records);
        return { success: true, record };
    };

    RecordManager.reject = function(id, reason) {
        const records = Storage.get(STORAGE_KEYS.RECORDS);
        const record = records.find(r => r.id === id);
        
        if (!record) {
            return { success: false, error: '记录不存在' };
        }
        
        if (record.status === 'confirmed') {
            return { success: false, error: '状态冲突：已确认的记录无法拒绝' };
        }
        
        if (record.status === 'rejected') {
            return { success: false, error: '状态冲突：该记录已拒绝' };
        }

        record.status = 'rejected';
        record.rejectedAt = new Date().toISOString();
        record.rejectReason = reason;
        record.history.push({
            action: 'rejected',
            time: new Date().toISOString(),
            note: reason || '人工拒绝'
        });
        
        Storage.set(STORAGE_KEYS.RECORDS, records);
        return { success: true, record };
    };

    RecordManager.modify = function(id, updates) {
        const records = Storage.get(STORAGE_KEYS.RECORDS);
        const record = records.find(r => r.id === id);
        
        if (!record) {
            return { success: false, error: '记录不存在' };
        }
        
        if (record.status === 'confirmed') {
            return { success: false, error: '状态冲突：已确认的记录无法修改' };
        }

        Object.assign(record, updates);
        record.status = 'modified';
        record.modifiedAt = new Date().toISOString();
        record.history.push({
            action: 'modified',
            time: new Date().toISOString(),
            note: '记录信息已修改'
        });
        
        Storage.set(STORAGE_KEYS.RECORDS, records);
        return { success: true, record };
    };

    RecordManager.exportToCSV = function() {
        const records = this.getAll();
        if (records.length === 0) {
            return { success: false, error: '暂无数据可导出' };
        }

        const headers = [
            '检查单号', '艇号', '游客姓名', '游客手机', '人数', '时长(小时)',
            '检查时间', '检查结果', '状态', '原因', '备注'
        ];

        const rows = records.map(r => {
            const boat = BoatManager.getById(r.boatId);
            const visitor = VisitorManager.getById(r.visitorId);
            return [
                r.id,
                boat ? boat.boatNumber : '已删除',
                visitor ? visitor.name : '已删除',
                visitor ? visitor.phone : '',
                r.passengers,
                r.duration,
                formatDate(r.checkTime),
                r.overall,
                r.status,
                r.reason,
                r.notes || ''
            ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `皮划艇租赁记录_${formatDateShort(new Date())}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        return { success: true, count: records.length };
    };

    function SampleData() {}

    SampleData.load = function() {
        const boats = [
            { boatNumber: 'K001', type: '单人艇', capacity: 1, lifeJackets: 2, status: 'available', notes: '新购入' },
            { boatNumber: 'K002', type: '双人艇', capacity: 2, lifeJackets: 3, status: 'available', notes: '' },
            { boatNumber: 'K003', type: '三人艇', capacity: 3, lifeJackets: 4, status: 'available', notes: '' },
            { boatNumber: 'K004', type: '单人艇', capacity: 1, lifeJackets: 1, status: 'maintenance', notes: '需维修' },
            { boatNumber: 'K005', type: '双人艇', capacity: 2, lifeJackets: 2, status: 'available', notes: '' }
        ];

        const weather = [
            { condition: '晴朗', windSpeed: 3.5, temperature: 26 },
            { condition: '多云', windSpeed: 5.2, temperature: 24 }
        ];

        const water = [
            { level: 2.8, flow: '平缓' },
            { level: 3.2, flow: '缓慢' }
        ];

        const visitors = [
            { name: '张三', phone: '13800138001', experience: '首次体验', notes: '一家三口' },
            { name: '李四', phone: '13800138002', experience: '初级', notes: '常来' },
            { name: '王五', phone: '13800138003', experience: '中级', notes: '俱乐部会员' },
            { name: '赵六', phone: '13800138004', experience: '高级', notes: '教练' }
        ];

        boats.forEach(b => BoatManager.add(b));
        weather.forEach(w => EnvironmentManager.addWeather(w));
        water.forEach(w => EnvironmentManager.addWater(w));
        visitors.forEach(v => VisitorManager.add(v));

        return {
            boats: boats.length,
            weather: weather.length,
            water: water.length,
            visitors: visitors.length
        };
    };

    function UI() {}

    UI.initTabs = function() {
        document.querySelectorAll('.nav-item').forEach(tab => {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                this.classList.add('active');
                const tabId = this.dataset.tab;
                document.getElementById(`tab-${tabId}`).classList.add('active');
                
                UI.refresh(tabId);
            });
        });
    };

    UI.refresh = function(tab) {
        switch(tab) {
            case 'dashboard':
                UI.renderDashboard();
                break;
            case 'boats':
                UI.renderBoats();
                break;
            case 'environment':
                UI.renderEnvironment();
                break;
            case 'visitors':
                UI.renderVisitors();
                break;
            case 'checkout':
                UI.renderCheckout();
                break;
            case 'records':
                UI.renderRecords();
                break;
            case 'guide':
                UI.renderGuide();
                break;
        }
    };

    UI.renderDashboard = function() {
        const boats = BoatManager.getAll();
        const records = RecordManager.getAll();
        
        const safeBoats = boats.filter(b => b.status === 'available').length;
        const todayChecks = records.filter(r => isToday(r.checkTime)).length;
        const rejectedCount = records.filter(r => r.status === 'rejected').length;
        
        document.getElementById('stat-total-boats').textContent = boats.length;
        document.getElementById('stat-safe-boats').textContent = safeBoats;
        document.getElementById('stat-today-checks').textContent = todayChecks;
        document.getElementById('stat-rejected').textContent = rejectedCount;
        
        const weather = EnvironmentManager.getLatestWeather();
        const water = EnvironmentManager.getLatestWater();
        const weatherAssessment = EnvironmentManager.assessWeather(weather);
        const waterAssessment = EnvironmentManager.assessWater(water);
        
        let envHtml = '';
        if (weather) {
            const level = weatherAssessment.level === 'danger' ? 'danger' : 
                         weatherAssessment.level === 'warning' ? 'warning' : 
                         weatherAssessment.level === 'missing' ? 'warning' : 'safe';
            envHtml += `
                <div class="env-item ${level}">
                    <div class="env-label">当前天气</div>
                    <div class="env-value">${weather.condition}</div>
                    <div class="env-label" style="margin-top: 8px;">风速: ${weather.windSpeed} m/s | 气温: ${weather.temperature}°C</div>
                    <span class="env-status ${level}">${weatherAssessment.message}</span>
                </div>
            `;
        }
        if (water) {
            const level = waterAssessment.level === 'danger' ? 'danger' : 
                         waterAssessment.level === 'warning' ? 'warning' : 
                         waterAssessment.level === 'missing' ? 'warning' : 'safe';
            envHtml += `
                <div class="env-item ${level}">
                    <div class="env-label">当前水位</div>
                    <div class="env-value">${water.level} m</div>
                    <div class="env-label" style="margin-top: 8px;">水流: ${water.flow}</div>
                    <span class="env-status ${level}">${waterAssessment.message}</span>
                </div>
            `;
        }
        
        document.getElementById('environment-status').innerHTML = envHtml || 
            '<p class="empty-state">暂无环境数据，请先录入天气和水位信息</p>';
        
        const recentRecords = records.slice(0, 5);
        let recordsHtml = '';
        if (recentRecords.length > 0) {
            recordsHtml = '<div style="display:flex;flex-direction:column;gap:10px;">';
            recentRecords.forEach(r => {
                const boat = BoatManager.getById(r.boatId);
                const visitor = VisitorManager.getById(r.visitorId);
                const resultClass = r.overall === 'pass' ? 'result-pass' : 
                                   r.overall === 'warning' ? 'result-warning' : 'result-fail';
                recordsHtml += `
                    <div style="padding:12px;background:#f8f9fa;border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="font-weight:500;">
                                ${boat ? boat.boatNumber : '已删除'} → ${visitor ? visitor.name : '已删除'}
                            </div>
                            <div style="font-size:12px;color:#666;margin-top:4px;">
                                ${formatDate(r.checkTime)} | ${r.reason}
                            </div>
                        </div>
                        <span class="status-badge ${resultClass}">${
                            r.overall === 'pass' ? '通过' : 
                            r.overall === 'warning' ? '警告' : '不通过'
                        }</span>
                    </div>
                `;
            });
            recordsHtml += '</div>';
        }
        document.getElementById('recent-records').innerHTML = recordsHtml || 
            '<p class="empty-state">暂无检查记录</p>';
    };

    UI.renderBoats = function() {
        const boats = BoatManager.getAll();
        let html = '';
        
        if (boats.length === 0) {
            html = '<tr><td colspan="7" class="empty-state">暂无艇只档案</td></tr>';
        } else {
            boats.forEach(boat => {
                const statusClass = boat.status === 'available' ? 'status-available' : 'status-maintenance';
                const statusText = boat.status === 'available' ? '可用' : '维护中';
                html += `
                    <tr>
                        <td><strong>${boat.boatNumber}</strong></td>
                        <td>${boat.type}</td>
                        <td>${boat.capacity}人</td>
                        <td>${boat.lifeJackets}件</td>
                        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                        <td>${formatDate(boat.lastCheck)}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn btn-primary btn-small" onclick="UI.editBoat('${boat.id}')">编辑</button>
                                <button class="btn btn-danger btn-small" onclick="UI.deleteBoat('${boat.id}')">删除</button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }
        document.getElementById('boats-table-body').innerHTML = html;
    };

    UI.renderEnvironment = function() {
        const weather = EnvironmentManager.getAllWeather();
        const water = EnvironmentManager.getAllWater();
        
        let weatherHtml = '';
        if (weather.length === 0) {
            weatherHtml = '<tr><td colspan="5" class="empty-state">暂无天气记录</td></tr>';
        } else {
            weather.forEach(w => {
                const assessment = EnvironmentManager.assessWeather(w);
                const statusClass = assessment.level === 'danger' ? 'result-fail' : 
                                   assessment.level === 'warning' ? 'result-warning' : 'result-pass';
                const statusText = assessment.level === 'danger' ? '危险' : 
                                  assessment.level === 'warning' ? '注意' : '正常';
                weatherHtml += `
                    <tr>
                        <td>${formatDate(w.createdAt)}</td>
                        <td>${w.condition}</td>
                        <td>${w.windSpeed}</td>
                        <td>${w.temperature}</td>
                        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    </tr>
                `;
            });
        }
        document.getElementById('weather-table-body').innerHTML = weatherHtml;
        
        let waterHtml = '';
        if (water.length === 0) {
            waterHtml = '<tr><td colspan="4" class="empty-state">暂无水位记录</td></tr>';
        } else {
            water.forEach(w => {
                const assessment = EnvironmentManager.assessWater(w);
                const statusClass = assessment.level === 'danger' ? 'result-fail' : 
                                   assessment.level === 'warning' ? 'result-warning' : 'result-pass';
                const statusText = assessment.level === 'danger' ? '危险' : 
                                  assessment.level === 'warning' ? '注意' : '正常';
                waterHtml += `
                    <tr>
                        <td>${formatDate(w.createdAt)}</td>
                        <td>${w.level}</td>
                        <td>${w.flow}</td>
                        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    </tr>
                `;
            });
        }
        document.getElementById('water-table-body').innerHTML = waterHtml;
    };

    UI.renderVisitors = function() {
        const visitors = VisitorManager.getAll();
        let html = '';
        
        if (visitors.length === 0) {
            html = '<tr><td colspan="6" class="empty-state">暂无游客记录</td></tr>';
        } else {
            visitors.forEach(v => {
                html += `
                    <tr>
                        <td><strong>${v.name}</strong></td>
                        <td>${v.phone}</td>
                        <td>${v.experience}</td>
                        <td>${v.rentalCount || 0}次</td>
                        <td>${v.notes || '-'}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn btn-primary btn-small" onclick="UI.editVisitor('${v.id}')">编辑</button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }
        document.getElementById('visitors-table-body').innerHTML = html;
    };

    UI.renderCheckout = function() {
        const boats = BoatManager.getAll().filter(b => b.status === 'available');
        const visitors = VisitorManager.getAll();
        
        let boatOptions = '<option value="">请选择艇只</option>';
        boats.forEach(b => {
            boatOptions += `<option value="${b.id}">${b.boatNumber} - ${b.type} (${b.capacity}人, ${b.lifeJackets}救生衣)</option>`;
        });
        
        let visitorOptions = '<option value="">请选择游客</option>';
        visitors.forEach(v => {
            visitorOptions += `<option value="${v.id}">${v.name} (${v.phone}, ${v.experience})</option>`;
        });
        
        document.getElementById('checkout-boat').innerHTML = boatOptions;
        document.getElementById('checkout-visitor').innerHTML = visitorOptions;
        
        document.getElementById('checkout-result').innerHTML = `
            <h3>安全检查结果</h3>
            <div class="result-placeholder">
                <p>请先填写检查信息并点击"执行安全检查"</p>
            </div>
        `;
        currentCheckResult = null;
        currentCheckRecordId = null;
    };

    UI.renderRecords = function() {
        const records = RecordManager.getAll();
        let html = '';
        
        if (records.length === 0) {
            html = '<tr><td colspan="7" class="empty-state">暂无租赁记录</td></tr>';
        } else {
            records.forEach(r => {
                const boat = BoatManager.getById(r.boatId);
                const visitor = VisitorManager.getById(r.visitorId);
                
                const resultClass = r.overall === 'pass' ? 'result-pass' : 
                                   r.overall === 'warning' ? 'result-warning' : 'result-fail';
                const resultText = r.overall === 'pass' ? '通过' : 
                                  r.overall === 'warning' ? '警告' : '不通过';
                
                const statusMap = {
                    'checked': { class: 'status-checked', text: '待处理' },
                    'confirmed': { class: 'status-confirmed', text: '已确认' },
                    'rejected': { class: 'status-rejected', text: '已拒绝' },
                    'modified': { class: 'status-modified', text: '已修改' }
                };
                const status = statusMap[r.status] || { class: '', text: r.status };
                
                let actions = '';
                if (r.status === 'checked' || r.status === 'modified') {
                    actions = `
                        <div class="action-buttons">
                            <button class="btn btn-success btn-small" onclick="UI.confirmRecord('${r.id}')">确认</button>
                            <button class="btn btn-danger btn-small" onclick="UI.rejectRecord('${r.id}')">拒绝</button>
                            <button class="btn btn-primary btn-small" onclick="UI.viewRecordDetail('${r.id}')">详情</button>
                        </div>
                    `;
                } else {
                    actions = `
                        <div class="action-buttons">
                            <button class="btn btn-secondary btn-small" onclick="UI.viewRecordDetail('${r.id}')">详情</button>
                        </div>
                    `;
                }
                
                html += `
                    <tr>
                        <td style="font-family:monospace;font-size:12px;">${r.id.substring(0, 15)}...</td>
                        <td>${boat ? boat.boatNumber : '<span style="color:#e53935;">已删除</span>'}</td>
                        <td>${visitor ? visitor.name : '<span style="color:#e53935;">已删除</span>'}</td>
                        <td>${formatDate(r.checkTime)}</td>
                        <td><span class="status-badge ${resultClass}">${resultText}</span></td>
                        <td><span class="status-badge ${status.class}">${status.text}</span></td>
                        <td>${actions}</td>
                    </tr>
                `;
            });
        }
        document.getElementById('records-table-body').innerHTML = html;
    };

    UI.renderGuide = function() {
        document.getElementById('guide-content').innerHTML = `
            <h3>快速入门：从空数据到完整报表</h3>
            <p>本系统围绕<strong>皮划艇安全清单</strong>和<strong>天气水位拦截</strong>两条主线设计。请按以下步骤操作：</p>
            
            <h3>第一步：点击"加载示例数据"</h3>
            <p>首次使用时，点击页面右上角的<strong>"加载示例数据"</strong>按钮。系统会自动创建：</p>
            <ul>
                <li>5条艇只档案（含1条维护中状态）</li>
                <li>2条天气记录</li>
                <li>2条水位记录</li>
                <li>4位游客信息（覆盖从首次体验到高级的经验等级）</li>
            </ul>
            
            <h3>第二步：建立艇只档案</h3>
            <p>进入<strong>"艇只档案"</strong>页面，这里管理所有皮划艇的安全清单：</p>
            <ul>
                <li><strong>艇号</strong>：唯一标识，系统会拦截重复艇号</li>
                <li><strong>救生衣配置</strong>：安全检查的核心项，数量必须 ≥ 载客人数</li>
                <li><strong>状态</strong>：只有"可用"状态的艇只才能用于租赁</li>
            </ul>
            <div class="warning-box">
                <strong>安全要点：</strong>救生衣数量不足或艇只维护中会直接导致安全检查不通过。
            </div>
            
            <h3>第三步：录入环境数据</h3>
            <p>进入<strong>"环境数据"</strong>页面，分别录入：</p>
            <ul>
                <li><strong>天气记录</strong>：天气状况、风速、气温。系统会自动判断预警状态</li>
                <li><strong>水位记录</strong>：水位高度、水流速度。系统会自动评估安全等级</li>
            </ul>
            <div class="warning-box">
                <strong>拦截规则：</strong>以下情况会<strong>直接拦截</strong>租赁：
                <br>• 天气：大雨、雷暴、大风、雾，或风速超过 12m/s
                <br>• 水位：超过 5.0m 或低于 1.0m，或水流湍急/危险
                <br>• <strong>数据缺失也会触发拦截</strong>
            </div>
            
            <h3>第四步：登记游客信息</h3>
            <p>进入<strong>"游客管理"</strong>页面，新增游客时需填写：</p>
            <ul>
                <li><strong>经验等级</strong>：首次体验、初级、中级、高级、专业</li>
            </ul>
            <p>系统会根据环境风险等级与游客经验进行<strong>匹配评估</strong>：</p>
            <ul>
                <li>环境危险时，仅高级及以上经验允许通过</li>
                <li>环境需注意时，首次体验者会收到警告提示</li>
            </ul>
            
            <h3>第五步：执行安全检查（核心功能）</h3>
            <p>进入<strong>"安全检查"</strong>页面：</p>
            <ol>
                <li>选择艇只（只显示可用状态）</li>
                <li>选择游客</li>
                <li>填写游客人数（不能超过艇只容量）</li>
                <li>点击<strong>"执行安全检查"</strong></li>
            </ol>
            <p>系统会依次检查<strong>5个维度</strong>并显示每项结果：</p>
            <ul>
                <li>✅ 艇只安全检查（状态、救生衣）</li>
                <li>✅ 天气状况检查</li>
                <li>✅ 水位水流检查</li>
                <li>✅ 游客经验匹配</li>
                <li>✅ 载客容量检查</li>
            </ul>
            <p>检查完成后可选择：</p>
            <ul>
                <li><strong>确认租赁</strong>：保存为已确认状态</li>
                <li><strong>拒绝租赁</strong>：需填写拒绝原因</li>
                <li><strong>重新检查</strong>：修改参数后再次检查</li>
            </ul>
            
            <h3>第六步：管理租赁记录</h3>
            <p>进入<strong>"租赁记录"</strong>页面：</p>
            <ul>
                <li>查看所有检查记录，包含检查单号、时间、结果、状态</li>
                <li>对"待处理"状态的记录进行<strong>确认</strong>或<strong>拒绝</strong></li>
                <li>点击<strong>"详情"</strong>查看完整的安全检查报告</li>
                <li>点击<strong>"导出记录"</strong>下载CSV格式报表</li>
            </ul>
            
            <h3>边界情况演示</h3>
            <p>系统已内置以下边界保护：</p>
            <ul>
                <li><strong>重复提交</strong>：1分钟内相同艇只+游客的检查会被拦截</li>
                <li><strong>状态冲突</strong>：已确认的记录无法拒绝，已拒绝的无法确认</li>
                <li><strong>来源记录缺失</strong>：删除艇只或游客后，关联记录会显示"已删除"，且无法再确认</li>
            </ul>
            
            <h3>看板监控</h3>
            <p><strong>"总览看板"</strong>页面实时展示：</p>
            <ul>
                <li>在册艇只 / 安全可用数量</li>
                <li>今日检查次数 / 拦截次数</li>
                <li>当前环境状态（天气、水位）</li>
                <li>近期安全检查记录</li>
            </ul>
            
            <h3>验收清单</h3>
            <p>验收时请关注以下主线：</p>
            <ol>
                <li>能看到艇只档案推进到安全清单（救生衣数量、艇只状态）</li>
                <li>能通过游客经验产出可复核结果（检查报告显示经验匹配情况）</li>
                <li>天气/水位超标时能明显看到<strong>拦截效果</strong>（红色标记、无法确认租赁）</li>
                <li>能完整执行：新增 → 检查 → 确认/拒绝 → 导出的全流程</li>
            </ol>
        `;
    };

    UI.showBoatForm = function(boat = null) {
        const isEdit = !!boat;
        const title = isEdit ? '编辑艇只' : '新增艇只';
        
        let typeOptions = BOAT_TYPES.map(t => 
            `<option value="${t}" ${boat && boat.type === t ? 'selected' : ''}>${t}</option>`
        ).join('');
        
        let statusOptions = `
            <option value="available" ${boat && boat.status === 'available' ? 'selected' : ''}>可用</option>
            <option value="maintenance" ${boat && boat.status === 'maintenance' ? 'selected' : ''}>维护中</option>
        `;
        
        const body = `
            <div class="form-group">
                <label>艇号 *</label>
                <input type="text" id="boat-number" value="${boat ? boat.boatNumber : ''}" placeholder="如：K001" ${isEdit ? 'readonly' : ''}>
            </div>
            <div class="form-group">
                <label>类型 *</label>
                <select id="boat-type">${typeOptions}</select>
            </div>
            <div class="form-group">
                <label>载客容量（人）*</label>
                <input type="number" id="boat-capacity" min="1" value="${boat ? boat.capacity : 2}">
            </div>
            <div class="form-group">
                <label>救生衣数量（件）*</label>
                <input type="number" id="boat-lifejackets" min="0" value="${boat ? boat.lifeJackets : 2}">
            </div>
            <div class="form-group">
                <label>状态</label>
                <select id="boat-status">${statusOptions}</select>
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea id="boat-notes" rows="2">${boat ? boat.notes || '' : ''}</textarea>
            </div>
        `;
        
        const footer = `
            <button class="btn btn-secondary" onclick="Modal.hide()">取消</button>
            <button class="btn btn-primary" onclick="UI.saveBoat('${boat ? boat.id : ''}')">保存</button>
        `;
        
        Modal.show(title, body, footer);
    };

    UI.saveBoat = function(id) {
        const data = {
            boatNumber: document.getElementById('boat-number').value.trim(),
            type: document.getElementById('boat-type').value,
            capacity: parseInt(document.getElementById('boat-capacity').value),
            lifeJackets: parseInt(document.getElementById('boat-lifejackets').value),
            status: document.getElementById('boat-status').value,
            notes: document.getElementById('boat-notes').value.trim()
        };
        
        if (!data.boatNumber) {
            showToast('请填写艇号', 'error');
            return;
        }
        if (data.capacity < 1 || data.lifeJackets < 0) {
            showToast('请填写有效的容量和救生衣数量', 'error');
            return;
        }
        
        let result;
        if (id) {
            result = BoatManager.update(id, data);
        } else {
            result = BoatManager.add(data);
        }
        
        if (result.success) {
            Modal.hide();
            showToast(id ? '艇只更新成功' : '艇只添加成功', 'success');
            UI.renderBoats();
            UI.renderDashboard();
        } else {
            showToast(result.error, 'error');
        }
    };

    UI.editBoat = function(id) {
        const boat = BoatManager.getById(id);
        if (boat) {
            UI.showBoatForm(boat);
        }
    };

    UI.deleteBoat = function(id) {
        const boat = BoatManager.getById(id);
        if (!boat) return;
        
        const body = `
            <p>确定要删除艇只 <strong>${boat.boatNumber}</strong> 吗？</p>
            <p style="color:#e53935;font-size:13px;margin-top:8px;">
                删除后，相关租赁记录会显示"来源记录缺失"且无法再确认。
            </p>
        `;
        
        const footer = `
            <button class="btn btn-secondary" onclick="Modal.hide()">取消</button>
            <button class="btn btn-danger" onclick="UI.confirmDeleteBoat('${id}')">确认删除</button>
        `;
        
        Modal.show('确认删除', body, footer);
    };

    UI.confirmDeleteBoat = function(id) {
        BoatManager.delete(id);
        Modal.hide();
        showToast('艇只已删除', 'success');
        UI.renderBoats();
        UI.renderDashboard();
    };

    UI.showWeatherForm = function() {
        let conditionOptions = WEATHER_CONDITIONS.map(c => 
            `<option value="${c}">${c}</option>`
        ).join('');
        
        const body = `
            <div class="form-group">
                <label>天气状况 *</label>
                <select id="weather-condition">${conditionOptions}</select>
            </div>
            <div class="form-group">
                <label>风速 (m/s) *</label>
                <input type="number" id="weather-wind" step="0.1" value="3.0">
            </div>
            <div class="form-group">
                <label>气温 (°C) *</label>
                <input type="number" id="weather-temp" value="25">
            </div>
        `;
        
        const footer = `
            <button class="btn btn-secondary" onclick="Modal.hide()">取消</button>
            <button class="btn btn-primary" onclick="UI.saveWeather()">保存</button>
        `;
        
        Modal.show('录入天气', body, footer);
    };

    UI.saveWeather = function() {
        const data = {
            condition: document.getElementById('weather-condition').value,
            windSpeed: parseFloat(document.getElementById('weather-wind').value),
            temperature: parseInt(document.getElementById('weather-temp').value)
        };
        
        if (isNaN(data.windSpeed) || data.windSpeed < 0) {
            showToast('请填写有效的风速', 'error');
            return;
        }
        
        EnvironmentManager.addWeather(data);
        Modal.hide();
        showToast('天气记录已保存', 'success');
        UI.renderEnvironment();
        UI.renderDashboard();
    };

    UI.showWaterForm = function() {
        let flowOptions = WATER_FLOW.map(f => 
            `<option value="${f}">${f}</option>`
        ).join('');
        
        const body = `
            <div class="form-group">
                <label>水位高度 (m) *</label>
                <input type="number" id="water-level" step="0.1" value="2.5">
            </div>
            <div class="form-group">
                <label>水流速度 *</label>
                <select id="water-flow">${flowOptions}</select>
            </div>
        `;
        
        const footer = `
            <button class="btn btn-secondary" onclick="Modal.hide()">取消</button>
            <button class="btn btn-primary" onclick="UI.saveWater()">保存</button>
        `;
        
        Modal.show('录入水位', body, footer);
    };

    UI.saveWater = function() {
        const data = {
            level: parseFloat(document.getElementById('water-level').value),
            flow: document.getElementById('water-flow').value
        };
        
        if (isNaN(data.level) || data.level < 0) {
            showToast('请填写有效的水位', 'error');
            return;
        }
        
        EnvironmentManager.addWater(data);
        Modal.hide();
        showToast('水位记录已保存', 'success');
        UI.renderEnvironment();
        UI.renderDashboard();
    };

    UI.showVisitorForm = function(visitor = null) {
        const isEdit = !!visitor;
        const title = isEdit ? '编辑游客' : '新增游客';
        
        let expOptions = VISITOR_EXPERIENCE.map(e => 
            `<option value="${e}" ${visitor && visitor.experience === e ? 'selected' : ''}>${e}</option>`
        ).join('');
        
        const body = `
            <div class="form-group">
                <label>姓名 *</label>
                <input type="text" id="visitor-name" value="${visitor ? visitor.name : ''}">
            </div>
            <div class="form-group">
                <label>手机号 *</label>
                <input type="tel" id="visitor-phone" value="${visitor ? visitor.phone : ''}" ${isEdit ? 'readonly' : ''}>
            </div>
            <div class="form-group">
                <label>经验等级 *</label>
                <select id="visitor-experience">${expOptions}</select>
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea id="visitor-notes" rows="2">${visitor ? visitor.notes || '' : ''}</textarea>
            </div>
        `;
        
        const footer = `
            <button class="btn btn-secondary" onclick="Modal.hide()">取消</button>
            <button class="btn btn-primary" onclick="UI.saveVisitor('${visitor ? visitor.id : ''}')">保存</button>
        `;
        
        Modal.show(title, body, footer);
    };

    UI.saveVisitor = function(id) {
        const data = {
            name: document.getElementById('visitor-name').value.trim(),
            phone: document.getElementById('visitor-phone').value.trim(),
            experience: document.getElementById('visitor-experience').value,
            notes: document.getElementById('visitor-notes').value.trim()
        };
        
        if (!data.name || !data.phone) {
            showToast('请填写姓名和手机号', 'error');
            return;
        }
        if (!/^1\d{10}$/.test(data.phone)) {
            showToast('请填写有效的11位手机号', 'error');
            return;
        }
        
        let result;
        if (id) {
            result = VisitorManager.update(id, data);
        } else {
            result = VisitorManager.add(data);
        }
        
        if (result.success) {
            Modal.hide();
            showToast(id ? '游客更新成功' : '游客添加成功', 'success');
            UI.renderVisitors();
        } else {
            showToast(result.error, 'error');
        }
    };

    UI.editVisitor = function(id) {
        const visitor = VisitorManager.getById(id);
        if (visitor) {
            UI.showVisitorForm(visitor);
        }
    };

    UI.runCheck = function() {
        const boatId = document.getElementById('checkout-boat').value;
        const visitorId = document.getElementById('checkout-visitor').value;
        const passengers = document.getElementById('checkout-passengers').value;
        const duration = document.getElementById('checkout-duration').value;
        const notes = document.getElementById('checkout-notes').value;
        
        if (!boatId || !visitorId || !passengers) {
            showToast('请选择艇只、游客并填写人数', 'error');
            return;
        }
        
        const result = SafetyEngine.runCheck(boatId, visitorId, passengers, duration, notes);
        currentCheckResult = result;
        
        let resultClass = result.overall === 'pass' ? 'pass' : 
                         result.overall === 'warning' ? 'warning' : 'fail';
        let resultTitle = result.overall === 'pass' ? '安全检查通过' : 
                         result.overall === 'warning' ? '存在风险，需注意' : '安全检查不通过';
        
        let itemsHtml = result.items.map(item => `
            <div class="check-item ${item.status}">
                <div class="check-item-title">
                    ${item.name}
                    <span class="check-item-status">
                        ${item.status === 'pass' ? '通过' : 
                          item.status === 'warning' ? '警告' : '不通过'}
                    </span>
                </div>
                <div class="check-item-desc">${item.message}</div>
            </div>
        `).join('');
        
        let actionsHtml = '';
        if (result.canRent) {
            actionsHtml = `
                <div class="result-actions">
                    <button class="btn btn-success" onclick="UI.confirmCurrentCheck()">确认租赁</button>
                    <button class="btn btn-danger" onclick="UI.rejectCurrentCheck()">拒绝租赁</button>
                </div>
            `;
        } else {
            actionsHtml = `
                <div class="result-actions">
                    <button class="btn btn-danger" onclick="UI.saveRejectedCheck()">保存为拒绝</button>
                </div>
            `;
        }
        
        document.getElementById('checkout-result').innerHTML = `
            <div class="check-result ${resultClass}">
                <div class="check-result-title">${resultTitle}</div>
                <div class="check-item-desc" style="margin-top:8px;">${result.reason}</div>
            </div>
            <div class="check-items">
                ${itemsHtml}
            </div>
            ${actionsHtml}
        `;
    };

    UI.confirmCurrentCheck = function() {
        if (!currentCheckResult) return;
        
        const saveResult = RecordManager.save(currentCheckResult);
        if (!saveResult.success) {
            showToast(saveResult.error, 'error');
            if (saveResult.existingRecord) {
                currentCheckRecordId = saveResult.existingRecord.id;
            }
            return;
        }
        
        const confirmResult = RecordManager.confirm(saveResult.record.id);
        if (confirmResult.success) {
            showToast('租赁已确认', 'success');
            currentCheckResult = null;
            UI.renderCheckout();
            UI.renderRecords();
            UI.renderDashboard();
        } else {
            showToast(confirmResult.error, 'error');
        }
    };

    UI.rejectCurrentCheck = function() {
        if (!currentCheckResult) return;
        
        const body = `
            <div class="form-group">
                <label>拒绝原因</label>
                <textarea id="reject-reason" rows="3" placeholder="请输入拒绝原因...">${currentCheckResult.reason}</textarea>
            </div>
        `;
        
        const footer = `
            <button class="btn btn-secondary" onclick="Modal.hide()">取消</button>
            <button class="btn btn-danger" onclick="UI.saveRejectCurrentCheck()">确认拒绝</button>
        `;
        
        Modal.show('拒绝租赁', body, footer);
    };

    UI.saveRejectCurrentCheck = function() {
        if (!currentCheckResult) {
            Modal.hide();
            return;
        }
        
        const reason = document.getElementById('reject-reason').value;
        const saveResult = RecordManager.save(currentCheckResult);
        
        if (!saveResult.success && !saveResult.existingRecord) {
            Modal.hide();
            showToast(saveResult.error, 'error');
            return;
        }
        
        const recordId = saveResult.success ? saveResult.record.id : saveResult.existingRecord.id;
        const rejectResult = RecordManager.reject(recordId, reason);
        
        Modal.hide();
        if (rejectResult.success) {
            showToast('已保存为拒绝状态', 'success');
            currentCheckResult = null;
            UI.renderCheckout();
            UI.renderRecords();
            UI.renderDashboard();
        } else {
            showToast(rejectResult.error, 'error');
        }
    };

    UI.saveRejectedCheck = function() {
        if (!currentCheckResult) return;
        
        const saveResult = RecordManager.save(currentCheckResult);
        if (!saveResult.success && !saveResult.existingRecord) {
            showToast(saveResult.error, 'error');
            return;
        }
        
        const recordId = saveResult.success ? saveResult.record.id : saveResult.existingRecord.id;
        RecordManager.reject(recordId, '安全检查不通过：' + currentCheckResult.reason);
        
        showToast('已保存为拒绝状态', 'success');
        currentCheckResult = null;
        UI.renderCheckout();
        UI.renderRecords();
        UI.renderDashboard();
    };

    UI.confirmRecord = function(id) {
        const result = RecordManager.confirm(id);
        if (result.success) {
            showToast('记录已确认', 'success');
            UI.renderRecords();
            UI.renderDashboard();
        } else {
            showToast(result.error, 'error');
        }
    };

    UI.rejectRecord = function(id) {
        const body = `
            <div class="form-group">
                <label>拒绝原因</label>
                <textarea id="record-reject-reason" rows="3" placeholder="请输入拒绝原因..."></textarea>
            </div>
        `;
        
        const footer = `
            <button class="btn btn-secondary" onclick="Modal.hide()">取消</button>
            <button class="btn btn-danger" onclick="UI.confirmRejectRecord('${id}')">确认拒绝</button>
        `;
        
        Modal.show('拒绝记录', body, footer);
    };

    UI.confirmRejectRecord = function(id) {
        const reason = document.getElementById('record-reject-reason').value;
        const result = RecordManager.reject(id, reason);
        Modal.hide();
        
        if (result.success) {
            showToast('记录已拒绝', 'success');
            UI.renderRecords();
            UI.renderDashboard();
        } else {
            showToast(result.error, 'error');
        }
    };

    UI.viewRecordDetail = function(id) {
        const record = RecordManager.getById(id);
        if (!record) {
            showToast('记录不存在', 'error');
            return;
        }
        
        const boat = BoatManager.getById(record.boatId);
        const visitor = VisitorManager.getById(record.visitorId);
        
        let resultClass = record.overall === 'pass' ? 'pass' : 
                         record.overall === 'warning' ? 'warning' : 'fail';
        let resultTitle = record.overall === 'pass' ? '安全检查通过' : 
                         record.overall === 'warning' ? '存在风险' : '安全检查不通过';
        
        let itemsHtml = '';
        if (record.items && record.items.length > 0) {
            itemsHtml = record.items.map(item => `
                <div class="check-item ${item.status}">
                    <div class="check-item-title">
                        ${item.name}
                        <span class="check-item-status">
                            ${item.status === 'pass' ? '通过' : 
                              item.status === 'warning' ? '警告' : '不通过'}
                        </span>
                    </div>
                    <div class="check-item-desc">${item.message}</div>
                </div>
            `).join('');
        }
        
        let historyHtml = '';
        if (record.history && record.history.length > 0) {
            historyHtml = '<div style="margin-top:20px;"><strong>操作历史：</strong><ul style="margin-left:20px;margin-top:8px;">';
            record.history.forEach(h => {
                historyHtml += `<li style="font-size:13px;color:#666;margin-bottom:4px;">
                    ${formatDate(h.time)} - ${h.note}
                </li>`;
            });
            historyHtml += '</ul></div>';
        }
        
        const body = `
            <div style="margin-bottom:16px;">
                <strong>检查单号：</strong>${record.id}<br>
                <strong>检查时间：</strong>${formatDate(record.checkTime)}<br>
                <strong>艇只：</strong>${boat ? boat.boatNumber : '已删除'}<br>
                <strong>游客：</strong>${visitor ? visitor.name + ' (' + visitor.experience + ')' : '已删除'}<br>
                <strong>人数：</strong>${record.passengers}人 | <strong>时长：</strong>${record.duration}小时<br>
                ${record.notes ? `<strong>备注：</strong>${record.notes}<br>` : ''}
            </div>
            <div class="check-result ${resultClass}">
                <div class="check-result-title">${resultTitle}</div>
                <div class="check-item-desc" style="margin-top:8px;">${record.reason}</div>
            </div>
            ${itemsHtml}
            ${historyHtml}
        `;
        
        const footer = `
            <button class="btn btn-secondary" onclick="Modal.hide()">关闭</button>
        `;
        
        Modal.show('检查详情', body, footer);
    };

    UI.exportRecords = function() {
        const result = RecordManager.exportToCSV();
        if (result.success) {
            showToast(`已导出 ${result.count} 条记录`, 'success');
        } else {
            showToast(result.error, 'error');
        }
    };

    UI.loadSampleData = function() {
        const body = `
            <p>将创建以下示例数据：</p>
            <ul style="margin-left:20px;margin-top:8px;">
                <li>5条艇只档案</li>
                <li>2条天气记录</li>
                <li>2条水位记录</li>
                <li>4位游客信息</li>
            </ul>
            <p style="color:#666;font-size:13px;margin-top:8px;">已有数据不会被覆盖。</p>
        `;
        
        const footer = `
            <button class="btn btn-secondary" onclick="Modal.hide()">取消</button>
            <button class="btn btn-primary" onclick="UI.confirmLoadSample()">确认加载</button>
        `;
        
        Modal.show('加载示例数据', body, footer);
    };

    UI.confirmLoadSample = function() {
        const result = SampleData.load();
        Modal.hide();
        showToast(`已加载：${result.boats}条艇只、${result.weather}条天气、${result.water}条水位、${result.visitors}位游客`, 'success');
        UI.refresh('dashboard');
    };

    UI.clearAllData = function() {
        const body = `
            <p style="color:#e53935;font-weight:500;">确定要清空所有数据吗？</p>
            <p style="font-size:13px;margin-top:8px;">此操作将删除所有艇只、环境、游客和租赁记录，且无法恢复。</p>
        `;
        
        const footer = `
            <button class="btn btn-secondary" onclick="Modal.hide()">取消</button>
            <button class="btn btn-danger" onclick="UI.confirmClearAll()">确认清空</button>
        `;
        
        Modal.show('清空所有数据', body, footer);
    };

    UI.confirmClearAll = function() {
        Storage.clearAll();
        Modal.hide();
        showToast('所有数据已清空', 'success');
        UI.refresh('dashboard');
    };

    UI.init = function() {
        UI.initTabs();
        
        document.getElementById('btn-add-boat').addEventListener('click', () => UI.showBoatForm());
        document.getElementById('btn-add-weather').addEventListener('click', () => UI.showWeatherForm());
        document.getElementById('btn-add-water').addEventListener('click', () => UI.showWaterForm());
        document.getElementById('btn-add-visitor').addEventListener('click', () => UI.showVisitorForm());
        document.getElementById('btn-run-check').addEventListener('click', () => UI.runCheck());
        document.getElementById('btn-reset-check').addEventListener('click', () => UI.renderCheckout());
        document.getElementById('btn-export-records').addEventListener('click', () => UI.exportRecords());
        document.getElementById('btn-load-sample').addEventListener('click', () => UI.loadSampleData());
        document.getElementById('btn-clear-all').addEventListener('click', () => UI.clearAllData());
        
        document.getElementById('modal-close').addEventListener('click', () => Modal.hide());
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'modal-overlay') {
                Modal.hide();
            }
        });
        
        UI.renderDashboard();
    };

    return {
        init: UI.init,
        editBoat: UI.editBoat,
        deleteBoat: UI.deleteBoat,
        confirmDeleteBoat: UI.confirmDeleteBoat,
        saveBoat: UI.saveBoat,
        saveWeather: UI.saveWeather,
        saveWater: UI.saveWater,
        editVisitor: UI.editVisitor,
        saveVisitor: UI.saveVisitor,
        runCheck: UI.runCheck,
        confirmCurrentCheck: UI.confirmCurrentCheck,
        rejectCurrentCheck: UI.rejectCurrentCheck,
        saveRejectCurrentCheck: UI.saveRejectCurrentCheck,
        saveRejectedCheck: UI.saveRejectedCheck,
        confirmRecord: UI.confirmRecord,
        rejectRecord: UI.rejectRecord,
        confirmRejectRecord: UI.confirmRejectRecord,
        viewRecordDetail: UI.viewRecordDetail,
        loadSampleData: UI.loadSampleData,
        confirmLoadSample: UI.confirmLoadSample,
        confirmClearAll: UI.confirmClearAll
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

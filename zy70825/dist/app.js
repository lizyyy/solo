"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const uuid_1 = require("uuid");
const path = __importStar(require("path"));
const fileParser_1 = require("./services/fileParser");
const rulesEngine_1 = require("./services/rulesEngine");
const dataStore_1 = require("./services/dataStore");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(process.cwd(), 'uploads'));
    },
    filename: (req, file, cb) => {
        cb(null, `${(0, uuid_1.v4)()}-${file.originalname}`);
    }
});
const upload = (0, multer_1.default)({ storage });
const fileParser = new fileParser_1.FileParserService();
const rulesEngine = new rulesEngine_1.RulesEngineService();
const dataStore = new dataStore_1.DataStoreService();
app.use(express_1.default.json());
app.use('/photos', express_1.default.static(path.join(process.cwd(), 'data', 'photos')));
app.post('/api/upload/shipments', upload.single('csvFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '请上传CSV文件' });
        }
        const fileName = req.file.originalname;
        if (await dataStore.isBatchProcessed(fileName)) {
            return res.status(400).json({ error: '该批次文件已处理过，不能重复提交' });
        }
        const batchId = (0, uuid_1.v4)();
        const shipments = await fileParser.parseShipmentCSV(req.file.path, batchId);
        const influencers = await dataStore.getInfluencers();
        const existingShipments = await dataStore.getAllShipments();
        const result = rulesEngine.processItems(shipments, influencers, existingShipments, batchId);
        const batch = {
            id: batchId,
            fileName,
            uploadTime: new Date().toISOString(),
            itemCount: shipments.length,
            processed: true
        };
        await dataStore.saveBatch(batch);
        await dataStore.saveShipments(shipments);
        await dataStore.saveProcessingResult(result);
        res.json({
            success: true,
            batchId,
            message: `处理完成，共 ${shipments.length} 条记录`,
            statistics: result.statistics
        });
    }
    catch (error) {
        console.error('处理失败:', error);
        res.status(500).json({ error: '处理失败' });
    }
});
app.post('/api/upload/influencers', upload.single('jsonFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '请上传JSON文件' });
        }
        const influencers = await fileParser.parseInfluencerJSON(req.file.path);
        await dataStore.saveInfluencers(influencers);
        res.json({
            success: true,
            message: `导入成功，共 ${influencers.size} 位达人`
        });
    }
    catch (error) {
        console.error('导入失败:', error);
        res.status(500).json({ error: '导入失败' });
    }
});
app.post('/api/upload/photos', upload.array('photos', 10), async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: '请上传照片' });
        }
        const photoUrls = [];
        for (const file of files) {
            const fileName = `${(0, uuid_1.v4)()}-${file.originalname}`;
            const buffer = await Promise.resolve().then(() => __importStar(require('fs'))).then(fs => fs.promises.readFile(file.path));
            const url = await dataStore.savePhoto(fileName, buffer);
            photoUrls.push(url);
        }
        res.json({
            success: true,
            photoUrls
        });
    }
    catch (error) {
        console.error('上传失败:', error);
        res.status(500).json({ error: '上传失败' });
    }
});
app.get('/api/results', async (req, res) => {
    try {
        const results = await dataStore.getProcessingResults();
        res.json({ success: true, data: results });
    }
    catch (error) {
        res.status(500).json({ error: '查询失败' });
    }
});
app.get('/api/results/:batchId', async (req, res) => {
    try {
        const result = await dataStore.getProcessingResultById(req.params.batchId);
        if (!result) {
            return res.status(404).json({ error: '未找到该批次' });
        }
        res.json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ error: '查询失败' });
    }
});
app.get('/api/report/:shipmentId', async (req, res) => {
    try {
        const report = await dataStore.getReportDetail(req.params.shipmentId);
        if (!report) {
            return res.status(404).json({ error: '未找到该记录' });
        }
        res.json({ success: true, data: report });
    }
    catch (error) {
        res.status(500).json({ error: '查询失败' });
    }
});
app.get('/api/batches', async (req, res) => {
    try {
        const batches = await dataStore.getBatches();
        res.json({ success: true, data: batches });
    }
    catch (error) {
        res.status(500).json({ error: '查询失败' });
    }
});
app.get('/api/shipments', async (req, res) => {
    try {
        const shipments = await dataStore.getAllShipments();
        res.json({ success: true, data: shipments });
    }
    catch (error) {
        res.status(500).json({ error: '查询失败' });
    }
});
app.get('/api/influencers', async (req, res) => {
    try {
        const influencers = await dataStore.getInfluencers();
        res.json({ success: true, data: Array.from(influencers.values()) });
    }
    catch (error) {
        res.status(500).json({ error: '查询失败' });
    }
});
app.listen(PORT, async () => {
    await Promise.resolve().then(() => __importStar(require('fs-extra'))).then(fs => fs.ensureDir(path.join(process.cwd(), 'uploads')));
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log('API文档:');
    console.log('  POST /api/upload/shipments   - 上传寄送单CSV');
    console.log('  POST /api/upload/influencers - 上传达人档案JSON');
    console.log('  POST /api/upload/photos      - 上传回收照片');
    console.log('  GET  /api/results            - 获取所有处理结果');
    console.log('  GET  /api/results/:batchId   - 获取批次处理结果');
    console.log('  GET  /api/report/:shipmentId - 获取单条明细报告');
    console.log('  GET  /api/batches            - 获取批次列表');
    console.log('  GET  /api/shipments          - 获取所有寄送记录');
    console.log('  GET  /api/influencers        - 获取所有达人');
});

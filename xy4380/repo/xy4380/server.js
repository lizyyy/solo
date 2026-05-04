const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Database = require('./database');
const similarity = require('./similarity');
const exporter = require('./exporter');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads', { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

const db = new Database();

app.post('/api/import/items', upload.array('photos', 100), async (req, res) => {
    try {
        const photos = req.files || [];
        const items = [];
        
        for (const photo of photos) {
            const itemId = db.insertItem({
                photoUrl: `/uploads/${photo.filename}`,
                originalName: photo.originalname,
                tags: [],
                description: '',
                foundDate: new Date().toISOString().split('T')[0],
                location: '',
                status: 'pending'
            });
            items.push({ id: itemId, photoUrl: `/uploads/${photo.filename}`, originalName: photo.originalname });
        }
        
        res.json({ success: true, count: items.length, items });
    } catch (error) {
        console.error('Import items error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/import/tags', upload.single('csv'), async (req, res) => {
    try {
        const csvPath = req.file.path;
        const results = await db.importTagsFromCSV(csvPath);
        fs.unlinkSync(csvPath);
        res.json({ success: true, ...results });
    } catch (error) {
        console.error('Import tags error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/import/claims', upload.single('json'), async (req, res) => {
    try {
        const jsonPath = req.file.path;
        const jsonContent = fs.readFileSync(jsonPath, 'utf8');
        const claims = JSON.parse(jsonContent);
        const results = db.importClaims(claims);
        fs.unlinkSync(jsonPath);
        res.json({ success: true, ...results });
    } catch (error) {
        console.error('Import claims error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/match', async (req, res) => {
    try {
        const { itemId, claimId, autoMatchAll } = req.body;
        
        let results;
        if (autoMatchAll) {
            results = similarity.autoMatchAll(db);
        } else if (itemId && claimId) {
            const item = db.getItem(itemId);
            const claim = db.getClaim(claimId);
            if (!item || !claim) {
                return res.status(404).json({ success: false, error: 'Item or Claim not found' });
            }
            results = similarity.calculateMatch(item, claim);
            db.saveMatchResult(itemId, claimId, results);
        } else if (itemId) {
            const item = db.getItem(itemId);
            const claims = db.getAllClaims();
            results = [];
            for (const claim of claims) {
                const match = similarity.calculateMatch(item, claim);
                db.saveMatchResult(itemId, claim.claimId, match);
                results.push({ claimId: claim.claimId, match });
            }
            results.sort((a, b) => b.match.overallScore - a.match.overallScore);
        } else if (claimId) {
            const claim = db.getClaim(claimId);
            const items = db.getAllItems();
            results = [];
            for (const item of items) {
                const match = similarity.calculateMatch(item, claim);
                db.saveMatchResult(item.id, claimId, match);
                results.push({ itemId: item.id, match });
            }
            results.sort((a, b) => b.match.overallScore - a.match.overallScore);
        } else {
            return res.status(400).json({ success: false, error: 'Invalid parameters' });
        }
        
        res.json({ success: true, results });
    } catch (error) {
        console.error('Match error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/items', async (req, res) => {
    try {
        const items = db.getAllItems();
        res.json({ success: true, items });
    } catch (error) {
        console.error('Get items error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/items/:id', async (req, res) => {
    try {
        const item = db.getItem(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }
        res.json({ success: true, item });
    } catch (error) {
        console.error('Get item error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/items/:id', async (req, res) => {
    try {
        const updated = db.updateItem(req.params.id, req.body);
        if (!updated) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }
        res.json({ success: true, item: db.getItem(req.params.id) });
    } catch (error) {
        console.error('Update item error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/claims', async (req, res) => {
    try {
        const claims = db.getAllClaims();
        res.json({ success: true, claims });
    } catch (error) {
        console.error('Get claims error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/claims/:id', async (req, res) => {
    try {
        const claim = db.getClaim(req.params.id);
        if (!claim) {
            return res.status(404).json({ success: false, error: 'Claim not found' });
        }
        res.json({ success: true, claim });
    } catch (error) {
        console.error('Get claim error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/claims/:id', async (req, res) => {
    try {
        const updated = db.updateClaim(req.params.id, req.body);
        if (!updated) {
            return res.status(404).json({ success: false, error: 'Claim not found' });
        }
        res.json({ success: true, claim: db.getClaim(req.params.id) });
    } catch (error) {
        console.error('Update claim error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/review', async (req, res) => {
    try {
        const { itemId, claimId, decision, notes, reviewer } = req.body;
        const reviewId = db.insertReview({
            itemId,
            claimId,
            decision,
            notes,
            reviewer: reviewer || '系统',
            reviewDate: new Date().toISOString()
        });
        
        if (decision === 'matched') {
            db.updateItemStatus(itemId, 'matched');
            db.updateClaimStatus(claimId, 'matched');
        } else if (decision === 'rejected') {
            db.updateClaimStatus(claimId, 'rejected');
        }
        
        res.json({ success: true, reviewId });
    } catch (error) {
        console.error('Review error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/merge-claims', async (req, res) => {
    try {
        const { sourceClaimIds, targetClaimId } = req.body;
        const result = db.mergeClaims(sourceClaimIds, targetClaimId);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Merge claims error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/reviews', async (req, res) => {
    try {
        const reviews = db.getAllReviews();
        res.json({ success: true, reviews });
    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/matches', async (req, res) => {
    try {
        const matches = db.getAllMatchResults();
        res.json({ success: true, matches });
    } catch (error) {
        console.error('Get matches error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/export/markdown', async (req, res) => {
    try {
        const content = exporter.generateMarkdownHandover(db);
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=交接单_${new Date().toISOString().split('T')[0]}.md`);
        res.send(content);
    } catch (error) {
        console.error('Export markdown error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/export/high-risk-csv', async (req, res) => {
    try {
        const content = exporter.generateHighRiskCSV(db);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=高风险认领清单_${new Date().toISOString().split('T')[0]}.csv`);
        res.send('\uFEFF' + content);
    } catch (error) {
        console.error('Export high-risk CSV error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/export/audit-json', async (req, res) => {
    try {
        const content = exporter.generateAuditJSON(db);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=审计包_${new Date().toISOString().split('T')[0]}.json`);
        res.send(content);
    } catch (error) {
        console.error('Export audit JSON error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const items = db.getAllItems();
        const claims = db.getAllClaims();
        const reviews = db.getAllReviews();
        const matches = db.getAllMatchResults();
        
        const stats = {
            totalItems: items.length,
            pendingItems: items.filter(i => i.status === 'pending').length,
            matchedItems: items.filter(i => i.status === 'matched').length,
            totalClaims: claims.length,
            pendingClaims: claims.filter(c => c.status === 'pending').length,
            matchedClaims: claims.filter(c => c.status === 'matched').length,
            rejectedClaims: claims.filter(c => c.status === 'rejected').length,
            totalReviews: reviews.length,
            totalMatches: matches.length,
            highRiskMatches: matches.filter(m => m.riskLevel === 'high').length
        };
        
        res.json({ success: true, stats });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`机场失物招领预审系统已启动: http://localhost:${PORT}`);
});

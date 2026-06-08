import express from 'express';
import multer from 'multer';
import db from './database';
import {
  findOrCreateLocation,
  getLocationById,
  getAllLocations,
  getLocationAliases,
  updateLocation,
  mergeLocations,
  searchLocations
} from './services/locationService';
import {
  createFeedback,
  getFeedbackById,
  getFeedbacksByLocation,
  getAllFeedbacks,
  updateFeedback,
  deleteFeedback,
  bulkImportFeedbacks
} from './services/feedbackService';
import {
  createPlanVersion,
  getPlanById,
  getPlansByLocation,
  getAllPlans,
  updatePlan,
  createReportFromPlan,
  getReportById,
  getReportsByLocation,
  getReportsByPlan,
  updateReport,
  getFullLocationTimeline
} from './services/planService';
import {
  checkAndCreateConflicts,
  getConflicts,
  getConflictById,
  resolveConflict,
  getConflictDetail
} from './services/conflictService';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '城市树木修剪排程 API 服务正常' });
});

router.get('/dashboard/stats', (req, res) => {
  const totalLocations = db.locations.all().length;
  const totalFeedbacks = db.resident_feedbacks.all().length;
  const pendingFeedbacks = db.resident_feedbacks.filter((f: any) => f.status === 'pending').length;
  const totalPlans = db.plan_versions.all().length;
  const draftPlans = db.plan_versions.filter((p: any) => p.status === 'draft').length;
  const totalReports = db.reports.all().length;
  const unresolvedConflicts = db.data_conflicts.filter((c: any) => !c.resolvedAt).length;

  const priorityStats = {
    urgent: db.resident_feedbacks.filter((f: any) => f.priority === 'urgent').length,
    high: db.resident_feedbacks.filter((f: any) => f.priority === 'high').length,
    medium: db.resident_feedbacks.filter((f: any) => f.priority === 'medium').length,
    low: db.resident_feedbacks.filter((f: any) => f.priority === 'low').length
  };

  const statusStats = {
    pending: db.resident_feedbacks.filter((f: any) => f.status === 'pending').length,
    processing: db.resident_feedbacks.filter((f: any) => f.status === 'in_progress' || f.status === 'processing').length,
    resolved: db.resident_feedbacks.filter((f: any) => f.status === 'resolved').length,
    closed: db.resident_feedbacks.filter((f: any) => f.status === 'closed').length
  };

  res.json({
    totalLocations,
    totalFeedbacks,
    pendingFeedbacks,
    totalPlans,
    draftPlans,
    totalReports,
    unresolvedConflicts,
    byPriority: [
      { priority: 'urgent', count: priorityStats.urgent },
      { priority: 'high', count: priorityStats.high },
      { priority: 'medium', count: priorityStats.medium },
      { priority: 'low', count: priorityStats.low }
    ],
    byStatus: [
      { status: 'pending', count: statusStats.pending },
      { status: 'processing', count: statusStats.processing },
      { status: 'resolved', count: statusStats.resolved },
      { status: 'closed', count: statusStats.closed }
    ]
  });
});

router.get('/locations', (req, res) => {
  const locations = getAllLocations();
  const result = locations.map(loc => ({
    ...loc,
    aliases: getLocationAliases(loc.id),
    feedbackCount: db.resident_feedbacks.filter((f: any) => f.locationId === loc.id).length
  }));
  res.json(result);
});

router.get('/locations/search', (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string') {
    return res.json([]);
  }
  const results = searchLocations(q);
  res.json(results);
});

router.get('/locations/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const location = getLocationById(id);
  if (!location) {
    return res.status(404).json({ error: '点位不存在' });
  }
  const aliases = getLocationAliases(id);
  const feedbacks = getFeedbacksByLocation(id);
  const plans = getPlansByLocation(id);
  const reports = getReportsByLocation(id);
  const timeline = getFullLocationTimeline(id);
  const conflicts = getConflicts({ locationId: id, resolved: false });

  res.json({
    location,
    aliases,
    feedbacks,
    plans,
    reports,
    timeline,
    conflicts
  });
});

router.put('/locations/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const updated = updateLocation(id, req.body);
  if (!updated) {
    return res.status(404).json({ error: '点位不存在' });
  }
  res.json(updated);
});

router.post('/locations/merge', (req, res) => {
  const { targetId, sourceIds } = req.body;
  if (!targetId || !sourceIds || !Array.isArray(sourceIds)) {
    return res.status(400).json({ error: '参数错误' });
  }
  const merged = mergeLocations(targetId, sourceIds);
  res.json({ merged });
});

router.get('/feedbacks', (req, res) => {
  const { status, priority, locationId } = req.query;
  const filters: any = {};
  if (status) filters.status = status as string;
  if (priority) filters.priority = priority as string;
  if (locationId) filters.locationId = parseInt(locationId as string);
  
  const feedbacks = getAllFeedbacks(filters);
  const result = feedbacks.map(fb => ({
    ...fb,
    location: getLocationById(fb.locationId)
  }));
  res.json(result);
});

router.get('/feedbacks/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const feedback = getFeedbackById(id);
  if (!feedback) {
    return res.status(404).json({ error: '反馈不存在' });
  }
  const location = getLocationById(feedback.locationId);
  res.json({ feedback, location });
});

router.post('/feedbacks', (req, res) => {
  const { locationName, lat, lng, address, street, district, ...feedbackData } = req.body;
  
  if (!locationName && (!lat || !lng)) {
    return res.status(400).json({ error: '必须提供位置名称或经纬度' });
  }

  const { location } = findOrCreateLocation(
    locationName || address || '未知位置',
    lat || 31.2304,
    lng || 121.4737,
    address,
    street,
    district
  );

  const feedback = createFeedback({
    ...feedbackData,
    locationId: location.id,
    content: feedbackData.content || feedbackData.rawContent,
    rawContent: feedbackData.rawContent || feedbackData.content,
    feedbackDate: feedbackData.feedbackDate || new Date().toISOString().split('T')[0],
    source: feedbackData.source || '居民反馈'
  });

  const conflicts = checkAndCreateConflicts(feedback.id);

  res.json({ feedback, location, conflicts });
});

router.post('/feedbacks/batch', (req, res, next) => {
  const contentType = req.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    next();
  } else {
    upload.single('file')(req, res, next);
  }
}, async (req, res) => {
  let feedbacks: any[] = [];
  
  if (req.body.feedbacks && Array.isArray(req.body.feedbacks)) {
    feedbacks = req.body.feedbacks;
  } else if (req.file) {
    try {
      const content = await import('fs').then(fs => 
        fs.promises.readFile(req.file!.path, 'utf-8')
      );
      feedbacks = JSON.parse(content);
    } catch (e) {
      return res.status(400).json({ error: '文件解析失败' });
    }
  } else {
    return res.status(400).json({ error: '请提供反馈数据或上传文件' });
  }

  const result = bulkImportFeedbacks(feedbacks, findOrCreateLocation);
  res.json(result);
});

router.put('/feedbacks/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const updated = updateFeedback(id, req.body);
  if (!updated) {
    return res.status(404).json({ error: '反馈不存在' });
  }
  res.json(updated);
});

router.delete('/feedbacks/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const deleted = deleteFeedback(id);
  if (!deleted) {
    return res.status(404).json({ error: '反馈不存在' });
  }
  res.json({ success: true });
});

router.get('/plans', (req, res) => {
  const { status, locationId } = req.query;
  const filters: any = {};
  if (status) filters.status = status as string;
  if (locationId) filters.locationId = parseInt(locationId as string);
  
  const plans = getAllPlans(filters);
  const result = plans.map(plan => ({
    ...plan,
    location: getLocationById(plan.locationId)
  }));
  res.json(result);
});

router.get('/plans/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const plan = getPlanById(id);
  if (!plan) {
    return res.status(404).json({ error: '方案不存在' });
  }
  const location = getLocationById(plan.locationId);
  const reports = getReportsByPlan(id);
  res.json({ plan, location, reports });
});

router.post('/plans', (req, res) => {
  try {
    const plan = createPlanVersion({
      ...req.body,
      createdBy: req.body.createdBy || '系统'
    });
    res.json(plan);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/plans/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const updated = updatePlan(id, req.body);
  if (!updated) {
    return res.status(404).json({ error: '方案不存在' });
  }
  res.json(updated);
});

router.post('/plans/:id/report', (req, res) => {
  const id = parseInt(req.params.id);
  const { generatedBy, customContent } = req.body;
  try {
    const report = createReportFromPlan(id, generatedBy || '系统', customContent);
    res.json(report);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/reports/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const report = getReportById(id);
  if (!report) {
    return res.status(404).json({ error: '报告不存在' });
  }
  const plan = getPlanById(report.planVersionId);
  const location = getLocationById(report.locationId);
  res.json({ report, plan, location });
});

router.put('/reports/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const updated = updateReport(id, req.body);
  if (!updated) {
    return res.status(404).json({ error: '报告不存在' });
  }
  res.json(updated);
});

router.get('/conflicts', (req, res) => {
  const { locationId, resolved } = req.query;
  const filters: any = {};
  if (locationId) filters.locationId = parseInt(locationId as string);
  if (resolved !== undefined) filters.resolved = resolved === 'true';
  
  const conflicts = getConflicts(filters);
  const result = conflicts.map(conflict => ({
    ...conflict,
    location: getLocationById(conflict.locationId),
    feedback: conflict.feedbackId ? db.resident_feedbacks.get(conflict.feedbackId) : null
  }));
  res.json(result);
});

router.get('/conflicts/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const detail = getConflictDetail(id);
  if (!detail) {
    return res.status(404).json({ error: '冲突不存在' });
  }
  res.json(detail);
});

router.post('/conflicts/:id/resolve', (req, res) => {
  const id = parseInt(req.params.id);
  const { resolution, resolvedBy, notes } = req.body;
  
  if (!['use_feedback', 'use_existing', 'manual'].includes(resolution)) {
    return res.status(400).json({ error: '无效的解决方式' });
  }

  const resolved = resolveConflict(id, resolution, resolvedBy || '系统', notes);
  if (!resolved) {
    return res.status(404).json({ error: '冲突不存在' });
  }
  res.json(resolved);
});

router.get('/photos', (req, res) => {
  const { locationId } = req.query;
  let photos = db.inspection_photos.all();
  if (locationId) {
    photos = photos.filter((p: any) => p.locationId === parseInt(locationId as string));
  }
  res.json(photos);
});

router.post('/photos', upload.single('photo'), (req, res) => {
  const { locationId, takenBy, notes, takenDate } = req.body;
  const filePath = req.file?.path;
  
  if (!locationId || !filePath) {
    return res.status(400).json({ error: '参数错误' });
  }

  const result = db.inspection_photos.insert({
    locationId: parseInt(locationId),
    filePath,
    fileName: req.file?.originalname,
    takenBy: takenBy || null,
    takenDate: takenDate || new Date().toISOString().split('T')[0],
    notes: notes || null
  });

  const photo = db.inspection_photos.get(result.lastInsertRowid);
  res.json(photo);
});

router.get('/street-notes', (req, res) => {
  const { locationId } = req.query;
  let notes = db.street_notes.all();
  if (locationId) {
    notes = notes.filter((n: any) => n.locationId === parseInt(locationId as string));
  }
  notes.sort((a: any, b: any) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  res.json(notes);
});

router.post('/street-notes', (req, res) => {
  const { locationId, streetName, content, author, source } = req.body;
  
  if (!locationId || !content) {
    return res.status(400).json({ error: '参数错误' });
  }

  const result = db.street_notes.insert({
    locationId: parseInt(locationId),
    streetName: streetName || null,
    content,
    author: author || null,
    source: source || '街道备注'
  });

  const note = db.street_notes.get(result.lastInsertRowid);
  res.json(note);
});

export default router;

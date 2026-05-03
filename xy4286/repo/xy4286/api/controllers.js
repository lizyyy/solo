const fs = require('fs');
const path = require('path');
const moment = require('moment');
const repositories = require('../repositories');
const models = require('../models');
const { Importer, Exporter } = require('../import_export');
const { RuleEngine } = require('../rules');
const { AUDIT_ACTIONS, ENTITY_TYPES } = require('../models/auditEvent');

const batchRepo = new repositories.BatchRepository();
const boxRepo = new repositories.BoxRepository();
const stationRepo = new repositories.StationRepository();
const personRepo = new repositories.ResponsiblePersonRepository();
const riskEventRepo = new repositories.RiskEventRepository();
const auditEventRepo = new repositories.AuditEventRepository();
const reviewRepo = new repositories.ReviewRepository();
const handoverFormRepo = new repositories.HandoverFormRepository();

const importer = new Importer();
const exporter = new Exporter();
const ruleEngine = new RuleEngine();

function handleError(res, error, status = 500) {
  console.error('Error:', error);
  res.status(status).json({
    success: false,
    error: error.message || 'Internal server error'
  });
}

function createAuditEvent(action, entityType, entityId, details = {}) {
  const audit = new models.AuditEvent({
    action,
    entityType,
    entityId,
    details
  });
  return auditEventRepo.create(audit);
}

async function importTemperatureCSV(req, res) {
  try {
    const { file } = req;
    const { boxId } = req.body;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: '请选择要上传的文件'
      });
    }

    if (!boxId) {
      return res.status(400).json({
        success: false,
        error: '请提供箱体ID'
      });
    }

    const result = await importer.importTemperatureCSV(file.path, boxId);

    fs.unlinkSync(file.path);

    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
}

async function importTrajectoryJSON(req, res) {
  try {
    const { file } = req;
    const { batchId, boxId } = req.body;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: '请选择要上传的文件'
      });
    }

    const result = importer.importVehicleTrajectoryJSON(file.path, batchId, boxId);

    fs.unlinkSync(file.path);

    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
}

function importHandoverForm(req, res) {
  try {
    const { body } = req;
    
    const result = importer.importHandoverForm(body);
    
    if (result.success) {
      createAuditEvent(
        AUDIT_ACTIONS.CREATE,
        ENTITY_TYPES.HANDOVER_FORM,
        result.handoverForm.id,
        { source: 'api_import' }
      );
    }

    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
}

function getRisks(req, res) {
  try {
    const { status, type, batchId, severity } = req.query;
    let risks = riskEventRepo.findAll();

    if (status) {
      risks = risks.filter(r => r.status === status);
    }
    if (type) {
      risks = risks.filter(r => r.type === type);
    }
    if (batchId) {
      risks = risks.filter(r => r.batchId === batchId);
    }
    if (severity) {
      risks = risks.filter(r => r.severity === severity);
    }

    res.json({
      success: true,
      count: risks.length,
      risks: risks.map(r => r.toJSON())
    });
  } catch (error) {
    handleError(res, error);
  }
}

function getRiskSummary(req, res) {
  try {
    const { batchId } = req.query;
    const summary = ruleEngine.getRiskSummary(batchId);

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    handleError(res, error);
  }
}

function getRiskById(req, res) {
  try {
    const { id } = req.params;
    const risk = riskEventRepo.findById(id);

    if (!risk) {
      return res.status(404).json({
        success: false,
        error: '风险事件不存在'
      });
    }

    res.json({
      success: true,
      risk: risk.toJSON()
    });
  } catch (error) {
    handleError(res, error);
  }
}

function resolveRisk(req, res) {
  try {
    const { id } = req.params;
    const { notes, status = 'resolved' } = req.body;

    const risk = riskEventRepo.findById(id);

    if (!risk) {
      return res.status(404).json({
        success: false,
        error: '风险事件不存在'
      });
    }

    risk.updateStatus(status, notes);
    const updated = riskEventRepo.update(risk);

    createAuditEvent(
      AUDIT_ACTIONS.RESOLVE_RISK,
      ENTITY_TYPES.RISK_EVENT,
      risk.id,
      { status, notes }
    );

    res.json({
      success: true,
      risk: updated.toJSON()
    });
  } catch (error) {
    handleError(res, error);
  }
}

function createReview(req, res) {
  try {
    const { body } = req;
    
    const review = new models.Review({
      riskEventId: body.riskEventId,
      batchId: body.batchId,
      boxId: body.boxId,
      type: body.type,
      submittedBy: body.submittedBy,
      submittedByName: body.submittedByName,
      title: body.title,
      description: body.description,
      evidence: body.evidence || [],
      correctionData: body.correctionData || {}
    });

    const saved = reviewRepo.create(review);

    createAuditEvent(
      AUDIT_ACTIONS.REVIEW,
      ENTITY_TYPES.REVIEW,
      saved.id,
      { riskEventId: body.riskEventId }
    );

    res.json({
      success: true,
      review: saved.toJSON()
    });
  } catch (error) {
    handleError(res, error);
  }
}

function getReviews(req, res) {
  try {
    const { status, riskEventId, batchId } = req.query;
    let reviews = reviewRepo.findAll();

    if (status) {
      reviews = reviews.filter(r => r.status === status);
    }
    if (riskEventId) {
      reviews = reviews.filter(r => r.riskEventId === riskEventId);
    }
    if (batchId) {
      reviews = reviews.filter(r => r.batchId === batchId);
    }

    res.json({
      success: true,
      count: reviews.length,
      reviews: reviews.map(r => r.toJSON())
    });
  } catch (error) {
    handleError(res, error);
  }
}

function getReviewById(req, res) {
  try {
    const { id } = req.params;
    const review = reviewRepo.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        error: '复核记录不存在'
      });
    }

    res.json({
      success: true,
      review: review.toJSON()
    });
  } catch (error) {
    handleError(res, error);
  }
}

function approveReview(req, res) {
  try {
    const { id } = req.params;
    const { notes, reviewerId, reviewerName } = req.body;

    const review = reviewRepo.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        error: '复核记录不存在'
      });
    }

    review.approve(notes, reviewerId);
    if (reviewerName) {
      review.reviewerName = reviewerName;
    }
    const updated = reviewRepo.update(review);

    createAuditEvent(
      AUDIT_ACTIONS.REVIEW,
      ENTITY_TYPES.REVIEW,
      review.id,
      { action: 'approve', notes }
    );

    res.json({
      success: true,
      review: updated.toJSON()
    });
  } catch (error) {
    handleError(res, error);
  }
}

function rejectReview(req, res) {
  try {
    const { id } = req.params;
    const { notes, reviewerId, reviewerName } = req.body;

    const review = reviewRepo.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        error: '复核记录不存在'
      });
    }

    review.reject(notes, reviewerId);
    if (reviewerName) {
      review.reviewerName = reviewerName;
    }
    const updated = reviewRepo.update(review);

    createAuditEvent(
      AUDIT_ACTIONS.REVIEW,
      ENTITY_TYPES.REVIEW,
      review.id,
      { action: 'reject', notes }
    );

    res.json({
      success: true,
      review: updated.toJSON()
    });
  } catch (error) {
    handleError(res, error);
  }
}

function getAuditEvents(req, res) {
  try {
    const { entityType, entityId, action, limit = 100 } = req.query;
    let events = auditEventRepo.findAll();

    if (entityType) {
      events = events.filter(e => e.entityType === entityType);
    }
    if (entityId) {
      events = events.filter(e => e.entityId === entityId);
    }
    if (action) {
      events = events.filter(e => e.action === action);
    }

    events = events.slice(0, parseInt(limit));

    res.json({
      success: true,
      count: events.length,
      events: events.map(e => e.toJSON())
    });
  } catch (error) {
    handleError(res, error);
  }
}

function exportJSON(req, res) {
  try {
    const { batchId } = req.query;
    const result = exporter.exportToJSON(batchId);

    createAuditEvent(
      AUDIT_ACTIONS.EXPORT,
      ENTITY_TYPES.REPORT,
      null,
      { format: 'json', batchId }
    );

    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
}

async function exportCSV(req, res) {
  try {
    const { batchId } = req.query;
    const result = await exporter.exportToCSV(batchId);

    createAuditEvent(
      AUDIT_ACTIONS.EXPORT,
      ENTITY_TYPES.REPORT,
      null,
      { format: 'csv', batchId }
    );

    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
}

function exportMarkdown(req, res) {
  try {
    const { batchId } = req.query;
    const result = exporter.exportToMarkdown(batchId);

    createAuditEvent(
      AUDIT_ACTIONS.EXPORT,
      ENTITY_TYPES.REPORT,
      null,
      { format: 'markdown', batchId }
    );

    res.set('Content-Type', 'text/markdown');
    res.send(result.content);
  } catch (error) {
    handleError(res, error);
  }
}

function getBatches(req, res) {
  try {
    const { state, hasRisk } = req.query;
    let batches = batchRepo.findAll();

    if (state) {
      batches = batches.filter(b => b.currentState === state);
    }
    if (hasRisk === 'true') {
      batches = batches.filter(b => b.hasAnyRisk());
    } else if (hasRisk === 'false') {
      batches = batches.filter(b => !b.hasAnyRisk());
    }

    res.json({
      success: true,
      count: batches.length,
      batches: batches.map(b => b.toJSON())
    });
  } catch (error) {
    handleError(res, error);
  }
}

function getBatchById(req, res) {
  try {
    const { id } = req.params;
    const batch = batchRepo.findById(id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: '批次不存在'
      });
    }

    res.json({
      success: true,
      batch: batch.toJSON()
    });
  } catch (error) {
    handleError(res, error);
  }
}

function createBatch(req, res) {
  try {
    const { body } = req;
    
    const batch = new models.Batch({
      batchNumber: body.batchNumber,
      vaccineName: body.vaccineName,
      quantity: body.quantity,
      manufacturer: body.manufacturer,
      expiryDate: body.expiryDate,
      boxId: body.boxId,
      originStationId: body.originStationId,
      destinationStationId: body.destinationStationId,
      scheduledDepartureTime: body.scheduledDepartureTime,
      scheduledArrivalTime: body.scheduledArrivalTime,
      actualDepartureTime: body.actualDepartureTime,
      actualArrivalTime: body.actualArrivalTime
    });

    const saved = batchRepo.create(batch);

    createAuditEvent(
      AUDIT_ACTIONS.CREATE,
      ENTITY_TYPES.BATCH,
      saved.id,
      { batchNumber: saved.batchNumber }
    );

    res.json({
      success: true,
      batch: saved.toJSON()
    });
  } catch (error) {
    handleError(res, error);
  }
}

function updateBatch(req, res) {
  try {
    const { id } = req.params;
    const { body } = req;

    const batch = batchRepo.findById(id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: '批次不存在'
      });
    }

    const oldValue = batch.toJSON();

    Object.keys(body).forEach(key => {
      if (batch.hasOwnProperty(key) && body[key] !== undefined) {
        batch[key] = body[key];
      }
    });

    const updated = batchRepo.update(batch);

    createAuditEvent(
      AUDIT_ACTIONS.UPDATE,
      ENTITY_TYPES.BATCH,
      batch.id,
      { oldValue, newValue: updated.toJSON() }
    );

    res.json({
      success: true,
      batch: updated.toJSON()
    });
  } catch (error) {
    handleError(res, error);
  }
}

async function runRulesForBatches(req, res) {
  try {
    const { batchId } = req.body;
    
    const result = await ruleEngine.runAllRules(batchId);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    handleError(res, error);
  }
}

function getBoxes(req, res) {
  try {
    const { state } = req.query;
    let boxes = boxRepo.findAll();

    if (state) {
      boxes = boxes.filter(b => b.currentState === state);
    }

    res.json({
      success: true,
      count: boxes.length,
      boxes: boxes.map(b => b.toJSON())
    });
  } catch (error) {
    handleError(res, error);
  }
}

function getBoxById(req, res) {
  try {
    const { id } = req.params;
    const box = boxRepo.findById(id);

    if (!box) {
      return res.status(404).json({
        success: false,
        error: '箱体不存在'
      });
    }

    res.json({
      success: true,
      box: box.toJSON()
    });
  } catch (error) {
    handleError(res, error);
  }
}

function createBox(req, res) {
  try {
    const { body } = req;
    
    const box = new models.Box({
      name: body.name,
      serialNumber: body.serialNumber,
      capacity: body.capacity
    });

    const saved = boxRepo.create(box);

    createAuditEvent(
      AUDIT_ACTIONS.CREATE,
      ENTITY_TYPES.BOX,
      saved.id,
      { name: saved.name }
    );

    res.json({
      success: true,
      box: saved.toJSON()
    });
  } catch (error) {
    handleError(res, error);
  }
}

function updateBox(req, res) {
  try {
    const { id } = req.params;
    const { body } = req;

    const box = boxRepo.findById(id);

    if (!box) {
      return res.status(404).json({
        success: false,
        error: '箱体不存在'
      });
    }

    Object.keys(body).forEach(key => {
      if (box.hasOwnProperty(key) && body[key] !== undefined) {
        box[key] = body[key];
      }
    });

    const updated = boxRepo.update(box);

    createAuditEvent(
      AUDIT_ACTIONS.UPDATE,
      ENTITY_TYPES.BOX,
      box.id,
      {}
    );

    res.json({
      success: true,
      box: updated.toJSON()
    });
  } catch (error) {
    handleError(res, error);
  }
}

function getStations(req, res) {
  try {
    const stations = stationRepo.findAll();

    res.json({
      success: true,
      count: stations.length,
      stations: stations.map(s => s.toJSON())
    });
  } catch (error) {
    handleError(res, error);
  }
}

function getStationById(req, res) {
  try {
    const { id } = req.params;
    const station = stationRepo.findById(id);

    if (!station) {
      return res.status(404).json({
        success: false,
        error: '站点不存在'
      });
    }

    res.json({
      success: true,
      station: station.toJSON()
    });
  } catch (error) {
    handleError(res, error);
  }
}

function createStation(req, res) {
  try {
    const { body } = req;
    
    const station = new models.Station({
      name: body.name,
      address: body.address,
      contactPerson: body.contactPerson,
      contactPhone: body.contactPhone,
      latitude: body.latitude,
      longitude: body.longitude,
      notes: body.notes
    });

    const saved = stationRepo.create(station);

    createAuditEvent(
      AUDIT_ACTIONS.CREATE,
      ENTITY_TYPES.STATION,
      saved.id,
      { name: saved.name }
    );

    res.json({
      success: true,
      station: saved.toJSON()
    });
  } catch (error) {
    handleError(res, error);
  }
}

function updateStation(req, res) {
  try {
    const { id } = req.params;
    const { body } = req;

    const station = stationRepo.findById(id);

    if (!station) {
      return res.status(404).json({
        success: false,
        error: '站点不存在'
      });
    }

    Object.keys(body).forEach(key => {
      if (station.hasOwnProperty(key) && body[key] !== undefined) {
        station[key] = body[key];
      }
    });

    const updated = stationRepo.update(station);

    createAuditEvent(
      AUDIT_ACTIONS.UPDATE,
      ENTITY_TYPES.STATION,
      station.id,
      {}
    );

    res.json({
      success: true,
      station: updated.toJSON()
    });
  } catch (error) {
    handleError(res, error);
  }
}

function getPersons(req, res) {
  try {
    const persons = personRepo.findAll();

    res.json({
      success: true,
      count: persons.length,
      persons: persons.map(p => p.toJSON())
    });
  } catch (error) {
    handleError(res, error);
  }
}

function getPersonById(req, res) {
  try {
    const { id } = req.params;
    const person = personRepo.findById(id);

    if (!person) {
      return res.status(404).json({
        success: false,
        error: '责任人不存在'
      });
    }

    res.json({
      success: true,
      person: person.toJSON()
    });
  } catch (error) {
    handleError(res, error);
  }
}

function createPerson(req, res) {
  try {
    const { body } = req;
    
    const person = new models.ResponsiblePerson({
      name: body.name,
      employeeId: body.employeeId,
      role: body.role,
      department: body.department,
      phone: body.phone,
      email: body.email
    });

    const saved = personRepo.create(person);

    createAuditEvent(
      AUDIT_ACTIONS.CREATE,
      ENTITY_TYPES.RESPONSIBLE_PERSON,
      saved.id,
      { name: saved.name }
    );

    res.json({
      success: true,
      person: saved.toJSON()
    });
  } catch (error) {
    handleError(res, error);
  }
}

function updatePerson(req, res) {
  try {
    const { id } = req.params;
    const { body } = req;

    const person = personRepo.findById(id);

    if (!person) {
      return res.status(404).json({
        success: false,
        error: '责任人不存在'
      });
    }

    Object.keys(body).forEach(key => {
      if (person.hasOwnProperty(key) && body[key] !== undefined) {
        person[key] = body[key];
      }
    });

    const updated = personRepo.update(person);

    createAuditEvent(
      AUDIT_ACTIONS.UPDATE,
      ENTITY_TYPES.RESPONSIBLE_PERSON,
      person.id,
      {}
    );

    res.json({
      success: true,
      person: updated.toJSON()
    });
  } catch (error) {
    handleError(res, error);
  }
}

function getHandoverForms(req, res) {
  try {
    const { batchId, state } = req.query;
    let forms = handoverFormRepo.findAll();

    if (batchId) {
      forms = forms.filter(f => f.batchId === batchId);
    }
    if (state) {
      forms = forms.filter(f => f.currentState === state);
    }

    res.json({
      success: true,
      count: forms.length,
      forms: forms.map(f => f.toJSON())
    });
  } catch (error) {
    handleError(res, error);
  }
}

function getHandoverFormById(req, res) {
  try {
    const { id } = req.params;
    const form = handoverFormRepo.findById(id);

    if (!form) {
      return res.status(404).json({
        success: false,
        error: '交接单不存在'
      });
    }

    res.json({
      success: true,
      form: form.toJSON()
    });
  } catch (error) {
    handleError(res, error);
  }
}

function signHandoverFormSender(req, res) {
  try {
    const { id } = req.params;
    const { signatureId, personId } = req.body;

    const form = handoverFormRepo.findById(id);

    if (!form) {
      return res.status(404).json({
        success: false,
        error: '交接单不存在'
      });
    }

    form.signSender(signatureId || `sig_${Date.now()}`, personId);
    const updated = handoverFormRepo.update(form);

    createAuditEvent(
      AUDIT_ACTIONS.SIGN_HANDOVER,
      ENTITY_TYPES.HANDOVER_FORM,
      form.id,
      { role: 'sender', personId }
    );

    res.json({
      success: true,
      form: updated.toJSON()
    });
  } catch (error) {
    handleError(res, error);
  }
}

function signHandoverFormReceiver(req, res) {
  try {
    const { id } = req.params;
    const { signatureId, personId } = req.body;

    const form = handoverFormRepo.findById(id);

    if (!form) {
      return res.status(404).json({
        success: false,
        error: '交接单不存在'
      });
    }

    form.signReceiver(signatureId || `sig_${Date.now()}`, personId);
    const updated = handoverFormRepo.update(form);

    createAuditEvent(
      AUDIT_ACTIONS.SIGN_HANDOVER,
      ENTITY_TYPES.HANDOVER_FORM,
      form.id,
      { role: 'receiver', personId }
    );

    res.json({
      success: true,
      form: updated.toJSON()
    });
  } catch (error) {
    handleError(res, error);
  }
}

module.exports = {
  importTemperatureCSV,
  importTrajectoryJSON,
  importHandoverForm,
  getRisks,
  getRiskSummary,
  getRiskById,
  resolveRisk,
  createReview,
  getReviews,
  getReviewById,
  approveReview,
  rejectReview,
  getAuditEvents,
  exportJSON,
  exportCSV,
  exportMarkdown,
  getBatches,
  getBatchById,
  createBatch,
  updateBatch,
  runRulesForBatches,
  getBoxes,
  getBoxById,
  createBox,
  updateBox,
  getStations,
  getStationById,
  createStation,
  updateStation,
  getPersons,
  getPersonById,
  createPerson,
  updatePerson,
  getHandoverForms,
  getHandoverFormById,
  signHandoverFormSender,
  signHandoverFormReceiver
};

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Plugin, Batch, Sample, Run, Review } = require('./models');
const pluginLoader = require('./services/pluginLoader');
const batchRunner = require('./services/batchRunner');
const exportService = require('./services/export');
const schemaValidator = require('./services/schemaValidator');
const { pluginsDir, samplesDir } = require('./database');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const uploadStorage = multer.memoryStorage();
const upload = multer({ 
  storage: uploadStorage,
  limits: { fileSize: 100 * 1024 * 1024 }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/plugins', (req, res) => {
  try {
    const plugins = Plugin.findAll();
    res.json(plugins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/plugins/:id', (req, res) => {
  try {
    const plugin = Plugin.findById(req.params.id);
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }
    res.json(plugin);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/plugins', upload.fields([
  { name: 'manifest', maxCount: 1 },
  { name: 'wasm', maxCount: 1 }
]), async (req, res) => {
  try {
    const manifestFile = req.files?.manifest?.[0];
    const wasmFile = req.files?.wasm?.[0];

    if (!manifestFile || !wasmFile) {
      return res.status(400).json({ error: 'Both manifest.json and .wasm file are required' });
    }

    let manifest;
    try {
      manifest = JSON.parse(manifestFile.buffer.toString('utf-8'));
    } catch (error) {
      return res.status(400).json({ error: 'Invalid manifest.json format' });
    }

    const manifestValidation = schemaValidator.validateManifest(manifest);
    if (!manifestValidation.valid) {
      return res.status(400).json({ 
        error: 'Manifest validation failed',
        errors: manifestValidation.errors
      });
    }

    const existingPlugin = Plugin.findByNameAndVersion(manifest.name, manifest.version);
    if (existingPlugin) {
      return res.status(409).json({ 
        error: `Plugin ${manifest.name} v${manifest.version} already exists`,
        pluginId: existingPlugin.id
      });
    }

    const tempManifestPath = path.join(pluginsDir, `temp-manifest-${Date.now()}.json`);
    const tempWasmPath = path.join(pluginsDir, `temp-wasm-${Date.now()}.wasm`);
    
    fs.writeFileSync(tempManifestPath, JSON.stringify(manifest, null, 2));
    fs.writeFileSync(tempWasmPath, wasmFile.buffer);

    try {
      const installedPlugins = Plugin.findAll();
      const validation = pluginLoader.fullValidation(
        tempManifestPath,
        tempWasmPath,
        installedPlugins,
        ['read:local']
      );

      if (!validation.overall.valid) {
        fs.unlinkSync(tempManifestPath);
        fs.unlinkSync(tempWasmPath);
        return res.status(400).json({
          error: 'Plugin validation failed',
          validation: validation
        });
      }

      const savedFiles = pluginLoader.savePluginFiles(
        manifest,
        wasmFile.buffer,
        manifest.name,
        manifest.version
      );

      fs.unlinkSync(tempManifestPath);
      fs.unlinkSync(tempWasmPath);

      const inputSchema = manifest.input_schema || null;
      const outputSchema = manifest.output_schema || null;
      const errorCodes = manifest.error_codes || null;

      const plugin = Plugin.create({
        name: manifest.name,
        version: manifest.version,
        vendor: manifest.vendor,
        description: manifest.description,
        manifest: manifest,
        wasm_path: savedFiles.wasmPath,
        input_schema: inputSchema,
        output_schema: outputSchema,
        error_codes: errorCodes,
        max_memory_mb: manifest.max_memory_mb || 64,
        max_timeout_ms: manifest.max_timeout_ms || 5000,
        performance_threshold_ms: manifest.performance_threshold_ms || 1000
      });

      res.status(201).json({
        plugin,
        validation: validation,
        message: 'Plugin imported successfully'
      });

    } catch (error) {
      if (fs.existsSync(tempManifestPath)) fs.unlinkSync(tempManifestPath);
      if (fs.existsSync(tempWasmPath)) fs.unlinkSync(tempWasmPath);
      throw error;
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/plugins/:id', (req, res) => {
  try {
    const plugin = Plugin.findById(req.params.id);
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }

    const batches = Batch.findByPluginId(plugin.id);
    if (batches.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete plugin with existing batches',
        batchCount: batches.length
      });
    }

    try {
      const wasmDir = path.dirname(plugin.wasm_path);
      if (fs.existsSync(wasmDir)) {
        fs.rmSync(wasmDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.warn('Failed to clean up plugin files:', e.message);
    }

    const success = Plugin.delete(req.params.id);
    if (success) {
      res.status(204).send();
    } else {
      res.status(404).json({ error: 'Plugin not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/plugins/validate', upload.fields([
  { name: 'manifest', maxCount: 1 },
  { name: 'wasm', maxCount: 1 }
]), async (req, res) => {
  try {
    const manifestFile = req.files?.manifest?.[0];
    const wasmFile = req.files?.wasm?.[0];

    if (!manifestFile || !wasmFile) {
      return res.status(400).json({ error: 'Both manifest.json and .wasm file are required' });
    }

    let manifest;
    try {
      manifest = JSON.parse(manifestFile.buffer.toString('utf-8'));
    } catch (error) {
      return res.status(400).json({ error: 'Invalid manifest.json format' });
    }

    const tempManifestPath = path.join(pluginsDir, `validate-manifest-${Date.now()}.json`);
    const tempWasmPath = path.join(pluginsDir, `validate-wasm-${Date.now()}.wasm`);
    
    fs.writeFileSync(tempManifestPath, JSON.stringify(manifest, null, 2));
    fs.writeFileSync(tempWasmPath, wasmFile.buffer);

    try {
      const installedPlugins = Plugin.findAll();
      const validation = pluginLoader.fullValidation(
        tempManifestPath,
        tempWasmPath,
        installedPlugins,
        ['read:local']
      );

      fs.unlinkSync(tempManifestPath);
      fs.unlinkSync(tempWasmPath);

      res.json({
        valid: validation.overall.valid,
        validation,
        manifest
      });

    } catch (error) {
      if (fs.existsSync(tempManifestPath)) fs.unlinkSync(tempManifestPath);
      if (fs.existsSync(tempWasmPath)) fs.unlinkSync(tempWasmPath);
      throw error;
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/batches', (req, res) => {
  try {
    const batches = Batch.findAll();
    res.json(batches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/batches/:id', (req, res) => {
  try {
    const batch = Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    res.json(batch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/batches', (req, res) => {
  try {
    const { plugin_id, name, description } = req.body;
    
    if (!plugin_id || !name) {
      return res.status(400).json({ error: 'plugin_id and name are required' });
    }

    const plugin = Plugin.findById(plugin_id);
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }

    const batch = Batch.create({
      plugin_id,
      name,
      description
    });

    res.status(201).json(batch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/batches/:id', (req, res) => {
  try {
    const { name, description } = req.body;
    const updates = {};
    
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    
    const batch = Batch.update(req.params.id, updates);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    res.json(batch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/batches/:id', (req, res) => {
  try {
    const batch = Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    if (batchRunner.isBatchRunning(req.params.id)) {
      return res.status(400).json({ error: 'Cannot delete running batch' });
    }

    Sample.deleteByBatchId(req.params.id);

    const success = Batch.delete(req.params.id);
    if (success) {
      res.status(204).send();
    } else {
      res.status(404).json({ error: 'Batch not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/batches/:id/samples', (req, res) => {
  try {
    const { input_data, expected_output } = req.body;
    const batchId = req.params.id;

    const batch = Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    if (!input_data) {
      return res.status(400).json({ error: 'input_data is required' });
    }

    const existingSamples = Sample.findAll(batchId);
    const orderIndex = existingSamples.length;

    const sample = Sample.create({
      batch_id: batchId,
      input_data,
      expected_output,
      order_index: orderIndex
    });

    Batch.update(batchId, { sample_count: orderIndex + 1 });

    res.status(201).json(sample);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/batches/:id/samples/batch', (req, res) => {
  try {
    const { samples } = req.body;
    const batchId = req.params.id;

    if (!samples || !Array.isArray(samples)) {
      return res.status(400).json({ error: 'samples array is required' });
    }

    const batch = Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const existingSamples = Sample.findAll(batchId);
    let orderIndex = existingSamples.length;
    const createdSamples = [];

    for (const sampleData of samples) {
      if (!sampleData.input_data) continue;

      const sample = Sample.create({
        batch_id: batchId,
        input_data: sampleData.input_data,
        expected_output: sampleData.expected_output,
        order_index: orderIndex++
      });
      createdSamples.push(sample);
    }

    Batch.update(batchId, { sample_count: orderIndex });

    res.status(201).json({
      count: createdSamples.length,
      samples: createdSamples
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/batches/:id/samples', (req, res) => {
  try {
    const samples = Sample.findAll(req.params.id);
    res.json(samples);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/batches/:id/run', async (req, res) => {
  try {
    const batchId = req.params.id;
    const { timeout_ms, max_memory_mb } = req.body;

    const batch = Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    if (batchRunner.isBatchRunning(batchId)) {
      return res.status(400).json({ error: 'Batch is already running' });
    }

    const samples = Sample.findAll(batchId);
    if (samples.length === 0) {
      return res.status(400).json({ error: 'No samples in this batch' });
    }

    res.json({
      message: 'Batch execution started',
      batchId,
      sampleCount: samples.length
    });

    setImmediate(async () => {
      try {
        await batchRunner.runBatch(batchId, {
          timeoutMs: timeout_ms,
          maxMemoryMb: max_memory_mb
        });
      } catch (error) {
        console.error('Batch execution error:', error);
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/batches/:id/progress', (req, res) => {
  try {
    const progress = batchRunner.getBatchProgress(req.params.id);
    if (progress) {
      res.json(progress);
    } else {
      const batch = Batch.findById(req.params.id);
      if (!batch) {
        return res.status(404).json({ error: 'Batch not found' });
      }
      res.json({
        batchId: req.params.id,
        status: batch.status,
        isRunning: false
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/batches/:id/cancel', (req, res) => {
  try {
    const success = batchRunner.cancelBatch(req.params.id);
    if (success) {
      res.json({ message: 'Batch cancelled' });
    } else {
      res.status(404).json({ error: 'Batch not running or not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/batches/:id/runs', (req, res) => {
  try {
    const runs = Run.findAll(req.params.id);
    res.json(runs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/batches/:id/stats', (req, res) => {
  try {
    const stats = Run.getStats(req.params.id);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/runs/:id', (req, res) => {
  try {
    const run = Run.findById(req.params.id);
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    const review = Review.findByRunId(req.params.id);
    res.json({
      ...run,
      review
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/runs/:id/review', (req, res) => {
  try {
    const { reviewer, conclusion, notes } = req.body;
    const runId = req.params.id;

    const run = Run.findById(runId);
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    if (!conclusion) {
      return res.status(400).json({ error: 'conclusion is required' });
    }

    if (!['approved', 'rejected', 'pending'].includes(conclusion)) {
      return res.status(400).json({ error: 'conclusion must be one of: approved, rejected, pending' });
    }

    const existingReview = Review.findByRunId(runId);
    let review;

    if (existingReview) {
      review = Review.update(runId, {
        reviewer,
        conclusion,
        notes
      });
    } else {
      review = Review.create({
        run_id: runId,
        reviewer,
        conclusion,
        notes
      });
    }

    res.json(review);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export/:batchId/markdown', (req, res) => {
  try {
    const batchId = req.params.batchId;
    const markdown = exportService.generateMarkdownReport(batchId);
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=validation-report-${batchId.slice(0, 8)}.md`);
    res.send(markdown);
  } catch (error) {
    if (error.message === 'Batch not found') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.get('/api/export/:batchId/audit', async (req, res) => {
  try {
    const batchId = req.params.batchId;
    const { include_wasm } = req.query;
    
    const auditPackage = await exportService.generateAuditPackage(batchId, {
      includeWasm: include_wasm === 'true'
    });
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${auditPackage.filename}`);
    res.send(auditPackage.buffer);
  } catch (error) {
    if (error.message === 'Batch not found') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.get('/api/running', (req, res) => {
  res.json({
    runningBatches: batchRunner.getRunningBatches(),
    runningExecutions: sandboxExecutor.getActiveExecutions()
  });
});

app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(error.statusCode || 500).json({ 
    error: error.message || 'Internal server error' 
  });
});

module.exports = app;

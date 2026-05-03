import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { storageService } from '../services/storage.js';
import { auditService } from '../services/auditService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const flags = await storageService.getFlags();
    res.json(flags);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const flags = await storageService.getFlags();
    const flag = flags.find(f => f.id === req.params.id);
    
    if (!flag) {
      return res.status(404).json({ error: 'Flag not found' });
    }
    
    res.json(flag);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const flags = await storageService.getFlags();
    
    const existingFlag = flags.find(f => f.key === req.body.key);
    if (existingFlag) {
      return res.status(400).json({ error: 'Flag key already exists' });
    }
    
    const newFlag = {
      id: uuidv4(),
      key: req.body.key,
      name: req.body.name,
      description: req.body.description,
      enabled: req.body.enabled ?? true,
      killSwitch: req.body.killSwitch ?? false,
      segments: req.body.segments || [],
      percentage: req.body.percentage !== undefined ? Number(req.body.percentage) : null,
      dependsOn: req.body.dependsOn || [],
      createdAt: new Date().toISOString()
    };
    
    flags.push(newFlag);
    await storageService.saveFlags(flags);
    
    await auditService.logCreate(
      'FLAG',
      newFlag,
      `创建 Flag: ${newFlag.name} (${newFlag.key})`
    );
    
    res.status(201).json(newFlag);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const flags = await storageService.getFlags();
    const index = flags.findIndex(f => f.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Flag not found' });
    }
    
    const oldValue = { ...flags[index] };
    
    const updatedFlag = {
      ...flags[index],
      key: req.body.key ?? flags[index].key,
      name: req.body.name ?? flags[index].name,
      description: req.body.description ?? flags[index].description,
      enabled: req.body.enabled !== undefined ? req.body.enabled : flags[index].enabled,
      killSwitch: req.body.killSwitch !== undefined ? req.body.killSwitch : flags[index].killSwitch,
      segments: req.body.segments ?? flags[index].segments,
      percentage: req.body.percentage !== undefined 
        ? Number(req.body.percentage) 
        : flags[index].percentage,
      dependsOn: req.body.dependsOn ?? flags[index].dependsOn,
      updatedAt: new Date().toISOString()
    };
    
    flags[index] = updatedFlag;
    await storageService.saveFlags(flags);
    
    await auditService.logUpdate(
      'FLAG',
      req.params.id,
      oldValue,
      updatedFlag,
      `更新 Flag: ${updatedFlag.name} (${updatedFlag.key})`
    );
    
    res.json(updatedFlag);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const flags = await storageService.getFlags();
    const index = flags.findIndex(f => f.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Flag not found' });
    }
    
    const deletedFlag = flags.splice(index, 1)[0];
    await storageService.saveFlags(flags);
    
    await auditService.logDelete(
      'FLAG',
      req.params.id,
      deletedFlag,
      `删除 Flag: ${deletedFlag.name} (${deletedFlag.key})`
    );
    
    res.json({ success: true, deleted: deletedFlag });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/toggle', async (req, res) => {
  try {
    const flags = await storageService.getFlags();
    const index = flags.findIndex(f => f.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Flag not found' });
    }
    
    const oldValue = { ...flags[index] };
    flags[index].enabled = !flags[index].enabled;
    flags[index].updatedAt = new Date().toISOString();
    
    await storageService.saveFlags(flags);
    
    await auditService.logUpdate(
      'FLAG',
      req.params.id,
      oldValue,
      flags[index],
      `切换 Flag 状态: ${flags[index].name} (${flags[index].key}) -> ${flags[index].enabled ? '开启' : '关闭'}`
    );
    
    res.json(flags[index]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/kill-switch', async (req, res) => {
  try {
    const flags = await storageService.getFlags();
    const index = flags.findIndex(f => f.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Flag not found' });
    }
    
    const oldValue = { ...flags[index] };
    flags[index].killSwitch = !flags[index].killSwitch;
    flags[index].updatedAt = new Date().toISOString();
    
    await storageService.saveFlags(flags);
    
    await auditService.logUpdate(
      'FLAG',
      req.params.id,
      oldValue,
      flags[index],
      `切换 Kill Switch: ${flags[index].name} (${flags[index].key}) -> ${flags[index].killSwitch ? '启用' : '禁用'}`
    );
    
    res.json(flags[index]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

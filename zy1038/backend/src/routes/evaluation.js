import { Router } from 'express';
import { storageService } from '../services/storage.js';
import { evaluationEngine } from '../services/evaluationEngine.js';
import { hashService } from '../services/hashService.js';

const router = Router();

router.post('/user/:userId', async (req, res) => {
  try {
    const [users, flags, segments] = await Promise.all([
      storageService.getUsers(),
      storageService.getFlags(),
      storageService.getSegments()
    ]);

    const user = users.find(u => u.id === req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const results = evaluationEngine.evaluateAllFlagsForUser(user, flags, segments);
    
    res.json({
      user,
      evaluations: results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/user-by-id', async (req, res) => {
  try {
    const { userId, userData } = req.body;
    
    if (!userId && !userData) {
      return res.status(400).json({ error: 'userId or userData is required' });
    }

    let user;
    
    if (userData) {
      user = {
        id: userData.id || userId || 'temp-user',
        name: userData.name || 'Temporary User',
        email: userData.email || '',
        region: userData.region,
        accountType: userData.accountType,
        tags: userData.tags || [],
        registerDays: Number(userData.registerDays) || 0
      };
    } else {
      const users = await storageService.getUsers();
      user = users.find(u => u.id === userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
    }

    const [flags, segments] = await Promise.all([
      storageService.getFlags(),
      storageService.getSegments()
    ]);

    const results = evaluationEngine.evaluateAllFlagsForUser(user, flags, segments);
    
    res.json({
      user,
      evaluations: results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/batch', async (req, res) => {
  try {
    const { userIds, includeAnalysis = true } = req.body;
    
    const [users, flags, segments] = await Promise.all([
      storageService.getUsers(),
      storageService.getFlags(),
      storageService.getSegments()
    ]);

    let targetUsers;
    if (userIds && userIds.length > 0) {
      targetUsers = users.filter(u => userIds.includes(u.id));
    } else {
      targetUsers = users;
    }

    const batchResults = evaluationEngine.evaluateBatch(targetUsers, flags, segments);
    
    let analysis = null;
    if (includeAnalysis) {
      analysis = evaluationEngine.analyzeBatchResults(batchResults, flags);
    }

    res.json({
      results: batchResults,
      analysis,
      totalUsers: targetUsers.length,
      totalFlags: flags.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/check-segment', async (req, res) => {
  try {
    const { userId, segmentId } = req.body;
    
    if (!userId || !segmentId) {
      return res.status(400).json({ error: 'userId and segmentId are required' });
    }

    const [users, segments] = await Promise.all([
      storageService.getUsers(),
      storageService.getSegments()
    ]);

    const user = users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const segment = segments.find(s => s.id === segmentId);
    if (!segment) {
      return res.status(404).json({ error: 'Segment not found' });
    }

    const result = evaluationEngine.evaluateUserInSegment(user, segment);
    
    res.json({
      user,
      segment,
      result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/hash/:userId/:flagKey', async (req, res) => {
  try {
    const { userId, flagKey } = req.params;
    
    const bucket = hashService.getBucket(userId, flagKey);
    
    res.json({
      userId,
      flagKey,
      bucket,
      percentage: bucket
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/hash/batch', async (req, res) => {
  try {
    const { userIds, flagKeys } = req.body;
    
    if (!userIds || !flagKeys) {
      return res.status(400).json({ error: 'userIds and flagKeys are required' });
    }

    const results = [];
    
    for (const userId of userIds) {
      const userResult = {
        userId,
        flags: []
      };
      
      for (const flagKey of flagKeys) {
        const bucket = hashService.getBucket(userId, flagKey);
        userResult.flags.push({
          flagKey,
          bucket
        });
      }
      
      results.push(userResult);
    }
    
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

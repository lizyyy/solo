import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Contract } from '../entities/Contract';
import { ReplayHistory } from '../entities/ReplayHistory';
import { MatchService } from '../services/MatchService';

const router = Router();
const contractRepository = AppDataSource.getRepository(Contract);
const historyRepository = AppDataSource.getRepository(ReplayHistory);

router.all('/*', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const requestPath = req.path.replace(/^\/api\/replay/, '');
  const requestMethod = req.method;

  let historyEntry = historyRepository.create({
    requestMethod,
    requestPath,
    requestHeaders: req.headers,
    requestQuery: req.query,
    requestBody: req.body,
    status: 'no_match'
  });

  try {
    const contract = await contractRepository.findOne({
      where: {
        path: requestPath,
        method: requestMethod,
        isActive: true
      },
      relations: ['scenes']
    });

    if (!contract) {
      historyEntry.status = 'no_match';
      historyEntry.failureReason = 'No matching contract found';
      await historyRepository.save(historyEntry);

      return res.status(404).json({
        success: false,
        error: 'No matching contract found',
        requestId: historyEntry.id
      });
    }

    historyEntry.contractId = contract.id;

    const matchedScene = MatchService.matchRequest(contract.scenes, {
      method: requestMethod,
      path: requestPath,
      headers: req.headers,
      query: req.query as Record<string, any>,
      body: req.body
    });

    if (!matchedScene) {
      historyEntry.status = 'no_match';
      historyEntry.failureReason = 'No matching scene found';
      await historyRepository.save(historyEntry);

      return res.status(404).json({
        success: false,
        error: 'No matching scene found',
        requestId: historyEntry.id
      });
    }

    const delay = MatchService.calculateDelay(matchedScene.delayConfig);
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    historyEntry.sceneId = matchedScene.id;
    historyEntry.matchedSceneName = matchedScene.name;
    historyEntry.responseStatusCode = matchedScene.statusCode;
    historyEntry.responseBody = matchedScene.responseBody;
    historyEntry.responseDelay = delay;
    historyEntry.status = matchedScene.statusCode >= 400 ? 'failed' : 'success';

    await historyRepository.save(historyEntry);

    if (matchedScene.headers) {
      Object.entries(matchedScene.headers).forEach(([key, value]) => {
        if (value) res.setHeader(key, value);
      });
    }

    res.status(matchedScene.statusCode).json(matchedScene.responseBody);
  } catch (error) {
    historyEntry.status = 'failed';
    historyEntry.failureReason = (error as Error).message;
    await historyRepository.save(historyEntry);

    res.status(500).json({
      success: false,
      error: (error as Error).message,
      requestId: historyEntry.id
    });
  }
});

export default router;

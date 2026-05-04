import { Router, Request, Response } from 'express';
import { gameService } from '../services/GameService';
import { exportService } from '../services/ExportService';
import {
  CreateGameRequest,
  PerformActionRequest,
  EventChoiceRequest,
  ApiResponse,
  GameError,
  ERROR_CODES,
} from '../types';

const router = Router();

const handleError = (res: Response, error: unknown): void => {
  if (error instanceof GameError) {
    res.status(400).json({
      success: false,
      error: error.message,
      errorCode: error.code,
      details: error.details,
    } as ApiResponse);
    return;
  }

  console.error('Unexpected error:', error);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    errorCode: 'INTERNAL_ERROR',
  } as ApiResponse);
};

router.post('/games', (req: Request, res: Response) => {
  try {
    const { name } = req.body as CreateGameRequest;

    if (!name || name.trim() === '') {
      throw new GameError('游戏名称不能为空', ERROR_CODES.INVALID_REQUEST);
    }

    const game = gameService.createGame(name.trim());

    res.status(201).json({
      success: true,
      data: game,
    } as ApiResponse);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/games/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const game = gameService.getGame(id);

    res.json({
      success: true,
      data: game,
    } as ApiResponse);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/games/:id/action', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { actionId, locationId } = req.body as PerformActionRequest;

    if (!actionId) {
      throw new GameError('行动ID不能为空', ERROR_CODES.INVALID_REQUEST);
    }

    const game = gameService.performAction(id, actionId, locationId);

    res.json({
      success: true,
      data: game,
    } as ApiResponse);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/games/:id/end-turn', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const game = gameService.endTurn(id);

    res.json({
      success: true,
      data: game,
    } as ApiResponse);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/games/:id/event-choice', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { eventId, choiceId } = req.body as EventChoiceRequest;

    if (!eventId || !choiceId) {
      throw new GameError('事件ID和选项ID不能为空', ERROR_CODES.INVALID_REQUEST);
    }

    const game = gameService.handleEventChoice(id, eventId, choiceId);

    res.json({
      success: true,
      data: game,
    } as ApiResponse);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/games/:id/available-actions', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;

    const game = gameService.getGame(id);
    const actions = gameService.getAvailableActions(game, locationId as string | undefined);

    res.json({
      success: true,
      data: actions,
    } as ApiResponse);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/games/:id/export/:format', (req: Request, res: Response) => {
  try {
    const { id, format } = req.params;
    const game = gameService.getGame(id);

    switch (format.toLowerCase()) {
      case 'markdown':
      case 'md':
        const markdown = exportService.exportToMarkdown(game);
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${game.name}-航海日志.md"`
        );
        res.send(markdown);
        break;

      case 'html':
        const html = exportService.exportToHTML(game);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${game.name}-航海日志.html"`
        );
        res.send(html);
        break;

      case 'json':
        const json = exportService.exportToJSON(game);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${game.name}-航海日志.json"`
        );
        res.send(json);
        break;

      default:
        throw new GameError(
          `不支持的导出格式: ${format}。支持的格式: markdown, html, json`,
          ERROR_CODES.INVALID_REQUEST
        );
    }
  } catch (error) {
    handleError(res, error);
  }
});

export default router;

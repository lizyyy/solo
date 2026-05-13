import { Router, Request, Response } from 'express';
import * as routeService from '../services/routeService';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const { search, status } = req.query;
    const routes = routeService.getRoutes({
      search: search as string,
      status: status as string,
    });
    res.json(routes);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const route = routeService.getRouteById(req.params.id);
    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }
    res.json(route);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { operator, ...data } = req.body;
    const route = routeService.createRoute(data, operator);
    res.status(201).json(route);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const { operator, ...data } = req.body;
    const route = routeService.updateRoute(req.params.id, data, operator);
    res.json(route);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/:routeId/stops', (req: Request, res: Response) => {
  try {
    const stops = routeService.getStops(req.params.routeId);
    res.json(stops);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/stops', (req: Request, res: Response) => {
  try {
    const { operator, ...data } = req.body;
    const stop = routeService.createStop(data, operator);
    res.status(201).json(stop);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.put('/stops/:id', (req: Request, res: Response) => {
  try {
    const { operator, ...data } = req.body;
    const stop = routeService.updateStop(req.params.id, data, operator);
    res.json(stop);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

export default router;

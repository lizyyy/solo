import { Router, Request, Response } from 'express';
import { billService } from '../services/bill-service';
import { VersionConflictError } from '../event-store';
import { conflictService } from '../services/conflict-service';
import { Bill, Participant } from '../types';

const router = Router();

const validateBill = (body: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!body.groupId) errors.push('groupId is required');
  if (!body.title) errors.push('title is required');
  if (!body.amount || body.amount <= 0) errors.push('amount must be a positive number');
  if (!body.participants || body.participants.length === 0) {
    errors.push('at least one participant is required');
  } else {
    const totalShare = body.participants.reduce((sum: number, p: Participant) => 
      sum + (p.adjustedShare !== undefined ? p.adjustedShare : p.share), 0
    );
    const totalPaid = body.participants.reduce((sum: number, p: Participant) => 
      sum + p.paid, 0
    );
    
    if (Math.abs(totalShare - body.amount) > 0.01) {
      errors.push(`total share (${totalShare}) does not match bill amount (${body.amount})`);
    }
    if (Math.abs(totalPaid - body.amount) > 0.01) {
      errors.push(`total paid (${totalPaid}) does not match bill amount (${body.amount})`);
    }
  }

  return { valid: errors.length === 0, errors };
};

router.post('/', async (req: Request, res: Response) => {
  try {
    const { valid, errors } = validateBill(req.body);
    if (!valid) {
      return res.status(400).json({ error: 'Invalid bill data', details: errors });
    }

    const userId = req.headers['x-user-id'] as string || 'anonymous';
    const clientId = req.headers['x-client-id'] as string || 'unknown';

    const bill = await billService.createBill(
      req.body,
      userId,
      clientId,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        correlationId: req.headers['x-correlation-id'] as string,
      }
    );

    res.status(201).json(bill);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const billId = req.params.id;
    const expectedVersion = parseInt(req.headers['if-match'] as string || '0', 10);
    
    const userId = req.headers['x-user-id'] as string || 'anonymous';
    const clientId = req.headers['x-client-id'] as string || 'unknown';

    const bill = await billService.updateBill(
      billId,
      req.body,
      userId,
      clientId,
      expectedVersion,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        correlationId: req.headers['x-correlation-id'] as string,
      }
    );

    res.json(bill);
  } catch (error) {
    if (error instanceof VersionConflictError) {
      const pendingConflicts = conflictService.getPendingConflicts(10);
      res.status(409).json({
        error: 'Version conflict',
        expectedVersion: error.expectedVersion,
        actualVersion: error.actualVersion,
        conflicts: pendingConflicts,
      });
    } else {
      res.status(500).json({ error: (error as Error).message });
    }
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const billId = req.params.id;
    const expectedVersion = parseInt(req.headers['if-match'] as string || '0', 10);
    
    const userId = req.headers['x-user-id'] as string || 'anonymous';
    const clientId = req.headers['x-client-id'] as string || 'unknown';

    await billService.deleteBill(
      billId,
      userId,
      clientId,
      expectedVersion,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        correlationId: req.headers['x-correlation-id'] as string,
      }
    );

    res.status(204).send();
  } catch (error) {
    if (error instanceof VersionConflictError) {
      res.status(409).json({
        error: 'Version conflict',
        expectedVersion: error.expectedVersion,
        actualVersion: error.actualVersion,
      });
    } else {
      res.status(500).json({ error: (error as Error).message });
    }
  }
});

router.get('/group/:groupId', async (req: Request, res: Response) => {
  try {
    const bills = billService.getBillsByGroup(req.params.groupId);
    res.json(bills);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const bill = billService.getBillById(req.params.id);
    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }
    res.json(bill);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/group/:groupId/balances', async (req: Request, res: Response) => {
  try {
    const balances = billService.calculateBalances(req.params.groupId);
    const suggestions = billService.calculateSettlementSuggestions(balances);
    
    res.json({
      balances: Object.fromEntries(balances),
      settlementSuggestions: suggestions,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;

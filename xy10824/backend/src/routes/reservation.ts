import express from 'express';
import { Parser } from 'json2csv';
import { StateMachineService } from '../services/StateMachineService';
import { ReservationStatus, ReleaseType } from '../database/schema';

const router = express.Router();
const stateMachineService = new StateMachineService();

router.post('/', async (req, res) => {
  try {
    const { orderId, poolId, quantity, expireSeconds } = req.body;
    if (!orderId || !poolId || !quantity) {
      return res.status(400).json({ error: 'orderId, poolId, and quantity are required' });
    }
    if (typeof quantity !== 'number' || quantity <= 0) {
      return res.status(400).json({ error: 'quantity must be a positive number' });
    }
    if (!Number.isInteger(quantity)) {
      return res.status(400).json({ error: 'quantity must be an integer' });
    }
    if (expireSeconds !== undefined && (typeof expireSeconds !== 'number' || expireSeconds <= 0)) {
      return res.status(400).json({ error: 'expireSeconds must be a positive number' });
    }
    const reservation = await stateMachineService.createReservation({
      orderId,
      poolId,
      quantity,
      expireSeconds,
    });
    res.json(reservation);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, limit = 100, offset = 0 } = req.query;
    const reservations = await stateMachineService.listReservations(
      status as ReservationStatus,
      Number(limit),
      Number(offset)
    );
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const { status } = req.query;
    const reservations = await stateMachineService.listReservations(status as ReservationStatus, 10000, 0);
    
    const fields = [
      'reservation_id',
      'order_id',
      'pool_id',
      'quantity',
      'status',
      'expire_at',
      'created_at',
      'updated_at',
    ];
    const parser = new Parser({ fields });
    const csv = parser.parse(reservations);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=reservations_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const reservations = await stateMachineService.getReservationsByOrder(orderId);
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/:reservationId/confirm', async (req, res) => {
  try {
    const { reservationId } = req.params;
    const reservation = await stateMachineService.confirmReservation(reservationId);
    res.json(reservation);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/:reservationId/release', async (req, res) => {
  try {
    const { reservationId } = req.params;
    const { releaseType = ReleaseType.ORDER_CANCEL, reason, releasedBy = 'api' } = req.body;
    const reservation = await stateMachineService.releaseReservation(
      reservationId,
      releaseType,
      reason,
      releasedBy
    );
    res.json(reservation);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/:reservationId/compensate', async (req, res) => {
  try {
    const { reservationId } = req.params;
    const { operator = 'manual' } = req.body;
    const result = await stateMachineService.manualCompensation(reservationId, operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/:reservationId', async (req, res) => {
  try {
    const { reservationId } = req.params;
    const reservation = await stateMachineService.getReservation(reservationId);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    res.json(reservation);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
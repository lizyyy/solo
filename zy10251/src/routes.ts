import express from 'express';
import { parkingService } from './service';
import {
  CreateAppointmentRequest,
  ApproveAppointmentRequest,
  RejectAppointmentRequest,
  CheckInRequest,
  CheckOutRequest,
  RevokeRequest
} from './types';

export const router = express.Router();

router.use(express.json());

router.post('/appointments', async (req, res) => {
  try {
    const result = await parkingService.createAppointment(req.body as CreateAppointmentRequest);
    if (result.success) {
      res.status(result.duplicate ? 200 : 201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (e) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.get('/appointments', async (req, res) => {
  try {
    const result = await parkingService.getAllAppointments();
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (e) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.get('/appointments/pending', async (req, res) => {
  try {
    const result = await parkingService.getPendingAppointments();
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (e) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.get('/appointments/:id', async (req, res) => {
  try {
    const result = await parkingService.getAppointment(req.params.id);
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (e) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.post('/appointments/:id/approve', async (req, res) => {
  try {
    const result = await parkingService.approveAppointment(req.params.id, req.body as ApproveAppointmentRequest);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (e) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.post('/appointments/:id/reject', async (req, res) => {
  try {
    const result = await parkingService.rejectAppointment(req.params.id, req.body as RejectAppointmentRequest);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (e) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.post('/appointments/:id/checkin', async (req, res) => {
  try {
    const result = await parkingService.checkIn(req.params.id, req.body as CheckInRequest);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (e) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.post('/appointments/:id/checkout', async (req, res) => {
  try {
    const result = await parkingService.checkOut(req.params.id, req.body as CheckOutRequest);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (e) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.post('/appointments/:id/cancel', async (req, res) => {
  try {
    const result = await parkingService.cancelMeeting(req.params.id, req.body as RevokeRequest);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (e) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.get('/appointments/:id/logs', async (req, res) => {
  try {
    const result = await parkingService.getChangeLogs('appointment', req.params.id);
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (e) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.get('/authorizations', async (req, res) => {
  try {
    const result = await parkingService.getAllAuthorizations();
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (e) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.get('/authorizations/overdue', async (req, res) => {
  try {
    const result = await parkingService.getOverdueAuthorizations();
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (e) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.get('/authorizations/:id', async (req, res) => {
  try {
    const result = await parkingService.getAuthorization(req.params.id);
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (e) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.post('/authorizations/:id/revoke', async (req, res) => {
  try {
    const result = await parkingService.revokeAuthorization(req.params.id, req.body as RevokeRequest);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (e) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.get('/authorizations/:id/logs', async (req, res) => {
  try {
    const result = await parkingService.getChangeLogs('authorization', req.params.id);
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (e) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

export default router;

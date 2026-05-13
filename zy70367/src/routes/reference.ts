import { Router } from 'express';
import { referenceService } from '../services/referenceService';

const router = Router();

router.get('/departments', (req, res) => {
  try {
    const departments = referenceService.getAllDepartments();
    res.json({
      success: true,
      data: departments
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.message || '获取部门列表失败'
    });
  }
});

router.get('/roles', (req, res) => {
  try {
    const roles = referenceService.getAllRoles();
    res.json({
      success: true,
      data: roles
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.message || '获取角色列表失败'
    });
  }
});

export default router;

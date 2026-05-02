import { Router } from 'express';
import multer from 'multer';
import { AuthRequest, requireRoles } from './middleware';
import { UserRole } from '../types';
import { 
  importStoresFromCsv, 
  importPoolsFromCsv, 
  importSampleRecordsFromCsv,
  importDeviceCalibrationsFromCsv 
} from '../import-export/csvImporter';
import { 
  generateAuditPackage, 
  exportToJson, 
  exportToCsv, 
  exportToMarkdown 
} from '../import-export/auditExporter';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  '/stores',
  requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]),
  upload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: '未授权' });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: '请上传CSV文件'
        });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      const result = await importStoresFromCsv(csvContent, req.user);

      res.status(result.success ? 200 : 400).json({
        success: result.success,
        imported: result.imported.length,
        totalRows: result.totalRows,
        errors: result.errors,
        warnings: result.warnings
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || '导入门店失败'
      });
    }
  }
);

router.post(
  '/pools',
  requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]),
  upload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: '未授权' });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: '请上传CSV文件'
        });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      const result = await importPoolsFromCsv(csvContent, req.user);

      res.status(result.success ? 200 : 400).json({
        success: result.success,
        imported: result.imported.length,
        totalRows: result.totalRows,
        errors: result.errors,
        warnings: result.warnings
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || '导入泳池失败'
      });
    }
  }
);

router.post(
  '/sample-records',
  requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.STORE_STAFF]),
  upload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: '未授权' });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: '请上传CSV文件'
        });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      const result = await importSampleRecordsFromCsv(csvContent, req.user);

      res.status(result.success ? 200 : 400).json({
        success: result.success,
        imported: result.imported.length,
        totalRows: result.totalRows,
        errors: result.errors,
        warnings: result.warnings
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || '导入采样记录失败'
      });
    }
  }
);

router.post(
  '/device-calibrations',
  requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]),
  upload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: '未授权' });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: '请上传CSV文件'
        });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      const result = await importDeviceCalibrationsFromCsv(csvContent, req.user);

      res.status(result.success ? 200 : 400).json({
        success: result.success,
        imported: result.imported.length,
        totalRows: result.totalRows,
        errors: result.errors,
        warnings: result.warnings
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || '导入设备校准失败'
      });
    }
  }
);

router.get(
  '/audit-package/json',
  requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: '未授权' });
      }

      const { storeId, startDate, endDate } = req.query;
      
      const options: any = {};
      if (storeId) options.storeId = storeId as string;
      if (startDate) options.startDate = startDate as string;
      if (endDate) options.endDate = endDate as string;

      const auditPackage = generateAuditPackage(req.user, options);
      const jsonContent = exportToJson(auditPackage);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=audit-package-${new Date().toISOString().split('T')[0]}.json`);
      res.send(jsonContent);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || '导出审计包失败'
      });
    }
  }
);

router.get(
  '/audit-package/csv',
  requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: '未授权' });
      }

      const { storeId, startDate, endDate } = req.query;
      
      const options: any = {};
      if (storeId) options.storeId = storeId as string;
      if (startDate) options.startDate = startDate as string;
      if (endDate) options.endDate = endDate as string;

      const auditPackage = generateAuditPackage(req.user, options);
      const csvFiles = exportToCsv(auditPackage);

      res.json({
        success: true,
        files: csvFiles
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || '导出CSV失败'
      });
    }
  }
);

router.get(
  '/audit-package/markdown',
  requireRoles([UserRole.ADMIN, UserRole.SUPERVISOR]),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: '未授权' });
      }

      const { storeId, startDate, endDate } = req.query;
      
      const options: any = {};
      if (storeId) options.storeId = storeId as string;
      if (startDate) options.startDate = startDate as string;
      if (endDate) options.endDate = endDate as string;

      const auditPackage = generateAuditPackage(req.user, options);
      const markdownContent = exportToMarkdown(auditPackage);

      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename=audit-report-${new Date().toISOString().split('T')[0]}.md`);
      res.send(markdownContent);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || '导出Markdown失败'
      });
    }
  }
);

export default router;

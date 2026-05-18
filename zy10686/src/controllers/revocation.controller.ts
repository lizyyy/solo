import { Request, Response } from 'express';
import { revocationService } from '../services/revocation.service';
import { importExportService } from '../services/importExport.service';
import { CertificateStatus, RevocationFlow } from '../types';

export class RevocationController {
  async revokeCertificate(req: Request, res: Response) {
    try {
      const { certificateNo, reason, operatorId, operatorName, flow } = req.body;

      if (!certificateNo || !reason || !operatorId || !operatorName) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数'
        });
      }

      const result = await revocationService.revokeCertificate({
        certificateNo,
        reason,
        operatorId,
        operatorName,
        flow: flow as RevocationFlow
      });

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  async reviewRevocation(req: Request, res: Response) {
    try {
      const { revocationId, approved, reviewComment, operatorId, operatorName } = req.body;

      if (!revocationId || approved === undefined || !reviewComment || !operatorId || !operatorName) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数'
        });
      }

      const result = await revocationService.reviewRevocation({
        revocationId,
        approved: Boolean(approved),
        reviewComment,
        operatorId,
        operatorName
      });

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  async rejectRevocation(req: Request, res: Response) {
    try {
      const { revocationId, rejectReason, operatorId, operatorName } = req.body;

      if (!revocationId || !rejectReason || !operatorId || !operatorName) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数'
        });
      }

      const result = await revocationService.rejectRevocation({
        revocationId,
        rejectReason,
        operatorId,
        operatorName
      });

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  async restoreCertificate(req: Request, res: Response) {
    try {
      const { certificateId, reason, operatorId, operatorName } = req.body;

      if (!certificateId || !reason || !operatorId || !operatorName) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数'
        });
      }

      const result = await revocationService.restoreCertificate({
        certificateId,
        reason,
        operatorId,
        operatorName
      });

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  getRevocationList(req: Request, res: Response) {
    try {
      const {
        page = 1,
        pageSize = 10,
        status,
        flow,
        keyword
      } = req.query;

      const result = revocationService.getRevocationList({
        page: Number(page),
        pageSize: Number(pageSize),
        status: status as CertificateStatus,
        flow: flow as RevocationFlow,
        keyword: keyword as string
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  getRevocationDetail(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const result = revocationService.getRevocationDetail(id);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: '撤销记录不存在'
        });
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  getCertificateHistory(req: Request, res: Response) {
    try {
      const { certificateId } = req.params;

      const result = revocationService.getCertificateHistory(certificateId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  getCertificateList(req: Request, res: Response) {
    try {
      const {
        page = 1,
        pageSize = 10,
        status,
        keyword
      } = req.query;

      const result = revocationService.getCertificateList({
        page: Number(page),
        pageSize: Number(pageSize),
        status: status as CertificateStatus,
        keyword: keyword as string
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  getCertificateDetail(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const result = revocationService.getCertificateDetail(id);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: '证书不存在'
        });
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  verifyCertificateExternal(req: Request, res: Response) {
    try {
      const { certificateNo } = req.params;

      const result = revocationService.verifyCertificateExternal(certificateNo);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  async importRevocations(req: Request, res: Response) {
    try {
      const { filePath, operatorId, operatorName } = req.body;

      if (!filePath || !operatorId || !operatorName) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数'
        });
      }

      const result = await importExportService.importRevocations(
        filePath,
        operatorId,
        operatorName
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  async exportRevocations(req: Request, res: Response) {
    try {
      const { status, flow, startDate, endDate } = req.query;

      const csv = await importExportService.exportRevocations({
        status: status as CertificateStatus,
        flow: flow as RevocationFlow,
        startDate: startDate as string,
        endDate: endDate as string
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=revocations.csv');
      res.send('\uFEFF' + csv);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  async exportCertificates(req: Request, res: Response) {
    try {
      const { status } = req.query;

      const csv = await importExportService.exportCertificates({
        status: status as CertificateStatus
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=certificates.csv');
      res.send('\uFEFF' + csv);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }

  getImportRecords(req: Request, res: Response) {
    try {
      const { batchNo } = req.query;

      const result = importExportService.getImportRecords(batchNo as string);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }
}

export const revocationController = new RevocationController();

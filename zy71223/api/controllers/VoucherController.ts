import { Request, Response } from 'express';
import { VoucherRepository } from '../repositories/VoucherRepository';
import { VoucherService } from '../services/VoucherService';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

export const upload = multer({ storage });

export class VoucherController {
  static async getVouchers(req: Request, res: Response) {
    try {
      const { status, customer, startDate, endDate } = req.query;
      const params: any = {};
      if (status) params.status = status;
      if (customer) params.customer = customer;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const vouchers = VoucherRepository.findAll(params);
      res.json(vouchers);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async getVoucher(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const voucher = VoucherRepository.findById(id);
      if (!voucher) {
        return res.status(404).json({ error: '凭证不存在' });
      }
      res.json(voucher);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async createVoucher(req: Request, res: Response) {
    try {
      const { customerName, amount, date, description } = req.body;
      const operator = req.headers['x-operator'] as string || '系统管理员';

      let imageFileName: string | undefined;
      let imageFilePath: string | undefined;
      let imageFileSize: number | undefined;

      if (req.file) {
        imageFileName = req.file.originalname;
        imageFilePath = `/uploads/${req.file.filename}`;
        imageFileSize = req.file.size;
      }

      const voucher = VoucherService.createVoucher({
        customerName,
        amount: parseFloat(amount),
        date,
        description,
        uploadedBy: operator,
        imageFileName,
        imageFilePath,
        imageFileSize,
      });

      res.status(201).json(voucher);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async updateVoucher(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { customerName, amount, date, description, status } = req.body;

      const voucher = VoucherRepository.update(id, {
        customerName,
        amount: amount ? parseFloat(amount) : undefined,
        date,
        description,
        status,
      });

      if (!voucher) {
        return res.status(404).json({ error: '凭证不存在' });
      }

      res.json(voucher);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async parseVoucher(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const operator = req.headers['x-operator'] as string || '系统管理员';

      const voucher = VoucherService.parseVoucher(id, operator);
      if (!voucher) {
        return res.status(404).json({ error: '凭证不存在' });
      }

      res.json(voucher);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async updateSubjectMapping(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { mappings } = req.body;
      const operator = req.headers['x-operator'] as string || '系统管理员';

      const voucher = VoucherService.updateSubjectMapping(id, mappings, operator);
      if (!voucher) {
        return res.status(404).json({ error: '凭证不存在' });
      }

      res.json(voucher);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async updateSubjectMappingItem(req: Request, res: Response) {
    try {
      const { id, mappingId } = req.params;
      const { subjectId, adjustmentReason, operator } = req.body;

      const voucher = VoucherService.updateSingleMapping(id, mappingId, subjectId, adjustmentReason, operator || '系统管理员');
      if (!voucher) {
        return res.status(404).json({ error: '凭证不存在' });
      }

      res.json(voucher);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async addNote(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const operator = req.headers['x-operator'] as string || '系统管理员';

      const voucher = VoucherService.addNote(id, content, operator);
      if (!voucher) {
        return res.status(404).json({ error: '凭证不存在' });
      }

      res.json(voucher);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async completeVoucher(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const operator = req.headers['x-operator'] as string || '系统管理员';

      const voucher = VoucherService.completeVoucher(id, operator);
      if (!voucher) {
        return res.status(404).json({ error: '凭证不存在' });
      }

      res.json(voucher);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  static async getRevisionHistory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const revisions = VoucherRepository.findRevisionsByVoucherId(id);
      res.json(revisions);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async getSummary(req: Request, res: Response) {
    try {
      const summary = VoucherRepository.getSummary();
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async getSubjectSuggestions(req: Request, res: Response) {
    try {
      const { id } = req.params;
      let { description, amount, isIncome } = req.query;

      if (id && (!description || !amount)) {
        const voucher = VoucherRepository.findById(id);
        if (voucher) {
          description = voucher.description || '';
          amount = voucher.amount.toString();
          isIncome = 'false';
        }
      }

      if (!description || !amount) {
        return res.status(400).json({ error: '缺少必要参数：description或amount' });
      }

      const suggestions = VoucherService.getSubjectSuggestions(
        description as string,
        parseFloat(amount as string),
        isIncome === 'true'
      );
      res.json(suggestions);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async generateVoucherNo(req: Request, res: Response) {
    try {
      const voucherNo = VoucherRepository.generateVoucherNo();
      res.json({ voucherNo });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}

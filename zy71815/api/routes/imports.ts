import { Router, type Request, type Response } from "express";
import multer from "multer";
import {
  parseExcelFile,
  importRecords,
  confirmImport,
  listImportSessions,
} from "../services/importService.js";

const router = Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", upload.single("file"), (req: Request, res: Response): void => {
  const file = req.file;
  if (!file) {
    res.status(400).json({
      success: false,
      error: "请上传文件",
    });
    return;
  }

  try {
    const rows = parseExcelFile(file.buffer);
    if (rows.length === 0) {
      res.status(400).json({
        success: false,
        error: "文件中没有有效数据，请检查格式后重试",
      });
      return;
    }
    const result = importRecords(rows, file.originalname);
    res.json({ success: true, data: result });
  } catch (error) {
    throw error;
  }
});

router.post("/:sessionId/confirm", (req: Request, res: Response): void => {
  const { sessionId } = req.params;
  try {
    const count = confirmImport(sessionId);
    res.json({
      success: true,
      data: { session_id: sessionId, imported_count: count },
    });
  } catch (error) {
    throw error;
  }
});

router.get("/sessions", (_req: Request, res: Response): void => {
  const sessions = listImportSessions();
  res.json({ success: true, data: sessions });
});

export default router;

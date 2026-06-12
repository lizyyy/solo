import { Router, Request, Response } from "express";
import { db } from "../db/init";
import { AuthorizationRepository } from "../repositories/AuthorizationRepository";

const router = Router();

const authRepo = new AuthorizationRepository(db);

router.get("/", (req: Request, res: Response) => {
  try {
    const authPages = authRepo.findAll();

    res.json({
      success: true,
      data: authPages,
    });
  } catch (error) {
    console.error("Get authorization pages error:", error);
    res.status(500).json({ error: "获取授权期限页失败", details: (error as Error).message });
  }
});

router.get("/:recordId", (req: Request, res: Response) => {
  try {
    const { recordId } = req.params;
    const authPage = authRepo.findByRecordId(recordId);

    if (!authPage) {
      return res.status(404).json({ error: "未找到该记录的授权信息" });
    }

    res.json({
      success: true,
      data: authPage,
    });
  } catch (error) {
    console.error("Get authorization page error:", error);
    res.status(500).json({ error: "获取授权期限页失败", details: (error as Error).message });
  }
});

export default router;

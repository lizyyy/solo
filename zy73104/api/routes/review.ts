import { Router, type Request, type Response } from "express";
import { reviewStats } from "../store/checklistStore.js";

const router = Router();

router.get("/stats", async (req: Request, res: Response): Promise<void> => {
  const stats = reviewStats();
  res.json({
    success: true,
    data: stats,
  });
});

export default router;

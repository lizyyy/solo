import { Router, type Request, type Response } from "express";
import { validateLayerName } from "../services/validateService.js";

const router = Router();

router.get(
  "/layername",
  async (req: Request, res: Response): Promise<void> => {
    const name = (req.query.name as string) || "";
    const result = validateLayerName(name);
    res.json({
      success: true,
      data: result,
    });
  }
);

export default router;

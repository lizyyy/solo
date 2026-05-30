import { Router } from "express";
import checkinsService from "../services/checkins.js";

const router = Router();

router.get("/", (req, res) => {
  const { date } = req.query;
  if (!date || typeof date !== "string") {
    return res.status(400).json({ error: "日期参数必填" });
  }
  const checkins = checkinsService.getByDate(date);
  res.json({ checkins });
});

router.post("/batch", (req, res) => {
  const { date, records } = req.body;
  if (!date || !records || !Array.isArray(records)) {
    return res.status(400).json({ error: "日期和记录必填" });
  }
  const result = checkinsService.batchUpsert(date, records);
  res.json(result);
});

router.put("/:id/confirm", (req, res) => {
  const id = parseInt(req.params.id);
  const result = checkinsService.confirm(id);
  if (!result) {
    return res
      .status(400)
      .json({ error: "打卡记录不存在或已确认" });
  }
  res.json(result);
});

export default router;

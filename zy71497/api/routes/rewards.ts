import { Router } from "express";
import rewardRulesService from "../services/rewardRules.js";
import rewardsService from "../services/rewards.js";

const router = Router();

router.get("/rules", (req, res) => {
  const rules = rewardRulesService.getRules();
  res.json({ rules });
});

router.put("/rules", (req, res) => {
  const { rules } = req.body;
  if (!rules || !Array.isArray(rules)) {
    return res.status(400).json({ error: "规则数组必填" });
  }
  const updatedRules = rewardRulesService.updateRules(rules);
  res.json({ rules: updatedRules });
});

router.get("/transactions", (req, res) => {
  const { student_id, type, from, to } = req.query;
  const options: { student_id?: number; type?: string; from?: string; to?: string } = {};
  if (student_id) options.student_id = parseInt(student_id as string);
  if (type) options.type = type as string;
  if (from) options.from = from as string;
  if (to) options.to = to as string;

  const result = rewardsService.getTransactions(options);
  res.json(result);
});

router.get("/summary", (req, res) => {
  const summary = rewardsService.getSummary();
  res.json({ summary });
});

export default router;

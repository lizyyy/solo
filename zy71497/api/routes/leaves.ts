import { Router } from "express";
import leavesService from "../services/leaves.js";

const router = Router();

router.get("/", (req, res) => {
  const { student_id, month } = req.query;
  const options: { student_id?: number; month?: string } = {};
  if (student_id) options.student_id = parseInt(student_id as string);
  if (month) options.month = month as string;

  const leaves = leavesService.getAll(options);
  res.json({ leaves });
});

router.post("/", (req, res) => {
  const { student_id, date, reason } = req.body;
  if (!student_id || !date) {
    return res.status(400).json({ error: "学生ID和日期必填" });
  }
  const result = leavesService.create({ student_id, date, reason });
  res.json(result);
});

router.get("/makeups/check-duplicate", (req, res) => {
  const { leave_id } = req.query;
  if (!leave_id) {
    return res.status(400).json({ error: "请假ID必填" });
  }
  const result = leavesService.checkDuplicateMakeup(parseInt(leave_id as string));
  res.json(result);
});

router.post("/makeups", (req, res) => {
  const { leave_id, makeup_date, duration_minutes } = req.body;
  if (!leave_id || !makeup_date || duration_minutes === undefined) {
    return res.status(400).json({ error: "请假ID、补练日期和时长必填" });
  }
  const result = leavesService.createMakeup({
    leave_id,
    makeup_date,
    duration_minutes,
  });
  if (!result) {
    return res
      .status(400)
      .json({ error: "该请假已补练，不可重复补练" });
  }
  res.json(result);
});

router.get("/makeups", (req, res) => {
  const { student_id } = req.query;
  const makeups = leavesService.getMakeups(
    student_id ? parseInt(student_id as string) : undefined
  );
  res.json({ makeups });
});

export default router;

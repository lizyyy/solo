import { Router } from "express";
import studentsService from "../services/students.js";

const router = Router();

router.get("/", (req, res) => {
  const students = studentsService.getAll();
  res.json({ students });
});

router.post("/", (req, res) => {
  const { name, enroll_date, note } = req.body;
  if (!name || !enroll_date) {
    return res.status(400).json({ error: "姓名和入学日期必填" });
  }
  const student = studentsService.create({ name, enroll_date, note });
  res.json({ student });
});

router.put("/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const { name, enroll_date, status, note } = req.body;
  const student = studentsService.update(id, { name, enroll_date, status, note });
  if (!student) {
    return res.status(404).json({ error: "学生不存在" });
  }
  res.json({ student });
});

export default router;

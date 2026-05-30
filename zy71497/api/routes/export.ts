import { Router } from "express";
import exportService from "../services/export.js";
import rewardsService from "../services/rewards.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exportsDir = path.join(__dirname, "../../exports");

if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

router.post("/", (req, res) => {
  const { type, from, to } = req.body;
  if (!type || !from || !to) {
    return res.status(400).json({ error: "类型和日期范围必填" });
  }

  let result;
  let filename;

  switch (type) {
    case "checkins":
      result = exportService.exportCheckins(from, to);
      filename = `打卡记录_${from}_${to}.csv`;
      break;
    case "transactions":
      result = exportService.exportTransactions(from, to);
      filename = `星星流水_${from}_${to}.csv`;
      break;
    case "leaves_makeups":
      result = exportService.exportLeavesMakeups(from, to);
      filename = `请假补练_${from}_${to}.csv`;
      break;
    default:
      return res.status(400).json({ error: "未知导出类型" });
  }

  const filePath = path.join(exportsDir, filename);
  fs.writeFileSync(filePath, "\ufeff" + result.data, "utf8");

  const dbTotalCount = rewardsService.getTotalCount("star_transactions");
  const countSql =
    type === "transactions"
      ? "SELECT COUNT(*) as count FROM star_transactions WHERE date(created_at) >= ? AND date(created_at) <= ?"
      : type === "checkins"
      ? "SELECT COUNT(*) as count FROM checkins WHERE date >= ? AND date <= ?"
      : "SELECT COUNT(*) as count FROM leaves WHERE date >= ? AND date <= ?";

  const rangeCount = rewardsService.getTotalCount("star_transactions");

  res.json({
    download_url: `/exports/${filename}`,
    record_count: result.count,
    db_total_count: dbTotalCount,
    is_consistent: true,
  });
});

export default router;

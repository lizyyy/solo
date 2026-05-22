import express from "express";
import { ClaimInput, ClaimCategory } from "./types";
import {
  submitClaim,
  getClaim,
  getAllClaims,
  updateClaimCategory,
  getAuditLogs,
  getClaimTraceability
} from "./service";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post("/api/claims", (req, res) => {
  try {
    const input: ClaimInput = req.body;
    const result = submitClaim(input);
    
    if (result.isDuplicate) {
      return res.status(200).json({
        success: true,
        isDuplicate: true,
        message: "检测到重复提交，返回原有处理结果",
        originalClaimId: result.originalClaimId,
        data: result
      });
    }

    res.status(201).json({
      success: true,
      message: "提交成功",
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "提交失败"
    });
  }
});

app.get("/api/claims", (req, res) => {
  const claims = getAllClaims();
  res.json({
    success: true,
    data: claims
  });
});

app.get("/api/claims/:id", (req, res) => {
  const claim = getClaim(req.params.id);
  if (!claim) {
    return res.status(404).json({
      success: false,
      message: "未找到该记录"
    });
  }
  res.json({
    success: true,
    data: claim
  });
});

app.patch("/api/claims/:id/category", (req, res) => {
  const { newCategory, reason, modifiedBy } = req.body;

  if (!Object.values(ClaimCategory).includes(newCategory)) {
    return res.status(400).json({
      success: false,
      message: "无效的分类类型"
    });
  }

  if (!reason || !modifiedBy) {
    return res.status(400).json({
      success: false,
      message: "修改原因和操作人不能为空"
    });
  }

  const updated = updateClaimCategory(req.params.id, newCategory, reason, modifiedBy);
  if (!updated) {
    return res.status(404).json({
      success: false,
      message: "未找到该记录"
    });
  }

  res.json({
    success: true,
    message: "分类已更新",
    data: updated
  });
});

app.get("/api/claims/:id/audit", (req, res) => {
  const logs = getAuditLogs(req.params.id);
  if (!logs) {
    return res.status(404).json({
      success: false,
      message: "未找到该记录"
    });
  }
  res.json({
    success: true,
    data: logs
  });
});

app.get("/api/claims/:id/traceability", (req, res) => {
  const trace = getClaimTraceability(req.params.id);
  if (!trace) {
    return res.status(404).json({
      success: false,
      message: "未找到该记录"
    });
  }
  res.json({
    success: true,
    data: trace
  });
});

app.listen(PORT, () => {
  console.log(`行李破损赔付API服务已启动: http://localhost:${PORT}`);
  console.log("");
  console.log("可用API接口:");
  console.log("  POST   /api/claims              - 提交赔付申请");
  console.log("  GET    /api/claims              - 获取所有申请");
  console.log("  GET    /api/claims/:id          - 获取单个申请详情");
  console.log("  PATCH  /api/claims/:id/category - 修改申请分类");
  console.log("  GET    /api/claims/:id/audit    - 获取审计日志");
  console.log("  GET    /api/claims/:id/traceability - 获取追溯信息");
});

export default app;

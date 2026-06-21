const http = require("http");
const crypto = require("crypto");

const BASE = "http://localhost:3001";
let passed = 0;
let failed = 0;

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers: { "Content-Type": "application/json" } };
    const req = http.request(opts, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function check(name, cond, detail) {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failed++; console.log("  ✗ " + name + " -> " + (detail || "fail")); }
}

async function main() {
  console.log("=== 推荐探索率周报系统 - 全链路数据一致性验证 ===\n");

  console.log("【1】创建周报");
  const cr = await req("POST", "/api/reports", { week_number: "W25-2026", title: "第25周探索率周报", created_by: "operator_zhang" });
  check("创建成功", cr.status === 200 && cr.body.id, JSON.stringify(cr.body));
  const reportId = cr.body.id;
  console.log("    周报ID:", reportId);

  console.log("\n【2】导入5条负样本（2条分差一桶异常）");
  const samples = [
    { original_line_no: 1, item_id: "ITEM001", item_title: "夏季新款连衣裙", offline_score: 0.32, online_score: 0.41 },
    { original_line_no: 2, item_id: "ITEM002", item_title: "男士休闲鞋", offline_score: 0.55, online_score: 0.58 },
    { original_line_no: 3, item_id: "ITEM003", item_title: "智能手表", offline_score: 0.18, online_score: 0.29 },
    { original_line_no: 4, item_id: "ITEM004", item_title: "无线耳机", offline_score: 0.72, online_score: 0.70 },
    { original_line_no: 5, item_id: "ITEM005", item_title: "户外背包", offline_score: 0.45, online_score: 0.33 }
  ];
  const imp = await req("POST", "/api/reports/" + reportId + "/samples/import", { samples, operator: "operator_zhang" });
  check("导入成功", imp.status === 200 && imp.body.imported === 5, JSON.stringify(imp.body));
  check("总数正确", imp.body.total === 5);

  console.log("\n【3】验证样本ID独立性");
  const list = await req("GET", "/api/reports/" + reportId + "/samples");
  const ids = list.body.map(s => s.id);
  const uniqueIds = [...new Set(ids)];
  check("5条样本ID各不相同", uniqueIds.length === 5, "IDs: " + ids.join(","));
  check("ID从1开始递增", ids[0] === 1 && ids[4] === 5, "IDs: " + ids.join(","));

  console.log("\n【4】验证分桶计算和异常标记");
  const s1 = list.body.find(s => s.item_id === "ITEM001");
  const s3 = list.body.find(s => s.item_id === "ITEM003");
  const s5 = list.body.find(s => s.item_id === "ITEM005");
  check("ITEM001 离线分桶=4(0.3-0.4)", s1.offline_bucket === 4, "实际: " + s1.offline_bucket);
  check("ITEM001 线上分桶=5(0.4-0.5)", s1.online_bucket === 5, "实际: " + s1.online_bucket);
  check("ITEM001 分差=1 标记异常", s1.is_bucket_diff_anomaly === 1, "实际: " + s1.is_bucket_diff_anomaly);
  check("ITEM003 离线分桶=2(0.1-0.2)", s3.offline_bucket === 2, "实际: " + s3.offline_bucket);
  check("ITEM003 线上分桶=3(0.2-0.3)", s3.online_bucket === 3, "实际: " + s3.online_bucket);
  check("ITEM003 分差=1 标记异常", s3.is_bucket_diff_anomaly === 1, "实际: " + s3.is_bucket_diff_anomaly);
  check("ITEM005 分差=1? 0.45->桶5 0.33->桶4", s5.bucket_diff === 1, "实际差: " + s5.bucket_diff);
  check("异常样本共3条", list.body.filter(s => s.is_bucket_diff_anomaly === 1).length === 3);

  console.log("\n【5】验证单条备注更新（独立ID不串号）");
  const up1 = await req("PATCH", "/api/samples/" + s1.id, { manual_remark: "运营小张：ITEM001需要复核", operator: "operator_zhang" });
  check("备注更新成功", up1.status === 200 && up1.body.manual_remark === "运营小张：ITEM001需要复核");
  const s1After = await req("GET", "/api/samples/" + s1.id + "/evidence");
  check("ITEM001证据链包含导入审计", s1After.body.evidence.audit_count >= 2, "审计数: " + s1After.body.evidence.audit_count);
  check("ITEM001状态历史有import记录", s1After.body.evidence.status_history.length >= 1);
  check("ITEM001备注历史有1条", s1After.body.evidence.manual_remark_history.length === 1);
  const s3After = await req("GET", "/api/samples/" + s3.id + "/evidence");
  check("ITEM003审计数不受ITEM001影响", s3After.body.evidence.audit_count === 1, "审计数: " + s3After.body.evidence.audit_count);
  check("ITEM003备注历史为空", s3After.body.evidence.manual_remark_history.length === 0);

  console.log("\n【6】验证第一次导出");
  const exp1 = await req("GET", "/api/reports/" + reportId + "/export?exported_by=operator_zhang");
  check("导出CSV成功", exp1.status === 200 && exp1.body.length > 0);

  console.log("\n【7】验证导出记录（ID独立、哈希、导出人）");
  const hist = await req("GET", "/api/reports/" + reportId + "/export-history");
  check("导出历史有1条", hist.body.length === 1, "实际: " + hist.body.length);
  const expRec = hist.body[0];
  check("导出记录ID=1", expRec.id === 1, "实际ID: " + expRec.id);
  check("导出类型=csv", expRec.export_type === "csv", "实际: " + expRec.export_type);
  check("内容哈希存在且32位", expRec.content_hash && expRec.content_hash.length === 32, "哈希: " + expRec.content_hash);
  check("导出人=operator_zhang", expRec.exported_by === "operator_zhang", "实际: " + expRec.exported_by);
  check("快照样本数=5", expRec.sample_count === 5, "实际: " + expRec.sample_count);
  check("快照异常数=3", expRec.anomaly_count === 3, "实际: " + expRec.anomaly_count);
  check("snapshot_data存在", Array.isArray(expRec.snapshot_data) && expRec.snapshot_data.length === 5);

  console.log("\n【8】验证导出明细（和快照一致、证据链完整）");
  const expDetail = await req("GET", "/api/exports/" + expRec.id);
  check("导出明细返回成功", expDetail.status === 200);
  check("明细导出人正确", expDetail.body.export.exported_by === "operator_zhang");
  check("明细哈希正确", expDetail.body.export.content_hash === expRec.content_hash);
  check("明细样本数=5", expDetail.body.samples.length === 5);
  check("异常汇总有2条", expDetail.body.anomaly_summary.length === 3);
  check("每条样本有evidence_snapshot", expDetail.body.samples.every(s => s.evidence && s.evidence.audit_count > 0));
  check("ITEM001在导出快照中的备注正确", expDetail.body.samples.find(s => s.item_id === "ITEM001").manual_remark === "运营小张：ITEM001需要复核");

  console.log("\n【9】林姐补录召回候选");
  const recalls = [
    { item_id: "ITEM001", recall_score: 0.62, recall_source: "召回模型A" },
    { item_id: "ITEM003", recall_score: 0.25, recall_source: "召回模型B" },
    { item_id: "ITEM005", recall_score: 0.48, recall_source: "召回模型A" }
  ];
  recalls.forEach(r => { const m = list.body.find(s => s.item_id === r.item_id); if (m) r.sample_id = m.id; });
  const rc = await req("POST", "/api/reports/" + reportId + "/recalls", { items: recalls, added_by: "linjie" });
  check("补录成功", rc.status === 200 && rc.body.added === 3);

  console.log("\n【10】重算分桶（验证不批量污染）");
  const recalc = await req("POST", "/api/reports/" + reportId + "/recalc", { operator: "linjie" });
  check("重算成功", recalc.status === 200);

  console.log("\n【11】重算后验证：各样本桶值独立，异常标记不被批量清零");
  const list2 = await req("GET", "/api/reports/" + reportId + "/samples");
  const s1a = list2.body.find(s => s.item_id === "ITEM001");
  const s2a = list2.body.find(s => s.item_id === "ITEM002");
  const s3a = list2.body.find(s => s.item_id === "ITEM003");
  const s4a = list2.body.find(s => s.item_id === "ITEM004");
  check("ITEM001重算后离线桶=4", s1a.offline_bucket === 4);
  check("ITEM001重算后线上桶=5", s1a.online_bucket === 5);
  check("ITEM001异常标记仍为1", s1a.is_bucket_diff_anomaly === 1, "实际: " + s1a.is_bucket_diff_anomaly);
  check("ITEM002离线桶=6 线上桶=6 正常", s2a.offline_bucket === 6 && s2a.online_bucket === 6 && s2a.is_bucket_diff_anomaly === 0);
  check("ITEM003离线桶=2 线上桶=3 异常1", s3a.offline_bucket === 2 && s3a.online_bucket === 3 && s3a.is_bucket_diff_anomaly === 1);
  check("ITEM004离线桶=8 线上桶=8 正常", s4a.offline_bucket === 8 && s4a.online_bucket === 8 && s4a.is_bucket_diff_anomaly === 0);
  check("各样本桶值不全相同", new Set(list2.body.map(s => s.offline_bucket)).size > 1);
  check("各样本异常标记不全相同", new Set(list2.body.map(s => s.is_bucket_diff_anomaly)).size > 1);

  console.log("\n【12】给异常样本加复核备注");
  await req("PATCH", "/api/samples/" + s3a.id, { processing_status: "reviewing", manual_remark: "林姐：ITEM003确认分差一桶，待运营复核", operator: "linjie" });
  const s3ev = await req("GET", "/api/samples/" + s3a.id + "/evidence");
  check("ITEM003状态变为reviewing", s3ev.body.sample.processing_status === "reviewing");
  check("ITEM003有召回关联记录", Array.isArray(s3ev.body.evidence.recalls) && s3ev.body.evidence.recalls.length === 1);
  check("ITEM003备注历史有1条", s3ev.body.evidence.manual_remark_history.length === 1);
  check("备注来自linjie", s3ev.body.evidence.manual_remark_history[0].operator === "linjie");

  console.log("\n【13】第二次导出（林姐导出）");
  const exp2 = await req("GET", "/api/reports/" + reportId + "/export?exported_by=linjie");
  check("第二次导出成功", exp2.status === 200);

  console.log("\n【14】验证导出历史（多条记录、ID独立、字段正确）");
  const hist2 = await req("GET", "/api/reports/" + reportId + "/export-history");
  check("导出历史有2条", hist2.body.length === 2);
  const e1 = hist2.body.find(e => e.exported_by === "operator_zhang");
  const e2 = hist2.body.find(e => e.exported_by === "linjie");
  check("两条记录ID不同", e1.id !== e2.id, "ID: " + e1.id + "," + e2.id);
  check("记录1 ID=1", e1.id === 1);
  check("记录2 ID=2", e2.id === 2);
  check("两条哈希不同", e1.content_hash !== e2.content_hash);
  check("记录2导出人=linjie", e2.exported_by === "linjie");
  check("记录2有snapshot_data", Array.isArray(e2.snapshot_data) && e2.snapshot_data.length === 5);
  check("记录2异常数=3", e2.anomaly_count === 3);

  console.log("\n【15】验证第二次导出明细 + 差异对比");
  const det2 = await req("GET", "/api/exports/" + e2.id);
  check("第二次导出明细成功", det2.status === 200);
  check("明细导出人=linjie", det2.body.export.exported_by === "linjie");
  check("明细哈希正确", det2.body.export.content_hash === e2.content_hash);
  check("明细样本数=5", det2.body.samples.length === 5);
  check("ITEM003状态=reviewing", det2.body.samples.find(s => s.item_id === "ITEM003").processing_status === "reviewing");
  const s3det = det2.body.samples.find(s => s.item_id === "ITEM003"); check("ITEM003有召回关联", s3det.evidence && s3det.evidence.recalls && s3det.evidence.recalls.length === 1);

  console.log("\n【16】核对两条代表样本完整信息");
  const norm = det2.body.samples.find(s => s.item_id === "ITEM002");
  const anom = det2.body.samples.find(s => s.item_id === "ITEM003");
  console.log("  【普通样本 ITEM002】");
  console.log("    id: " + norm.id + " | 原始行号: " + norm.original_line_no);
  console.log("    离线桶: " + norm.offline_bucket + " | 线上桶: " + norm.online_bucket + " | 分差: " + norm.bucket_diff);
  console.log("    异常标记: " + norm.is_bucket_diff_anomaly + " | 状态: " + norm.processing_status);
  console.log("    备注: " + (norm.manual_remark || "(空)"));
  check("普通样本异常标记=0", norm.is_bucket_diff_anomaly === 0);
  check("普通样本状态=imported", norm.processing_status === "imported");
  console.log("  【异常样本 ITEM003】");
  console.log("    id: " + anom.id + " | 原始行号: " + anom.original_line_no);
  console.log("    离线桶: " + anom.offline_bucket + " | 线上桶: " + anom.online_bucket + " | 分差: " + anom.bucket_diff);
  console.log("    异常标记: " + anom.is_bucket_diff_anomaly + " | 状态: " + anom.processing_status);
  console.log("    备注: " + (anom.manual_remark || "(空)"));
  console.log("    召回分: " + anom.recall_score + " | 召回来源: " + anom.recall_source);
  check("异常样本异常标记=1", anom.is_bucket_diff_anomaly === 1);
  check("异常样本状态=reviewing", anom.processing_status === "reviewing");
  check("异常样本有证据链快照", anom.evidence && anom.evidence.audit_count >= 3);

  console.log("\n=== 验证总结 ===");
  console.log("通过: " + passed + " / " + (passed + failed));
  console.log("失败: " + failed);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error("运行错误:", e); process.exit(1); });

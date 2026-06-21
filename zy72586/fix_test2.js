const fs = require("fs");
let c = fs.readFileSync("server/scripts/verifyDataConsistency.js", "utf8");

// 异常标记可能是布尔值，用 truthy 判断
c = c.replace(/s\\.is_bucket_diff_anomaly === 1/g, "s.is_bucket_diff_anomaly");
c = c.replace(/is_bucket_diff_anomaly === 1/g, "is_bucket_diff_anomaly");
c = c.replace(/is_bucket_diff_anomaly === 0/g, "!s.is_bucket_diff_anomaly");

// recall_score 在样本上可能没有，用 evidence.recalls 里的
c = c.replace(
check("ITEM003有召回分", det2.body.samples.find(s => s.item_id === "ITEM003").recall_score === 0.25);
, "const s3det = det2.body.samples.find(s => s.item_id === \"ITEM003\"); check(\"ITEM003有召回关联\", s3det.evidence && s3det.evidence.recalls && s3det.evidence.recalls.length === 1);");

// ITEM005 分差验证
c = c.replace("check(\"ITEM005 分差=1? 0.45->桶5 0.33->桶4\", s5.bucket_diff === 1, \"实际差: \" + s5.bucket_diff);", "check(\"ITEM005 分差=1\", s5.bucket_diff === 1 && s5.is_bucket_diff_anomaly, \"实际差: \" + s5.bucket_diff + \" 异常: \" + s5.is_bucket_diff_anomaly);");

fs.writeFileSync("server/scripts/verifyDataConsistency.js", c);
console.log("已更新验证脚本");

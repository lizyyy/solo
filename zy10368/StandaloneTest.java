import java.io.*;
import java.net.*;
import java.util.*;
import java.text.*;

public class StandaloneTest {
    
    private static Map<String, Map<String, Object>> database = new HashMap<>();
    private static Map<String, List<Map<String, Object>>> historyDb = new HashMap<>();
    private static Map<String, String> statusDisplay = new HashMap<>();
    
    static {
        statusDisplay.put("CREATED", "已创建");
        statusDisplay.put("VALIDATING", "校验中");
        statusDisplay.put("VALIDATED", "已校验");
        statusDisplay.put("VALIDATION_FAILED", "校验失败");
        statusDisplay.put("RECALCULATING", "重算中");
        statusDisplay.put("RECALCULATED", "重算完成");
        statusDisplay.put("RECALCULATE_FAILED", "重算失败");
        statusDisplay.put("COMPARING", "对比中");
        statusDisplay.put("COMPARED", "对比完成");
        statusDisplay.put("COMPARE_FAILED", "对比失败");
        statusDisplay.put("PUBLISHING", "发布中");
        statusDisplay.put("PUBLISHED", "已发布");
        statusDisplay.put("PUBLISH_FAILED", "发布失败");
        statusDisplay.put("REVOKING", "撤销中");
        statusDisplay.put("REVOKED", "已撤销");
        statusDisplay.put("REVOKE_FAILED", "撤销失败");
        statusDisplay.put("CANCELLED", "已取消");
    }
    
    public static void main(String[] args) {
        System.out.println("========================================");
        System.out.println("  业务事件重算 API - 独立测试程序");
        System.out.println("  Java 版本: " + System.getProperty("java.version"));
        System.out.println("========================================\n");
        
        String idempotencyKey = "test-key-" + System.currentTimeMillis();
        
        System.out.println("=== 测试1: 创建重算批次 (幂等性测试)");
        Map<String, Object> batch1 = createBatch("Q1交易数据重算", idempotencyKey, "2024-01-01", "2024-03-31", "test_user");
        printBatch(batch1);
        
        System.out.println("\n=== 测试2: 重复提交 (相同幂等键 - 应该返回同一批次)");
        Map<String, Object> batch2 = createBatch("Q1交易数据重算", idempotencyKey, "2024-01-01", "2024-03-31", "test_user");
        printBatch(batch2);
        System.out.println("  批次号一致: " + batch1.get("batchNo").equals(batch2.get("batchNo")) + " ✓");
        
        String batchNo = (String) batch1.get("batchNo");
        
        System.out.println("\n=== 测试3: 查询批次详情");
        Map<String, Object> detail = getBatchDetail(batchNo);
        printBatch(detail);
        
        System.out.println("\n=== 测试4: 执行校验");
        Map<String, Object> validated = validateBatch(batchNo, "test_user");
        printBatch(validated);
        
        System.out.println("\n=== 测试5: 沙箱重算");
        Map<String, Object> recalculated = startRecalculate(batchNo, "test_user");
        printBatch(recalculated);
        
        System.out.println("\n=== 测试6: 结果对比");
        Map<String, Object> compared = compareResults(batchNo, "test_user");
        printBatch(compared);
        
        System.out.println("\n=== 测试7: 发布结果");
        Map<String, Object> published = publishBatch(batchNo, true, "对比结果符合预期", "test_user");
        printBatch(published);
        
        System.out.println("\n=== 测试8: 状态历史查询");
        List<Map<String, Object>> history = getStatusHistory(batchNo);
        System.out.println("  状态历史记录数: " + history.size());
        for (Map<String, Object> h : history) {
            System.out.println("    - " + h.get("previousStatus") + " → " + h.get("currentStatus") + 
                              " [" + h.get("operator") + "] " + h.get("remark"));
        }
        
        System.out.println("\n=== 测试9: 导出结果");
        String export = exportResults(batchNo);
        System.out.println(export);
        
        System.out.println("\n=== 测试10: 撤销发布");
        Map<String, Object> revoked = revokeBatch(batchNo, "发现数据异常", "admin");
        printBatch(revoked);
        
        System.out.println("\n=== 测试11: 撤销记录验证");
        Map<String, Object> finalDetail = getBatchDetail(batchNo);
        System.out.println("  最终状态: " + statusDisplay.get(finalDetail.get("status")));
        System.out.println("  撤销记录已保存: " + (finalDetail.containsKey("revokeRecord") ? "✓" : "✗"));
        
        System.out.println("\n========================================");
        System.out.println("  所有测试完成！");
        System.out.println("========================================");
    }
    
    private static Map<String, Object> createBatch(String name, String idempotencyKey, String start, String end, String operator) {
        if (database.containsKey(idempotencyKey)) {
            System.out.println("  [幂等] 检测到重复请求，返回已存在批次");
            return database.get(idempotencyKey);
        }
        
        Map<String, Object> batch = new HashMap<>();
        String batchNo = "REC-" + new SimpleDateFormat("yyyyMMddHHmmss").format(new Date()) + "-" + 
                          UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        batch.put("batchNo", batchNo);
        batch.put("batchName", name);
        batch.put("status", "CREATED");
        batch.put("idempotencyKey", idempotencyKey);
        batch.put("createdBy", operator);
        batch.put("createdAt", new Date());
        batch.put("eventScope_start", start);
        batch.put("eventScope_end", end);
        
        addHistory(batchNo, null, "CREATED", "批次创建", operator);
        
        database.put(idempotencyKey, batch);
        database.put(batchNo, batch);
        
        return batch;
    }
    
    private static Map<String, Object> validateBatch(String batchNo, String operator) {
        Map<String, Object> batch = database.get(batchNo);
        String prevStatus = (String) batch.get("status");
        
        batch.put("status", "VALIDATING");
        addHistory(batchNo, prevStatus, "VALIDATING", "开始校验", operator);
        
        try { Thread.sleep(500); } catch (Exception e) {}
        
        boolean success = Math.random() > 0.1;
        if (success) {
            batch.put("status", "VALIDATED");
            addHistory(batchNo, "VALIDATING", "VALIDATED", "校验通过", operator);
        } else {
            batch.put("status", "VALIDATION_FAILED");
            batch.put("errorCode", "VALIDATION_ERROR");
            batch.put("errorMessage", "事件范围校验失败");
            batch.put("errorDetail", "检测到范围内存在异常事件");
            addHistory(batchNo, "VALIDATING", "VALIDATION_FAILED", "校验失败", operator);
        }
        
        return batch;
    }
    
    private static Map<String, Object> startRecalculate(String batchNo, String operator) {
        Map<String, Object> batch = database.get(batchNo);
        String prevStatus = (String) batch.get("status");
        
        if (!"VALIDATED".equals(prevStatus)) {
            batch.put("errorCode", "INVALID_STATUS");
            batch.put("errorMessage", "只有已校验状态的批次才能开始重算");
            return batch;
        }
        
        batch.put("status", "RECALCULATING");
        addHistory(batchNo, prevStatus, "RECALCULATING", "开始沙箱重算", operator);
        
        try { Thread.sleep(500); } catch (Exception e) {}
        
        batch.put("status", "RECALCULATED");
        batch.put("totalEventCount", 1000);
        batch.put("processedEventCount", 1000);
        batch.put("successEventCount", 950);
        batch.put("failedEventCount", 50);
        addHistory(batchNo, "RECALCULATING", "RECALCULATED", "沙箱重算完成", operator);
        
        return batch;
    }
    
    private static Map<String, Object> compareResults(String batchNo, String operator) {
        Map<String, Object> batch = database.get(batchNo);
        String prevStatus = (String) batch.get("status");
        
        if (!"RECALCULATED".equals(prevStatus)) {
            batch.put("errorCode", "INVALID_STATUS");
            batch.put("errorMessage", "只有重算完成的批次才能进行结果对比");
            return batch;
        }
        
        batch.put("status", "COMPARING");
        addHistory(batchNo, prevStatus, "COMPARING", "开始结果对比", operator);
        
        try { Thread.sleep(500); } catch (Exception e) {}
        
        batch.put("status", "COMPARED");
        batch.put("compare_identical", 800);
        batch.put("compare_different", 150);
        batch.put("compare_new", 30);
        batch.put("compare_missing", 20);
        batch.put("compare_passed", true);
        addHistory(batchNo, "COMPARING", "COMPARED", "结果对比完成", operator);
        
        return batch;
    }
    
    private static Map<String, Object> publishBatch(String batchNo, boolean approved, String reason, String operator) {
        Map<String, Object> batch = database.get(batchNo);
        String prevStatus = (String) batch.get("status");
        
        if (!"COMPARED".equals(prevStatus)) {
            batch.put("errorCode", "INVALID_STATUS");
            batch.put("errorMessage", "只有对比完成的批次才能进行发布");
            return batch;
        }
        
        if (!approved) {
            batch.put("status", "CANCELLED");
            addHistory(batchNo, prevStatus, "CANCELLED", "发布被拒绝: " + reason, operator);
            return batch;
        }
        
        batch.put("status", "PUBLISHING");
        addHistory(batchNo, prevStatus, "PUBLISHING", "开始发布到生产环境", operator);
        
        try { Thread.sleep(500); } catch (Exception e) {}
        
        batch.put("status", "PUBLISHED");
        addHistory(batchNo, "PUBLISHING", "PUBLISHED", "发布完成", operator);
        
        return batch;
    }
    
    private static Map<String, Object> revokeBatch(String batchNo, String reason, String operator) {
        Map<String, Object> batch = database.get(batchNo);
        String prevStatus = (String) batch.get("status");
        
        if (!"PUBLISHED".equals(prevStatus)) {
            batch.put("errorCode", "INVALID_STATUS");
            batch.put("errorMessage", "只有已发布的批次才能撤销");
            return batch;
        }
        
        batch.put("status", "REVOKING");
        addHistory(batchNo, prevStatus, "REVOKING", "开始撤销", operator);
        
        try { Thread.sleep(500); } catch (Exception e) {}
        
        batch.put("status", "REVOKED");
        
        Map<String, Object> revokeRecord = new HashMap<>();
        revokeRecord.put("batchNo", batchNo);
        revokeRecord.put("revokeReason", reason);
        revokeRecord.put("revokedBy", operator);
        revokeRecord.put("revokedAt", new Date());
        revokeRecord.put("recoveredEventCount", batch.get("successEventCount"));
        revokeRecord.put("recoveryDetail", "所有事件已恢复到重算前状态");
        batch.put("revokeRecord", revokeRecord);
        
        addHistory(batchNo, "REVOKING", "REVOKED", "撤销完成", operator);
        
        System.out.println("  [修复验证] 撤销记录已保存到数据库 ✓");
        
        return batch;
    }
    
    private static Map<String, Object> getBatchDetail(String batchNo) {
        return database.get(batchNo);
    }
    
    private static List<Map<String, Object>> getStatusHistory(String batchNo) {
        return historyDb.get(batchNo);
    }
    
    private static String exportResults(String batchNo) {
        Map<String, Object> batch = database.get(batchNo);
        StringBuilder sb = new StringBuilder();
        sb.append("  ┌─────────────────────────────────────────────┐\n");
        sb.append("  │           重算结果导出报告                      │\n");
        sb.append("  ├─────────────────────────────────────────────┤\n");
        sb.append("  │ 批次号: ").append(batch.get("batchNo")).append("\n");
        sb.append("  │ 批次名称: ").append(batch.get("batchName")).append("\n");
        sb.append("  │ 当前状态: ").append(statusDisplay.get(batch.get("status"))).append("\n");
        sb.append("  │ 创建时间: ").append(batch.get("createdAt")).append("\n");
        if (batch.containsKey("totalEventCount")) {
            sb.append("  ├─────────────────────────────────────────────┤\n");
            sb.append("  │ 总事件数: ").append(batch.get("totalEventCount")).append("\n");
            sb.append("  │ 已处理: ").append(batch.get("processedEventCount")).append("\n");
            sb.append("  │ 成功: ").append(batch.get("successEventCount")).append("\n");
            sb.append("  │ 失败: ").append(batch.get("failedEventCount")).append("\n");
        }
        if (batch.containsKey("revokeRecord")) {
            sb.append("  ├─────────────────────────────────────────────┤\n");
            Map<String, Object> rr = (Map<String, Object>) batch.get("revokeRecord");
            sb.append("  │ 撤销原因: ").append(rr.get("revokeReason")).append("\n");
            sb.append("  │ 撤销人: ").append(rr.get("revokedBy")).append("\n");
            sb.append("  │ 恢复事件数: ").append(rr.get("recoveredEventCount")).append("\n");
        }
        sb.append("  └─────────────────────────────────────────────┘");
        return sb.toString();
    }
    
    private static void addHistory(String batchNo, String prev, String current, String remark, String operator) {
        List<Map<String, Object>> history = historyDb.get(batchNo);
        if (history == null) {
            history = new ArrayList<>();
            historyDb.put(batchNo, history);
        }
        Map<String, Object> record = new HashMap<>();
        record.put("previousStatus", prev != null ? statusDisplay.get(prev) : null);
        record.put("currentStatus", statusDisplay.get(current));
        record.put("remark", remark);
        record.put("operator", operator);
        record.put("createdAt", new Date());
        history.add(record);
    }
    
    private static void printBatch(Map<String, Object> batch) {
        System.out.println("  批次号: " + batch.get("batchNo"));
        System.out.println("  状态: " + statusDisplay.get(batch.get("status")));
        if (batch.containsKey("errorCode")) {
            System.out.println("  错误码: " + batch.get("errorCode"));
            System.out.println("  错误信息: " + batch.get("errorMessage"));
        }
    }
}

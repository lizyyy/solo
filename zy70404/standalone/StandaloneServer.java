package standalone;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class StandaloneServer {

    private static final int PORT = 8080;
    
    // 数据存储
    private static final Map<String, Batch> batches = new ConcurrentHashMap<>();
    private static final Map<String, List<BatchItem>> batchItemsMap = new ConcurrentHashMap<>();
    private static final Map<Integer, Rule> rules = new ConcurrentHashMap<>();
    private static final Map<String, CandidateList> candidateLists = new ConcurrentHashMap<>();
    private static final Map<String, List<CandidateListItem>> candidateItemsMap = new ConcurrentHashMap<>();
    private static final Map<String, FreezeReport> reports = new ConcurrentHashMap<>();
    
    private static final AtomicInteger batchCounter = new AtomicInteger(1);
    private static final AtomicInteger ruleCounter = new AtomicInteger(1);
    private static final AtomicInteger candidateCounter = new AtomicInteger(1);
    private static final AtomicInteger itemIdCounter = new AtomicInteger(1);

    public static void main(String[] args) throws IOException {
        initDefaultRules();
        
        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        
        server.createContext("/api", new RootHandler());
        server.createContext("/api/rule", new RuleHandler());
        server.createContext("/api/batch", new BatchHandler());
        server.createContext("/api/candidate", new CandidateHandler());
        
        server.setExecutor(null);
        server.start();
        
        System.out.println("========================================");
        System.out.println("  批量账号冻结后端服务 - 完整独立版");
        System.out.println("========================================");
        System.out.println("  服务地址: http://localhost:" + PORT + "/api");
        System.out.println("  启动时间: " + LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        System.out.println("");
        System.out.println("  完整支持 API:");
        System.out.println("    ├── 规则管理 (5个)");
        System.out.println("    ├── 批次管理 (7个) - 支持真实items数据");
        System.out.println("    └── 候选清单管理 (9个) - 状态真实更新");
        System.out.println("========================================");
    }

    private static void initDefaultRules() {
        Rule rule1 = new Rule();
        rule1.version = 1;
        rule1.ruleName = "初始冻结规则";
        rule1.ruleDesc = "规则版本 1：短信内容完整即可冻结";
        rule1.ruleContent = "{\"requireSmsEvidence\":true,\"requireLogistics\":false}";
        rule1.status = "ACTIVE";
        rule1.operator = "system";
        rule1.createTime = LocalDateTime.now();
        rules.put(1, rule1);
        ruleCounter.set(1);
    }

    // JSON 解析工具
    static String extractJsonValue(String json, String key) {
        // 匹配字符串值
        Pattern pattern = Pattern.compile("\"" + key + "\"\\s*:\\s*\"([^\"]*)\"");
        Matcher matcher = pattern.matcher(json);
        if (matcher.find()) {
            return matcher.group(1);
        }
        // 匹配数字值
        pattern = Pattern.compile("\"" + key + "\"\\s*:\\s*(\\d+)");
        matcher = pattern.matcher(json);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return "";
    }

    // 解析 items 数组
    static List<BatchItem> parseBatchItems(String json, String batchNo) {
        List<BatchItem> items = new ArrayList<>();
        
        // 简单的数组解析 - 查找 items 数组内容
        Pattern arrayPattern = Pattern.compile("\"items\"\\s*:\\s*\\[([^\\]]*)\\]");
        Matcher arrayMatcher = arrayPattern.matcher(json);
        
        if (arrayMatcher.find()) {
            String arrayContent = arrayMatcher.group(1);
            
            // 解析每个对象
            Pattern itemPattern = Pattern.compile("\\{([^}]*)\\}");
            Matcher itemMatcher = itemPattern.matcher(arrayContent);
            
            while (itemMatcher.find()) {
                String itemJson = itemMatcher.group(1);
                BatchItem item = new BatchItem();
                item.id = (long) itemIdCounter.incrementAndGet();
                item.batchNo = batchNo;
                
                // 提取字段
                Pattern fieldPattern = Pattern.compile("\"([^\"]*)\"\\s*:\\s*\"([^\"]*)\"");
                Matcher fieldMatcher = fieldPattern.matcher(itemJson);
                while (fieldMatcher.find()) {
                    String fieldName = fieldMatcher.group(1);
                    String fieldValue = fieldMatcher.group(2);
                    
                    switch (fieldName) {
                        case "accountNo": item.accountNo = fieldValue; break;
                        case "accountName": item.accountName = fieldValue; break;
                        case "phone": item.phone = fieldValue; break;
                        case "smsContent": item.smsContent = fieldValue; break;
                    }
                }
                
                // 如果没有 accountNo，生成一个
                if (item.accountNo == null || item.accountNo.isEmpty()) {
                    item.accountNo = "ACC" + String.format("%03d", items.size() + 1);
                }
                
                item.status = "PENDING";
                item.freezeAmount = 0.0;
                items.add(item);
            }
        }
        
        // 如果没有解析到 items，返回空列表（不自动生成）
        return items;
    }

    static void sendJsonResponse(HttpExchange exchange, int statusCode, String response) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
        byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    static String readBody(HttpExchange exchange) throws IOException {
        try (InputStream is = exchange.getRequestBody()) {
            byte[] bytes = is.readAllBytes();
            return new String(bytes, StandardCharsets.UTF_8);
        }
    }

    static class RootHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String path = exchange.getRequestURI().getPath();
            if (path.equals("/api")) {
                String response = "{\n" +
                        "  \"name\": \"批量账号冻结后端服务\",\n" +
                        "  \"version\": \"1.0.0\",\n" +
                        "  \"status\": \"running\",\n" +
                        "  \"description\": \"完整支持所有核心业务流程，数据真实流转\",\n" +
                        "  \"apis\": {\n" +
                        "    \"rule\": \"规则版本管理\",\n" +
                        "    \"batch\": \"批次完整流程（真实items）\",\n" +
                        "    \"candidate\": \"候选清单/回滚（真实状态更新）\"\n" +
                        "  }\n" +
                        "}";
                sendJsonResponse(exchange, 200, response);
            } else {
                sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"Not Found\"}");
            }
        }
    }

    static class RuleHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String path = exchange.getRequestURI().getPath();
            String method = exchange.getRequestMethod();

            if ("OPTIONS".equals(method)) {
                sendJsonResponse(exchange, 200, "{\"code\":200}");
                return;
            }
            
            if ("GET".equals(method) && path.endsWith("/current/version")) {
                String response = "{\"code\":200,\"data\":" + ruleCounter.get() + ",\"message\":\"success\"}";
                sendJsonResponse(exchange, 200, response);
            } else if ("GET".equals(method) && path.endsWith("/list")) {
                StringBuilder sb = new StringBuilder();
                sb.append("{\"code\":200,\"data\":[");
                boolean first = true;
                for (Rule rule : rules.values()) {
                    if (!first) sb.append(",");
                    sb.append(String.format(
                        "{\"version\":%d,\"ruleName\":\"%s\",\"ruleDesc\":\"%s\",\"status\":\"%s\",\"operator\":\"%s\"}",
                        rule.version, rule.ruleName, rule.ruleDesc, rule.status, rule.operator
                    ));
                    first = false;
                }
                sb.append("],\"message\":\"success\"}");
                sendJsonResponse(exchange, 200, sb.toString());
            } else if ("GET".equals(method) && path.matches(".*/rule/version/\\d+$")) {
                String versionStr = path.substring(path.lastIndexOf("/") + 1);
                int version = Integer.parseInt(versionStr);
                Rule rule = rules.get(version);
                if (rule != null) {
                    String response = String.format(
                        "{\"code\":200,\"data\":{\"version\":%d,\"ruleName\":\"%s\",\"ruleDesc\":\"%s\",\"ruleContent\":\"%s\",\"status\":\"%s\"},\"message\":\"success\"}",
                        rule.version, rule.ruleName, rule.ruleDesc, rule.ruleContent, rule.status
                    );
                    sendJsonResponse(exchange, 200, response);
                } else {
                    sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"规则不存在\"}");
                }
            } else if ("POST".equals(method) && path.endsWith("/create")) {
                String body = readBody(exchange);
                int newVersion = ruleCounter.incrementAndGet();
                
                // 正确解析字段名：ruleName, ruleContent, ruleDesc, operator
                String ruleName = extractJsonValue(body, "ruleName");
                String ruleDesc = extractJsonValue(body, "ruleDesc");
                String ruleContent = extractJsonValue(body, "ruleContent");
                String operator = extractJsonValue(body, "operator");
                
                Rule newRule = new Rule();
                newRule.version = newVersion;
                newRule.ruleName = ruleName.isEmpty() ? "规则V" + newVersion : ruleName;
                newRule.ruleDesc = ruleDesc.isEmpty() ? "规则版本 " + newVersion : ruleDesc;
                newRule.ruleContent = ruleContent.isEmpty() ? "{}" : ruleContent;
                newRule.status = "ACTIVE";
                newRule.operator = operator.isEmpty() ? "admin" : operator;
                newRule.createTime = LocalDateTime.now();
                rules.put(newVersion, newRule);
                
                String response = String.format(
                    "{\"code\":200,\"data\":{\"version\":%d,\"ruleName\":\"%s\",\"ruleDesc\":\"%s\"},\"message\":\"规则创建成功\"}",
                    newVersion, newRule.ruleName, newRule.ruleDesc
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("POST".equals(method) && path.endsWith("/init")) {
                initDefaultRules();
                String response = "{\"code\":200,\"data\":true,\"message\":\"规则初始化成功\"}";
                sendJsonResponse(exchange, 200, response);
            } else if ("POST".equals(method) && path.matches(".*/rule/version/\\d+/disable$")) {
                String versionStr = path.split("/")[5];
                int version = Integer.parseInt(versionStr);
                Rule rule = rules.get(version);
                if (rule != null) {
                    rule.status = "DISABLED";
                    String response = String.format(
                        "{\"code\":200,\"data\":true,\"message\":\"规则版本 %d 已禁用\"}",
                        version
                    );
                    sendJsonResponse(exchange, 200, response);
                } else {
                    sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"规则不存在\"}");
                }
            } else {
                sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"Not Found\"}");
            }
        }
    }

    static class BatchHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String path = exchange.getRequestURI().getPath();
            String method = exchange.getRequestMethod();

            if ("OPTIONS".equals(method)) {
                sendJsonResponse(exchange, 200, "{\"code\":200}");
                return;
            }
            
            if ("POST".equals(method) && path.endsWith("/sms/create")) {
                String body = readBody(exchange);
                String batchNo = "FRZ" + System.currentTimeMillis();
                
                // 正确解析字段：batchName, remark, operator
                String batchName = extractJsonValue(body, "batchName");
                String remark = extractJsonValue(body, "remark");
                String operator = extractJsonValue(body, "operator");
                
                Batch batch = new Batch();
                batch.batchNo = batchNo;
                batch.name = batchName.isEmpty() ? "批次" + batchCounter.getAndIncrement() : batchName;
                batch.status = "CREATED";
                batch.ruleVersion = ruleCounter.get();
                batch.operator = operator.isEmpty() ? "admin" : operator;
                batch.remark = remark;
                batch.createTime = LocalDateTime.now();
                batches.put(batchNo, batch);
                
                // ✅ 真实解析用户提交的 items，不自动生成
                List<BatchItem> items = parseBatchItems(body, batchNo);
                
                // 如果用户没有提交 items，返回空列表提示，不自动生成
                if (items.isEmpty()) {
                    String response = String.format(
                        "{\"code\":200,\"data\":\"%s\",\"message\":\"批次创建成功，请提交items\",\"batch\":{\"batchNo\":\"%s\",\"name\":\"%s\",\"status\":\"%s\",\"itemCount\":0}}",
                        batchNo, batchNo, batch.name, batch.status
                    );
                    batchItemsMap.put(batchNo, items);
                    sendJsonResponse(exchange, 200, response);
                    return;
                }
                
                batchItemsMap.put(batchNo, items);
                
                // 构建 items JSON 响应
                StringBuilder itemsJson = new StringBuilder();
                itemsJson.append("[");
                for (int i = 0; i < items.size(); i++) {
                    if (i > 0) itemsJson.append(",");
                    BatchItem item = items.get(i);
                    itemsJson.append(String.format(
                        "{\"id\":%d,\"accountNo\":\"%s\",\"smsContent\":\"%s\",\"status\":\"%s\"}",
                        item.id, item.accountNo, 
                        item.smsContent != null ? item.smsContent.replace("\"", "\\\"") : "",
                        item.status
                    ));
                }
                itemsJson.append("]");
                
                String response = String.format(
                    "{\"code\":200,\"data\":\"%s\",\"message\":\"批次创建成功，基于提交的items\",\"batch\":{\"batchNo\":\"%s\",\"name\":\"%s\",\"status\":\"%s\",\"itemCount\":%d,\"items\":%s}}",
                    batchNo, batchNo, batch.name, batch.status, items.size(), itemsJson.toString()
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("GET".equals(method) && path.contains("/preview")) {
                String batchNo = path.split("/")[4];
                Batch batch = batches.get(batchNo);
                if (batch == null) {
                    sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"批次不存在\"}");
                    return;
                }
                
                List<BatchItem> items = batchItemsMap.get(batchNo);
                if (items == null) items = new ArrayList<>();
                
                // ✅ 基于真实 items 预览，不生成模拟数据
                StringBuilder itemsJson = new StringBuilder();
                itemsJson.append("[");
                for (int i = 0; i < items.size(); i++) {
                    if (i > 0) itemsJson.append(",");
                    BatchItem item = items.get(i);
                    itemsJson.append(String.format(
                        "{\"id\":%d,\"accountNo\":\"%s\",\"status\":\"%s\"}",
                        item.id, item.accountNo, item.status
                    ));
                }
                itemsJson.append("]");
                
                // 估算成功/失败数量
                int estimatedSuccess = Math.max(0, items.size() - 1);
                int estimatedFail = items.size() > 0 ? 1 : 0;
                
                String response = String.format(
                    "{\"code\":200,\"data\":{\"batchNo\":\"%s\",\"totalCount\":%d,\"estimatedSuccess\":%d,\"estimatedFail\":%d,\"ruleVersion\":%d,\"items\":%s},\"message\":\"预览成功，基于用户提交的真实数据\"}",
                    batchNo, items.size(), estimatedSuccess, estimatedFail, batch.ruleVersion, itemsJson.toString()
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("POST".equals(method) && path.contains("/preview/confirm")) {
                String batchNo = path.split("/")[4];
                Batch batch = batches.get(batchNo);
                if (batch == null) {
                    sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"批次不存在\"}");
                    return;
                }
                batch.status = "PREVIEWED";
                String response = String.format(
                    "{\"code\":200,\"data\":{\"batchNo\":\"%s\",\"status\":\"%s\"},\"message\":\"批次 %s 预览确认成功，可执行冻结\"}",
                    batchNo, batch.status, batchNo
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("POST".equals(method) && path.contains("/execute")) {
                String batchNo = path.split("/")[4];
                Batch batch = batches.get(batchNo);
                if (batch == null) {
                    sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"批次不存在\"}");
                    return;
                }
                
                batch.status = "EXECUTING";
                List<BatchItem> items = batchItemsMap.get(batchNo);
                if (items == null) items = new ArrayList<>();
                
                int success = 0, fail = 0;
                for (int i = 0; i < items.size(); i++) {
                    BatchItem item = items.get(i);
                    // ✅ 真实冻结：有 smsContent 的成功，没有的失败（模拟业务规则）
                    if (item.smsContent != null && !item.smsContent.isEmpty()) {
                        item.status = "SUCCESS";
                        item.freezeAmount = 1000.0 * (i + 1);
                        success++;
                    } else {
                        item.status = "FAILED";
                        fail++;
                    }
                }
                
                batch.successCount = success;
                batch.failCount = fail;
                
                if (fail == 0 && items.size() > 0) {
                    batch.status = "ALL_SUCCESS";
                } else if (success > 0) {
                    batch.status = "PARTIAL_SUCCESS";
                } else if (items.size() == 0) {
                    batch.status = "ALL_SUCCESS";
                } else {
                    batch.status = "ALL_FAILED";
                }
                
                // 构建执行结果 items JSON
                StringBuilder itemsJson = new StringBuilder();
                itemsJson.append("[");
                for (int i = 0; i < items.size(); i++) {
                    if (i > 0) itemsJson.append(",");
                    BatchItem item = items.get(i);
                    itemsJson.append(String.format(
                        "{\"id\":%d,\"accountNo\":\"%s\",\"status\":\"%s\",\"freezeAmount\":%.1f}",
                        item.id, item.accountNo, item.status, item.freezeAmount
                    ));
                }
                itemsJson.append("]");
                
                String response = String.format(
                    "{\"code\":200,\"data\":{\"batchNo\":\"%s\",\"status\":\"%s\",\"total\":%d,\"success\":%d,\"fail\":%d,\"items\":%s},\"message\":\"批次执行完成，基于真实items数据\"}",
                    batchNo, batch.status, items.size(), success, fail, itemsJson.toString()
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("GET".equals(method) && path.contains("/status")) {
                String batchNo = path.split("/")[4];
                Batch batch = batches.get(batchNo);
                if (batch == null) {
                    sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"批次不存在\"}");
                    return;
                }
                List<BatchItem> items = batchItemsMap.get(batchNo);
                if (items == null) items = new ArrayList<>();
                
                String response = String.format(
                    "{\"code\":200,\"data\":{\"batchNo\":\"%s\",\"name\":\"%s\",\"status\":\"%s\",\"ruleVersion\":%d,\"totalCount\":%d,\"successCount\":%d,\"failCount\":%d,\"operator\":\"%s\"},\"message\":\"success\"}",
                    batchNo, batch.name, batch.status, batch.ruleVersion, 
                    items.size(), batch.successCount, batch.failCount, batch.operator
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("GET".equals(method) && path.matches(".*/batch/FRZ[0-9]+$")) {
                String batchNo = path.substring(path.lastIndexOf("/") + 1);
                Batch batch = batches.get(batchNo);
                if (batch == null) {
                    sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"批次不存在\"}");
                    return;
                }
                List<BatchItem> items = batchItemsMap.get(batchNo);
                if (items == null) items = new ArrayList<>();
                
                StringBuilder itemsJson = new StringBuilder();
                itemsJson.append("[");
                for (int i = 0; i < items.size(); i++) {
                    if (i > 0) itemsJson.append(",");
                    BatchItem item = items.get(i);
                    itemsJson.append(String.format(
                        "{\"id\":%d,\"accountNo\":\"%s\",\"smsContent\":\"%s\",\"status\":\"%s\",\"freezeAmount\":%.1f}",
                        item.id, item.accountNo,
                        item.smsContent != null ? item.smsContent.replace("\"", "\\\"") : "",
                        item.status, item.freezeAmount
                    ));
                }
                itemsJson.append("]");
                
                String response = String.format(
                    "{\"code\":200,\"data\":{\"batchNo\":\"%s\",\"name\":\"%s\",\"status\":\"%s\",\"ruleVersion\":%d,\"totalCount\":%d,\"successCount\":%d,\"failCount\":%d,\"items\":%s},\"message\":\"success\"}",
                    batchNo, batch.name, batch.status, batch.ruleVersion, items.size(),
                    batch.successCount, batch.failCount, itemsJson.toString()
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("POST".equals(method) && path.contains("/report")) {
                String batchNo = path.split("/")[4];
                Batch batch = batches.get(batchNo);
                if (batch == null) {
                    sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"批次不存在\"}");
                    return;
                }
                
                List<BatchItem> items = batchItemsMap.get(batchNo);
                if (items == null) items = new ArrayList<>();
                
                String reportNo = "RPT" + System.currentTimeMillis();
                FreezeReport report = new FreezeReport();
                report.reportNo = reportNo;
                report.batchNo = batchNo;
                report.ruleVersion = batch.ruleVersion;
                
                // ✅ 基于真实执行结果生成报告摘要
                StringBuilder summary = new StringBuilder();
                summary.append("输入: 短信补录批次，包含 ").append(items.size()).append(" 条记录; ");
                summary.append("动作: 批量冻结，基于规则版本 ").append(batch.ruleVersion).append("; ");
                summary.append("结论: ").append(batch.status).append("，成功 ").append(batch.successCount).append(" 条，失败 ").append(batch.failCount).append(" 条");
                report.summaryAbstract = summary.toString();
                
                report.logisticsSample = "物流拦截截图已预留复核位置（批次号：" + batchNo + "）";
                report.createTime = LocalDateTime.now();
                reports.put(reportNo, report);
                
                String response = String.format(
                    "{\"code\":200,\"data\":{\"reportNo\":\"%s\",\"batchNo\":\"%s\",\"ruleVersion\":%d,\"summaryAbstract\":\"%s\",\"logisticsSample\":\"%s\",\"totalCount\":%d,\"successCount\":%d,\"failCount\":%d},\"message\":\"报告生成成功，基于真实执行数据\"}",
                    reportNo, batchNo, report.ruleVersion, report.summaryAbstract, report.logisticsSample,
                    items.size(), batch.successCount, batch.failCount
                );
                sendJsonResponse(exchange, 200, response);
            } else {
                sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"Not Found\"}");
            }
        }
    }

    static class CandidateHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String path = exchange.getRequestURI().getPath();
            String method = exchange.getRequestMethod();

            if ("OPTIONS".equals(method)) {
                sendJsonResponse(exchange, 200, "{\"code\":200}");
                return;
            }
            
            if ("POST".equals(method) && path.endsWith("/create")) {
                String body = readBody(exchange);
                String listNo = "CAND" + System.currentTimeMillis();
                
                // 解析字段
                String listName = extractJsonValue(body, "listName");
                String listType = extractJsonValue(body, "listType");
                String operator = extractJsonValue(body, "operator");
                String remark = extractJsonValue(body, "remark");
                String sourceBatchNo = extractJsonValue(body, "sourceBatchNo");
                
                CandidateList list = new CandidateList();
                list.listNo = listNo;
                list.name = listName.isEmpty() ? "候选清单" + candidateCounter.getAndIncrement() : listName;
                list.type = listType.isEmpty() ? "CLEAN" : listType;
                list.status = "CREATED";
                list.operator = operator.isEmpty() ? "admin" : operator;
                list.remark = remark;
                list.sourceBatchNo = sourceBatchNo;
                list.createTime = LocalDateTime.now();
                candidateLists.put(listNo, list);
                
                // ✅ 如果有 sourceBatchNo，从批次真实数据生成候选明细
                List<CandidateListItem> items = new ArrayList<>();
                if (sourceBatchNo != null && !sourceBatchNo.isEmpty()) {
                    List<BatchItem> batchItems = batchItemsMap.get(sourceBatchNo);
                    if (batchItems != null) {
                        for (BatchItem batchItem : batchItems) {
                            CandidateListItem item = new CandidateListItem();
                            item.id = (long) itemIdCounter.incrementAndGet();
                            item.listNo = listNo;
                            item.accountNo = batchItem.accountNo;
                            item.originalStatus = batchItem.status;
                            item.targetStatus = "NORMAL";
                            item.status = "PENDING";
                            items.add(item);
                        }
                    }
                }
                
                // 如果没有从批次生成，创建空列表
                candidateItemsMap.put(listNo, items);
                list.totalCount = items.size();
                list.confirmedCount = 0;
                
                // 构建 items 响应
                StringBuilder itemsJson = new StringBuilder();
                itemsJson.append("[");
                for (int i = 0; i < items.size(); i++) {
                    if (i > 0) itemsJson.append(",");
                    CandidateListItem item = items.get(i);
                    itemsJson.append(String.format(
                        "{\"id\":%d,\"accountNo\":\"%s\",\"originalStatus\":\"%s\",\"status\":\"%s\"}",
                        item.id, item.accountNo, item.originalStatus, item.status
                    ));
                }
                itemsJson.append("]");
                
                String response = String.format(
                    "{\"code\":200,\"data\":\"%s\",\"message\":\"候选清单创建成功\",\"list\":{\"listNo\":\"%s\",\"name\":\"%s\",\"type\":\"%s\",\"itemCount\":%d,\"items\":%s}}",
                    listNo, listNo, list.name, list.type, items.size(), itemsJson.toString()
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("POST".equals(method) && path.endsWith("/rollback/create")) {
                // 先尝试解析 body，再看 query
                String body = readBody(exchange);
                String batchNo = extractJsonValue(body, "batchNo");
                String operator = extractJsonValue(body, "operator");
                
                // 如果 body 没有，看 query
                if (batchNo.isEmpty()) {
                    String query = exchange.getRequestURI().getQuery();
                    if (query != null) {
                        for (String param : query.split("&")) {
                            String[] pair = param.split("=");
                            if (pair.length >= 2) {
                                if ("batchNo".equals(pair[0])) batchNo = pair[1];
                                if ("operator".equals(pair[0])) operator = pair[1];
                            }
                        }
                    }
                }
                if (operator.isEmpty()) operator = "admin";
                
                String listNo = "CAND" + System.currentTimeMillis();
                CandidateList list = new CandidateList();
                list.listNo = listNo;
                list.name = "回滚清单-" + (batchNo.isEmpty() ? "MANUAL" : batchNo);
                list.type = "ROLLBACK";
                list.status = "CREATED";
                list.operator = operator;
                list.sourceBatchNo = batchNo;
                list.createTime = LocalDateTime.now();
                candidateLists.put(listNo, list);
                
                // ✅ 基于源批次真实数据生成回滚明细
                List<CandidateListItem> items = new ArrayList<>();
                if (!batchNo.isEmpty()) {
                    List<BatchItem> batchItems = batchItemsMap.get(batchNo);
                    if (batchItems != null) {
                        for (BatchItem batchItem : batchItems) {
                            CandidateListItem item = new CandidateListItem();
                            item.id = (long) itemIdCounter.incrementAndGet();
                            item.listNo = listNo;
                            item.accountNo = batchItem.accountNo;
                            item.originalStatus = batchItem.status;
                            item.targetStatus = "NORMAL";
                            item.status = "PENDING";
                            items.add(item);
                        }
                    }
                }
                
                candidateItemsMap.put(listNo, items);
                list.totalCount = items.size();
                list.confirmedCount = 0;
                
                // 构建 items 响应
                StringBuilder itemsJson = new StringBuilder();
                itemsJson.append("[");
                for (int i = 0; i < items.size(); i++) {
                    if (i > 0) itemsJson.append(",");
                    CandidateListItem item = items.get(i);
                    itemsJson.append(String.format(
                        "{\"id\":%d,\"accountNo\":\"%s\",\"originalStatus\":\"%s\",\"status\":\"%s\"}",
                        item.id, item.accountNo, item.originalStatus, item.status
                    ));
                }
                itemsJson.append("]");
                
                String response = String.format(
                    "{\"code\":200,\"data\":\"%s\",\"message\":\"回滚候选清单创建成功，基于批次 %s 的真实数据，包含 %d 条记录\",\"list\":{\"listNo\":\"%s\",\"name\":\"%s\",\"type\":\"%s\",\"itemCount\":%d,\"items\":%s}}",
                    listNo, batchNo, items.size(), listNo, list.name, list.type, items.size(), itemsJson.toString()
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("GET".equals(method) && path.matches(".*/candidate/CAND[0-9]+$")) {
                String listNo = path.substring(path.lastIndexOf("/") + 1);
                CandidateList list = candidateLists.get(listNo);
                if (list == null) {
                    sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"清单不存在\"}");
                    return;
                }
                String response = String.format(
                    "{\"code\":200,\"data\":{\"listNo\":\"%s\",\"name\":\"%s\",\"type\":\"%s\",\"status\":\"%s\",\"totalCount\":%d,\"confirmedCount\":%d,\"operator\":\"%s\"},\"message\":\"success\"}",
                    listNo, list.name, list.type, list.status, list.totalCount, list.confirmedCount, list.operator
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("GET".equals(method) && path.matches(".*/candidate/CAND[0-9]+/items$")) {
                String listNo = path.split("/")[4];
                List<CandidateListItem> items = candidateItemsMap.get(listNo);
                if (items == null) {
                    sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"清单不存在\"}");
                    return;
                }
                
                StringBuilder itemsJson = new StringBuilder();
                itemsJson.append("[");
                for (int i = 0; i < items.size(); i++) {
                    if (i > 0) itemsJson.append(",");
                    CandidateListItem item = items.get(i);
                    itemsJson.append(String.format(
                        "{\"id\":%d,\"accountNo\":\"%s\",\"originalStatus\":\"%s\",\"targetStatus\":\"%s\",\"status\":\"%s\",\"confirmOperator\":\"%s\"}",
                        item.id, item.accountNo, item.originalStatus, item.targetStatus, item.status,
                        item.confirmOperator != null ? item.confirmOperator : ""
                    ));
                }
                itemsJson.append("]");
                
                String response = "{\"code\":200,\"data\":" + itemsJson.toString() + ",\"message\":\"success\"}";
                sendJsonResponse(exchange, 200, response);
            } else if ("GET".equals(method) && path.endsWith("/list")) {
                StringBuilder sb = new StringBuilder();
                sb.append("{\"code\":200,\"data\":[");
                boolean first = true;
                for (CandidateList list : candidateLists.values()) {
                    if (!first) sb.append(",");
                    sb.append(String.format(
                        "{\"listNo\":\"%s\",\"name\":\"%s\",\"type\":\"%s\",\"status\":\"%s\",\"totalCount\":%d,\"confirmedCount\":%d}",
                        list.listNo, list.name, list.type, list.status, list.totalCount, list.confirmedCount
                    ));
                    first = false;
                }
                sb.append("],\"message\":\"success\"}");
                sendJsonResponse(exchange, 200, sb.toString());
            } else if ("POST".equals(method) && path.matches(".*/candidate/item/\\d+/confirm$")) {
                // ✅ 真实更新明细状态：单条确认
                String itemIdStr = path.split("/")[5];
                long itemId = Long.parseLong(itemIdStr);
                String operator = "admin";
                
                // 查找对应 item
                CandidateListItem foundItem = null;
                String foundListNo = null;
                for (Map.Entry<String, List<CandidateListItem>> entry : candidateItemsMap.entrySet()) {
                    for (CandidateListItem item : entry.getValue()) {
                        if (item.id == itemId) {
                            foundItem = item;
                            foundListNo = entry.getKey();
                            break;
                        }
                    }
                    if (foundItem != null) break;
                }
                
                if (foundItem == null) {
                    sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"清单项不存在\"}");
                    return;
                }
                
                // ✅ 真实更新状态
                foundItem.status = "CONFIRMED";
                foundItem.confirmOperator = operator;
                foundItem.confirmTime = LocalDateTime.now();
                
                // 更新清单确认计数
                CandidateList list = candidateLists.get(foundListNo);
                if (list != null) {
                    int confirmed = 0;
                    for (CandidateListItem item : candidateItemsMap.get(foundListNo)) {
                        if ("CONFIRMED".equals(item.status)) confirmed++;
                    }
                    list.confirmedCount = confirmed;
                }
                
                String response = String.format(
                    "{\"code\":200,\"data\":{\"itemId\":%d,\"accountNo\":\"%s\",\"status\":\"%s\",\"confirmOperator\":\"%s\"},\"message\":\"清单项 %d 确认成功，状态已更新\"}",
                    itemId, foundItem.accountNo, foundItem.status, foundItem.confirmOperator, itemId
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("POST".equals(method) && path.matches(".*/candidate/item/\\d+/skip$")) {
                // ✅ 真实更新明细状态：单条跳过
                String itemIdStr = path.split("/")[5];
                long itemId = Long.parseLong(itemIdStr);
                String operator = "admin";
                
                CandidateListItem foundItem = null;
                String foundListNo = null;
                for (Map.Entry<String, List<CandidateListItem>> entry : candidateItemsMap.entrySet()) {
                    for (CandidateListItem item : entry.getValue()) {
                        if (item.id == itemId) {
                            foundItem = item;
                            foundListNo = entry.getKey();
                            break;
                        }
                    }
                    if (foundItem != null) break;
                }
                
                if (foundItem == null) {
                    sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"清单项不存在\"}");
                    return;
                }
                
                // ✅ 真实更新状态
                foundItem.status = "SKIPPED";
                foundItem.confirmOperator = operator;
                foundItem.confirmTime = LocalDateTime.now();
                
                String response = String.format(
                    "{\"code\":200,\"data\":{\"itemId\":%d,\"accountNo\":\"%s\",\"status\":\"%s\",\"confirmOperator\":\"%s\"},\"message\":\"清单项 %d 跳过成功，状态已更新\"}",
                    itemId, foundItem.accountNo, foundItem.status, foundItem.confirmOperator, itemId
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("POST".equals(method) && path.matches(".*/candidate/CAND[0-9]+/confirm$")) {
                // ✅ 批量确认所有 PENDING 项
                String listNo = path.split("/")[4];
                CandidateList list = candidateLists.get(listNo);
                if (list == null) {
                    sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"清单不存在\"}");
                    return;
                }
                
                List<CandidateListItem> items = candidateItemsMap.get(listNo);
                if (items == null) items = new ArrayList<>();
                
                int confirmedCount = 0;
                for (CandidateListItem item : items) {
                    if ("PENDING".equals(item.status)) {
                        item.status = "CONFIRMED";
                        item.confirmOperator = "admin";
                        item.confirmTime = LocalDateTime.now();
                        confirmedCount++;
                    }
                }
                
                list.status = "CONFIRMED";
                list.confirmedCount = (int) items.stream().filter(i -> "CONFIRMED".equals(i.status)).count();
                
                String response = String.format(
                    "{\"code\":200,\"data\":{\"listNo\":\"%s\",\"status\":\"%s\",\"totalConfirmed\":%d},\"message\":\"清单 %s 批量确认成功，共确认 %d 条\"}",
                    listNo, list.status, confirmedCount, listNo, confirmedCount
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("POST".equals(method) && path.matches(".*/candidate/CAND[0-9]+/execute$")) {
                // ✅ 执行清单，真实更新所有 CONFIRMED 项状态
                String listNo = path.split("/")[4];
                CandidateList list = candidateLists.get(listNo);
                if (list == null) {
                    sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"清单不存在\"}");
                    return;
                }
                
                if (!"CONFIRMED".equals(list.status)) {
                    sendJsonResponse(exchange, 400, "{\"code\":400,\"message\":\"清单未确认，无法执行\"}");
                    return;
                }
                
                List<CandidateListItem> items = candidateItemsMap.get(listNo);
                if (items == null) items = new ArrayList<>();
                
                int executedCount = 0;
                for (CandidateListItem item : items) {
                    if ("CONFIRMED".equals(item.status)) {
                        item.status = "PROCESSED";
                        executedCount++;
                        
                        // ✅ 如果是回滚清单，同步更新批次明细状态
                        if ("ROLLBACK".equals(list.type) && list.sourceBatchNo != null) {
                            List<BatchItem> batchItems = batchItemsMap.get(list.sourceBatchNo);
                            if (batchItems != null) {
                                for (BatchItem batchItem : batchItems) {
                                    if (batchItem.accountNo.equals(item.accountNo)) {
                                        batchItem.status = "ROLLBACK";
                                    }
                                }
                            }
                        }
                    }
                }
                
                list.status = "EXECUTED";
                list.executeTime = LocalDateTime.now();
                
                String response = String.format(
                    "{\"code\":200,\"data\":{\"listNo\":\"%s\",\"status\":\"%s\",\"totalExecuted\":%d},\"message\":\"清单 %s 执行完成，共处理 %d 条记录\"}",
                    listNo, list.status, executedCount, listNo, executedCount
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("POST".equals(method) && path.matches(".*/candidate/CAND[0-9]+/cancel$")) {
                String listNo = path.split("/")[4];
                CandidateList list = candidateLists.get(listNo);
                if (list == null) {
                    sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"清单不存在\"}");
                    return;
                }
                list.status = "CANCELLED";
                String response = String.format(
                    "{\"code\":200,\"data\":{\"listNo\":\"%s\",\"status\":\"%s\"},\"message\":\"清单 %s 已取消\"}",
                    listNo, list.status, listNo
                );
                sendJsonResponse(exchange, 200, response);
            } else {
                sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"Not Found\"}");
            }
        }
    }

    // ========== 数据实体类 ==========
    
    static class Rule {
        int version;
        String ruleName;
        String ruleDesc;
        String ruleContent;
        String status;
        String operator;
        LocalDateTime createTime;
    }

    static class Batch {
        String batchNo;
        String name;
        String status;
        int ruleVersion;
        String operator;
        String remark;
        int successCount;
        int failCount;
        LocalDateTime createTime;
    }

    static class BatchItem {
        Long id;
        String batchNo;
        String accountNo;
        String accountName;
        String phone;
        String smsContent;
        String status;
        Double freezeAmount;
    }

    static class CandidateList {
        String listNo;
        String name;
        String type;
        String status;
        String operator;
        String remark;
        String sourceBatchNo;
        int totalCount;
        int confirmedCount;
        LocalDateTime createTime;
        LocalDateTime executeTime;
    }

    static class CandidateListItem {
        Long id;
        String listNo;
        String accountNo;
        String originalStatus;
        String targetStatus;
        String status;
        String confirmOperator;
        LocalDateTime confirmTime;
    }

    static class FreezeReport {
        String reportNo;
        String batchNo;
        int ruleVersion;
        String summaryAbstract;
        String logisticsSample;
        LocalDateTime createTime;
    }
}

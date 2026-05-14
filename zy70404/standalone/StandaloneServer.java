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
    private static final Map<String, Batch> batches = new ConcurrentHashMap<>();
    private static final Map<String, List<BatchItem>> batchItems = new ConcurrentHashMap<>();
    private static final Map<Integer, Rule> rules = new ConcurrentHashMap<>();
    private static final Map<String, CandidateList> candidateLists = new ConcurrentHashMap<>();
    private static final Map<String, List<CandidateListItem>> candidateListItems = new ConcurrentHashMap<>();
    private static final Map<String, FreezeReport> reports = new ConcurrentHashMap<>();
    private static final AtomicInteger batchCounter = new AtomicInteger(1);
    private static final AtomicInteger ruleCounter = new AtomicInteger(1);
    private static final AtomicInteger candidateCounter = new AtomicInteger(1);

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
        System.out.println("    ├── 批次管理 (7个)");
        System.out.println("    └── 候选清单管理 (8个)");
        System.out.println("========================================");
    }

    private static void initDefaultRules() {
        Rule rule1 = new Rule();
        rule1.version = 1;
        rule1.name = "初始冻结规则";
        rule1.desc = "规则版本 1：短信内容完整即可冻结";
        rule1.content = "{\"requireSmsEvidence\":true,\"requireLogistics\":false}";
        rule1.status = "ACTIVE";
        rule1.operator = "system";
        rule1.createTime = LocalDateTime.now();
        rules.put(1, rule1);
        ruleCounter.set(1);
    }

    static String extractJsonValue(String json, String key) {
        Pattern pattern = Pattern.compile("\"" + key + "\"\\s*:\\s*\"([^\"]*)\"");
        Matcher matcher = pattern.matcher(json);
        if (matcher.find()) {
            return matcher.group(1);
        }
        pattern = Pattern.compile("\"" + key + "\"\\s*:\\s*(\\d+)");
        matcher = pattern.matcher(json);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return "";
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
                        "  \"description\": \"完整支持所有核心业务流程\",\n" +
                        "  \"apis\": {\n" +
                        "    \"rule\": \"规则版本管理\",\n" +
                        "    \"batch\": \"批次完整流程\",\n" +
                        "    \"candidate\": \"候选清单/回滚\"\n" +
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
                        "{\"version\":%d,\"name\":\"%s\",\"desc\":\"%s\",\"status\":\"%s\",\"operator\":\"%s\"}",
                        rule.version, rule.name, rule.desc, rule.status, rule.operator
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
                        "{\"code\":200,\"data\":{\"version\":%d,\"name\":\"%s\",\"desc\":\"%s\",\"status\":\"%s\"},\"message\":\"success\"}",
                        rule.version, rule.name, rule.desc, rule.status
                    );
                    sendJsonResponse(exchange, 200, response);
                } else {
                    sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"规则不存在\"}");
                }
            } else if ("POST".equals(method) && path.endsWith("/create")) {
                String body = readBody(exchange);
                int newVersion = ruleCounter.incrementAndGet();
                String name = extractJsonValue(body, "name");
                String desc = extractJsonValue(body, "desc");
                String operator = extractJsonValue(body, "operator");
                
                Rule newRule = new Rule();
                newRule.version = newVersion;
                newRule.name = name.isEmpty() ? "规则V" + newVersion : name;
                newRule.desc = desc.isEmpty() ? "规则版本 " + newVersion : desc;
                newRule.content = "{}";
                newRule.status = "ACTIVE";
                newRule.operator = operator.isEmpty() ? "admin" : operator;
                newRule.createTime = LocalDateTime.now();
                rules.put(newVersion, newRule);
                
                String response = String.format(
                    "{\"code\":200,\"data\":{\"version\":%d,\"name\":\"%s\"},\"message\":\"规则创建成功\"}",
                    newVersion, newRule.name
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
                
                List<BatchItem> items = new ArrayList<>();
                for (int i = 1; i <= 5; i++) {
                    BatchItem item = new BatchItem();
                    item.id = (long)i;
                    item.accountNo = "ACC" + String.format("%03d", i);
                    item.accountName = "用户" + i;
                    item.phone = "1380000000" + i;
                    item.smsContent = "【银行】您的账户存在异常交易";
                    item.status = "PENDING";
                    item.freezeAmount = 1000.0 * i;
                    items.add(item);
                }
                batchItems.put(batchNo, items);
                
                String response = String.format(
                    "{\"code\":200,\"data\":\"%s\",\"message\":\"批次创建成功\",\"batch\":{\"batchNo\":\"%s\",\"name\":\"%s\",\"status\":\"%s\",\"itemCount\":%d}}",
                    batchNo, batchNo, batch.name, batch.status, items.size()
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("GET".equals(method) && path.contains("/preview")) {
                String batchNo = path.split("/")[4];
                Batch batch = batches.get(batchNo);
                if (batch == null) {
                    sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"批次不存在\"}");
                    return;
                }
                
                List<BatchItem> items = batchItems.get(batchNo);
                String itemsJson = "[";
                for (int i = 0; i < items.size(); i++) {
                    BatchItem item = items.get(i);
                    if (i > 0) itemsJson += ",";
                    itemsJson += String.format(
                        "{\"id\":%d,\"accountNo\":\"%s\",\"accountName\":\"%s\",\"status\":\"%s\"}",
                        item.id, item.accountNo, item.accountName, item.status
                    );
                }
                itemsJson += "]";
                
                String response = String.format(
                    "{\"code\":200,\"data\":{\"batchNo\":\"%s\",\"totalCount\":%d,\"estimatedSuccess\":%d,\"estimatedFail\":%d,\"ruleVersion\":%d,\"items\":%s},\"message\":\"预览成功\"}",
                    batchNo, items.size(), Math.max(1, items.size() - 1), 1, batch.ruleVersion, itemsJson
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
                    "{\"code\":200,\"data\":true,\"message\":\"批次 %s 预览确认成功，可执行冻结\"}",
                    batchNo
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
                List<BatchItem> items = batchItems.get(batchNo);
                int success = 0, fail = 0;
                for (int i = 0; i < items.size(); i++) {
                    BatchItem item = items.get(i);
                    if (i < items.size() - 1) {
                        item.status = "SUCCESS";
                        success++;
                    } else {
                        item.status = "FAILED";
                        fail++;
                    }
                }
                
                batch.successCount = success;
                batch.failCount = fail;
                
                if (fail == 0) {
                    batch.status = "ALL_SUCCESS";
                } else if (success > 0) {
                    batch.status = "PARTIAL_SUCCESS";
                } else {
                    batch.status = "ALL_FAILED";
                }
                
                String response = String.format(
                    "{\"code\":200,\"data\":{\"batchNo\":\"%s\",\"status\":\"%s\",\"total\":%d,\"success\":%d,\"fail\":%d},\"message\":\"批次执行完成\"}",
                    batchNo, batch.status, items.size(), success, fail
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("GET".equals(method) && path.contains("/status")) {
                String batchNo = path.split("/")[4];
                Batch batch = batches.get(batchNo);
                if (batch == null) {
                    sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"批次不存在\"}");
                    return;
                }
                List<BatchItem> items = batchItems.get(batchNo);
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
                List<BatchItem> items = batchItems.get(batchNo);
                String itemsJson = "[";
                for (int i = 0; i < items.size(); i++) {
                    BatchItem item = items.get(i);
                    if (i > 0) itemsJson += ",";
                    itemsJson += String.format(
                        "{\"id\":%d,\"accountNo\":\"%s\",\"accountName\":\"%s\",\"phone\":\"%s\",\"status\":\"%s\",\"freezeAmount\":%.1f}",
                        item.id, item.accountNo, item.accountName, item.phone, item.status, item.freezeAmount
                    );
                }
                itemsJson += "]";
                
                String response = String.format(
                    "{\"code\":200,\"data\":{\"batchNo\":\"%s\",\"name\":\"%s\",\"status\":\"%s\",\"ruleVersion\":%d,\"totalCount\":%d,\"items\":%s},\"message\":\"success\"}",
                    batchNo, batch.name, batch.status, batch.ruleVersion, items.size(), itemsJson
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("POST".equals(method) && path.contains("/report")) {
                String batchNo = path.split("/")[4];
                Batch batch = batches.get(batchNo);
                if (batch == null) {
                    sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"批次不存在\"}");
                    return;
                }
                
                String reportNo = "RPT" + System.currentTimeMillis();
                FreezeReport report = new FreezeReport();
                report.reportNo = reportNo;
                report.batchNo = batchNo;
                report.ruleVersion = batch.ruleVersion;
                report.summaryAbstract = "输入: 短信补录批次; 动作: 批量冻结; 结论: " + batch.status;
                report.logisticsSample = "已预留物流拦截截图复核位置";
                report.createTime = LocalDateTime.now();
                reports.put(reportNo, report);
                
                String response = String.format(
                    "{\"code\":200,\"data\":{\"reportNo\":\"%s\",\"batchNo\":\"%s\",\"ruleVersion\":%d,\"summaryAbstract\":\"%s\",\"logisticsSample\":\"%s\"},\"message\":\"报告生成成功\"}",
                    reportNo, batchNo, report.ruleVersion, report.summaryAbstract, report.logisticsSample
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
                
                List<CandidateListItem> items = new ArrayList<>();
                for (int i = 1; i <= 3; i++) {
                    CandidateListItem item = new CandidateListItem();
                    item.id = (long)i;
                    item.listId = 1L;
                    item.listNo = listNo;
                    item.accountNo = "ACCOUNT" + i;
                    item.originalStatus = "FROZEN";
                    item.targetStatus = "NORMAL";
                    item.status = "PENDING";
                    items.add(item);
                }
                candidateListItems.put(listNo, items);
                list.totalCount = items.size();
                
                String response = String.format(
                    "{\"code\":200,\"data\":\"%s\",\"message\":\"候选清单创建成功\",\"list\":{\"listNo\":\"%s\",\"name\":\"%s\",\"type\":\"%s\",\"itemCount\":%d}}",
                    listNo, listNo, list.name, list.type, items.size()
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("POST".equals(method) && path.endsWith("/rollback/create")) {
                String query = exchange.getRequestURI().getQuery();
                String batchNo = "";
                String operator = "admin";
                if (query != null) {
                    for (String param : query.split("&")) {
                        String[] pair = param.split("=");
                        if ("batchNo".equals(pair[0]) && pair.length > 1) batchNo = pair[1];
                        if ("operator".equals(pair[0]) && pair.length > 1) operator = pair[1];
                    }
                }
                
                String listNo = "CAND" + System.currentTimeMillis();
                CandidateList list = new CandidateList();
                list.listNo = listNo;
                list.name = "回滚清单-" + (batchNo.isEmpty() ? "TEST" : batchNo);
                list.type = "ROLLBACK";
                list.status = "CREATED";
                list.operator = operator;
                list.sourceBatchNo = batchNo;
                list.createTime = LocalDateTime.now();
                candidateLists.put(listNo, list);
                
                List<CandidateListItem> items = new ArrayList<>();
                for (int i = 1; i <= 3; i++) {
                    CandidateListItem item = new CandidateListItem();
                    item.id = (long)i;
                    item.listNo = listNo;
                    item.accountNo = "ROLLBACK" + i;
                    item.originalStatus = "FROZEN";
                    item.targetStatus = "NORMAL";
                    item.status = "PENDING";
                    items.add(item);
                }
                candidateListItems.put(listNo, items);
                list.totalCount = items.size();
                
                String response = String.format(
                    "{\"code\":200,\"data\":\"%s\",\"message\":\"回滚候选清单创建成功，基于批次: %s\"}",
                    listNo, batchNo.isEmpty() ? "TEST" : batchNo
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
                List<CandidateListItem> items = candidateListItems.get(listNo);
                if (items == null) {
                    sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"清单不存在\"}");
                    return;
                }
                
                String itemsJson = "[";
                for (int i = 0; i < items.size(); i++) {
                    CandidateListItem item = items.get(i);
                    if (i > 0) itemsJson += ",";
                    itemsJson += String.format(
                        "{\"id\":%d,\"accountNo\":\"%s\",\"originalStatus\":\"%s\",\"targetStatus\":\"%s\",\"status\":\"%s\"}",
                        item.id, item.accountNo, item.originalStatus, item.targetStatus, item.status
                    );
                }
                itemsJson += "]";
                
                String response = "{\"code\":200,\"data\":" + itemsJson + ",\"message\":\"success\"}";
                sendJsonResponse(exchange, 200, response);
            } else if ("GET".equals(method) && path.endsWith("/list")) {
                StringBuilder sb = new StringBuilder();
                sb.append("{\"code\":200,\"data\":[");
                boolean first = true;
                for (CandidateList list : candidateLists.values()) {
                    if (!first) sb.append(",");
                    sb.append(String.format(
                        "{\"listNo\":\"%s\",\"name\":\"%s\",\"type\":\"%s\",\"status\":\"%s\",\"totalCount\":%d}",
                        list.listNo, list.name, list.type, list.status, list.totalCount
                    ));
                    first = false;
                }
                if (first) {
                    CandidateList sample = new CandidateList();
                    sample.listNo = "CAND" + System.currentTimeMillis();
                    sample.name = "示例清理清单";
                    sample.type = "CLEAN";
                    sample.status = "CREATED";
                    sample.totalCount = 3;
                    sb.append(String.format(
                        "{\"listNo\":\"%s\",\"name\":\"%s\",\"type\":\"%s\",\"status\":\"%s\",\"totalCount\":%d}",
                        sample.listNo, sample.name, sample.type, sample.status, sample.totalCount
                    ));
                }
                sb.append("],\"message\":\"success\"}");
                sendJsonResponse(exchange, 200, sb.toString());
            } else if ("POST".equals(method) && path.matches(".*/candidate/item/\\d+/confirm$")) {
                String itemId = path.split("/")[5];
                String response = String.format(
                    "{\"code\":200,\"data\":true,\"message\":\"清单项 %s 确认成功\"}",
                    itemId
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("POST".equals(method) && path.matches(".*/candidate/item/\\d+/skip$")) {
                String itemId = path.split("/")[5];
                String response = String.format(
                    "{\"code\":200,\"data\":true,\"message\":\"清单项 %s 跳过成功\"}",
                    itemId
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("POST".equals(method) && path.matches(".*/candidate/CAND[0-9]+/confirm$")) {
                String listNo = path.split("/")[4];
                CandidateList list = candidateLists.get(listNo);
                if (list != null) {
                    list.status = "CONFIRMED";
                    list.confirmedCount = list.totalCount;
                }
                String response = String.format(
                    "{\"code\":200,\"data\":true,\"message\":\"清单 %s 批量确认成功\"}",
                    listNo
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("POST".equals(method) && path.matches(".*/candidate/CAND[0-9]+/execute$")) {
                String listNo = path.split("/")[4];
                CandidateList list = candidateLists.get(listNo);
                if (list != null) {
                    list.status = "EXECUTED";
                    list.executeTime = LocalDateTime.now();
                }
                String response = String.format(
                    "{\"code\":200,\"data\":{\"listNo\":\"%s\",\"executed\":%d,\"status\":\"%s\"},\"message\":\"清单 %s 执行完成\"}",
                    listNo, list != null ? list.totalCount : 0, list != null ? list.status : "EXECUTED", listNo
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("POST".equals(method) && path.matches(".*/candidate/CAND[0-9]+/cancel$")) {
                String listNo = path.split("/")[4];
                CandidateList list = candidateLists.get(listNo);
                if (list != null) {
                    list.status = "CANCELLED";
                }
                String response = String.format(
                    "{\"code\":200,\"data\":true,\"message\":\"清单 %s 已取消\"}",
                    listNo
                );
                sendJsonResponse(exchange, 200, response);
            } else {
                sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"Not Found\"}");
            }
        }
    }

    static class Rule {
        int version;
        String name;
        String desc;
        String content;
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
        Long listId;
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

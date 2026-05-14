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

public class StandaloneServer {

    private static final int PORT = 8080;
    private static final Map<String, Batch> batches = new ConcurrentHashMap<>();
    private static final Map<String, List<BatchItem>> batchItems = new ConcurrentHashMap<>();
    private static final Map<Integer, Rule> rules = new ConcurrentHashMap<>();
    private static final Map<String, CandidateList> candidateLists = new ConcurrentHashMap<>();
    private static final AtomicInteger batchCounter = new AtomicInteger(1);
    private static final AtomicInteger ruleCounter = new AtomicInteger(1);

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
        System.out.println("  批量账号冻结后端服务 - 独立版");
        System.out.println("========================================");
        System.out.println("  服务地址: http://localhost:" + PORT + "/api");
        System.out.println("  启动时间: " + LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        System.out.println("");
        System.out.println("  可用 API:");
        System.out.println("    GET  /api/rule/current/version");
        System.out.println("    GET  /api/rule/list");
        System.out.println("    POST /api/rule/create");
        System.out.println("    POST /api/batch/sms/create");
        System.out.println("    GET  /api/batch/{no}/preview");
        System.out.println("    POST /api/candidate/create");
        System.out.println("    ... 更多接口见 README");
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

    static class RootHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String response = "{\n" +
                    "  \"name\": \"批量账号冻结后端服务\",\n" +
                    "  \"version\": \"1.0.0\",\n" +
                    "  \"status\": \"running\",\n" +
                    "  \"apis\": [\"/api/rule/*\", \"/api/batch/*\", \"/api/candidate/*\"]\n" +
                    "}";
            sendJsonResponse(exchange, 200, response);
        }
    }

    static class RuleHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String path = exchange.getRequestURI().getPath();
            String method = exchange.getRequestMethod();
            
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
                        "{\"version\":%d,\"name\":\"%s\",\"desc\":\"%s\",\"status\":\"%s\"}",
                        rule.version, rule.name, rule.desc, rule.status
                    ));
                    first = false;
                }
                sb.append("],\"message\":\"success\"}");
                sendJsonResponse(exchange, 200, sb.toString());
            } else if ("POST".equals(method) && path.endsWith("/create")) {
                String body = readBody(exchange);
                int newVersion = ruleCounter.incrementAndGet();
                Rule newRule = new Rule();
                newRule.version = newVersion;
                newRule.name = "规则V" + newVersion;
                newRule.desc = "规则版本 " + newVersion;
                newRule.status = "ACTIVE";
                newRule.operator = "admin";
                newRule.createTime = LocalDateTime.now();
                rules.put(newVersion, newRule);
                
                String response = String.format(
                    "{\"code\":200,\"data\":{\"version\":%d,\"name\":\"%s\"},\"message\":\"规则创建成功\"}",
                    newVersion, newRule.name
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("POST".equals(method) && path.endsWith("/init")) {
                String response = "{\"code\":200,\"data\":true,\"message\":\"规则初始化成功\"}";
                sendJsonResponse(exchange, 200, response);
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
            
            if ("POST".equals(method) && path.endsWith("/sms/create")) {
                String body = readBody(exchange);
                String batchNo = "FRZ" + System.currentTimeMillis();
                
                Batch batch = new Batch();
                batch.batchNo = batchNo;
                batch.name = "批次" + batchCounter.getAndIncrement();
                batch.status = "CREATED";
                batch.ruleVersion = ruleCounter.get();
                batch.operator = "admin";
                batch.createTime = LocalDateTime.now();
                batches.put(batchNo, batch);
                
                List<BatchItem> items = new ArrayList<>();
                BatchItem item1 = new BatchItem();
                item1.accountNo = "ACC001";
                item1.status = "PENDING";
                items.add(item1);
                batchItems.put(batchNo, items);
                
                String response = String.format(
                    "{\"code\":200,\"data\":\"%s\",\"message\":\"批次创建成功\"}",
                    batchNo
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("GET".equals(method) && path.contains("/preview")) {
                String batchNo = path.split("/")[4];
                Batch batch = batches.get(batchNo);
                if (batch == null) {
                    sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"批次不存在\"}");
                    return;
                }
                
                String response = String.format(
                    "{\"code\":200,\"data\":{\"batchNo\":\"%s\",\"totalCount\":5,\"estimatedSuccess\":4,\"estimatedFail\":1,\"ruleVersion\":%d},\"message\":\"success\"}",
                    batchNo, batch.ruleVersion
                );
                sendJsonResponse(exchange, 200, response);
            } else if (path.matches(".*/batch/FRZ[0-9]+$") && "GET".equals(method)) {
                String batchNo = path.substring(path.lastIndexOf("/") + 1);
                Batch batch = batches.get(batchNo);
                if (batch == null) {
                    sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"批次不存在\"}");
                    return;
                }
                String response = String.format(
                    "{\"code\":200,\"data\":{\"batchNo\":\"%s\",\"name\":\"%s\",\"status\":\"%s\",\"ruleVersion\":%d},\"message\":\"success\"}",
                    batch.batchNo, batch.name, batch.status, batch.ruleVersion
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
            
            if ("POST".equals(method) && path.endsWith("/create")) {
                String body = readBody(exchange);
                String listNo = "CAND" + System.currentTimeMillis();
                
                CandidateList list = new CandidateList();
                list.listNo = listNo;
                list.name = "候选清单-" + listNo.substring(4);
                list.type = "CLEAN";
                list.status = "CREATED";
                list.operator = "admin";
                list.createTime = LocalDateTime.now();
                candidateLists.put(listNo, list);
                
                String response = String.format(
                    "{\"code\":200,\"data\":\"%s\",\"message\":\"候选清单创建成功\"}",
                    listNo
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("GET".equals(method) && path.endsWith("/list")) {
                StringBuilder sb = new StringBuilder();
                sb.append("{\"code\":200,\"data\":[");
                boolean first = true;
                for (CandidateList list : candidateLists.values()) {
                    if (!first) sb.append(",");
                    sb.append(String.format(
                        "{\"listNo\":\"%s\",\"name\":\"%s\",\"type\":\"%s\",\"status\":\"%s\"}",
                        list.listNo, list.name, list.type, list.status
                    ));
                    first = false;
                }
                sb.append("],\"message\":\"success\"}");
                sendJsonResponse(exchange, 200, sb.toString());
            } else if ("POST".equals(method) && path.contains("/confirm")) {
                String listNo = path.split("/")[4];
                String response = String.format(
                    "{\"code\":200,\"data\":true,\"message\":\"清单 %s 确认成功\"}",
                    listNo
                );
                sendJsonResponse(exchange, 200, response);
            } else if ("POST".equals(method) && path.contains("/execute")) {
                String listNo = path.split("/")[4];
                String response = String.format(
                    "{\"code\":200,\"data\":true,\"message\":\"清单 %s 执行成功\"}",
                    listNo
                );
                sendJsonResponse(exchange, 200, response);
            } else {
                sendJsonResponse(exchange, 404, "{\"code\":404,\"message\":\"Not Found\"}");
            }
        }
    }

    static void sendJsonResponse(HttpExchange exchange, int statusCode, String response) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.sendResponseHeaders(statusCode, response.getBytes(StandardCharsets.UTF_8).length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(response.getBytes(StandardCharsets.UTF_8));
        }
    }

    static String readBody(HttpExchange exchange) throws IOException {
        try (InputStream is = exchange.getRequestBody()) {
            byte[] bytes = is.readAllBytes();
            return new String(bytes, StandardCharsets.UTF_8);
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
        LocalDateTime createTime;
    }

    static class BatchItem {
        String accountNo;
        String status;
    }

    static class CandidateList {
        String listNo;
        String name;
        String type;
        String status;
        String operator;
        LocalDateTime createTime;
    }
}

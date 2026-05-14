package com.infrastructure.drain;

import java.io.*;
import java.net.*;
import java.util.*;

public class SimpleDrainServer {
    
    private static final int PORT = 8080;
    private static final Map batches = new HashMap();
    private static final Map actionLogs = new HashMap();
    
    public static void main(String[] args) throws Exception {
        System.out.println("========================================");
        System.out.println("  服务实例排空 API - 简化服务器");
        System.out.println("========================================");
        System.out.println("启动时间: " + new Date());
        System.out.println("监听端口: " + PORT);
        System.out.println("");
        
        ServerSocket serverSocket = new ServerSocket(PORT);
        System.out.println("✓ 服务启动成功!");
        System.out.println("");
        System.out.println("测试命令:");
        System.out.println("  curl http://localhost:8080/health");
        System.out.println("  curl http://localhost:8080/api/v1/drain/batches");
        System.out.println("");
        
        while (true) {
            Socket clientSocket = serverSocket.accept();
            handleRequest(clientSocket);
        }
    }
    
    private static void handleRequest(Socket socket) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(socket.getInputStream()));
        OutputStream out = socket.getOutputStream();
        
        String requestLine = in.readLine();
        if (requestLine == null) {
            socket.close();
            return;
        }
        
        String[] parts = requestLine.split(" ");
        String method = parts[0];
        String path = parts[1];
        
        // 读取所有头部
        Map headers = new HashMap();
        String line;
        while ((line = in.readLine()) != null && !line.isEmpty()) {
            String[] headerParts = line.split(": ", 2);
            if (headerParts.length == 2) {
                headers.put(headerParts[0], headerParts[1]);
            }
        }
        
        // 读取请求体
        StringBuilder body = new StringBuilder();
        if (headers.containsKey("Content-Length")) {
            int contentLength = Integer.parseInt((String) headers.get("Content-Length"));
            char[] buffer = new char[contentLength];
            in.read(buffer, 0, contentLength);
            body.append(buffer);
        }
        
        String response = handleRoute(method, path, body.toString());
        
        out.write(("HTTP/1.1 200 OK\r\n").getBytes());
        out.write(("Content-Type: application/json; charset=utf-8\r\n").getBytes());
        out.write(("Content-Length: " + response.getBytes("UTF-8").length + "\r\n").getBytes());
        out.write(("Connection: close\r\n").getBytes());
        out.write(("\r\n").getBytes());
        out.write(response.getBytes("UTF-8"));
        out.flush();
        socket.close();
    }
    
    private static String handleRoute(String method, String path, String body) {
        if (path.equals("/health")) {
            return "{\"status\":\"UP\",\"timestamp\":\"" + new Date() + "\"}";
        }
        
        if (path.equals("/api/v1/drain/batches") && method.equals("GET")) {
            return buildBatchListResponse();
        }
        
        if (path.equals("/api/v1/drain/batches") && method.equals("POST")) {
            return createBatch(body);
        }
        
        if (path.startsWith("/api/v1/drain/batches/")) {
            String remaining = path.substring("/api/v1/drain/batches/".length());
            String[] pathParts = remaining.split("/");
            String batchId = pathParts[0];
            String action = pathParts.length > 1 ? pathParts[1] : null;
            
            if (action == null && method.equals("GET")) {
                return getBatchDetail(batchId);
            }
            
            if (action != null && method.equals("POST")) {
                return processBatchAction(batchId, action);
            }
        }
        
        return "{\"code\":404,\"message\":\"Not found\"}";
    }
    
    private static String buildBatchListResponse() {
        StringBuilder sb = new StringBuilder();
        sb.append("{\"code\":200,\"message\":\"成功\",\"data\":[");
        
        boolean first = true;
        Iterator it = batches.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry entry = (Map.Entry) it.next();
            if (!first) sb.append(",");
            first = false;
            sb.append((String) entry.getValue());
        }
        
        sb.append("],\"timestamp\":\"").append(new Date()).append("\"}");
        return sb.toString();
    }
    
    private static String createBatch(String body) {
        String batchId = extractValue(body, "batchId");
        String operator = extractValue(body, "operator");
        String reason = extractValue(body, "reason");
        
        if (batchId == null || batchId.isEmpty()) {
            return "{\"code\":400,\"message\":\"batchId不能为空\"}";
        }
        
        // 幂等性检查
        if (batches.containsKey(batchId)) {
            return "{\"code\":200,\"message\":\"批次已存在（幂等返回）\",\"data\":" + batches.get(batchId) + "}";
        }
        
        // 创建批次数据
        String batchData = createBatchData(batchId, operator, reason);
        batches.put(batchId, batchData);
        
        // 添加操作日志
        addActionLog(batchId, operator, "INIT", "INIT", "创建排空批次");
        
        return "{\"code\":200,\"message\":\"批次创建成功\",\"data\":" + batchData + "}";
    }
    
    private static String getBatchDetail(String batchId) {
        if (!batches.containsKey(batchId)) {
            return "{\"code\":404,\"message\":\"批次不存在: " + batchId + "\"}";
        }
        
        String baseData = (String) batches.get(batchId);
        
        // 构建完整响应，包含所有明细
        StringBuilder logs = new StringBuilder();
        if (actionLogs.containsKey(batchId)) {
            logs.append((String) actionLogs.get(batchId));
        }
        
        return "{\"code\":200,\"message\":\"成功\",\"data\":{\"batchId\":\"" + batchId + 
               "\",\"status\":\"INIT\",\"actionLogs\":[" + logs + 
               "],\"connections\":[],\"tasks\":[],\"offloadResults\":[],\"recoveryActions\":[]}}";
    }
    
    private static String processBatchAction(String batchId, String action) {
        if (!batches.containsKey(batchId)) {
            return "{\"code\":404,\"message\":\"批次不存在: " + batchId + "\"}";
        }
        
        String operator = "system";
        String newStatus = "INIT";
        String remark = "";
        
        if ("validate".equals(action)) {
            newStatus = "VALIDATED";
            remark = "批次校验通过";
        } else if ("offload".equals(action)) {
            newStatus = "OFFLOADED";
            remark = "摘流完成";
        } else if ("observe".equals(action)) {
            newStatus = "CONNECTIONS_EMPTY";
            remark = "连接已清空";
        } else if ("migrate".equals(action)) {
            newStatus = "TASKS_MIGRATED";
            remark = "任务迁移完成";
        } else if ("drain".equals(action)) {
            newStatus = "DRAINED";
            remark = "排空完成";
        } else if ("complete".equals(action)) {
            newStatus = "COMPLETED";
            remark = "排空流程完成";
        } else if ("cancel".equals(action)) {
            newStatus = "CANCELLED";
            remark = "批次已取消";
        } else if ("recover".equals(action)) {
            newStatus = "RECOVERED";
            remark = "批次已恢复";
        } else {
            return "{\"code\":400,\"message\":\"未知操作: " + action + "\"}";
        }
        
        addActionLog(batchId, operator, "INIT", newStatus, remark);
        
        return "{\"code\":200,\"message\":\"操作成功: " + action + "\",\"data\":{\"batchId\":\"" + 
               batchId + "\",\"status\":\"" + newStatus + "\"}}";
    }
    
    private static void addActionLog(String batchId, String operator, String from, String to, String remark) {
        String log = "{\"fromStatus\":\"" + from + "\",\"toStatus\":\"" + to + 
                     "\",\"remark\":\"" + remark + "\",\"operator\":\"" + operator + 
                     "\",\"actionTime\":\"" + new Date() + "\"}";
        
        if (actionLogs.containsKey(batchId)) {
            String existing = (String) actionLogs.get(batchId);
            actionLogs.put(batchId, existing + "," + log);
        } else {
            actionLogs.put(batchId, log);
        }
    }
    
    private static String createBatchData(String batchId, String operator, String reason) {
        return "{\"batchId\":\"" + batchId + "\",\"operator\":\"" + operator + 
               "\",\"reason\":\"" + reason + "\",\"status\":\"INIT\",\"createdAt\":\"" + new Date() + "\"}";
    }
    
    private static String extractValue(String json, String key) {
        String pattern = "\"" + key + "\"\\s*:\\s*\"([^\"]*)\"";
        try {
            java.util.regex.Pattern p = java.util.regex.Pattern.compile(pattern);
            java.util.regex.Matcher m = p.matcher(json);
            if (m.find()) {
                return m.group(1);
            }
        } catch (Exception e) {
            // ignore
        }
        return null;
    }
}

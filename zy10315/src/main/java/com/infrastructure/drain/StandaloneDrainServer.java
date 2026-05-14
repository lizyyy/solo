package com.infrastructure.drain;

import com.infrastructure.drain.model.*;
import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;

import java.io.*;
import java.net.InetSocketAddress;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

public class StandaloneDrainServer {
    
    private static final int PORT = 8080;
    private static final Map<String, DrainBatch> batches = new ConcurrentHashMap<>();
    private static final Map<String, ServiceInstance> instances = new ConcurrentHashMap<>();
    private static final Map<String, List<DrainActionLog>> actionLogs = new ConcurrentHashMap<>();
    private static final Map<String, List<PersistentConnection>> connections = new ConcurrentHashMap<>();
    private static final Map<String, List<QueueTask>> tasks = new ConcurrentHashMap<>();
    private static final Map<String, List<TrafficOffloadResult>> offloadResults = new ConcurrentHashMap<>();
    private static final Map<String, List<RecoveryAction>> recoveryActions = new ConcurrentHashMap<>();
    
    public static void main(String[] args) throws Exception {
        System.out.println("========================================");
        System.out.println("  服务实例排空 API - 独立服务器模式");
        System.out.println("========================================");
        System.out.println("启动时间: " + LocalDateTime.now());
        System.out.println("监听端口: " + PORT);
        System.out.println("");
        
        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        
        server.createContext("/api/v1/drain/batches", new BatchesHandler());
        server.createContext("/api/v1/drain/batches/", new BatchDetailHandler());
        server.createContext("/health", new HealthHandler());
        
        server.setExecutor(null);
        server.start();
        
        System.out.println("✓ 服务启动成功!");
        System.out.println("");
        System.out.println("可用API端点:");
        System.out.println("  GET  /health                          - 健康检查");
        System.out.println("  GET  /api/v1/drain/batches           - 获取所有批次");
        System.out.println("  POST /api/v1/drain/batches           - 创建批次 (JSON)");
        System.out.println("  GET  /api/v1/drain/batches/{id}      - 获取批次详情");
        System.out.println("  POST /api/v1/drain/batches/{id}/validate - 校验批次");
        System.out.println("  POST /api/v1/drain/batches/{id}/offload  - 开始摘流");
        System.out.println("  POST /api/v1/drain/batches/{id}/observe  - 观察连接");
        System.out.println("  POST /api/v1/drain/batches/{id}/migrate  - 迁移任务");
        System.out.println("  POST /api/v1/drain/batches/{id}/drain    - 执行排空");
        System.out.println("  POST /api/v1/drain/batches/{id}/complete - 完成流程");
        System.out.println("  POST /api/v1/drain/batches/{id}/cancel   - 取消批次");
        System.out.println("  POST /api/v1/drain/batches/{id}/recover  - 恢复批次");
        System.out.println("");
        System.out.println("测试命令:");
        System.out.println("  curl http://localhost:8080/health");
        System.out.println("  curl http://localhost:8080/api/v1/drain/batches");
        System.out.println("");
    }
    
    static class HealthHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String response = "{\"status\":\"UP\",\"timestamp\":\"" + LocalDateTime.now() + "\"}";
            sendResponse(exchange, 200, response);
        }
    }
    
    static class BatchesHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String method = exchange.getRequestMethod();
            
            if ("GET".equals(method)) {
                handleGetBatches(exchange);
            } else if ("POST".equals(method)) {
                handleCreateBatch(exchange);
            } else {
                sendResponse(exchange, 405, "{\"error\":\"Method not allowed\"}");
            }
        }
        
        private void handleGetBatches(HttpExchange exchange) throws IOException {
            List<Map<String, Object>> batchList = new ArrayList<>();
            for (DrainBatch batch : batches.values()) {
                batchList.add(batchToMap(batch));
            }
            
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("code", 200);
            result.put("message", "成功");
            result.put("data", batchList);
            result.put("timestamp", LocalDateTime.now().toString());
            sendResponse(exchange, 200, toJson(result));
        }
        
        private void handleCreateBatch(HttpExchange exchange) throws IOException {
            String body = readBody(exchange);
            
            try {
                String batchId = extractJsonValue(body, "batchId");
                String operator = extractJsonValue(body, "operator");
                String reason = extractJsonValue(body, "reason");
                
                if (batchId == null || batchId.isEmpty()) {
                    sendResponse(exchange, 400, "{\"code\":400,\"message\":\"batchId不能为空\"}");
                    return;
                }
                
                if (batches.containsKey(batchId)) {
                    DrainBatch existing = batches.get(batchId);
                    Map<String, Object> result = new LinkedHashMap<>();
                    result.put("code", 200);
                    result.put("message", "批次已存在（幂等返回）");
                    result.put("data", batchToMap(existing));
                    result.put("timestamp", LocalDateTime.now().toString());
                    sendResponse(exchange, 200, toJson(result));
                    return;
                }
                
                DrainBatch batch = new DrainBatch();
                batch.setBatchId(batchId);
                batch.setOperator(operator != null ? operator : "system");
                batch.setReason(reason != null ? reason : "手动排空");
                batch.setStatus(DrainStatus.INIT);
                batch.setCreatedAt(LocalDateTime.now());
                batch.setUpdatedAt(LocalDateTime.now());
                
                List<ServiceInstance> instanceList = new ArrayList<>();
                String instancesStr = extractJsonArray(body, "instances");
                if (instancesStr != null && !instancesStr.isEmpty()) {
                    String[] instanceItems = instancesStr.split("\\},\\{");
                    for (int i = 0; i < instanceItems.length; i++) {
                        String item = instanceItems[i];
                        String instanceId = extractJsonValue(item, "instanceId");
                        String serviceName = extractJsonValue(item, "serviceName");
                        String ip = extractJsonValue(item, "ip");
                        
                        ServiceInstance inst = new ServiceInstance();
                        inst.setInstanceId(instanceId != null ? instanceId : "instance-" + i);
                        inst.setServiceName(serviceName != null ? serviceName : "service-" + i);
                        inst.setIp(ip != null ? ip : "192.168.1." + (100 + i));
                        inst.setStatus(DrainStatus.INIT);
                        inst.setActiveConnections(3);
                        inst.setPendingTasks(5);
                        inst.setBatch(batch);
                        instanceList.add(inst);
                        instances.put(inst.getInstanceId(), inst);
                    }
                }
                
                if (instanceList.isEmpty()) {
                    for (int i = 0; i < 2; i++) {
                        ServiceInstance inst = new ServiceInstance();
                        inst.setInstanceId("instance-" + batchId + "-" + i);
                        inst.setServiceName("order-service");
                        inst.setIp("192.168.1." + (100 + i));
                        inst.setStatus(DrainStatus.INIT);
                        inst.setActiveConnections(3);
                        inst.setPendingTasks(5);
                        inst.setBatch(batch);
                        instanceList.add(inst);
                        instances.put(inst.getInstanceId(), inst);
                    }
                }
                batch.setInstances(instanceList);
                
                for (ServiceInstance inst : instanceList) {
                    simulateConnections(inst.getInstanceId());
                    simulateTasks(inst.getInstanceId());
                }
                
                batches.put(batchId, batch);
                addActionLog(batchId, null, batch.getOperator(), DrainStatus.INIT, DrainStatus.INIT, "创建排空批次");
                
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("code", 200);
                result.put("message", "批次创建成功");
                result.put("data", batchToMap(batch));
                result.put("timestamp", LocalDateTime.now().toString());
                sendResponse(exchange, 200, toJson(result));
                
            } catch (Exception e) {
                sendResponse(exchange, 500, "{\"code\":500,\"message\":\"" + e.getMessage() + "\"}");
            }
        }
    }
    
    static class BatchDetailHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String path = exchange.getRequestURI().getPath();
            String method = exchange.getRequestMethod();
            
            String[] parts = path.split("/");
            if (parts.length < 5) {
                sendResponse(exchange, 404, "{\"code\":404,\"message\":\"Not found\"}");
                return;
            }
            
            String batchId = parts[5];
            String action = parts.length > 6 ? parts[6] : null;
            
            if (!batches.containsKey(batchId)) {
                sendResponse(exchange, 404, "{\"code\":404,\"message\":\"批次不存在: " + batchId + "\"}");
                return;
            }
            
            DrainBatch batch = batches.get(batchId);
            
            if (action == null) {
                if ("GET".equals(method)) {
                    Map<String, Object> result = new LinkedHashMap<>();
                    result.put("code", 200);
                    result.put("message", "成功");
                    result.put("data", batchToMap(batch));
                    result.put("timestamp", LocalDateTime.now().toString());
                    sendResponse(exchange, 200, toJson(result));
                } else {
                    sendResponse(exchange, 405, "{\"code\":405,\"message\":\"Method not allowed\"}");
                }
            } else {
                if ("POST".equals(method)) {
                    handleBatchAction(exchange, batch, action);
                } else {
                    sendResponse(exchange, 405, "{\"code\":405,\"message\":\"Method not allowed\"}");
                }
            }
        }
        
        private void handleBatchAction(HttpExchange exchange, DrainBatch batch, String action) throws IOException {
            try {
                DrainStatus current = batch.getStatus();
                
                switch (action) {
                    case "validate":
                        validateTransition(batch.getBatchId(), current, DrainStatus.VALIDATING);
                        batch.setStatus(DrainStatus.VALIDATED);
                        batch.setUpdatedAt(LocalDateTime.now());
                        addActionLog(batch.getBatchId(), null, batch.getOperator(), current, DrainStatus.VALIDATED, "批次校验通过");
                        break;
                    case "offload":
                        validateTransition(batch.getBatchId(), current, DrainStatus.TRAFFIC_OFFLOADING);
                        batch.setStatus(DrainStatus.TRAFFIC_OFFLOADED);
                        batch.setUpdatedAt(LocalDateTime.now());
                        performTrafficOffload(batch);
                        addActionLog(batch.getBatchId(), null, batch.getOperator(), current, DrainStatus.TRAFFIC_OFFLOADED, "摘流完成");
                        break;
                    case "observe":
                        validateTransition(batch.getBatchId(), current, DrainStatus.CONNECTION_OBSERVING);
                        batch.setStatus(DrainStatus.CONNECTIONS_EMPTY);
                        batch.setUpdatedAt(LocalDateTime.now());
                        addActionLog(batch.getBatchId(), null, batch.getOperator(), current, DrainStatus.CONNECTIONS_EMPTY, "连接已清空");
                        break;
                    case "migrate":
                        validateTransition(batch.getBatchId(), current, DrainStatus.TASK_MIGRATING);
                        batch.setStatus(DrainStatus.TASKS_MIGRATED);
                        batch.setUpdatedAt(LocalDateTime.now());
                        performTaskMigration(batch);
                        addActionLog(batch.getBatchId(), null, batch.getOperator(), current, DrainStatus.TASKS_MIGRATED, "任务迁移完成");
                        break;
                    case "drain":
                        validateTransition(batch.getBatchId(), current, DrainStatus.DRAINING);
                        batch.setStatus(DrainStatus.DRAINED);
                        batch.setUpdatedAt(LocalDateTime.now());
                        performDrain(batch);
                        addActionLog(batch.getBatchId(), null, batch.getOperator(), current, DrainStatus.DRAINED, "排空完成");
                        break;
                    case "complete":
                        validateTransition(batch.getBatchId(), current, DrainStatus.COMPLETED);
                        batch.setStatus(DrainStatus.COMPLETED);
                        batch.setCompletedAt(LocalDateTime.now());
                        batch.setUpdatedAt(LocalDateTime.now());
                        addActionLog(batch.getBatchId(), null, batch.getOperator(), current, DrainStatus.COMPLETED, "排空流程完成");
                        break;
                    case "cancel":
                        batch.setStatus(DrainStatus.CANCELLED);
                        batch.setUpdatedAt(LocalDateTime.now());
                        addActionLog(batch.getBatchId(), null, batch.getOperator(), current, DrainStatus.CANCELLED, "批次已取消");
                        break;
                    case "recover":
                        batch.setStatus(DrainStatus.RECOVERED);
                        batch.setUpdatedAt(LocalDateTime.now());
                        performRecovery(batch);
                        addActionLog(batch.getBatchId(), null, batch.getOperator(), current, DrainStatus.RECOVERED, "批次已恢复");
                        break;
                    default:
                        sendResponse(exchange, 400, "{\"code\":400,\"message\":\"未知操作: " + action + "\"}");
                        return;
                }
                
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("code", 200);
                result.put("message", "操作成功: " + action);
                result.put("data", batchToMap(batch));
                result.put("timestamp", LocalDateTime.now().toString());
                sendResponse(exchange, 200, toJson(result));
                
            } catch (IllegalStateException e) {
                sendResponse(exchange, 400, "{\"code\":400,\"message\":\"" + e.getMessage() + "\"}");
            } catch (Exception e) {
                sendResponse(exchange, 500, "{\"code\":500,\"message\":\"" + e.getMessage() + "\"}");
            }
        }
    }
    
    private static void validateTransition(String batchId, DrainStatus current, DrainStatus target) {
        boolean allowed = false;
        
        switch (current) {
            case INIT:
                allowed = target == DrainStatus.VALIDATING || target == DrainStatus.CANCELLED;
                break;
            case VALIDATED:
                allowed = target == DrainStatus.TRAFFIC_OFFLOADING || target == DrainStatus.CANCELLED;
                break;
            case TRAFFIC_OFFLOADED:
                allowed = target == DrainStatus.CONNECTION_OBSERVING || target == DrainStatus.CANCELLED;
                break;
            case CONNECTIONS_EMPTY:
                allowed = target == DrainStatus.TASK_MIGRATING || target == DrainStatus.CANCELLED;
                break;
            case TASKS_MIGRATED:
                allowed = target == DrainStatus.DRAINING || target == DrainStatus.CANCELLED;
                break;
            case DRAINED:
                allowed = target == DrainStatus.COMPLETED;
                break;
            case FAILED:
                allowed = target == DrainStatus.RECOVERING || target == DrainStatus.CANCELLED;
                break;
            default:
                allowed = false;
        }
        
        if (!allowed) {
            throw new IllegalStateException("状态不允许跳转: " + current + " -> " + target);
        }
    }
    
    private static void simulateConnections(String instanceId) {
        List<PersistentConnection> connList = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            PersistentConnection conn = new PersistentConnection();
            conn.setConnectionId("conn-" + instanceId + "-" + i);
            conn.setInstanceId(instanceId);
            conn.setClientIp("10.0.0." + (100 + i));
            conn.setClientPort(10000 + (int) (System.currentTimeMillis() % 10000));
            conn.setProtocol("HTTP");
            conn.setStatus("ACTIVE");
            conn.setConnectedAt(LocalDateTime.now().minusMinutes(i * 5));
            connList.add(conn);
        }
        connections.put(instanceId, connList);
    }
    
    private static void simulateTasks(String instanceId) {
        String[] taskTypes = {"ORDER_PROCESS", "PAYMENT_NOTIFY", "DATA_SYNC"};
        List<QueueTask> taskList = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            QueueTask task = new QueueTask();
            task.setTaskId("task-" + instanceId + "-" + i);
            task.setInstanceId(instanceId);
            task.setQueueName("queue-" + (i % 3));
            task.setTaskType(taskTypes[i % 3]);
            task.setStatus("PENDING");
            task.setCreatedAt(LocalDateTime.now().minusMinutes(i * 2));
            taskList.add(task);
        }
        tasks.put(instanceId, taskList);
    }
    
    private static void performTrafficOffload(DrainBatch batch) {
        for (ServiceInstance inst : batch.getInstances()) {
            TrafficOffloadResult result = new TrafficOffloadResult();
            result.setInstanceId(inst.getInstanceId());
            result.setBatchId(batch.getBatchId());
            result.setSuccess(true);
            result.setMessage("摘流成功");
            result.setInitialConnections(3);
            result.setFinalConnections(0);
            result.setInitialTasks(5);
            result.setFinalTasks(5);
            result.setOffloadStartTime(LocalDateTime.now().minusSeconds(2));
            result.setOffloadEndTime(LocalDateTime.now());
            result.setDurationSeconds(2L);
            
            if (!offloadResults.containsKey(batch.getBatchId())) {
                offloadResults.put(batch.getBatchId(), new ArrayList<>());
            }
            offloadResults.get(batch.getBatchId()).add(result);
            
            List<PersistentConnection> connList = connections.get(inst.getInstanceId());
            if (connList != null) {
                for (PersistentConnection conn : connList) {
                    conn.setStatus("CLOSED");
                }
            }
        }
    }
    
    private static void performTaskMigration(DrainBatch batch) {
        for (ServiceInstance inst : batch.getInstances()) {
            List<QueueTask> taskList = tasks.get(inst.getInstanceId());
            if (taskList != null) {
                for (QueueTask task : taskList) {
                    if ("PENDING".equals(task.getStatus())) {
                        task.setStatus("MIGRATED");
                        task.setTargetInstanceId("target-" + inst.getInstanceId());
                        task.setMigratedAt(LocalDateTime.now());
                    }
                }
            }
            inst.setPendingTasks(0);
        }
    }
    
    private static void performDrain(DrainBatch batch) {
        for (ServiceInstance inst : batch.getInstances()) {
            List<PersistentConnection> connList = connections.get(inst.getInstanceId());
            if (connList != null) {
                for (PersistentConnection conn : connList) {
                    conn.setStatus("DRAINED");
                }
            }
            
            List<QueueTask> taskList = tasks.get(inst.getInstanceId());
            if (taskList != null) {
                for (QueueTask task : taskList) {
                    task.setStatus("COMPLETED");
                }
            }
            
            inst.setActiveConnections(0);
            inst.setPendingTasks(0);
        }
    }
    
    private static void performRecovery(DrainBatch batch) {
        for (ServiceInstance inst : batch.getInstances()) {
            RecoveryAction action = new RecoveryAction();
            action.setBatchId(batch.getBatchId());
            action.setInstanceId(inst.getInstanceId());
            action.setOperator(batch.getOperator());
            action.setActionType("INSTANCE_RECOVERY");
            action.setReason("手动恢复失败批次");
            action.setActionDetail("恢复实例连接和任务处理");
            action.setSuccess(true);
            action.setActionTime(LocalDateTime.now());
            
            if (!recoveryActions.containsKey(batch.getBatchId())) {
                recoveryActions.put(batch.getBatchId(), new ArrayList<>());
            }
            recoveryActions.get(batch.getBatchId()).add(action);
            
            List<PersistentConnection> connList = connections.get(inst.getInstanceId());
            if (connList != null) {
                for (PersistentConnection conn : connList) {
                    conn.setStatus("ACTIVE");
                }
            }
            
            List<QueueTask> taskList = tasks.get(inst.getInstanceId());
            if (taskList != null) {
                for (QueueTask task : taskList) {
                    if ("MIGRATED".equals(task.getStatus())) {
                        task.setStatus("PENDING");
                        task.setTargetInstanceId(null);
                        task.setMigratedAt(null);
                    }
                }
            }
            
            inst.setStatus(DrainStatus.INIT);
            inst.setActiveConnections(3);
            inst.setPendingTasks(5);
        }
    }
    
    private static void addActionLog(String batchId, String instanceId, String operator, DrainStatus from, DrainStatus to, String remark) {
        DrainActionLog log = new DrainActionLog();
        log.setBatchId(batchId);
        log.setInstanceId(instanceId);
        log.setOperator(operator);
        log.setFromStatus(from);
        log.setToStatus(to);
        log.setRemark(remark);
        log.setActionTime(LocalDateTime.now());
        
        if (!actionLogs.containsKey(batchId)) {
            actionLogs.put(batchId, new ArrayList<>());
        }
        actionLogs.get(batchId).add(log);
    }
    
    private static Map<String, Object> batchToMap(DrainBatch batch) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("batchId", batch.getBatchId());
        map.put("operator", batch.getOperator());
        map.put("reason", batch.getReason());
        map.put("status", batch.getStatus().name());
        map.put("createdAt", batch.getCreatedAt().toString());
        map.put("updatedAt", batch.getUpdatedAt().toString());
        if (batch.getCompletedAt() != null) {
            map.put("completedAt", batch.getCompletedAt().toString());
        }
        
        List<Map<String, Object>> instanceMaps = new ArrayList<>();
        for (ServiceInstance inst : batch.getInstances()) {
            Map<String, Object> instMap = new LinkedHashMap<>();
            instMap.put("instanceId", inst.getInstanceId());
            instMap.put("serviceName", inst.getServiceName());
            instMap.put("ip", inst.getIp());
            instMap.put("status", inst.getStatus().name());
            instMap.put("activeConnections", inst.getActiveConnections());
            instMap.put("pendingTasks", inst.getPendingTasks());
            instanceMaps.add(instMap);
        }
        map.put("instances", instanceMaps);
        
        List<Map<String, Object>> logMaps = new ArrayList<>();
        List<DrainActionLog> logs = actionLogs.get(batch.getBatchId());
        if (logs != null) {
            for (DrainActionLog log : logs) {
                Map<String, Object> logMap = new LinkedHashMap<>();
                logMap.put("fromStatus", log.getFromStatus().name());
                logMap.put("toStatus", log.getToStatus().name());
                logMap.put("remark", log.getRemark());
                logMap.put("operator", log.getOperator());
                logMap.put("actionTime", log.getActionTime().toString());
                logMaps.add(logMap);
            }
        }
        map.put("actionLogs", logMaps);
        
        List<Map<String, Object>> resultMaps = new ArrayList<>();
        List<TrafficOffloadResult> results = offloadResults.get(batch.getBatchId());
        if (results != null) {
            for (TrafficOffloadResult result : results) {
                Map<String, Object> resultMap = new LinkedHashMap<>();
                resultMap.put("instanceId", result.getInstanceId());
                resultMap.put("success", result.getSuccess());
                resultMap.put("message", result.getMessage());
                resultMap.put("initialConnections", result.getInitialConnections());
                resultMap.put("finalConnections", result.getFinalConnections());
                resultMaps.add(resultMap);
            }
        }
        map.put("offloadResults", resultMaps);
        
        List<Map<String, Object>> connMaps = new ArrayList<>();
        for (ServiceInstance inst : batch.getInstances()) {
            List<PersistentConnection> connList = connections.get(inst.getInstanceId());
            if (connList != null) {
                for (PersistentConnection conn : connList) {
                    Map<String, Object> connMap = new LinkedHashMap<>();
                    connMap.put("connectionId", conn.getConnectionId());
                    connMap.put("instanceId", conn.getInstanceId());
                    connMap.put("clientIp", conn.getClientIp());
                    connMap.put("status", conn.getStatus());
                    connMaps.add(connMap);
                }
            }
        }
        map.put("connections", connMaps);
        
        List<Map<String, Object>> taskMaps = new ArrayList<>();
        for (ServiceInstance inst : batch.getInstances()) {
            List<QueueTask> taskList = tasks.get(inst.getInstanceId());
            if (taskList != null) {
                for (QueueTask task : taskList) {
                    Map<String, Object> taskMap = new LinkedHashMap<>();
                    taskMap.put("taskId", task.getTaskId());
                    taskMap.put("instanceId", task.getInstanceId());
                    taskMap.put("taskType", task.getTaskType());
                    taskMap.put("status", task.getStatus());
                    taskMap.put("targetInstanceId", task.getTargetInstanceId());
                    taskMaps.add(taskMap);
                }
            }
        }
        map.put("tasks", taskMaps);
        
        List<Map<String, Object>> recoveryMaps = new ArrayList<>();
        List<RecoveryAction> recoveryList = recoveryActions.get(batch.getBatchId());
        if (recoveryList != null) {
            for (RecoveryAction ra : recoveryList) {
                Map<String, Object> raMap = new LinkedHashMap<>();
                raMap.put("instanceId", ra.getInstanceId());
                raMap.put("actionType", ra.getActionType());
                raMap.put("reason", ra.getReason());
                raMap.put("success", ra.getSuccess());
                raMap.put("actionTime", ra.getActionTime().toString());
                recoveryMaps.add(raMap);
            }
        }
        map.put("recoveryActions", recoveryMaps);
        
        return map;
    }
    
    private static String extractJsonValue(String json, String key) {
        String pattern = "\"" + key + "\"\\s*:\\s*\"([^\"]*)\"";
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(pattern);
        java.util.regex.Matcher m = p.matcher(json);
        if (m.find()) {
            return m.group(1);
        }
        pattern = "\"" + key + "\"\\s*:\\s*([^,}\\]]+)";
        m = java.util.regex.Pattern.compile(pattern).matcher(json);
        if (m.find()) {
            return m.group(1).trim();
        }
        return null;
    }
    
    private static String extractJsonArray(String json, String key) {
        String pattern = "\"" + key + "\"\\s*:\\s*\\[(.*?)\\]";
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(pattern, java.util.regex.Pattern.DOTALL);
        java.util.regex.Matcher m = p.matcher(json);
        if (m.find()) {
            return m.group(1).trim();
        }
        return null;
    }
    
    private static String toJson(Map<String, Object> map) {
        StringBuilder sb = new StringBuilder();
        sb.append("{");
        boolean first = true;
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            if (!first) sb.append(",");
            first = false;
            sb.append("\"").append(entry.getKey()).append("\":");
            Object value = entry.getValue();
            if (value == null) {
                sb.append("null");
            } else if (value instanceof String) {
                sb.append("\"").append(value).append("\"");
            } else if (value instanceof Number) {
                sb.append(value);
            } else if (value instanceof Boolean) {
                sb.append(value);
            } else if (value instanceof List) {
                sb.append(listToJson((List<?>) value));
            } else if (value instanceof Map) {
                sb.append(toJson((Map<String, Object>) value));
            } else {
                sb.append("\"").append(value).append("\"");
            }
        }
        sb.append("}");
        return sb.toString();
    }
    
    private static String listToJson(List<?> list) {
        StringBuilder sb = new StringBuilder();
        sb.append("[");
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) sb.append(",");
            Object item = list.get(i);
            if (item == null) {
                sb.append("null");
            } else if (item instanceof String) {
                sb.append("\"").append(item).append("\"");
            } else if (item instanceof Number) {
                sb.append(item);
            } else if (item instanceof Boolean) {
                sb.append(item);
            } else if (item instanceof Map) {
                sb.append(toJson((Map<String, Object>) item));
            } else {
                sb.append("\"").append(item).append("\"");
            }
        }
        sb.append("]");
        return sb.toString();
    }
    
    private static String readBody(HttpExchange exchange) throws IOException {
        InputStream is = exchange.getRequestBody();
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buffer = new byte[1024];
        int len;
        while ((len = is.read(buffer)) > 0) {
            bos.write(buffer, 0, len);
        }
        return bos.toString("UTF-8");
    }
    
    private static void sendResponse(HttpExchange exchange, int statusCode, String response) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(statusCode, response.getBytes("UTF-8").length);
        OutputStream os = exchange.getResponseBody();
        os.write(response.getBytes("UTF-8"));
        os.close();
    }
}

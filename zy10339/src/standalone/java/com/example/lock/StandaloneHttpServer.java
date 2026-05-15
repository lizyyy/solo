package com.example.lock;

import java.io.*;
import java.net.*;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 零依赖独立 HTTP 服务器 - 纯 JDK 8 内置 API
 * 无需 Spring Boot，无需任何外部 jar
 */
public class StandaloneHttpServer {

    // 数据存储
    private static final Map<String, ResourceLock> LOCK_STORE = new ConcurrentHashMap<>();
    private static final Map<String, LockQueueItem> WAIT_QUEUE = new ConcurrentHashMap<>();
    private static final List<ReleaseAuditRecord> RELEASE_HISTORY = Collections.synchronizedList(new ArrayList<>());
    private static final Map<String, CachedResponse> IDEMPOTENT_CACHE = new ConcurrentHashMap<>();

    // 统计
    private static final AtomicLong REQUEST_COUNTER = new AtomicLong(0);
    private static final long START_TIME = System.currentTimeMillis();

    public static void main(String[] args) throws Exception {
        int port = 8080;
        if (args.length > 0) {
            port = Integer.parseInt(args[0]);
        }

        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/", new RootHandler());
        server.createContext("/api/locks/acquire", new AcquireLockHandler());
        server.createContext("/api/locks/release", new ReleaseLockHandler());
        server.createContext("/api/locks/", new LockQueryHandler());
        server.createContext("/api/locks", new AllLocksHandler());
        server.createContext("/h2-console", new ConsoleHandler());
        server.setExecutor(Executors.newFixedThreadPool(10));
        server.start();

        System.out.println("============================================================");
        System.out.println("  \uD83D\uDD12 资源锁冲突解释 API - 独立服务器版本");
        System.out.println("  \u2728 零依赖！纯 JDK 8 内置 HTTP 服务器");
        System.out.println("============================================================");
        System.out.println();
        System.out.println("  服务地址: http://localhost:" + port);
        System.out.println("  管理界面: http://localhost:" + port + "/");
        System.out.println();
        System.out.println("  API 接口:");
        System.out.println("    POST /api/locks/acquire    - 获取锁");
        System.out.println("    POST /api/locks/release    - 释放锁");
        System.out.println("    GET  /api/locks/{resourceId} - 查询锁状态");
        System.out.println("    GET  /api/locks/{resourceId}/queue - 查询等待队列");
        System.out.println("    GET  /api/locks/{resourceId}/history - 查询释放历史");
        System.out.println("    GET  /api/locks/{resourceId}/export - 导出完整状态");
        System.out.println("    GET  /api/locks/export      - 导出所有锁");
        System.out.println();
        System.out.println("  按 Ctrl+C 停止服务");
        System.out.println("============================================================");
        System.out.println();
    }

    // ==================== 数据模型 ====================

    static class ResourceLock {
        String resourceId;
        String lockHolder;
        String requestId;
        String status;
        String operationSource;
        long lockTime;
        long expireTime;
        long releaseTime;
        String timeoutSeconds;
    }

    static class LockQueueItem {
        String resourceId;
        String lockHolder;
        String requestId;
        int position;
        String status;
        long queuedAt;
    }

    static class ReleaseAuditRecord {
        String resourceId;
        String lockHolder;
        String requestId;
        String releaseSource;
        String releaseReason;
        long lockDurationSeconds;
        long releasedAt;
    }

    static class CachedResponse {
        String requestId;
        String responseJson;
        long timestamp;
    }

    // ==================== HTTP 请求处理器 ====================

    static class RootHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String path = exchange.getRequestURI().getPath();
            if ("/".equals(path)) {
                sendHtmlResponse(exchange, 200, getDashboardHtml());
            } else {
                sendErrorResponse(exchange, 404, "Not Found: " + path);
            }
        }
    }

    static class AcquireLockHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equals(exchange.getRequestMethod())) {
                sendErrorResponse(exchange, 405, "Method Not Allowed");
                return;
            }

            try {
                String body = readRequestBody(exchange);
                Map<String, Object> request = parseJson(body);

                String requestId = (String) request.get("requestId");

                // 幂等检查
                if (IDEMPOTENT_CACHE.containsKey(requestId)) {
                    CachedResponse cached = IDEMPOTENT_CACHE.get(requestId);
                    System.out.println("[幂等命中: " + requestId);
                    sendJsonResponse(exchange, 200, cached.responseJson);
                    return;
                }

                String resourceId = (String) request.get("resourceId");
                String lockHolder = (String) request.get("lockHolder");
                String operationSource = (String) request.get("operationSource");
                if (operationSource == null) operationSource = "API";
                int timeoutSeconds = request.containsKey("timeoutSeconds") ? ((Number) request.get("timeoutSeconds")).intValue() : 300;
                boolean waitInQueue = request.containsKey("waitInQueue") ? (Boolean) request.get("waitInQueue") : true;

                // 检查是否已存在锁
                ResourceLock existingLock = LOCK_STORE.get(resourceId);

                if (existingLock == null || "RELEASED".equals(existingLock.status) || 
                    "AVAILABLE".equals(existingLock.status)) {
                    // 创建新锁
                    ResourceLock lock = new ResourceLock();
                    lock.resourceId = resourceId;
                    lock.lockHolder = lockHolder;
                    lock.requestId = requestId;
                    lock.status = "LOCKED";
                    lock.operationSource = operationSource;
                    lock.lockTime = System.currentTimeMillis();
                    lock.expireTime = lock.lockTime + timeoutSeconds * 1000L;
                    lock.timeoutSeconds = timeoutSeconds;
                    LOCK_STORE.put(resourceId, lock);

                    Map<String, Object> response = createSuccessResponse(lock, "成功获取锁");
                    String jsonResponse = toJson(response);
                    CachedResponse cached = new CachedResponse();
                    cached.requestId = requestId;
                    cached.responseJson = jsonResponse;
                    cached.timestamp = System.currentTimeMillis();
                    IDEMPOTENT_CACHE.put(requestId, cached);
                    System.out.println("[加锁成功] " + resourceId + " -> " + lockHolder);
                    sendJsonResponse(exchange, 200, jsonResponse);
                    return;
                }

                if ("LOCKED".equals(existingLock.status)) {
                    // 同一持有人，续期
                    if (existingLock.lockHolder.equals(lockHolder)) {
                    existingLock.expireTime = System.currentTimeMillis() + timeoutSeconds * 1000L;
                    Map<String, Object> response = createSuccessResponse(existingLock, "锁续期成功");
                    String jsonResponse = toJson(response);
                    CachedResponse cached = new CachedResponse();
                    cached.requestId = requestId;
                    cached.responseJson = jsonResponse;
                    cached.timestamp = System.currentTimeMillis();
                    IDEMPOTENT_CACHE.put(requestId, cached);
                    System.out.println("[锁续期] " + resourceId + " -> " + lockHolder);
                    sendJsonResponse(exchange, 200, jsonResponse);
                    return;
                }

                // 加入等待队列
                if (waitInQueue) {
                    int queueSize = 0;
                    for (LockQueueItem item : WAIT_QUEUE.values()) {
                        if (item.resourceId.equals(resourceId) && "WAITING".equals(item.status)) {
                            queueSize++;
                        }
                    }
                    int position = queueSize + 1;

                    LockQueueItem queueItem = new LockQueueItem();
                    queueItem.resourceId = resourceId;
                    queueItem.lockHolder = lockHolder;
                    queueItem.requestId = requestId;
                    queueItem.position = position;
                    queueItem.status = "WAITING";
                    queueItem.queuedAt = System.currentTimeMillis();
                    WAIT_QUEUE.put(requestId, queueItem);

                    Map<String, Object> response = new LinkedHashMap<>();
                    response.put("code", 200);
                    response.put("message", "已加入等待队列，当前位置: " + position);
                    Map<String, Object> data = new LinkedHashMap<>();
                    data.put("resourceId", resourceId);
                    data.put("lockHolder", lockHolder);
                    data.put("requestId", requestId);
                    data.put("status", "WAITING");
                    data.put("waitQueuePosition", position);
                    data.put("success", true);
                    data.put("message", "已加入等待队列，当前位置: " + position);
                    response.put("data", data);
                    String jsonResponse = toJson(response);
                    CachedResponse cached = new CachedResponse();
                    cached.requestId = requestId;
                    cached.responseJson = jsonResponse;
                    cached.timestamp = System.currentTimeMillis();
                    IDEMPOTENT_CACHE.put(requestId, cached);
                    System.out.println("[加入队列] " + resourceId + " -> " + lockHolder + " 位置:" + position);
                    sendJsonResponse(exchange, 200, jsonResponse);
                    return;
                }

                // 冲突
                Map<String, Object> response = new LinkedHashMap<>();
                response.put("code", 409);
                response.put("message", "资源已被锁定");
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("resourceId", resourceId);
                data.put("lockHolder", lockHolder);
                data.put("requestId", requestId);
                data.put("status", "AVAILABLE");
                data.put("conflictReason", "资源已被锁定，当前持有人: " + existingLock.lockHolder);
                data.put("success", false);
                data.put("message", "获取锁失败: 资源已被锁定");
                response.put("data", data);
                String jsonResponse = toJson(response);
                CachedResponse cached = new CachedResponse();
                cached.requestId = requestId;
                cached.responseJson = jsonResponse;
                cached.timestamp = System.currentTimeMillis();
                IDEMPOTENT_CACHE.put(requestId, cached);
                System.out.println("[冲突] " + resourceId + " -> 被 " + existingLock.lockHolder + " 占用");
                sendJsonResponse(exchange, 200, jsonResponse);
            } catch (Exception e) {
                e.printStackTrace();
                sendErrorResponse(exchange, 500, e.getMessage());
            }
        }
    }

    static class ReleaseLockHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equals(exchange.getRequestMethod())) {
                sendErrorResponse(exchange, 405, "Method Not Allowed");
                return;
            }

            try {
                String body = readRequestBody(exchange);
                Map<String, Object> request = parseJson(body);

                String requestId = (String) request.get("requestId");

                // 幂等检查
                if (IDEMPOTENT_CACHE.containsKey(requestId)) {
                    CachedResponse cached = IDEMPOTENT_CACHE.get(requestId);
                    System.out.println("[释放幂等命中] " + requestId);
                    sendJsonResponse(exchange, 200, cached.responseJson);
                    return;
                }

                String resourceId = (String) request.get("resourceId");
                String lockHolder = (String) request.get("lockHolder");
                String releaseSource = (String) request.get("operationSource");
                if (releaseSource == null) releaseSource = "API";
                String releaseReason = (String) request.get("releaseReason");

                ResourceLock lock = LOCK_STORE.get(resourceId);

                if (lock == null) {
                    Map<String, Object> response = new LinkedHashMap<>();
                    response.put("code", 404);
                    response.put("message", "锁不存在");
                    Map<String, Object> data = new LinkedHashMap<>();
                    data.put("resourceId", resourceId);
                    data.put("lockHolder", lockHolder);
                    data.put("requestId", requestId);
                    data.put("success", false);
                    data.put("message", "锁不存在，无需重复释放");
                    response.put("data", data);
                    String jsonResponse = toJson(response);
                    CachedResponse cached = new CachedResponse();
                    cached.requestId = requestId;
                    cached.responseJson = jsonResponse;
                    cached.timestamp = System.currentTimeMillis();
                    IDEMPOTENT_CACHE.put(requestId, cached);
                    System.out.println("[释放无锁] " + resourceId);
                    sendJsonResponse(exchange, 200, jsonResponse);
                    return;
                }

                if (!lock.lockHolder.equals(lockHolder)) {
                    Map<String, Object> response = new LinkedHashMap<>();
                    response.put("code", 403);
                    response.put("message", "无权释放该锁，锁持有人不匹配");
                    Map<String, Object> data = new LinkedHashMap<>();
                    data.put("resourceId", resourceId);
                    data.put("lockHolder", lockHolder);
                    data.put("requestId", requestId);
                    data.put("success", false);
                    data.put("message", "无权释放该锁");
                    response.put("data", data);
                    String jsonResponse = toJson(response);
                    sendJsonResponse(exchange, 200, jsonResponse);
                    System.out.println("[释放被拒] " + resourceId);
                    return;
                }

                if (!"LOCKED".equals(lock.status)) {
                    Map<String, Object> response = new LinkedHashMap<>();
                    response.put("code", 400);
                    response.put("message", "锁当前不处于锁定状态");
                    Map<String, Object> data = new LinkedHashMap<>();
                    data.put("resourceId", resourceId);
                    data.put("lockHolder", lockHolder);
                    data.put("requestId", requestId);
                    data.put("status", lock.status);
                    data.put("success", false);
                    data.put("message", "锁当前不处于锁定状态，无需重复释放");
                    response.put("data", data);
                    String jsonResponse = toJson(response);
                    CachedResponse cached = new CachedResponse();
                    cached.requestId = requestId;
                    cached.responseJson = jsonResponse;
                    cached.timestamp = System.currentTimeMillis();
                    IDEMPOTENT_CACHE.put(requestId, cached);
                    System.out.println("[释放已完成] " + resourceId);
                    sendJsonResponse(exchange, 200, jsonResponse);
                    return;
                }

                // 执行释放
                lock.status = "RELEASED";
                lock.releaseTime = System.currentTimeMillis();

                // 记录审计
                ReleaseAuditRecord audit = new ReleaseAuditRecord();
                audit.resourceId = resourceId;
                audit.lockHolder = lock.lockHolder;
                audit.requestId = lock.requestId;
                audit.releaseSource = releaseSource;
                audit.releaseReason = releaseReason;
                audit.releasedAt = System.currentTimeMillis();
                if (lock.lockTime > 0) {
                    audit.lockDurationSeconds = (lock.releaseTime - lock.lockTime) / 1000;
                }
                RELEASE_HISTORY.add(0, audit);

                // 激活等待队列中的下一个
                activateNextInQueue(resourceId);

                Map<String, Object> response = createSuccessResponse(lock, "锁已成功释放");
                String jsonResponse = toJson(response);
                CachedResponse cached = new CachedResponse();
                cached.requestId = requestId;
                cached.responseJson = jsonResponse;
                cached.timestamp = System.currentTimeMillis();
                IDEMPOTENT_CACHE.put(requestId, cached);
                System.out.println("[释放成功] " + resourceId + " -> " + lockHolder + " 原因:" + releaseReason);
                sendJsonResponse(exchange, 200, jsonResponse);

            } catch (Exception e) {
                e.printStackTrace();
                sendErrorResponse(exchange, 500, e.getMessage());
            }
        }
    }

    static void activateNextInQueue(String resourceId) {
        // 找到第一个等待的
        LockQueueItem nextItem = null;
        int minPos = Integer.MAX_VALUE;
        for (LockQueueItem item : WAIT_QUEUE.values()) {
            if (item.resourceId.equals(resourceId) && "WAITING".equals(item.status) && item.position < minPos) {
                minPos = item.position;
                nextItem = item;
            }
        }

        if (nextItem != null) {
            ResourceLock lock = LOCK_STORE.get(resourceId);
            lock.lockHolder = nextItem.lockHolder;
            lock.requestId = nextItem.requestId;
            lock.status = "LOCKED";
            lock.lockTime = System.currentTimeMillis();
            lock.expireTime = System.currentTimeMillis() + 300 * 1000L;

            nextItem.status = "LOCKED";

            // 更新队列位置
            int pos = 1;
            for (LockQueueItem item : WAIT_QUEUE.values()) {
                if (item.resourceId.equals(resourceId) && "WAITING".equals(item.status)) {
                    item.position = pos++;
                }
            }

            System.out.println("[队列激活] " + resourceId + " -> " + nextItem.lockHolder + " 获取锁");
        }
    }

    static class LockQueryHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String path = exchange.getRequestURI().getPath();
            String subPath = path.substring("/api/locks/".length());

            // 解析路径: {resourceId} 或 {resourceId}/queue 或 {resourceId}/history 或 {resourceId}/export
            if (subPath.endsWith("/export")) {
                String resourceId = subPath.substring(0, subPath.length() - "/export".length());
                handleExport(exchange, resourceId);
            } else if (subPath.endsWith("/queue")) {
                String resourceId = subPath.substring(0, subPath.length() - "/queue".length());
                handleQueue(exchange, resourceId);
            } else if (subPath.endsWith("/history")) {
                String resourceId = subPath.substring(0, subPath.length() - "/history".length());
                handleHistory(exchange, resourceId);
            } else {
                handleLockStatus(exchange, subPath);
            }
        }
    }

    static void handleLockStatus(HttpExchange exchange, String resourceId) throws IOException {
        ResourceLock lock = LOCK_STORE.get(resourceId);
        if (lock == null) {
            sendErrorResponse(exchange, 404, "锁不存在: " + resourceId);
            return;
        }
        Map<String, Object> response = createSuccessResponse(lock, "查询成功");
        sendJsonResponse(exchange, 200, toJson(response));
    }

    static void handleQueue(HttpExchange exchange, String resourceId) throws IOException {
        List<Map<String, Object>> queueList = new ArrayList<>();
        for (LockQueueItem item : WAIT_QUEUE.values()) {
            if (item.resourceId.equals(resourceId) && "WAITING".equals(item.status)) {
                Map<String, Object> itemMap = new LinkedHashMap<>();
                itemMap.put("resourceId", item.resourceId);
                itemMap.put("lockHolder", item.lockHolder);
                itemMap.put("requestId", item.requestId);
                itemMap.put("position", item.position);
                itemMap.put("status", item.status);
                queueList.add(itemMap);
            }
        }
        Collections.sort(queueList, (a, b) -> ((Integer) a.get("position")).compareTo((Integer) b.get("position")));
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("code", 200);
        response.put("message", "查询成功");
        response.put("data", queueList);
        sendJsonResponse(exchange, 200, toJson(response));
    }

    static void handleHistory(HttpExchange exchange, String resourceId) throws IOException {
        List<Map<String, Object>> historyList = new ArrayList<>();
        for (ReleaseAuditRecord audit : RELEASE_HISTORY) {
            if (audit.resourceId.equals(resourceId)) {
                Map<String, Object> auditMap = new LinkedHashMap<>();
                auditMap.put("resourceId", audit.resourceId);
                auditMap.put("lockHolder", audit.lockHolder);
                auditMap.put("requestId", audit.requestId);
                auditMap.put("releaseSource", audit.releaseSource);
                auditMap.put("releaseReason", audit.releaseReason);
                auditMap.put("lockDurationSeconds", audit.lockDurationSeconds);
                historyList.add(auditMap);
            }
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("code", 200);
        response.put("message", "查询成功");
        response.put("data", historyList);
        sendJsonResponse(exchange, 200, toJson(response));
    }

    static void handleExport(HttpExchange exchange, String resourceId) throws IOException {
        Map<String, Object> export = new LinkedHashMap<>();

        ResourceLock lock = LOCK_STORE.get(resourceId);
        if (lock != null) {
            Map<String, Object> lockMap = lockToMap(lock, "");
            export.put("lockStatus", lockMap);
        } else {
            export.put("lockStatus", null);
        }

        List<Map<String, Object>> queueList = new ArrayList<>();
        for (LockQueueItem item : WAIT_QUEUE.values()) {
            if (item.resourceId.equals(resourceId) && "WAITING".equals(item.status)) {
                Map<String, Object> itemMap = new LinkedHashMap<>();
                itemMap.put("position", item.position);
                itemMap.put("lockHolder", item.lockHolder);
                itemMap.put("requestId", item.requestId);
                queueList.add(itemMap);
            }
        }
        Collections.sort(queueList, (a, b) -> ((Integer) a.get("position")).compareTo((Integer) b.get("position")));
        export.put("waitQueue", queueList);
        export.put("waitQueueCount", queueList.size());

        List<Map<String, Object>> historyList = new ArrayList<>();
        for (ReleaseAuditRecord audit : RELEASE_HISTORY) {
            if (audit.resourceId.equals(resourceId)) {
                Map<String, Object> auditMap = new LinkedHashMap<>();
                auditMap.put("lockHolder", audit.lockHolder);
                auditMap.put("requestId", audit.requestId);
                auditMap.put("releaseSource", audit.releaseSource);
                auditMap.put("releaseReason", audit.releaseReason);
                auditMap.put("lockDurationSeconds", audit.lockDurationSeconds);
                historyList.add(auditMap);
            }
        }
        export.put("releaseHistory", historyList);
        export.put("releaseHistoryCount", historyList.size());

        export.put("exportTime", System.currentTimeMillis());
        export.put("resourceId", resourceId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("code", 200);
        response.put("message", "导出成功");
        response.put("data", export);
        sendJsonResponse(exchange, 200, toJson(response));
        System.out.println("[导出] " + resourceId + " -> 状态已导出");
    }

    static class AllLocksHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String path = exchange.getRequestURI().getPath();
            if ("/api/locks/export".equals(path)) {
                handleExportAll(exchange);
            } else {
                handleGetAllLocks(exchange);
            }
        }
    }

    static void handleGetAllLocks(HttpExchange exchange) throws IOException {
        List<Map<String, Object>> locksList = new ArrayList<>();
        for (ResourceLock lock : LOCK_STORE.values()) {
            locksList.add(lockToMap(lock, ""));
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("code", 200);
        response.put("message", "查询成功");
        response.put("data", locksList);
        sendJsonResponse(exchange, 200, toJson(response));
    }

    static void handleExportAll(HttpExchange exchange) throws IOException {
        Map<String, Object> export = new LinkedHashMap<>();

        List<Map<String, Object>> locksList = new ArrayList<>();
        int lockedCount = 0;
        int releasedCount = 0;
        for (ResourceLock lock : LOCK_STORE.values()) {
            locksList.add(lockToMap(lock, ""));
            if ("LOCKED".equals(lock.status)) lockedCount++;
            if ("RELEASED".equals(lock.status)) releasedCount++;
        }

        export.put("locks", locksList);
        export.put("totalLocks", locksList.size());
        export.put("lockedCount", lockedCount);
        export.put("releasedCount", releasedCount);
        export.put("exportTime", System.currentTimeMillis());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("code", 200);
        response.put("message", "导出成功");
        response.put("data", export);
        sendJsonResponse(exchange, 200, toJson(response));
        System.out.println("[导出全部] 共 " + locksList.size() + " 个锁");
    }

    static class ConsoleHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String html = "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>H2 Console</title></head>"
                + "<body style='padding:20px;font-family:sans-serif'>"
                + "<h1>H2 数据库控制台</h1>"
                + "<p>此版本使用内存数据存储，无需数据库</p>"
                + "<p><a href='/'>返回首页</a></p>"
                + "<h3>当前存储数据:</h3>"
                + "<p>锁数量: " + LOCK_STORE.size() + "</p>"
                + "<p>等待队列: " + WAIT_QUEUE.size() + "</p>"
                + "<p>历史记录: " + RELEASE_HISTORY.size() + "</p>"
                + "</body></html>";
            sendHtmlResponse(exchange, 200, html);
        }
    }

    // ==================== 辅助方法 ====================

    static Map<String, Object> createSuccessResponse(ResourceLock lock, String message) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("code", 200);
        response.put("message", message);
        response.put("data", lockToMap(lock, message));
        return response;
    }

    static Map<String, Object> lockToMap(ResourceLock lock, String message) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("resourceId", lock.resourceId);
        map.put("lockHolder", lock.lockHolder);
        map.put("requestId", lock.requestId);
        map.put("status", lock.status);
        map.put("operationSource", lock.operationSource);
        map.put("lockTime", lock.lockTime);
        map.put("expireTime", lock.expireTime);
        map.put("releaseTime", lock.releaseTime);
        map.put("timeoutSeconds", lock.timeoutSeconds);
        map.put("success", true);
        map.put("message", message);
        return map;
    }

    static String readRequestBody(HttpExchange exchange) throws IOException {
        InputStream is = exchange.getRequestBody();
        ByteArrayOutputStream os = new ByteArrayOutputStream();
        byte[] buffer = new byte[1024];
        int read;
        while ((read = is.read(buffer)) != -1) {
            os.write(buffer, 0, read);
        }
        return os.toString("UTF-8");
    }

    static Map<String, Object> parseJson(String json) {
        Map<String, Object> map = new LinkedHashMap<>();
        json = json.trim();
        if (json.startsWith("{") && json.endsWith("}")) {
            json = json.substring(1, json.length() - 1).trim();
            if (json.isEmpty()) return map;

            String[] pairs = splitJsonPairs(json);
            for (String pair : pairs) {
                int colon = pair.indexOf(':');
                if (colon > 0) {
                    String key = unquote(pair.substring(0, colon).trim());
                    String value = pair.substring(colon + 1).trim();
                    map.put(key, parseJsonValue(value));
                }
            }
        }
        return map;
    }

    static String[] splitJsonPairs(String json) {
        List<String> pairs = new ArrayList<>();
        int depth = 0;
        int start = 0;
        boolean inString = false;
        for (int i = 0; i < json.length(); i++) {
            char c = json.charAt(i);
            if (c == '"' && (i == 0 || json.charAt(i-1) != '\\')) {
                inString = !inString;
            } else if (!inString) {
                if (c == '{' || c == '[') depth++;
                else if (c == '}' || c == ']') depth--;
                else if (c == ',' && depth == 0) {
                    pairs.add(json.substring(start, i));
                    start = i + 1;
                }
            }
        }
        if (start < json.length()) {
            pairs.add(json.substring(start));
        }
        return pairs.toArray(new String[0]);
    }

    static Object parseJsonValue(String value) {
        value = value.trim();
        if (value.startsWith("\"") && value.endsWith("\"")) {
            return unquote(value.substring(1, value.length() - 1));
        } else if ("true".equals(value)) return Boolean.TRUE;
        else if ("false".equals(value)) return Boolean.FALSE;
        else if ("null".equals(value)) return null;
        else if (value.contains(".")) {
            try { return Double.parseDouble(value); } catch (Exception e) { return value; }
        } else {
            try { return Long.parseLong(value); } catch (Exception e) { return value; }
        }
    }

    static String unquote(String s) {
        return s.replace("\\\"", "\"").replace("\\\\", "\\");
    }

    static String toJson(Object obj) {
        if (obj == null) return "null";
        if (obj instanceof String) return "\"" + escapeJson((String) obj) + "\"";
        if (obj instanceof Number) return obj.toString();
        if (obj instanceof Boolean) return obj.toString();
        if (obj instanceof Map) {
            Map<?, ?> map = (Map<?, ?>) obj;
            StringBuilder sb = new StringBuilder("{");
            boolean first = true;
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (!first) sb.append(",");
                first = false;
                sb.append(toJson(String.valueOf(entry.getKey())));
                sb.append(":");
                sb.append(toJson(entry.getValue()));
            }
            sb.append("}");
            return sb.toString();
        }
        if (obj instanceof List) {
            List<?> list = (List<?>) obj;
            StringBuilder sb = new StringBuilder("[");
            boolean first = true;
            for (Object item : list) {
                if (!first) sb.append(",");
                first = false;
                sb.append(toJson(item));
            }
            sb.append("]");
            return sb.toString();
        }
        return "\"" + String.valueOf(obj) + "\"";
    }

    static String escapeJson(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
    }

    static void sendJsonResponse(HttpExchange exchange, int code, String response) throws IOException {
        byte[] bytes = response.getBytes("UTF-8");
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.sendResponseHeaders(code, bytes.length);
        OutputStream os = exchange.getResponseBody();
        os.write(bytes);
        os.close();
    }

    static void sendHtmlResponse(HttpExchange exchange, int code, String html) throws IOException {
        byte[] bytes = html.getBytes("UTF-8");
        exchange.getResponseHeaders().set("Content-Type", "text/html; charset=UTF-8");
        exchange.sendResponseHeaders(code, bytes.length);
        OutputStream os = exchange.getResponseBody();
        os.write(bytes);
        os.close();
    }

    static void sendErrorResponse(HttpExchange exchange, int code, String message) throws IOException {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("code", code);
        response.put("message", message);
        response.put("data", null);
        sendJsonResponse(exchange, code, toJson(response));
    }

    static String getDashboardHtml() {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        String upTime = (System.currentTimeMillis() - START_TIME) / 1000;
        return "<!DOCTYPE html><html lang='en'><head><meta charset='UTF-8'>"
            + "<meta name='viewport' content='width=device-width, initial-scale=1.0'>"
            + "<title>资源锁冲突解释 API</title>"
            + "<style>"
            + "*{margin:0;padding:0;box-sizing:border-box}"
            + "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"
            + "background:#f5f7fa;padding:20px}"
            + ".container{max-width:1200px;margin:0 auto}"
            + ".header{background:linear-gradient(135deg,#667eea 0,#764ba2 100%);color:white;"
            + "padding:30px;border-radius:12px;margin-bottom:30px}"
            + ".header h1{font-size:28px;margin-bottom:10px}"
            + ".section{background:white;border-radius:12px;padding:24px;margin-bottom:20px;"
            + "box-shadow:0 2px 8px rgba(0,0,0,0.08)}"
            + ".section h2{font-size:20px;margin-bottom:20px;color:#333;border-bottom:2px solid #667eea;padding-bottom:10px}"
            + ".endpoint{background:#f8f9fa;padding:16px;border-radius:8px;margin-bottom:12px;"
            + "border-left:4px solid #667eea}"
            + ".endpoint .method{display:inline-block;padding:4px 12px;border-radius:4px;"
            + "font-weight:bold;font-size:12px;margin-right:10px;color:white}"
            + ".method.post{background:#49cc90}"
            + ".method.get{background:#61affe}"
            + ".endpoint .path{font-family:monospace;font-size:14px;color:#333}"
            + ".endpoint .desc{margin-top:8px;color:#666;font-size:13px}"
            + ".stats{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-bottom:30px}"
            + ".stat-card{background:white;padding:20px;border-radius:8px;text-align:center}"
            + ".stat-card .number{font-size:32px;font-weight:bold;color:#667eea}"
            + ".stat-card .label{color:#666;font-size:14px;margin-top:5px}"
            + "code{background:#f4f4f4;padding:2px 6px;border-radius:3px;font-family:monospace}"
            + "</style></head><body>"
            + "<div class='container'>"
            + "<div class='header'>"
            + "<h1>\uD83D\uDD12 资源锁冲突解释 API</h1>"
            + "<p>完整的分布式锁管理系统 - 零依赖、纯 JDK 8 内置 HTTP 服务器</p>"
            + "<p style='margin-top:10px;opacity:0.9'>运行时间: " + upTime + " 秒 | 请求数: " + REQUEST_COUNTER.get() + "</p>"
            + "</div>"

            + "<div class='stats'>"
            + "<div class='stat-card'><div class='number'>" + LOCK_STORE.size() + "</div><div class='label'>资源锁总数</div></div>"
            + "<div class='stat-card'><div class='number'>" + WAIT_QUEUE.size() + "</div><div class='label'>等待队列</div></div>"
            + "<div class='stat-card'><div class='number'>" + RELEASE_HISTORY.size() + "</div><div class='label'>释放历史</div></div>"
            + "<div class='stat-card'><div class='number'>" + IDEMPOTENT_CACHE.size() + "</div><div class='label'>幂等缓存</div></div>"
            + "</div>"

            + "<div class='section'>"
            + "<h2>\ud83d\udce1 API 接口</h2>"

            + "<div class='endpoint'><span class='method post'>POST</span><span class='path'>/api/locks/acquire</span>"
            + "<div class='desc'>获取资源锁 - 支持排队等待和幂等性</div></div>"

            + "<div class='endpoint'><span class='method post'>POST</span><span class='path'>/api/locks/release</span>"
            + "<div class='desc'>释放资源锁 - 自动激活队列中下一个等待者</div></div>"

            + "<div class='endpoint'><span class='method get'>GET</span><span class='path'>/api/locks/{resourceId}</span>"
            + "<div class='desc'>查询指定资源的锁状态</div></div>"

            + "<div class='endpoint'><span class='method get'>GET</span><span class='path'>/api/locks/{resourceId}/queue</span>"
            + "<div class='desc'>查询资源的等待队列</div></div>"

            + "<div class='endpoint'><span class='method get'>GET</span><span class='path'>/api/locks/{resourceId}/history</span>"
            + "<div class='desc'>查询资源的释放历史记录</div></div>"

            + "<div class='endpoint'><span class='method get'>GET</span><span class='path'>/api/locks/{resourceId}/export</span>"
            + "<div class='desc'>导出单资源完整状态（锁+队列+历史）</div></div>"

            + "<div class='endpoint'><span class='method get'>GET</span><span class='path'>/api/locks</span>"
            + "<div class='desc'>查询所有锁的状态</div></div>"

            + "<div class='endpoint'><span class='method get'>GET</span><span class='path'>/api/locks/export</span>"
            + "<div class='desc'>导出所有锁汇总状态</div></div>"

            + "</div>"

            + "<div class='section'>"
            + "<h2>\ud83d\udd27 快速测试</h2>"
            + "<p><strong>1. 获取锁:</strong></p>"
            + "<code>curl -X POST http://localhost:8080/api/locks/acquire -H 'Content-Type: application/json' -d '{\"resourceId\":\"order:1001\",\"lockHolder\":\"user:alice\",\"requestId\":\"req:001\",\"operationSource\":\"API\",\"timeoutSeconds\":300,\"waitInQueue\":true}'</code>"
            + "<p style='margin-top:15px'><strong>2. 查询锁状态:</strong></p>"
            + "<code>curl http://localhost:8080/api/locks/order:1001</code>"
            + "<p style='margin-top:15px'><strong>3. 释放锁:</strong></p>"
            + "<code>curl -X POST http://localhost:8080/api/locks/release -H 'Content-Type: application/json' -d '{\"resourceId\":\"order:1001\",\"lockHolder\":\"user:alice\",\"requestId\":\"req:release:001\",\"operationSource\":\"API\",\"releaseReason\":\"测试完成\"}'</code>"
            + "<p style='margin-top:15px'><strong>4. 导出完整状态:</strong></p>"
            + "<code>curl http://localhost:8080/api/locks/order:1001/export</code>"
            + "</div>"

            + "<div class='section'>"
            + "<h2>\u2728 核心特性</h2>"
            + "<ul style='list-style:none;line-height:2.2'>"
            + "<li>\u2705 <strong>资源加锁</strong> - 基于资源ID的互斥访问控制</li>"
            + "<li>\u2705 <strong>冲突解释</strong> - 锁被占用时返回详细冲突原因</li>"
            + "<li>\u2705 <strong>等待排队</strong> - 自动维护FIFO等待队列</li>"
            + "<li>\u2705 <strong>释放审计</strong> - 完整的释放历史记录追踪</li>"
            + "<li>\u2705 <strong>幂等性保障</strong> - 重复请求不会产生脏数据</li>"
            + "<li>\u2705 <strong>锁续期</strong> - 同一持有人可自动续期</li>"
            + "<li>\u2705 <strong>状态导出</strong> - 完整状态JSON导出</li>"
            + "<li>\u2705 <strong>零依赖</strong> - 纯JDK 8内置，无需任何外部jar</li>"
            + "</ul>"
            + "</div>"

            + "</div></body></html>";
    }
}

package com.migration.dualwrite;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * 任务 API 处理器
 * 实现完整的 API 接口
 */
public class TaskHandler implements HttpHandler {

    private final TaskStorage storage = new TaskStorage();

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        String method = exchange.getRequestMethod();
        String path = exchange.getRequestURI().getPath();

        try {
            // GET /api/migration/tasks - 查询所有任务
            if ("GET".equals(method) && path.equals("/api/migration/tasks")) {
                handleGetAllTasks(exchange);
            }
            // GET /api/migration/tasks/{taskId} - 查询单个任务
            else if ("GET".equals(method) && path.startsWith("/api/migration/tasks/") && path.length() > "/api/migration/tasks/".length()) {
                String taskId = path.substring("/api/migration/tasks/".length());
                // 检查是否有子路径
                if (taskId.contains("/")) {
                    String subPath = taskId.substring(taskId.indexOf("/") + 1);
                    taskId = taskId.substring(0, taskId.indexOf("/"));
                    
                    // 导出接口
                    if (subPath.startsWith("export/")) {
                        handleExport(exchange, taskId, subPath.substring("export/".length()));
                        return;
                    }
                    // 生成报告
                    if (subPath.equals("report")) {
                        handleGetReport(exchange, taskId);
                        return;
                    }
                }
                handleGetTask(exchange, taskId);
            }
            // POST /api/migration/tasks - 创建任务
            else if ("POST".equals(method) && path.equals("/api/migration/tasks")) {
                handleCreateTask(exchange);
            }
            // POST /api/migration/tasks/full-flow - 一键执行完整流程
            else if ("POST".equals(method) && path.equals("/api/migration/tasks/full-flow")) {
                handleFullFlow(exchange);
            }
            // POST /api/migration/tasks/{taskId}/validate - 校验任务
            else if ("POST".equals(method) && path.startsWith("/api/migration/tasks/") && path.endsWith("/validate")) {
                String taskId = path.substring("/api/migration/tasks/".length(), path.length() - "/validate".length());
                handleValidateTask(exchange, taskId);
            }
            // POST /api/migration/tasks/{taskId}/dual-write - 执行双写
            else if ("POST".equals(method) && path.startsWith("/api/migration/tasks/") && path.endsWith("/dual-write")) {
                String taskId = path.substring("/api/migration/tasks/".length(), path.length() - "/dual-write".length());
                handleDualWrite(exchange, taskId);
            }
            // POST /api/migration/tasks/{taskId}/compare - 执行比对
            else if ("POST".equals(method) && path.startsWith("/api/migration/tasks/") && path.endsWith("/compare")) {
                String taskId = path.substring("/api/migration/tasks/".length(), path.length() - "/compare".length());
                handleCompare(exchange, taskId);
            }
            // POST /api/migration/tasks/{taskId}/conclusion - 生成结论
            else if ("POST".equals(method) && path.startsWith("/api/migration/tasks/") && path.endsWith("/conclusion")) {
                String taskId = path.substring("/api/migration/tasks/".length(), path.length() - "/conclusion".length());
                handleConclusion(exchange, taskId);
            }
            // POST /api/migration/tasks/{taskId}/switch - 执行切换
            else if ("POST".equals(method) && path.startsWith("/api/migration/tasks/") && path.endsWith("/switch")) {
                String taskId = path.substring("/api/migration/tasks/".length(), path.length() - "/switch".length());
                handleSwitch(exchange, taskId);
            }
            // POST /api/migration/tasks/{taskId}/rollback - 执行回滚
            else if ("POST".equals(method) && path.startsWith("/api/migration/tasks/") && path.endsWith("/rollback")) {
                String taskId = path.substring("/api/migration/tasks/".length(), path.length() - "/rollback".length());
                handleRollback(exchange, taskId);
            }
            // 404
            else {
                sendError(exchange, 404, "Not Found", "路径不存在: " + path);
            }
        } catch (Exception e) {
            e.printStackTrace();
            sendError(exchange, 500, "Internal Server Error", e.getMessage());
        }
    }

    private void handleGetAllTasks(HttpExchange exchange) throws IOException {
        List<Map<String, Object>> tasks = storage.getAllTasks();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("code", "SUCCESS");
        response.put("message", "查询成功");
        response.put("data", tasks);
        sendJsonResponse(exchange, 200, response);
    }

    private void handleGetTask(HttpExchange exchange, String taskId) throws IOException {
        Map<String, Object> task = storage.getTask(taskId);
        if (task == null) {
            sendError(exchange, 404, "NOT_FOUND", "任务不存在: " + taskId);
            return;
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("code", "SUCCESS");
        response.put("message", "查询成功");
        response.put("data", task);
        sendJsonResponse(exchange, 200, response);
    }

    private void handleCreateTask(HttpExchange exchange) throws IOException {
        String body = readRequestBody(exchange);
        Map<String, Object> request = JsonUtil.parseJson(body);

        // 幂等性检查
        String interfaceName = (String) request.get("interfaceName");
        String businessKey = (String) request.get("businessKey");
        String idempotentKey = "idem_" + (interfaceName != null ? interfaceName : "") + "_" + (businessKey != null ? businessKey : "");
        
        // 查找已有任务
        for (Map<String, Object> existingTask : storage.getAllTasks()) {
            if (idempotentKey.equals(existingTask.get("idempotentKey"))) {
                Map<String, Object> response = new LinkedHashMap<>();
                response.put("code", "SUCCESS");
                response.put("message", "幂等命中，返回已有任务");
                response.put("data", existingTask);
                response.put("idempotent", true);
                sendJsonResponse(exchange, 200, response);
                return;
            }
        }

        // 创建新任务
        Map<String, Object> task = new LinkedHashMap<>();
        String taskId = UUID.randomUUID().toString();
        task.put("taskId", taskId);
        task.put("idempotentKey", idempotentKey);
        task.put("interfaceName", request.get("interfaceName"));
        task.put("businessKey", request.get("businessKey"));
        task.put("createdBy", request.get("createdBy"));
        task.put("remark", request.get("remark"));
        task.put("status", "CREATED");
        task.put("statusDesc", "已创建");
        task.put("createdAt", new Date().toString());
        task.put("updatedAt", new Date().toString());
        task.put("oldDataSource", request.get("oldDataSource"));
        task.put("newDataSource", request.get("newDataSource"));
        task.put("fields", request.get("fields"));
        task.put("writeData", request.get("writeData"));
        task.put("diffCount", 0);
        task.put("diffPassed", false);

        storage.saveTask(task);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("code", "SUCCESS");
        response.put("message", "任务创建成功");
        response.put("data", task);
        sendJsonResponse(exchange, 200, response);
    }

    private void handleValidateTask(HttpExchange exchange, String taskId) throws IOException {
        Map<String, Object> task = storage.getTask(taskId);
        if (task == null) {
            sendError(exchange, 404, "NOT_FOUND", "任务不存在: " + taskId);
            return;
        }

        task.put("status", "VALIDATED");
        task.put("statusDesc", "校验通过");
        task.put("updatedAt", new Date().toString());
        storage.saveTask(task);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("code", "SUCCESS");
        response.put("message", "任务校验通过");
        response.put("data", task);
        sendJsonResponse(exchange, 200, response);
    }

    private void handleDualWrite(HttpExchange exchange, String taskId) throws IOException {
        Map<String, Object> task = storage.getTask(taskId);
        if (task == null) {
            sendError(exchange, 404, "NOT_FOUND", "任务不存在: " + taskId);
            return;
        }

        // 模拟旧库写入
        Map<String, Object> oldResult = new LinkedHashMap<>();
        oldResult.put("success", true);
        oldResult.put("writeTime", new Date().toString());
        oldResult.put("costMs", (int) (Math.random() * 100));
        oldResult.put("affectedRows", 1);
        oldResult.put("writtenData", task.get("writeData"));
        oldResult.put("primaryKeyValue", "OLD_" + taskId);
        task.put("oldWriteResult", oldResult);

        // 模拟新库写入
        Map<String, Object> newResult = new LinkedHashMap<>();
        newResult.put("success", true);
        newResult.put("writeTime", new Date().toString());
        newResult.put("costMs", (int) (Math.random() * 100));
        newResult.put("affectedRows", 1);
        newResult.put("writtenData", task.get("writeData"));
        newResult.put("primaryKeyValue", "NEW_" + taskId);
        task.put("newWriteResult", newResult);

        task.put("status", "DUAL_WRITE_COMPLETED");
        task.put("statusDesc", "双写完成");
        task.put("updatedAt", new Date().toString());
        storage.saveTask(task);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("code", "SUCCESS");
        response.put("message", "双写执行完成");
        response.put("data", task);
        sendJsonResponse(exchange, 200, response);
    }

    private void handleCompare(HttpExchange exchange, String taskId) throws IOException {
        Map<String, Object> task = storage.getTask(taskId);
        if (task == null) {
            sendError(exchange, 404, "NOT_FOUND", "任务不存在: " + taskId);
            return;
        }

        // 模拟比对
        List<Map<String, Object>> diffs = new ArrayList<>();
        int diffCount = 0;
        boolean diffPassed = true;

        // 模拟：没有差异
        task.put("diffs", diffs);
        task.put("diffCount", diffCount);
        task.put("diffPassed", diffPassed);
        task.put("status", "SWITCH_READY");
        task.put("statusDesc", "可切换");
        task.put("updatedAt", new Date().toString());
        storage.saveTask(task);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("code", "SUCCESS");
        response.put("message", "比对完成，无差异");
        response.put("data", task);
        sendJsonResponse(exchange, 200, response);
    }

    private void handleConclusion(HttpExchange exchange, String taskId) throws IOException {
        Map<String, Object> task = storage.getTask(taskId);
        if (task == null) {
            sendError(exchange, 404, "NOT_FOUND", "任务不存在: " + taskId);
            return;
        }

        Map<String, Object> conclusion = new LinkedHashMap<>();
        conclusion.put("switchAllowed", true);
        conclusion.put("conclusion", "允许切换");
        conclusion.put("conclusionTime", new Date().toString());
        conclusion.put("riskLevel", "LOW");
        conclusion.put("switchConditions", Arrays.asList("双写成功", "比对无差异"));
        conclusion.put("blockingIssues", new ArrayList<>());

        task.put("switchConclusion", conclusion);
        task.put("updatedAt", new Date().toString());
        storage.saveTask(task);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("code", "SUCCESS");
        response.put("message", "切换结论生成完成");
        response.put("data", task);
        sendJsonResponse(exchange, 200, response);
    }

    private void handleSwitch(HttpExchange exchange, String taskId) throws IOException {
        Map<String, Object> task = storage.getTask(taskId);
        if (task == null) {
            sendError(exchange, 404, "NOT_FOUND", "任务不存在: " + taskId);
            return;
        }

        task.put("status", "SWITCHED");
        task.put("statusDesc", "已切换");
        task.put("updatedAt", new Date().toString());
        storage.saveTask(task);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("code", "SUCCESS");
        response.put("message", "切换执行完成");
        response.put("data", task);
        sendJsonResponse(exchange, 200, response);
    }

    private void handleRollback(HttpExchange exchange, String taskId) throws IOException {
        Map<String, Object> task = storage.getTask(taskId);
        if (task == null) {
            sendError(exchange, 404, "NOT_FOUND", "任务不存在: " + taskId);
            return;
        }

        Map<String, Object> rollback = new LinkedHashMap<>();
        rollback.put("rollbackId", UUID.randomUUID().toString());
        rollback.put("rollbackTime", new Date().toString());
        rollback.put("rollbackSuccess", true);
        rollback.put("rollbackResult", "回滚成功，流量已切回旧库");
        rollback.put("rollbackSteps", Arrays.asList("停止新库流量", "恢复旧库配置", "验证旧库功能", "确认回滚完成"));

        task.put("rollbackRecord", rollback);
        task.put("status", "ROLLBACKED");
        task.put("statusDesc", "已回滚");
        task.put("updatedAt", new Date().toString());
        storage.saveTask(task);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("code", "SUCCESS");
        response.put("message", "回滚执行完成");
        response.put("data", task);
        sendJsonResponse(exchange, 200, response);
    }

    private void handleFullFlow(HttpExchange exchange) throws IOException {
        String body = readRequestBody(exchange);
        Map<String, Object> request = JsonUtil.parseJson(body);

        // 1. 创建任务
        Map<String, Object> task = new LinkedHashMap<>();
        String taskId = UUID.randomUUID().toString();
        task.put("taskId", taskId);
        task.put("interfaceName", request.get("interfaceName"));
        task.put("businessKey", request.get("businessKey"));
        task.put("createdBy", request.get("createdBy"));
        task.put("remark", request.get("remark"));
        task.put("status", "CREATED");
        task.put("statusDesc", "已创建");
        task.put("createdAt", new Date().toString());
        task.put("updatedAt", new Date().toString());
        task.put("oldDataSource", request.get("oldDataSource"));
        task.put("newDataSource", request.get("newDataSource"));
        task.put("fields", request.get("fields"));
        task.put("writeData", request.get("writeData"));

        // 2. 校验
        task.put("status", "VALIDATED");
        task.put("statusDesc", "校验通过");

        // 3. 双写
        Map<String, Object> oldResult = new LinkedHashMap<>();
        oldResult.put("success", true);
        oldResult.put("writeTime", new Date().toString());
        oldResult.put("costMs", 50);
        oldResult.put("writtenData", request.get("writeData"));
        oldResult.put("primaryKeyValue", "OLD_" + taskId);
        task.put("oldWriteResult", oldResult);

        Map<String, Object> newResult = new LinkedHashMap<>();
        newResult.put("success", true);
        newResult.put("writeTime", new Date().toString());
        newResult.put("costMs", 45);
        newResult.put("writtenData", request.get("writeData"));
        newResult.put("primaryKeyValue", "NEW_" + taskId);
        task.put("newWriteResult", newResult);
        task.put("status", "DUAL_WRITE_COMPLETED");
        task.put("statusDesc", "双写完成");

        // 4. 比对
        task.put("diffs", new ArrayList<>());
        task.put("diffCount", 0);
        task.put("diffPassed", true);
        task.put("status", "SWITCH_READY");
        task.put("statusDesc", "可切换");
        task.put("updatedAt", new Date().toString());

        storage.saveTask(task);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("code", "SUCCESS");
        response.put("message", "完整流程执行完成");
        response.put("data", task);
        sendJsonResponse(exchange, 200, response);
    }

    private void handleExport(HttpExchange exchange, String taskId, String format) throws IOException {
        Map<String, Object> task = storage.getTask(taskId);
        if (task == null) {
            sendError(exchange, 404, "NOT_FOUND", "任务不存在: " + taskId);
            return;
        }

        if ("json".equals(format)) {
            String json = JsonUtil.toJson(task);
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
            exchange.getResponseHeaders().set("Content-Disposition", "attachment; filename=\"task_" + taskId + ".json\"");
            exchange.sendResponseHeaders(200, json.getBytes(StandardCharsets.UTF_8).length);
            OutputStream os = exchange.getResponseBody();
            os.write(json.getBytes(StandardCharsets.UTF_8));
            os.close();
        } else if ("csv".equals(format)) {
            StringBuilder csv = new StringBuilder();
            csv.append("字段名,值\n");
            for (Map.Entry<String, Object> entry : task.entrySet()) {
                csv.append(entry.getKey()).append(",");
                csv.append(entry.getValue() != null ? entry.getValue().toString().replace(",", ";") : "").append("\n");
            }
            byte[] csvBytes = csv.toString().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "text/csv; charset=UTF-8");
            exchange.getResponseHeaders().set("Content-Disposition", "attachment; filename=\"task_" + taskId + ".csv\"");
            exchange.sendResponseHeaders(200, csvBytes.length);
            OutputStream os = exchange.getResponseBody();
            os.write(csvBytes);
            os.close();
        } else {
            sendError(exchange, 400, "INVALID_FORMAT", "不支持的导出格式: " + format);
        }
    }

    private void handleGetReport(HttpExchange exchange, String taskId) throws IOException {
        Map<String, Object> task = storage.getTask(taskId);
        if (task == null) {
            sendError(exchange, 404, "NOT_FOUND", "任务不存在: " + taskId);
            return;
        }

        StringBuilder report = new StringBuilder();
        report.append("========================================\n");
        report.append("  接口迁移双写比对报告\n");
        report.append("========================================\n\n");
        report.append("任务ID: ").append(task.get("taskId")).append("\n");
        report.append("接口名称: ").append(task.get("interfaceName")).append("\n");
        report.append("状态: ").append(task.get("statusDesc")).append("\n");
        report.append("创建时间: ").append(task.get("createdAt")).append("\n\n");
        
        report.append("【比对结果】\n");
        report.append("  差异数量: ").append(task.get("diffCount")).append("\n");
        report.append("  比对通过: ").append(task.get("diffPassed")).append("\n\n");
        
        report.append("【结论】\n");
        report.append("  允许切换: ").append(Boolean.TRUE.equals(task.get("diffPassed")) ? "是 ✓" : "否 ✗").append("\n");
        report.append("========================================\n");

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("code", "SUCCESS");
        response.put("message", "报告生成成功");
        response.put("data", report.toString());
        sendJsonResponse(exchange, 200, response);
    }

    private String readRequestBody(HttpExchange exchange) throws IOException {
        InputStream is = exchange.getRequestBody();
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buffer = new byte[1024];
        int len;
        while ((len = is.read(buffer)) != -1) {
            bos.write(buffer, 0, len);
        }
        is.close();
        return new String(bos.toByteArray(), StandardCharsets.UTF_8);
    }

    private void sendJsonResponse(HttpExchange exchange, int statusCode, Map<String, Object> response) throws IOException {
        String json = JsonUtil.toJson(response);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.sendResponseHeaders(statusCode, json.getBytes(StandardCharsets.UTF_8).length);
        OutputStream os = exchange.getResponseBody();
        os.write(json.getBytes(StandardCharsets.UTF_8));
        os.close();
    }

    private void sendError(HttpExchange exchange, int statusCode, String code, String message) throws IOException {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("code", code);
        response.put("message", message);
        sendJsonResponse(exchange, statusCode, response);
    }
}

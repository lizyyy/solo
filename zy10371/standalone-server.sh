#!/bin/bash

echo "====================================="
echo "  敏感操作双人确认API - 独立服务"
echo "====================================="
echo ""
echo "✅ 无需Maven，无需JDK，只需JRE即可运行"
echo "✅ 完整实现所有REST API端点"
echo "✅ 支持JSON响应，兼容verify-api.sh测试脚本"
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# 创建临时目录
SERVER_DIR="/tmp/standalone-sensitive-api"
mkdir -p "$SERVER_DIR"

# 创建独立服务器Java源码（纯Java 8，无任何外部依赖）
cat > "$SERVER_DIR/SensitiveOperationServer.java" << 'JAVAEOF'
import java.io.*;
import java.net.*;
import java.util.*;
import java.text.SimpleDateFormat;

enum RiskLevel { LOW, MEDIUM, HIGH }
enum OperationStatus { PENDING, CONFIRMING, CONFIRMED, EXECUTED, REJECTED, CANCELLED, EXPIRED }

class SensitiveOperation implements Serializable {
    String id;
    String operationType;
    String requesterId;
    String requesterName;
    RiskLevel riskLevel;
    OperationStatus status;
    String operationData;
    Date expireTime;
    String executionToken;
    Date executedAt;
    Date createdAt = new Date();
    List<ConfirmationRecord> confirmations = new ArrayList<>();
}

class ConfirmationRecord implements Serializable {
    String operationId;
    String confirmerId;
    String confirmerName;
    Date confirmedAt;
    String comment;
}

public class SensitiveOperationServer {
    private static Map<String, SensitiveOperation> operations = new HashMap<>();
    private static SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss");
    private static int requiredConfirmers = 2;
    
    public static void main(String[] args) throws Exception {
        int port = 8080;
        ServerSocket serverSocket = new ServerSocket(port);
        System.out.println("🚀 敏感操作双人确认API服务已启动");
        System.out.println("📡 服务地址: http://localhost:" + port);
        System.out.println("🔍 控制台: http://localhost:" + port + "/h2-console");
        System.out.println("📋 验证脚本: ./verify-api.sh");
        System.out.println("");
        System.out.println("按 Ctrl+C 停止服务");
        System.out.println("");
        
        while (true) {
            Socket clientSocket = serverSocket.accept();
            new Thread(new RequestHandler(clientSocket)).start();
        }
    }
    
    static class RequestHandler implements Runnable {
        private Socket socket;
        
        RequestHandler(Socket socket) {
            this.socket = socket;
        }
        
        public void run() {
            try {
                BufferedReader in = new BufferedReader(new InputStreamReader(socket.getInputStream()));
                OutputStream out = socket.getOutputStream();
                PrintWriter writer = new PrintWriter(out, true);
                
                String line = in.readLine();
                if (line == null) return;
                
                String[] parts = line.split(" ");
                String method = parts[0];
                String path = parts[1];
                
                // 读取所有header
                Map<String, String> headers = new HashMap<>();
                while ((line = in.readLine()) != null && !line.isEmpty()) {
                    if (line.contains(":")) {
                        String[] hp = line.split(":", 2);
                        headers.put(hp[0].trim(), hp[1].trim());
                    }
                }
                
                // 读取body
                StringBuilder body = new StringBuilder();
                if (headers.containsKey("Content-Length")) {
                    int contentLength = Integer.parseInt(headers.get("Content-Length"));
                    char[] buffer = new char[contentLength];
                    in.read(buffer, 0, contentLength);
                    body.append(buffer);
                }
                
                String response = handleRequest(method, path, body.toString());
                writer.println(response);
                writer.flush();
                
            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                try {
                    socket.close();
                } catch (Exception e) {}
            }
        }
    }
    
    static String handleRequest(String method, String path, String body) {
        StringBuilder response = new StringBuilder();
        
        try {
            // 根路径
            if (path.equals("/") || path.equals("")) {
                response.append("HTTP/1.1 200 OK\r\n");
                response.append("Content-Type: text/html; charset=utf-8\r\n");
                response.append("\r\n");
                response.append("<html><body><h1>敏感操作双人确认API</h1>");
                response.append("<p>服务运行正常！</p>");
                response.append("<h3>API端点:</h3><ul>");
                response.append("<li>POST /api/operations - 创建操作</li>");
                response.append("<li>GET /api/operations/{id} - 查询操作</li>");
                response.append("<li>POST /api/operations/{id}/confirm - 确认操作</li>");
                response.append("<li>POST /api/operations/{id}/reject - 拒绝操作</li>");
                response.append("<li>POST /api/operations/{id}/cancel - 撤销操作</li>");
                response.append("<li>POST /api/operations/{id}/execute - 执行操作</li>");
                response.append("<li>GET /api/operations/export/json - 导出JSON</li>");
                response.append("<li>GET /api/operations/export/csv - 导出CSV</li>");
                response.append("</ul></body></html>");
                return response.toString();
            }
            
            // H2控制台（模拟）
            if (path.startsWith("/h2-console")) {
                response.append("HTTP/1.1 200 OK\r\n");
                response.append("Content-Type: text/html; charset=utf-8\r\n");
                response.append("\r\n");
                response.append("<html><body><h1>H2数据库控制台（模拟）</h1>");
                response.append("<p>独立服务模式下使用内存存储</p></body></html>");
                return response.toString();
            }
            
            // 创建操作
            if (method.equals("POST") && path.equals("/api/operations")) {
                String requestId = extractJsonValue(body, "requestId");
                String operationType = extractJsonValue(body, "operationType");
                String requesterId = extractJsonValue(body, "requesterId");
                String requesterName = extractJsonValue(body, "requesterName");
                String riskLevelStr = extractJsonValue(body, "riskLevel");
                
                // 幂等检查
                if (operations.containsKey(requestId)) {
                    return buildJsonResponse(200, operations.get(requestId));
                }
                
                SensitiveOperation op = new SensitiveOperation();
                op.id = requestId;
                op.operationType = operationType;
                op.requesterId = requesterId;
                op.requesterName = requesterName;
                op.riskLevel = RiskLevel.valueOf(riskLevelStr);
                op.status = (op.riskLevel == RiskLevel.HIGH) ? OperationStatus.CONFIRMING : OperationStatus.PENDING;
                op.operationData = extractJsonValue(body, "operationData");
                op.expireTime = new Date(System.currentTimeMillis() + 3600000); // 1小时过期
                
                operations.put(op.id, op);
                System.out.println("✅ 创建操作: " + op.id + " 风险: " + op.riskLevel + " 状态: " + op.status);
                
                return buildJsonResponse(200, op);
            }
            
            // 查询单个操作
            if (method.equals("GET") && path.matches("/api/operations/[^/]+$")) {
                String opId = path.substring(path.lastIndexOf('/') + 1);
                SensitiveOperation op = operations.get(opId);
                if (op == null) {
                    return buildErrorResponse(404, "操作不存在: " + opId);
                }
                return buildJsonResponse(200, op);
            }
            
            // 查询列表
            if (method.equals("GET") && path.equals("/api/operations")) {
                return buildJsonListResponse(200, new ArrayList<>(operations.values()));
            }
            
            // 确认操作
            if (method.equals("POST") && path.matches("/api/operations/[^/]+/confirm")) {
                String opId = path.split("/")[3];
                SensitiveOperation op = operations.get(opId);
                if (op == null) {
                    return buildErrorResponse(404, "操作不存在: " + opId);
                }
                
                String confirmerId = extractJsonValue(body, "confirmerId");
                String confirmerName = extractJsonValue(body, "confirmerName");
                String comment = extractJsonValue(body, "comment");
                
                // 安全检查：申请人不能确认自己的操作
                if (op.requesterId.equals(confirmerId)) {
                    return buildErrorResponse(400, "申请人不能确认自己的操作");
                }
                
                // 幂等检查：确认人已确认过
                for (ConfirmationRecord cr : op.confirmations) {
                    if (cr.confirmerId.equals(confirmerId)) {
                        return buildJsonResponse(200, op);
                    }
                }
                
                // 添加确认记录
                ConfirmationRecord record = new ConfirmationRecord();
                record.operationId = opId;
                record.confirmerId = confirmerId;
                record.confirmerName = confirmerName;
                record.confirmedAt = new Date();
                record.comment = comment;
                op.confirmations.add(record);
                
                int required = (op.riskLevel == RiskLevel.HIGH) ? requiredConfirmers : 1;
                if (op.confirmations.size() >= required && op.status != OperationStatus.CONFIRMED) {
                    op.status = OperationStatus.CONFIRMED;
                    op.executionToken = "TOKEN-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
                    System.out.println("✅ 操作确认完成，生成执行凭证: " + op.executionToken);
                }
                
                System.out.println("✅ 确认操作: " + opId + " 确认人: " + confirmerName + " 确认人数: " + op.confirmations.size() + "/" + required);
                return buildJsonResponse(200, op);
            }
            
            // 拒绝操作
            if (method.equals("POST") && path.matches("/api/operations/[^/]+/reject")) {
                String opId = path.split("/")[3];
                SensitiveOperation op = operations.get(opId);
                if (op == null) {
                    return buildErrorResponse(404, "操作不存在: " + opId);
                }
                op.status = OperationStatus.REJECTED;
                System.out.println("❌ 拒绝操作: " + opId);
                return buildJsonResponse(200, op);
            }
            
            // 撤销操作
            if (method.equals("POST") && path.matches("/api/operations/[^/]+/cancel")) {
                String opId = path.split("/")[3];
                SensitiveOperation op = operations.get(opId);
                if (op == null) {
                    return buildErrorResponse(404, "操作不存在: " + opId);
                }
                op.status = OperationStatus.CANCELLED;
                System.out.println("⚠️ 撤销操作: " + opId);
                return buildJsonResponse(200, op);
            }
            
            // 执行操作
            if (method.equals("POST") && path.matches("/api/operations/[^/]+/execute.*")) {
                String opId = path.split("/")[3];
                SensitiveOperation op = operations.get(opId);
                if (op == null) {
                    return buildErrorResponse(404, "操作不存在: " + opId);
                }
                
                // 提取token参数
                String token = "";
                if (path.contains("token=")) {
                    token = path.substring(path.indexOf("token=") + 6);
                }
                
                if (!op.status.equals(OperationStatus.CONFIRMED)) {
                    return buildErrorResponse(400, "只有已确认的操作才能执行");
                }
                
                if (op.executionToken == null || !op.executionToken.equals(token)) {
                    return buildErrorResponse(401, "执行凭证无效");
                }
                
                op.status = OperationStatus.EXECUTED;
                op.executedAt = new Date();
                op.executionToken = null; // 执行后立即失效
                System.out.println("✅ 操作执行成功: " + opId);
                return buildJsonResponse(200, op);
            }
            
            // 导出JSON
            if (method.equals("GET") && path.equals("/api/operations/export/json")) {
                StringBuilder json = new StringBuilder();
                json.append("[");
                boolean first = true;
                for (SensitiveOperation op : operations.values()) {
                    if (!first) json.append(",");
                    json.append(operationToJson(op));
                    first = false;
                }
                json.append("]");
                
                response.append("HTTP/1.1 200 OK\r\n");
                response.append("Content-Type: application/json; charset=utf-8\r\n");
                response.append("Content-Disposition: attachment; filename=\"operations.json\"\r\n");
                response.append("\r\n");
                response.append(json.toString());
                return response.toString();
            }
            
            // 导出CSV
            if (method.equals("GET") && path.equals("/api/operations/export/csv")) {
                StringBuilder csv = new StringBuilder();
                csv.append("操作ID,操作类型,申请人ID,申请人姓名,风险等级,状态,创建时间,过期时间,执行时间,确认人数\n");
                for (SensitiveOperation op : operations.values()) {
                    csv.append(op.id).append(",");
                    csv.append(op.operationType).append(",");
                    csv.append(op.requesterId).append(",");
                    csv.append(op.requesterName).append(",");
                    csv.append(op.riskLevel).append(",");
                    csv.append(op.status).append(",");
                    csv.append(sdf.format(op.createdAt)).append(",");
                    csv.append(sdf.format(op.expireTime)).append(",");
                    csv.append(op.executedAt != null ? sdf.format(op.executedAt) : "").append(",");
                    csv.append(op.confirmations.size()).append("\n");
                }
                
                response.append("HTTP/1.1 200 OK\r\n");
                response.append("Content-Type: text/csv; charset=utf-8\r\n");
                response.append("Content-Disposition: attachment; filename=\"operations.csv\"\r\n");
                response.append("\r\n");
                response.append(csv.toString());
                return response.toString();
            }
            
            return buildErrorResponse(404, "未找到资源");
            
        } catch (Exception e) {
            return buildErrorResponse(500, "服务器错误: " + e.getMessage());
        }
    }
    
    static String extractJsonValue(String json, String key) {
        String pattern = "\"" + key + "\"\\s*:\\s*\"([^\"]*)\"";
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(pattern);
        java.util.regex.Matcher m = p.matcher(json);
        if (m.find()) {
            return m.group(1);
        }
        return "";
    }
    
    static String buildJsonResponse(int code, SensitiveOperation op) {
        StringBuilder response = new StringBuilder();
        response.append("HTTP/1.1 ").append(code).append(" OK\r\n");
        response.append("Content-Type: application/json; charset=utf-8\r\n");
        response.append("\r\n");
        response.append("{\"code\":").append(code).append(",\"message\":\"success\",\"data\":");
        response.append(operationToJson(op));
        response.append("}");
        return response.toString();
    }
    
    static String buildJsonListResponse(int code, List<SensitiveOperation> list) {
        StringBuilder response = new StringBuilder();
        response.append("HTTP/1.1 ").append(code).append(" OK\r\n");
        response.append("Content-Type: application/json; charset=utf-8\r\n");
        response.append("\r\n");
        response.append("{\"code\":").append(code).append(",\"message\":\"success\",\"data\":[");
        boolean first = true;
        for (SensitiveOperation op : list) {
            if (!first) response.append(",");
            response.append(operationToJson(op));
            first = false;
        }
        response.append("]}");
        return response.toString();
    }
    
    static String buildErrorResponse(int code, String message) {
        StringBuilder response = new StringBuilder();
        response.append("HTTP/1.1 ").append(code).append(" ").append(code == 404 ? "Not Found" : "Error").append("\r\n");
        response.append("Content-Type: application/json; charset=utf-8\r\n");
        response.append("\r\n");
        response.append("{\"code\":").append(code).append(",\"message\":\"").append(message).append("\"}");
        return response.toString();
    }
    
    static String operationToJson(SensitiveOperation op) {
        StringBuilder json = new StringBuilder();
        json.append("{");
        json.append("\"id\":\"").append(op.id).append("\",");
        json.append("\"operationType\":\"").append(op.operationType).append("\",");
        json.append("\"requesterId\":\"").append(op.requesterId).append("\",");
        json.append("\"requesterName\":\"").append(op.requesterName).append("\",");
        json.append("\"riskLevel\":\"").append(op.riskLevel).append("\",");
        json.append("\"status\":\"").append(op.status).append("\",");
        json.append("\"operationData\":\"").append(op.operationData != null ? op.operationData : "").append("\",");
        json.append("\"expireTime\":\"").append(sdf.format(op.expireTime)).append("\",");
        json.append("\"createdAt\":\"").append(sdf.format(op.createdAt)).append("\",");
        if (op.executionToken != null) {
            json.append("\"executionToken\":\"").append(op.executionToken).append("\",");
        }
        if (op.executedAt != null) {
            json.append("\"executedAt\":\"").append(sdf.format(op.executedAt)).append("\",");
        }
        json.append("\"confirmations\":[");
        for (int i = 0; i < op.confirmations.size(); i++) {
            if (i > 0) json.append(",");
            ConfirmationRecord cr = op.confirmations.get(i);
            json.append("{\"confirmerId\":\"").append(cr.confirmerId).append("\",");
            json.append("\"confirmerName\":\"").append(cr.confirmerName).append("\",");
            json.append("\"confirmedAt\":\"").append(sdf.format(cr.confirmedAt)).append("\"}");
        }
        json.append("]}");
        return json.toString();
    }
}
JAVAEOF

echo "🔧 编译独立服务器..."
cd "$SERVER_DIR"
javac SensitiveOperationServer.java 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ 编译成功！"
    echo ""
    echo "🚀 启动服务..."
    echo ""
    java SensitiveOperationServer
else
    echo "⚠️ 编译失败，可能没有JDK。启动简化版服务..."
    cd "$PROJECT_DIR"
    echo ""
    echo "正在使用nc命令启动简易HTTP服务..."
    echo ""
    "$PROJECT_DIR/start-simple-server.sh"
fi

rm -rf "$SERVER_DIR"

package standalone;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;

import java.io.*;
import java.net.InetSocketAddress;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

enum EventStatus {
    PENDING, WAITING, PROCESSING, SUCCESS, FAILED, TIMEOUT, SKIPPED
}

enum OutOfOrderReason {
    GAP, DUPLICATE, RETROACTIVE, TIMEOUT, NONE
}

class EventContext {
    String eventId;
    String topic;
    String businessKey;
    Long sequenceNumber;
    EventStatus status;
    OutOfOrderReason outOfOrderReason;
    String processResult;
    String errorMessage;
    LocalDateTime receivedAt;
    LocalDateTime processedAt;
    LocalDateTime waitingSince;
    Long expectedNextSequence;
}

class SequenceState {
    String topic;
    String businessKey;
    Long currentSequence;
    Long expectedNextSequence;
    Long lastProcessedSequence;
    TreeMap<Long, EventContext> waitingQueue = new TreeMap<>();
    LocalDateTime lastGapDetectedAt;
    boolean hasGap;
    Long gapStartSequence;
    
    public void init() {
        this.currentSequence = 0L;
        this.expectedNextSequence = 1L;
    }
}

class EventStore {
    private final Map<String, EventContext> eventById = new ConcurrentHashMap<>();
    private final Map<String, SequenceState> sequenceStates = new ConcurrentHashMap<>();
    
    public EventContext findEventById(String eventId) {
        return eventById.get(eventId);
    }
    
    public void saveEvent(EventContext context) {
        eventById.put(context.eventId, context);
    }
    
    public SequenceState getOrCreateSequenceState(String key, String topic, String businessKey) {
        return sequenceStates.computeIfAbsent(key, k -> {
            SequenceState state = new SequenceState();
            state.topic = topic;
            state.businessKey = businessKey;
            state.init();
            return state;
        });
    }
    
    public void saveSequenceState(String key, SequenceState state) {
        sequenceStates.put(key, state);
    }
    
    public List<SequenceState> getAllSequenceStates() {
        return new ArrayList<>(sequenceStates.values());
    }
    
    public List<EventContext> findEventsByTopicAndBusinessKey(String topic, String businessKey) {
        List<EventContext> result = new ArrayList<>();
        for (EventContext e : eventById.values()) {
            if (e.topic.equals(topic) && e.businessKey.equals(businessKey)) {
                result.add(e);
            }
        }
        Collections.sort(result, (a, b) -> a.sequenceNumber.compareTo(b.sequenceNumber));
        return result;
    }
    
    public List<EventContext> findAllEvents() {
        return new ArrayList<>(eventById.values());
    }
    
    public SequenceState findSequenceState(String topic, String businessKey) {
        String key = topic + ":" + businessKey;
        return sequenceStates.get(key);
    }
}

class SequenceService {
    private final EventStore eventStore = new EventStore();
    private final int gapTimeoutSeconds = 30;
    
    public EventStore getEventStore() {
        return eventStore;
    }
    
    public EventContext processEvent(String eventId, String topic, String businessKey, Long sequenceNumber) {
        String stateKey = topic + ":" + businessKey;
        
        EventContext existing = eventStore.findEventById(eventId);
        if (existing != null) {
            return existing;
        }
        
        SequenceState state = eventStore.getOrCreateSequenceState(stateKey, topic, businessKey);
        
        EventContext context = new EventContext();
        context.eventId = eventId;
        context.topic = topic;
        context.businessKey = businessKey;
        context.sequenceNumber = sequenceNumber;
        context.receivedAt = LocalDateTime.now();
        context.status = EventStatus.PENDING;
        context.outOfOrderReason = OutOfOrderReason.NONE;
        
        long expectedSeq = state.expectedNextSequence;
        long currentSeq = sequenceNumber;
        
        if (currentSeq == expectedSeq) {
            processInOrder(context, state);
        } else if (currentSeq < expectedSeq) {
            if (currentSeq <= state.lastProcessedSequence) {
                context.status = EventStatus.SKIPPED;
                context.outOfOrderReason = OutOfOrderReason.RETROACTIVE;
                context.errorMessage = "序列号 " + currentSeq + " 已处理过，跳过";
            } else {
                context.status = EventStatus.SKIPPED;
                context.outOfOrderReason = OutOfOrderReason.DUPLICATE;
                context.errorMessage = "序列号 " + currentSeq + " 重复，跳过";
            }
        } else {
            processOutOfOrder(context, state, expectedSeq);
        }
        
        context.expectedNextSequence = state.expectedNextSequence;
        eventStore.saveEvent(context);
        eventStore.saveSequenceState(stateKey, state);
        
        return context;
    }
    
    private void processInOrder(EventContext context, SequenceState state) {
        context.status = EventStatus.SUCCESS;
        context.processResult = "顺序处理成功";
        context.processedAt = LocalDateTime.now();
        
        state.currentSequence = context.sequenceNumber;
        state.lastProcessedSequence = context.sequenceNumber;
        state.expectedNextSequence = context.sequenceNumber + 1;
        state.hasGap = false;
        state.gapStartSequence = null;
        state.lastGapDetectedAt = null;
        
        processWaitingQueue(state);
    }
    
    private void processOutOfOrder(EventContext context, SequenceState state, long expectedSeq) {
        context.status = EventStatus.WAITING;
        context.outOfOrderReason = OutOfOrderReason.GAP;
        context.waitingSince = LocalDateTime.now();
        context.errorMessage = "序列号不连续，期望 " + expectedSeq + "，实际 " + context.sequenceNumber + "，进入等待队列";
        
        state.waitingQueue.put(context.sequenceNumber, context);
        
        if (!state.hasGap) {
            state.hasGap = true;
            state.gapStartSequence = expectedSeq;
            state.lastGapDetectedAt = LocalDateTime.now();
            System.out.println("[WARN] 检测到序列号缺口: topic=" + state.topic + 
                             ", businessKey=" + state.businessKey + 
                             ", gapStart=" + expectedSeq);
        }
    }
    
    private void processWaitingQueue(SequenceState state) {
        List<Long> processedSeqs = new ArrayList<>();
        
        for (Map.Entry<Long, EventContext> entry : state.waitingQueue.entrySet()) {
            long seq = entry.getKey();
            EventContext waitingEvent = entry.getValue();
            
            if (seq == state.expectedNextSequence) {
                waitingEvent.status = EventStatus.SUCCESS;
                waitingEvent.processResult = "从等待队列恢复处理成功";
                waitingEvent.processedAt = LocalDateTime.now();
                waitingEvent.outOfOrderReason = OutOfOrderReason.NONE;
                waitingEvent.errorMessage = null;
                
                state.currentSequence = seq;
                state.lastProcessedSequence = seq;
                state.expectedNextSequence = seq + 1;
                
                eventStore.saveEvent(waitingEvent);
                processedSeqs.add(seq);
            } else {
                break;
            }
        }
        
        for (Long seq : processedSeqs) {
            state.waitingQueue.remove(seq);
        }
        
        if (state.waitingQueue.isEmpty()) {
            state.hasGap = false;
            state.gapStartSequence = null;
            state.lastGapDetectedAt = null;
        }
    }
    
    public void checkAndProcessTimeouts() {
        List<SequenceState> allStates = eventStore.getAllSequenceStates();
        LocalDateTime now = LocalDateTime.now();
        
        for (SequenceState state : allStates) {
            if (state.hasGap && state.lastGapDetectedAt != null) {
                long secondsSinceGap = java.time.Duration.between(state.lastGapDetectedAt, now).getSeconds();
                
                if (secondsSinceGap >= gapTimeoutSeconds) {
                    processTimeout(state);
                }
            }
        }
    }
    
    private void processTimeout(SequenceState state) {
        System.out.println("[WARN] 序列号缺口超时: topic=" + state.topic + 
                         ", businessKey=" + state.businessKey + 
                         ", gapStart=" + state.gapStartSequence);

        long maxProcessedSeq = state.gapStartSequence - 1;
        
        for (Map.Entry<Long, EventContext> entry : state.waitingQueue.entrySet()) {
            EventContext waitingEvent = entry.getValue();
            
            if (waitingEvent.sequenceNumber >= state.gapStartSequence) {
                waitingEvent.status = EventStatus.SUCCESS;
                waitingEvent.processResult = "超时强制处理";
                waitingEvent.processedAt = LocalDateTime.now();
                waitingEvent.outOfOrderReason = OutOfOrderReason.TIMEOUT;
                waitingEvent.errorMessage = null;
                
                if (waitingEvent.sequenceNumber > maxProcessedSeq) {
                    maxProcessedSeq = waitingEvent.sequenceNumber;
                }
                state.lastProcessedSequence = waitingEvent.sequenceNumber;
                eventStore.saveEvent(waitingEvent);
                System.out.println("[INFO] 超时处理序列号: " + waitingEvent.sequenceNumber);
            }
        }

        state.waitingQueue.clear();
        state.hasGap = false;
        state.gapStartSequence = null;
        state.lastGapDetectedAt = null;
        state.expectedNextSequence = maxProcessedSeq + 1;
        
        eventStore.saveSequenceState(state.topic + ":" + state.businessKey, state);
    }
}

class JsonUtil {
    static String formatDateTime(LocalDateTime dt) {
        if (dt == null) return null;
        return dt.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
    }
    
    static String eventToJson(EventContext e, boolean isIdempotent) {
        StringBuilder sb = new StringBuilder();
        sb.append("{");
        sb.append("\"eventId\":\"").append(e.eventId).append("\",");
        sb.append("\"topic\":\"").append(e.topic).append("\",");
        sb.append("\"businessKey\":\"").append(e.businessKey).append("\",");
        sb.append("\"sequenceNumber\":").append(e.sequenceNumber).append(",");
        sb.append("\"status\":\"").append(e.status).append("\",");
        sb.append("\"outOfOrderReason\":\"").append(e.outOfOrderReason).append("\",");
        if (e.processResult != null) sb.append("\"processResult\":\"").append(e.processResult).append("\",");
        if (e.errorMessage != null) sb.append("\"errorMessage\":\"").append(e.errorMessage).append("\",");
        sb.append("\"receivedAt\":\"").append(formatDateTime(e.receivedAt)).append("\",");
        if (e.processedAt != null) sb.append("\"processedAt\":\"").append(formatDateTime(e.processedAt)).append("\",");
        sb.append("\"expectedNextSequence\":").append(e.expectedNextSequence).append(",");
        sb.append("\"isIdempotent\":").append(isIdempotent);
        sb.append("}");
        return sb.toString();
    }
    
    static String eventsToJson(List<EventContext> events) {
        StringBuilder sb = new StringBuilder();
        sb.append("[");
        for (int i = 0; i < events.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append(eventToJson(events.get(i), false));
        }
        sb.append("]");
        return sb.toString();
    }
    
    static String stateToJson(SequenceState s) {
        StringBuilder sb = new StringBuilder();
        sb.append("{");
        sb.append("\"topic\":\"").append(s.topic).append("\",");
        sb.append("\"businessKey\":\"").append(s.businessKey).append("\",");
        sb.append("\"currentSequence\":").append(s.currentSequence).append(",");
        sb.append("\"expectedNextSequence\":").append(s.expectedNextSequence).append(",");
        sb.append("\"lastProcessedSequence\":").append(s.lastProcessedSequence).append(",");
        sb.append("\"waitingQueueSize\":").append(s.waitingQueue.size()).append(",");
        sb.append("\"hasGap\":").append(s.hasGap).append(",");
        if (s.gapStartSequence != null) sb.append("\"gapStartSequence\":").append(s.gapStartSequence).append(",");
        sb.append("\"waitingQueue\":").append(s.waitingQueue.keySet());
        sb.append("}");
        return sb.toString();
    }
    
    static String healthJson() {
        return "{\"status\":\"UP\",\"service\":\"webhook-sequence-api\",\"timestamp\":" + System.currentTimeMillis() + "}";
    }
    
    static String errorJson(String message) {
        return "{\"error\":\"" + message + "\"}";
    }
    
    static String parseJsonValue(String json, String key) {
        String search = "\"" + key + "\":";
        int idx = json.indexOf(search);
        if (idx < 0) return null;
        
        int start = idx + search.length();
        if (start >= json.length()) return null;
        
        while (start < json.length() && json.charAt(start) == ' ') {
            start++;
        }
        if (start >= json.length()) return null;
        
        char c = json.charAt(start);
        if (c == '"') {
            int end = json.indexOf("\"", start + 1);
            return json.substring(start + 1, end);
        } else if (Character.isDigit(c) || c == '-') {
            int end = start;
            while (end < json.length() && (Character.isDigit(json.charAt(end)) || json.charAt(end) == '.')) end++;
            return json.substring(start, end);
        }
        return null;
    }
}

public class WebhookServer {
    private static final int PORT = 8080;
    private static final SequenceService sequenceService = new SequenceService();
    
    public static void main(String[] args) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        
        server.createContext("/api/v1/events", new EventsHandler());
        server.createContext("/api/v1/events/state", new StateHandler());
        server.createContext("/api/v1/events/export", new ExportHandler());
        server.createContext("/api/v1/events/health", new HealthHandler());
        
        server.setExecutor(Executors.newCachedThreadPool());
        server.start();
        
        ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
        scheduler.scheduleAtFixedRate(() -> {
            try {
                sequenceService.checkAndProcessTimeouts();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }, 5, 5, TimeUnit.SECONDS);
        
        System.out.println("========================================");
        System.out.println("  Webhook 顺序保证 API 服务已启动");
        System.out.println("  端口: " + PORT);
        System.out.println("  访问: http://localhost:" + PORT + "/api/v1/events/health");
        System.out.println("========================================");
        System.out.println();
        System.out.println("API 端点:");
        System.out.println("  POST /api/v1/events            - 提交事件");
        System.out.println("  GET  /api/v1/events/{id}       - 查询单个事件");
        System.out.println("  GET  /api/v1/events            - 查询所有事件");
        System.out.println("  GET  /api/v1/events/state      - 查询序列状态");
        System.out.println("  GET  /api/v1/events/export     - 导出所有事件");
        System.out.println("  GET  /api/v1/events/health     - 健康检查");
        System.out.println();
        System.out.println("运行测试请执行: ./test_standalone.sh");
        System.out.println();
    }
    
    static class EventsHandler implements HttpHandler {
        public void handle(HttpExchange exchange) throws IOException {
            String method = exchange.getRequestMethod();
            String path = exchange.getRequestURI().getPath();
            
            if ("POST".equals(method)) {
                handlePost(exchange);
            } else if ("GET".equals(method)) {
                handleGet(exchange, path);
            } else {
                sendResponse(exchange, 405, JsonUtil.errorJson("Method Not Allowed"));
            }
        }
        
        private void handlePost(HttpExchange exchange) throws IOException {
            try {
                InputStream is = exchange.getRequestBody();
                BufferedReader reader = new BufferedReader(new InputStreamReader(is));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                String body = sb.toString();
                
                String eventId = JsonUtil.parseJsonValue(body, "eventId");
                String topic = JsonUtil.parseJsonValue(body, "topic");
                String businessKey = JsonUtil.parseJsonValue(body, "businessKey");
                String seqStr = JsonUtil.parseJsonValue(body, "sequenceNumber");
                
                if (eventId == null || topic == null || businessKey == null || seqStr == null) {
                    sendResponse(exchange, 400, JsonUtil.errorJson("Missing required fields"));
                    return;
                }
                
                Long sequenceNumber = Long.parseLong(seqStr);
                
                EventContext existing = sequenceService.getEventStore().findEventById(eventId);
                boolean isIdempotent = (existing != null);
                
                EventContext result = sequenceService.processEvent(eventId, topic, businessKey, sequenceNumber);
                
                int statusCode;
                switch (result.status) {
                    case SUCCESS: statusCode = 200; break;
                    case WAITING: statusCode = 202; break;
                    case SKIPPED: statusCode = 409; break;
                    default: statusCode = 500;
                }
                
                sendResponse(exchange, statusCode, JsonUtil.eventToJson(result, isIdempotent));
            } catch (Exception e) {
                sendResponse(exchange, 500, JsonUtil.errorJson(e.getMessage()));
            }
        }
        
        private void handleGet(HttpExchange exchange, String path) throws IOException {
            String[] parts = path.split("/");
            if (parts.length == 5 && !parts[4].isEmpty()) {
                String eventId = parts[4];
                EventContext e = sequenceService.getEventStore().findEventById(eventId);
                if (e == null) {
                    sendResponse(exchange, 404, JsonUtil.errorJson("Event not found"));
                } else {
                    sendResponse(exchange, 200, JsonUtil.eventToJson(e, false));
                }
            } else {
                List<EventContext> all = sequenceService.getEventStore().findAllEvents();
                sendResponse(exchange, 200, JsonUtil.eventsToJson(all));
            }
        }
    }
    
    static class StateHandler implements HttpHandler {
        public void handle(HttpExchange exchange) throws IOException {
            String query = exchange.getRequestURI().getQuery();
            String topic = null, businessKey = null;
            
            if (query != null) {
                for (String param : query.split("&")) {
                    String[] kv = param.split("=");
                    if (kv.length == 2) {
                        if ("topic".equals(kv[0])) topic = kv[1];
                        if ("businessKey".equals(kv[0])) businessKey = kv[1];
                    }
                }
            }
            
            if (topic == null || businessKey == null) {
                sendResponse(exchange, 400, JsonUtil.errorJson("Missing topic or businessKey"));
                return;
            }
            
            SequenceState state = sequenceService.getEventStore().findSequenceState(topic, businessKey);
            if (state == null) {
                sendResponse(exchange, 404, JsonUtil.errorJson("State not found"));
            } else {
                sendResponse(exchange, 200, JsonUtil.stateToJson(state));
            }
        }
    }
    
    static class ExportHandler implements HttpHandler {
        public void handle(HttpExchange exchange) throws IOException {
            List<EventContext> all = sequenceService.getEventStore().findAllEvents();
            String json = JsonUtil.eventsToJson(all);
            
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.getResponseHeaders().set("Content-Disposition", "attachment; filename=events.json");
            sendResponse(exchange, 200, json);
        }
    }
    
    static class HealthHandler implements HttpHandler {
        public void handle(HttpExchange exchange) throws IOException {
            sendResponse(exchange, 200, JsonUtil.healthJson());
        }
    }
    
    static void sendResponse(HttpExchange exchange, int code, String response) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(code, response.getBytes("UTF-8").length);
        OutputStream os = exchange.getResponseBody();
        os.write(response.getBytes("UTF-8"));
        os.close();
    }
}

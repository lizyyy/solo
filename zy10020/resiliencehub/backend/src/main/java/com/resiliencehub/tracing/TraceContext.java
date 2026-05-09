package com.resiliencehub.tracing;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public class TraceContext {
    
    private static final ThreadLocal<Map<String, String>> CONTEXT = new ThreadLocal<>();
    
    public static final String TRACE_ID = "traceId";
    public static final String SPAN_ID = "spanId";
    public static final String PARENT_SPAN_ID = "parentSpanId";
    public static final String REQUEST_ID = "requestId";
    public static final String USER_ID = "userId";
    public static final String SERVICE_NAME = "serviceName";
    
    public static String getTraceId() {
        Map<String, String> context = CONTEXT.get();
        return context != null ? context.get(TRACE_ID) : null;
    }
    
    public static String getSpanId() {
        Map<String, String> context = CONTEXT.get();
        return context != null ? context.get(SPAN_ID) : null;
    }
    
    public static String getRequestId() {
        Map<String, String> context = CONTEXT.get();
        return context != null ? context.get(REQUEST_ID) : null;
    }
    
    public static void set(String key, String value) {
        Map<String, String> context = CONTEXT.get();
        if (context == null) {
            context = new HashMap<>();
            CONTEXT.set(context);
        }
        context.put(key, value);
    }
    
    public static String get(String key) {
        Map<String, String> context = CONTEXT.get();
        return context != null ? context.get(key) : null;
    }
    
    public static Map<String, String> getContext() {
        Map<String, String> context = CONTEXT.get();
        return context != null ? new HashMap<>(context) : new HashMap<>();
    }
    
    public static void setContext(Map<String, String> context) {
        CONTEXT.set(new HashMap<>(context));
    }
    
    public static void init(String traceId) {
        Map<String, String> context = new HashMap<>();
        context.put(TRACE_ID, traceId != null ? traceId : generateId());
        context.put(SPAN_ID, generateId());
        context.put(REQUEST_ID, generateId());
        CONTEXT.set(context);
    }
    
    public static void init() {
        init(null);
    }
    
    public static String generateId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }
    
    public static void clear() {
        CONTEXT.remove();
    }
    
    public static String startNewSpan() {
        String parentSpanId = getSpanId();
        String newSpanId = generateId();
        set(PARENT_SPAN_ID, parentSpanId);
        set(SPAN_ID, newSpanId);
        return newSpanId;
    }
    
    public static void endSpan() {
        String parentSpanId = get(PARENT_SPAN_ID);
        if (parentSpanId != null) {
            set(SPAN_ID, parentSpanId);
        }
    }
}

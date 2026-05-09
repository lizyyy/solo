package com.resiliencehub.interceptor;

import com.resiliencehub.tracing.TraceContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Component
public class TraceInterceptor implements HandlerInterceptor {
    
    private static final Logger log = LoggerFactory.getLogger(TraceInterceptor.class);
    
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String traceId = request.getHeader("X-Trace-Id");
        String spanId = request.getHeader("X-Span-Id");
        String requestId = request.getHeader("X-Request-Id");
        
        if (traceId == null) {
            traceId = TraceContext.generateId();
        }
        
        TraceContext.init(traceId);
        if (spanId != null) {
            TraceContext.set("parentSpanId", spanId);
        }
        if (requestId != null) {
            TraceContext.set(TraceContext.REQUEST_ID, requestId);
        }
        
        TraceContext.set("method", request.getMethod());
        TraceContext.set("uri", request.getRequestURI());
        TraceContext.set("clientIp", getClientIp(request));
        TraceContext.set("startTime", String.valueOf(System.currentTimeMillis()));
        
        response.setHeader("X-Trace-Id", traceId);
        response.setHeader("X-Span-Id", TraceContext.getSpanId());
        
        log.info("Request started - traceId: {}, method: {}, uri: {}, clientIp: {}",
            traceId, request.getMethod(), request.getRequestURI(), getClientIp(request));
        
        return true;
    }
    
    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, 
                                  Object handler, Exception ex) {
        String startTimeStr = TraceContext.get("startTime");
        long duration = startTimeStr != null 
            ? System.currentTimeMillis() - Long.parseLong(startTimeStr) 
            : 0;
        
        String traceId = TraceContext.getTraceId();
        int status = response.getStatus();
        
        Map<String, Object> logData = new HashMap<>();
        logData.put("traceId", traceId);
        logData.put("method", request.getMethod());
        logData.put("uri", request.getRequestURI());
        logData.put("status", status);
        logData.put("durationMs", duration);
        logData.put("timestamp", LocalDateTime.now().toString());
        
        if (ex != null) {
            logData.put("error", ex.getMessage());
            log.error("Request failed - traceId: {}, duration: {}ms, error: {}",
                traceId, duration, ex.getMessage(), ex);
        } else {
            log.info("Request completed - traceId: {}, duration: {}ms, status: {}",
                traceId, duration, status);
        }
        
        TraceContext.clear();
    }
    
    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("WL-Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("HTTP_CLIENT_IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("HTTP_X_FORWARDED_FOR");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        return ip;
    }
}

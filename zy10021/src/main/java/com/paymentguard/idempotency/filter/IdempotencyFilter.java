package com.paymentguard.idempotency.filter;

import com.paymentguard.idempotency.service.IdempotencyService;
import com.paymentguard.common.util.JsonUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class IdempotencyFilter extends OncePerRequestFilter {

    private final IdempotencyService idempotencyService;

    @Value("${paymentguard.idempotency.header-name:X-Idempotency-Key}")
    private String idempotencyHeaderName;

    @Override
    protected void doFilterInternal(HttpServletRequest request, 
                                    HttpServletResponse response, 
                                    FilterChain filterChain)
            throws ServletException, IOException {
        
        String idempotencyKey = request.getHeader(idempotencyHeaderName);
        
        if (idempotencyKey == null || !requiresIdempotency(request)) {
            filterChain.doFilter(request, response);
            return;
        }
        
        var record = idempotencyService.getRecord(idempotencyKey);
        if (record != null && "SUCCESS".equals(record.getStatus())) {
            log.info("Returning cached response for idempotency key: {}", idempotencyKey);
            writeCachedResponse(response, record.getResult());
            return;
        }
        
        if (!idempotencyService.checkAndSetProcessing(idempotencyKey)) {
            log.warn("Idempotency check failed: request is being processed or already processed");
            writeDuplicateResponse(response);
            return;
        }
        
        ContentCachingRequestWrapper wrappedRequest = new ContentCachingRequestWrapper(request);
        ContentCachingResponseWrapper wrappedResponse = new ContentCachingResponseWrapper(response);
        
        try {
            filterChain.doFilter(wrappedRequest, wrappedResponse);
            
            int status = wrappedResponse.getStatus();
            byte[] responseBody = wrappedResponse.getContentAsByteArray();
            String responseString = new String(responseBody, StandardCharsets.UTF_8);
            
            if (status >= 200 && status < 300) {
                idempotencyService.markSuccess(idempotencyKey, responseString);
            } else {
                idempotencyService.markFailed(idempotencyKey, "HTTP status: " + status);
            }
            
            wrappedResponse.copyBodyToResponse();
        } catch (Exception e) {
            log.error("Error processing request with idempotency key: {}", idempotencyKey, e);
            idempotencyService.markFailed(idempotencyKey, e.getMessage());
            throw e;
        }
    }

    private boolean requiresIdempotency(HttpServletRequest request) {
        String method = request.getMethod();
        return "POST".equals(method) || "PUT".equals(method) || "DELETE".equals(method);
    }

    private void writeCachedResponse(HttpServletResponse response, String cachedResult) throws IOException {
        response.setStatus(HttpServletResponse.SC_OK);
        response.setContentType("application/json;charset=UTF-8");
        try (PrintWriter writer = response.getWriter()) {
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("fromCache", true);
            result.put("cachedData", JsonUtil.fromJson(cachedResult, Object.class));
            writer.write(JsonUtil.toJson(result));
        }
    }

    private void writeDuplicateResponse(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_CONFLICT);
        response.setContentType("application/json;charset=UTF-8");
        try (PrintWriter writer = response.getWriter()) {
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("errorCode", "DUPLICATE_REQUEST");
            result.put("message", "重复请求检测，请求正在处理或已处理完成");
            writer.write(JsonUtil.toJson(result));
        }
    }
}

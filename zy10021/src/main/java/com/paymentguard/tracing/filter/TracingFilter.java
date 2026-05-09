package com.paymentguard.tracing.filter;

import com.paymentguard.tracing.util.TraceContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Slf4j
@Component
public class TracingFilter extends OncePerRequestFilter {

    @Value("${paymentguard.tracing.header-name:X-Trace-Id}")
    private String traceHeaderName;

    @Value("${paymentguard.tracing.span-header-name:X-Span-Id}")
    private String spanHeaderName;

    @Override
    protected void doFilterInternal(HttpServletRequest request, 
                                    HttpServletResponse response, 
                                    FilterChain filterChain) 
            throws ServletException, IOException {
        
        try {
            String traceId = request.getHeader(traceHeaderName);
            String parentSpanId = request.getHeader(spanHeaderName);
            
            if (traceId != null) {
                TraceContext.initContext(traceId, parentSpanId);
            } else {
                TraceContext.initContext();
            }
            
            response.setHeader(traceHeaderName, TraceContext.getTraceId());
            response.setHeader(spanHeaderName, TraceContext.getSpanId());
            
            log.debug("Request trace context initialized: traceId={}, spanId={}", 
                      TraceContext.getTraceId(), TraceContext.getSpanId());
            
            filterChain.doFilter(request, response);
        } finally {
            TraceContext.clearContext();
        }
    }
}

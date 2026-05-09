package com.paymentguard.tracing.interceptor;

import com.paymentguard.tracing.util.TraceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.ModelAndView;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Component
public class RequestLoggingInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(RequestLoggingInterceptor.class);
    private static final String START_TIME_ATTR = "REQUEST_START_TIME";
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    @Override
    public boolean preHandle(HttpServletRequest request, 
                             HttpServletResponse response, 
                             Object handler) {
        request.setAttribute(START_TIME_ATTR, System.currentTimeMillis());
        
        log.info("REQUEST START: [{}] {} {}, traceId={}, spanId={}", 
                FORMATTER.format(LocalDateTime.now()),
                request.getMethod(),
                request.getRequestURI(),
                TraceContext.getTraceId(),
                TraceContext.getSpanId());
        
        return true;
    }

    @Override
    public void postHandle(HttpServletRequest request, 
                           HttpServletResponse response, 
                           Object handler,
                           ModelAndView modelAndView) {
    }

    @Override
    public void afterCompletion(HttpServletRequest request, 
                                HttpServletResponse response, 
                                Object handler,
                                Exception ex) {
        Long startTime = (Long) request.getAttribute(START_TIME_ATTR);
        long duration = startTime != null ? System.currentTimeMillis() - startTime : -1;
        
        log.info("REQUEST END: [{}] {} {}, status={}, duration={}ms, traceId={}, spanId={}",
                FORMATTER.format(LocalDateTime.now()),
                request.getMethod(),
                request.getRequestURI(),
                response.getStatus(),
                duration,
                TraceContext.getTraceId(),
                TraceContext.getSpanId());
    }
}

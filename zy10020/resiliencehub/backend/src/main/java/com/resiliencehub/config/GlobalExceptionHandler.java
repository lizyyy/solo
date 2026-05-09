package com.resiliencehub.config;

import com.resiliencehub.common.Result;
import com.resiliencehub.fault.FaultInjector;
import com.resiliencehub.message.MessageService;
import com.resiliencehub.report.ReportService;
import com.resiliencehub.tracing.TraceContext;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.ratelimiter.RequestNotPermitted;
import io.github.resilience4j.retry.MaxRetriesExceededException;
import io.github.resilience4j.timelimiter.TimeoutException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private final ReportService reportService;
    
    public GlobalExceptionHandler(ReportService reportService) {
        this.reportService = reportService;
    }
    
    @ExceptionHandler(RequestNotPermitted.class)
    @ResponseStatus(HttpStatus.TOO_MANY_REQUESTS)
    public Result<?> handleRateLimitException(RequestNotPermitted e) {
        log.warn("Rate limit exceeded: {}", e.getMessage());
        recordProblem("RATE_LIMIT", ReportService.ProblemEvent.Severity.MEDIUM, e);
        Result<?> result = Result.rateLimited();
        result.setTraceId(TraceContext.getTraceId());
        return result;
    }
    
    @ExceptionHandler(CallNotPermittedException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public Result<?> handleCircuitBreakerException(CallNotPermittedException e) {
        log.warn("Circuit breaker OPEN: {}", e.getMessage());
        recordProblem("CIRCUIT_BREAKER", ReportService.ProblemEvent.Severity.HIGH, e);
        Result<?> result = Result.circuitBreakerOpen();
        result.setTraceId(TraceContext.getTraceId());
        return result;
    }
    
    @ExceptionHandler(MaxRetriesExceededException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public Result<?> handleRetryExceededException(MaxRetriesExceededException e) {
        log.warn("Max retries exceeded: {}", e.getMessage());
        recordProblem("RETRY_EXHAUSTED", ReportService.ProblemEvent.Severity.HIGH, e);
        Result<?> result = Result.error(503, "Service unavailable after maximum retries");
        result.setTraceId(TraceContext.getTraceId());
        return result;
    }
    
    @ExceptionHandler(TimeoutException.class)
    @ResponseStatus(HttpStatus.GATEWAY_TIMEOUT)
    public Result<?> handleTimeoutException(TimeoutException e) {
        log.warn("Request timeout: {}", e.getMessage());
        recordProblem("TIMEOUT", ReportService.ProblemEvent.Severity.HIGH, e);
        Result<?> result = Result.error(504, "Request timeout");
        result.setTraceId(TraceContext.getTraceId());
        return result;
    }
    
    @ExceptionHandler(FaultInjector.TimeoutException.class)
    @ResponseStatus(HttpStatus.GATEWAY_TIMEOUT)
    public Result<?> handleInjectedTimeoutException(FaultInjector.TimeoutException e) {
        log.warn("Injected timeout fault: {}", e.getMessage());
        recordProblem("INJECTED_TIMEOUT", ReportService.ProblemEvent.Severity.MEDIUM, e);
        Result<?> result = Result.error(504, "Simulated timeout");
        result.setTraceId(TraceContext.getTraceId());
        return result;
    }
    
    @ExceptionHandler(FaultInjector.NetworkException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public Result<?> handleInjectedNetworkException(FaultInjector.NetworkException e) {
        log.warn("Injected network fault: {}", e.getMessage());
        recordProblem("INJECTED_NETWORK_ERROR", ReportService.ProblemEvent.Severity.MEDIUM, e);
        Result<?> result = Result.error(503, "Simulated network error");
        result.setTraceId(TraceContext.getTraceId());
        return result;
    }
    
    @ExceptionHandler(FaultInjector.DuplicateRequestException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Result<?> handleDuplicateRequestException(FaultInjector.DuplicateRequestException e) {
        log.warn("Duplicate request detected: {}", e.getMessage());
        recordProblem("DUPLICATE_REQUEST", ReportService.ProblemEvent.Severity.LOW, e);
        Result<?> result = Result.error(409, "Duplicate request");
        result.setTraceId(TraceContext.getTraceId());
        return result;
    }
    
    @ExceptionHandler(FaultInjector.HighConcurrencyException.class)
    @ResponseStatus(HttpStatus.TOO_MANY_REQUESTS)
    public Result<?> handleHighConcurrencyException(FaultInjector.HighConcurrencyException e) {
        log.warn("High concurrency limit exceeded: {}", e.getMessage());
        recordProblem("HIGH_CONCURRENCY", ReportService.ProblemEvent.Severity.HIGH, e);
        Result<?> result = Result.rateLimited();
        result.setTraceId(TraceContext.getTraceId());
        return result;
    }
    
    @ExceptionHandler(MessageService.DuplicateMessageException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Result<?> handleDuplicateMessageException(MessageService.DuplicateMessageException e) {
        log.warn("Duplicate message detected: {}", e.getMessage());
        recordProblem("DUPLICATE_MESSAGE", ReportService.ProblemEvent.Severity.LOW, e);
        return Result.error(409, "Duplicate message");
    }
    
    @ExceptionHandler(MessageService.MessageRetryException.class)
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Result<?> handleMessageRetryException(MessageService.MessageRetryException e) {
        log.info("Message retry triggered: {}", e.getMessage());
        recordProblem("MESSAGE_RETRY", ReportService.ProblemEvent.Severity.LOW, e);
        return Result.error(202, "Message will be retried");
    }
    
    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Result<?> handleValidationException(MethodArgumentNotValidException e) {
        Map<String, String> errors = new HashMap<>();
        e.getBindingResult().getFieldErrors().forEach(error -> 
            errors.put(error.getField(), error.getDefaultMessage()));
        
        log.warn("Validation failed: {}", errors);
        Result<?> result = Result.error(400, "Validation failed");
        result.setTraceId(TraceContext.getTraceId());
        return result;
    }
    
    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public Result<?> handleGenericException(Exception e) {
        log.error("Unexpected error occurred", e);
        recordProblem("UNEXPECTED_ERROR", ReportService.ProblemEvent.Severity.CRITICAL, e);
        Result<?> result = Result.error(500, "Internal server error");
        result.setTraceId(TraceContext.getTraceId());
        return result;
    }
    
    private void recordProblem(String type, ReportService.ProblemEvent.Severity severity, Exception e) {
        ReportService.ProblemEvent event = new ReportService.ProblemEvent();
        event.setType(type);
        event.setSeverity(severity);
        event.setDescription(e.getMessage());
        event.setTraceId(TraceContext.getTraceId());
        
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("exceptionClass", e.getClass().getName());
        if (e.getStackTrace().length > 0) {
            metadata.put("stackTrace", e.getStackTrace()[0].toString());
        }
        event.setMetadata(metadata);
        
        reportService.recordProblem(event);
    }
}

package com.paymentguard.common.exception;

import com.paymentguard.common.enums.IssueType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(PaymentGuardException.class)
    public ResponseEntity<Map<String, Object>> handlePaymentGuardException(PaymentGuardException ex) {
        log.error("PaymentGuard error: type={}, code={}, message={}", 
                  ex.getIssueType(), ex.getErrorCode(), ex.getMessage(), ex);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", false);
        response.put("errorCode", ex.getErrorCode());
        response.put("issueType", ex.getIssueType().getDescription());
        response.put("message", ex.getMessage());
        response.put("timestamp", LocalDateTime.now());
        if (ex.getData() != null) {
            response.put("data", ex.getData());
        }
        
        HttpStatus status = determineHttpStatus(ex.getIssueType());
        return ResponseEntity.status(status).body(response);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationException(MethodArgumentNotValidException ex) {
        String errors = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "));
        
        log.warn("Validation failed: {}", errors);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", false);
        response.put("errorCode", "VALIDATION_ERROR");
        response.put("message", errors);
        response.put("timestamp", LocalDateTime.now());
        
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGenericException(Exception ex) {
        log.error("Unexpected error occurred", ex);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", false);
        response.put("errorCode", "INTERNAL_ERROR");
        response.put("message", "系统内部错误，请联系管理员");
        response.put("timestamp", LocalDateTime.now());
        
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }

    private HttpStatus determineHttpStatus(IssueType issueType) {
        return switch (issueType) {
            case DUPLICATE_PAYMENT, IDEMPOTENCY_FAILURE -> HttpStatus.CONFLICT;
            case CALLBACK_TIMEOUT -> HttpStatus.REQUEST_TIMEOUT;
            case CONCURRENCY_CONFLICT, LOCK_ACQUISITION_FAILED -> HttpStatus.TOO_MANY_REQUESTS;
            case DATA_INTEGRITY_ISSUE, MESSAGE_CONSUME_FAILED, ORDER_STATUS_INCONSISTENCY -> HttpStatus.INTERNAL_SERVER_ERROR;
        };
    }
}

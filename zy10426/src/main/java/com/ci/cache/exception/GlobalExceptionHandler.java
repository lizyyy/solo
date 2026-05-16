package com.ci.cache.exception;

import com.ci.cache.dto.ApiResponse;
import com.ci.cache.service.ExceptionLoggingService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.util.ContentCachingRequestWrapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

@ControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @Autowired
    private ExceptionLoggingService exceptionLoggingService;

    @Autowired
    private ObjectMapper objectMapper;

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgumentException(
            IllegalArgumentException ex, HttpServletRequest request) {
        String originalInput = getOriginalInput(request);
        exceptionLoggingService.logException(
                "VALIDATION",
                originalInput,
                ex,
                "Rejected due to invalid input parameters",
                extractApplicationId(request),
                extractCacheKey(request)
        );
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(ex.getMessage(), "INVALID_ARGUMENT"));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalStateException(
            IllegalStateException ex, HttpServletRequest request) {
        String originalInput = getOriginalInput(request);
        exceptionLoggingService.logException(
                "STATE_TRANSITION",
                originalInput,
                ex,
                "Operation blocked due to business rule violation",
                extractApplicationId(request),
                extractCacheKey(request)
        );
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error(ex.getMessage(), "STATE_CONFLICT"));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleValidationExceptions(
            MethodArgumentNotValidException ex, HttpServletRequest request) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach((error) -> {
            String fieldName = ((FieldError) error).getField();
            String errorMessage = error.getDefaultMessage();
            errors.put(fieldName, errorMessage);
        });

        String originalInput = getOriginalInput(request);
        exceptionLoggingService.logException(
                "VALIDATION",
                originalInput,
                ex,
                "Validation failed for fields: " + errors.keySet(),
                extractApplicationId(request),
                extractCacheKey(request)
        );

        return ResponseEntity.badRequest()
                .body(new ApiResponse<>(false, "Validation failed", errors, "VALIDATION_ERROR"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGenericException(
            Exception ex, HttpServletRequest request) {
        String originalInput = getOriginalInput(request);
        exceptionLoggingService.logException(
                "UNEXPECTED",
                originalInput,
                ex,
                "Unexpected error occurred - see stack trace for details",
                extractApplicationId(request),
                extractCacheKey(request)
        );
        logger.error("Unexpected error processing request", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("An unexpected error occurred: " + ex.getMessage(), "INTERNAL_ERROR"));
    }

    private String getOriginalInput(HttpServletRequest request) {
        try {
            if (request instanceof ContentCachingRequestWrapper wrapper) {
                byte[] content = wrapper.getContentAsByteArray();
                if (content.length > 0) {
                    String body = new String(content, StandardCharsets.UTF_8);
                    return body.length() > 3900 ? body.substring(0, 3900) + "..." : body;
                }
            }
            String query = request.getQueryString();
            return request.getMethod() + " " + request.getRequestURI() +
                    (query != null ? "?" + query : "");
        } catch (Exception e) {
            return "Failed to capture input: " + e.getMessage();
        }
    }

    private String extractApplicationId(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (path.contains("/evictions/")) {
            String[] parts = path.split("/");
            for (int i = 0; i < parts.length; i++) {
                if (parts[i].equals("evictions") && i + 1 < parts.length) {
                    return parts[i + 1];
                }
            }
        }
        return null;
    }

    private String extractCacheKey(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (path.contains("/cache/")) {
            String[] parts = path.split("/");
            for (int i = 0; i < parts.length; i++) {
                if (parts[i].equals("cache") && i + 1 < parts.length && !parts[i + 1].equals("active")) {
                    return parts[i + 1];
                }
            }
        }
        return null;
    }
}

package com.infrastructure.drain.exception;

import com.infrastructure.drain.dto.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import javax.servlet.http.HttpServletRequest;
import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(DrainException.class)
    public ApiResponse<Void> handleDrainException(DrainException ex, HttpServletRequest request) {
        log.error("DrainException: {} - {}", request.getRequestURI(), ex.getMessage());
        ApiResponse<Void> response = ApiResponse.error(ex.getCode(), ex.getMessage());
        response.setRequestId(request.getRequestId());
        return response;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ApiResponse<Void> handleValidationException(MethodArgumentNotValidException ex, HttpServletRequest request) {
        String errors = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "));
        log.warn("ValidationException: {} - {}", request.getRequestURI(), errors);
        ApiResponse<Void> response = ApiResponse.badRequest(errors);
        response.setRequestId(request.getRequestId());
        return response;
    }

    @ExceptionHandler(Exception.class)
    public ApiResponse<Void> handleException(Exception ex, HttpServletRequest request) {
        log.error("Exception: {} - {}", request.getRequestURI(), ex.getMessage(), ex);
        ApiResponse<Void> response = ApiResponse.error(500, "服务器内部错误");
        response.setRequestId(request.getRequestId());
        return response;
    }
}

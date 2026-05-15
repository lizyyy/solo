package com.lineage.exception;

import com.lineage.dto.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import javax.validation.ConstraintViolationException;
import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(LineageException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleLineageException(LineageException e) {
        log.error("Lineage exception: code={}, message={}", e.getCode(), e.getMessage());
        return ApiResponse.error(e.getCode(), e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleValidationException(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(error -> {
                    String field = error.getField();
                    String defaultMessage = error.getDefaultMessage();
                    return field + ": " + defaultMessage;
                })
                .collect(Collectors.joining("; "));
        log.error("Validation exception: {}", message);
        return ApiResponse.error(ErrorCode.VALIDATION_FAILED, "参数校验失败: " + message);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleConstraintViolationException(ConstraintViolationException e) {
        String message = e.getConstraintViolations().stream()
                .map(violation -> violation.getPropertyPath() + ": " + violation.getMessage())
                .collect(Collectors.joining("; "));
        log.error("Constraint violation exception: {}", message);
        return ApiResponse.error(ErrorCode.VALIDATION_FAILED, "参数校验失败: " + message);
    }

    @ExceptionHandler(BindException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleBindException(BindException e) {
        String message = e.getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .collect(Collectors.joining("; "));
        log.error("Bind exception: {}", message);
        return ApiResponse.error(ErrorCode.VALIDATION_FAILED, "参数绑定失败: " + message);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleMissingParameterException(MissingServletRequestParameterException e) {
        String message = "缺少必填参数: " + e.getParameterName();
        log.error("Missing parameter exception: {}", message);
        return ApiResponse.error(ErrorCode.VALIDATION_FAILED, message);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleTypeMismatchException(MethodArgumentTypeMismatchException e) {
        String message = "参数类型错误: " + e.getName() + " 应为 " + (e.getRequiredType() != null ? e.getRequiredType().getSimpleName() : "正确类型");
        log.error("Type mismatch exception: {}", message);
        return ApiResponse.error(ErrorCode.VALIDATION_FAILED, message);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleMessageNotReadableException(HttpMessageNotReadableException e) {
        String message = "请求体格式错误，请检查 JSON 格式";
        log.error("Message not readable exception: {}", e.getMessage());
        return ApiResponse.error("INVALID_REQUEST_BODY", message);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    @ResponseStatus(HttpStatus.METHOD_NOT_ALLOWED)
    public ApiResponse<Void> handleMethodNotSupportedException(HttpRequestMethodNotSupportedException e) {
        String message = "不支持的 HTTP 方法: " + e.getMethod();
        log.error("Method not supported exception: {}", message);
        return ApiResponse.error("METHOD_NOT_ALLOWED", message);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    @ResponseStatus(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
    public ApiResponse<Void> handleMediaTypeNotSupportedException(HttpMediaTypeNotSupportedException e) {
        String message = "不支持的媒体类型: " + e.getContentType();
        log.error("Media type not supported exception: {}", message);
        return ApiResponse.error("UNSUPPORTED_MEDIA_TYPE", message);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleIllegalArgumentException(IllegalArgumentException e) {
        log.error("Illegal argument exception: {}", e.getMessage());
        return ApiResponse.error(ErrorCode.INVALID_PARAMETER, e.getMessage());
    }

    @ExceptionHandler(NullPointerException.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> handleNullPointerException(NullPointerException e) {
        log.error("Null pointer exception", e);
        return ApiResponse.error("NULL_POINTER_ERROR", "系统内部空指针错误，请联系管理员");
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> handleGenericException(Exception e) {
        log.error("Unexpected exception", e);
        return ApiResponse.error("INTERNAL_ERROR", "系统内部错误: " + e.getMessage());
    }
}

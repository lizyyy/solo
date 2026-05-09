package com.resiliencehub.common;

import java.io.Serializable;
import java.time.LocalDateTime;

public class Result<T> implements Serializable {
    
    private int code;
    private String message;
    private T data;
    private String traceId;
    private LocalDateTime timestamp;
    
    public Result() {
        this.timestamp = LocalDateTime.now();
    }
    
    public static <T> Result<T> success(T data) {
        Result<T> result = new Result<>();
        result.setCode(200);
        result.setMessage("success");
        result.setData(data);
        return result;
    }
    
    public static <T> Result<T> success() {
        return success(null);
    }
    
    public static <T> Result<T> error(int code, String message) {
        Result<T> result = new Result<>();
        result.setCode(code);
        result.setMessage(message);
        return result;
    }
    
    public static <T> Result<T> error(String message) {
        return error(500, message);
    }
    
    public static <T> Result<T> rateLimited() {
        Result<T> result = new Result<>();
        result.setCode(429);
        result.setMessage("请求过于频繁，请稍后再试");
        return result;
    }
    
    public static <T> Result<T> circuitBreakerOpen() {
        Result<T> result = new Result<>();
        result.setCode(503);
        result.setMessage("服务暂时不可用，请稍后再试");
        return result;
    }
    
    public static <T> Result<T> fallback(String message) {
        Result<T> result = new Result<>();
        result.setCode(503);
        result.setMessage("服务降级: " + message);
        return result;
    }
    
    public int getCode() {
        return code;
    }
    
    public void setCode(int code) {
        this.code = code;
    }
    
    public String getMessage() {
        return message;
    }
    
    public void setMessage(String message) {
        this.message = message;
    }
    
    public T getData() {
        return data;
    }
    
    public void setData(T data) {
        this.data = data;
    }
    
    public String getTraceId() {
        return traceId;
    }
    
    public void setTraceId(String traceId) {
        this.traceId = traceId;
    }
    
    public LocalDateTime getTimestamp() {
        return timestamp;
    }
    
    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }
}

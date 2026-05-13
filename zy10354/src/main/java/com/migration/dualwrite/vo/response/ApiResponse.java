package com.migration.dualwrite.vo.response;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ApiResponse<T> {
    private String code;
    private String message;
    private T data;
    private LocalDateTime timestamp;
    private String requestId;
    private Boolean idempotent;

    public static <T> ApiResponse<T> success(T data) {
        ApiResponse<T> response = new ApiResponse<>();
        response.code = "SUCCESS";
        response.message = "操作成功";
        response.data = data;
        response.timestamp = LocalDateTime.now();
        return response;
    }

    public static <T> ApiResponse<T> success(String message, T data) {
        ApiResponse<T> response = success(data);
        response.message = message;
        return response;
    }

    public static <T> ApiResponse<T> successIdempotent(T data) {
        ApiResponse<T> response = success(data);
        response.idempotent = true;
        response.message = "幂等命中，返回已有结果";
        return response;
    }

    public static <T> ApiResponse<T> error(String code, String message) {
        ApiResponse<T> response = new ApiResponse<>();
        response.code = code;
        response.message = message;
        response.timestamp = LocalDateTime.now();
        return response;
    }

    public static <T> ApiResponse<T> error(String code, String message, T data) {
        ApiResponse<T> response = error(code, message);
        response.data = data;
        return response;
    }
}

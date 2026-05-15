package com.identity.verification.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ApiResponse<T> {
    private Integer code;
    private String message;
    private T data;
    private LocalDateTime timestamp;
    private Boolean success;

    public static <T> ApiResponse<T> success(T data) {
        ApiResponse<T> response = new ApiResponse<>();
        response.setCode(200);
        response.setMessage("操作成功");
        response.setData(data);
        response.setTimestamp(LocalDateTime.now());
        response.setSuccess(true);
        return response;
    }

    public static <T> ApiResponse<T> success(String message, T data) {
        ApiResponse<T> response = success(data);
        response.setMessage(message);
        return response;
    }

    public static <T> ApiResponse<T> error(Integer code, String message) {
        ApiResponse<T> response = new ApiResponse<>();
        response.setCode(code);
        response.setMessage(message);
        response.setTimestamp(LocalDateTime.now());
        response.setSuccess(false);
        return response;
    }

    public static <T> ApiResponse<T> duplicateRequest(T data) {
        ApiResponse<T> response = new ApiResponse<>();
        response.setCode(409);
        response.setMessage("重复请求，已返回已有结果");
        response.setData(data);
        response.setTimestamp(LocalDateTime.now());
        response.setSuccess(true);
        return response;
    }
}

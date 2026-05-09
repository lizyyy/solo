package com.paymentguard.common.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ApiResponse<T> {
    
    private boolean success;
    private String message;
    private T data;
    private Map<String, Object> metadata;
    
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, "操作成功", data, null);
    }
    
    public static <T> ApiResponse<T> success(T data, String message) {
        return new ApiResponse<>(true, message, data, null);
    }
    
    public static <T> ApiResponse<T> success(T data, Map<String, Object> metadata) {
        return new ApiResponse<>(true, "操作成功", data, metadata);
    }
    
    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(false, message, null, null);
    }
    
    public static <T> ApiResponse<T> error(String message, T data) {
        return new ApiResponse<>(false, message, data, null);
    }
}

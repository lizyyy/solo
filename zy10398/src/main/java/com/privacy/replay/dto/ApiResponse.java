package com.privacy.replay.dto;

import lombok.Data;

import java.util.HashMap;
import java.util.Map;

@Data
public class ApiResponse<T> {

    private int code;
    private String message;
    private boolean success;
    private T data;

    public static <T> ApiResponse<T> success(T data) {
        ApiResponse<T> response = new ApiResponse<>();
        response.setCode(0);
        response.setMessage("成功");
        response.setSuccess(true);
        response.setData(data);
        return response;
    }

    public static <T> ApiResponse<T> success() {
        return success(null);
    }

    public static <T> ApiResponse<T> error(int code, String message) {
        ApiResponse<T> response = new ApiResponse<>();
        response.setCode(code);
        response.setMessage(message);
        response.setSuccess(false);
        return response;
    }
}

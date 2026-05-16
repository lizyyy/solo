package com.package.repo.model.dto;

import com.package.repo.model.enums.ResponseStatus;
import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ApiResponse<T> {
    private ResponseStatus status;
    private String message;
    private T data;
    private LocalDateTime timestamp;

    public static <T> ApiResponse<T> success(T data) {
        return ApiResponse.<T>builder()
                .status(ResponseStatus.SUCCESS)
                .message("操作成功")
                .data(data)
                .timestamp(LocalDateTime.now())
                .build();
    }

    public static <T> ApiResponse<T> success(String message, T data) {
        return ApiResponse.<T>builder()
                .status(ResponseStatus.SUCCESS)
                .message(message)
                .data(data)
                .timestamp(LocalDateTime.now())
                .build();
    }

    public static <T> ApiResponse<T> pendingReview(T data) {
        return ApiResponse.<T>builder()
                .status(ResponseStatus.PENDING_REVIEW)
                .message("待复核")
                .data(data)
                .timestamp(LocalDateTime.now())
                .build();
    }

    public static <T> ApiResponse<T> blocked(String message, T data) {
        return ApiResponse.<T>builder()
                .status(ResponseStatus.BLOCKED)
                .message(message)
                .data(data)
                .timestamp(LocalDateTime.now())
                .build();
    }

    public static <T> ApiResponse<T> compensated(String message, T data) {
        return ApiResponse.<T>builder()
                .status(ResponseStatus.COMPENSATED)
                .message(message)
                .data(data)
                .timestamp(LocalDateTime.now())
                .build();
    }

    public static <T> ApiResponse<T> failed(String message) {
        return ApiResponse.<T>builder()
                .status(ResponseStatus.FAILED)
                .message(message)
                .timestamp(LocalDateTime.now())
                .build();
    }
}

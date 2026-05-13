package com.example.lock.dto;

import com.example.lock.enums.LockStatus;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class LockResponse {

    private String resourceId;
    private String lockHolder;
    private String requestId;
    private LockStatus status;
    private Integer waitQueuePosition;
    private String conflictReason;
    private LocalDateTime lockTime;
    private LocalDateTime expireTime;
    private boolean success;
    private String message;
}

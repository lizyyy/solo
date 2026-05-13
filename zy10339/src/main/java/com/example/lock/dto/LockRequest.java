package com.example.lock.dto;

import com.example.lock.enums.OperationSource;
import com.example.lock.enums.TimeoutStrategy;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class LockRequest {

    @NotBlank(message = "资源ID不能为空")
    private String resourceId;

    @NotBlank(message = "锁持有人不能为空")
    private String lockHolder;

    @NotBlank(message = "请求ID不能为空（用于幂等性）")
    private String requestId;

    @NotNull(message = "操作来源不能为空")
    private OperationSource operationSource;

    private TimeoutStrategy timeoutStrategy = TimeoutStrategy.AUTO_RELEASE;

    private Integer timeoutSeconds = 300;

    private boolean waitInQueue = true;
}

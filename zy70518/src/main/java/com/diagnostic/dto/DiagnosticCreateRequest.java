package com.diagnostic.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.time.LocalDateTime;

@Data
public class DiagnosticCreateRequest {
    @NotBlank(message = "实例ID不能为空")
    private String instanceId;

    @NotBlank(message = "连接池名称不能为空")
    private String poolName;

    @NotNull(message = "采样时间不能为空")
    private LocalDateTime sampleTime;

    private Integer totalConnections;
    private Integer activeConnections;
    private Integer idleConnections;
    private Integer waitingThreads;
    private Integer maxPoolSize;
    private Long connectionUsageAvgTime;
    private Long connectionUsageMaxTime;
    private String stackSummary;
    private String stackDetails;
    private String rawInput;
}
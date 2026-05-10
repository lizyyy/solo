package com.paymentguard.common.dto;

import com.paymentguard.common.enums.ScenarioType;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ScenarioConfig {
    
    @NotNull(message = "场景类型不能为空")
    private ScenarioType scenarioType;
    
    private String orderId;
    
    @Min(value = 1, message = "并发数最小为1")
    @Max(value = 1000, message = "并发数最大为1000")
    private int concurrency = 10;
    
    @Min(value = 1, message = "持续时间最小为1秒")
    @Max(value = 3600, message = "持续时间最大为3600秒")
    private int durationSeconds = 10;
    
    @Min(value = 0, message = "重复次数最小为0")
    @Max(value = 100, message = "重复次数最大为100")
    private int duplicateCount = 5;
    
    @Min(value = 0, message = "失败率最小为0")
    @Max(value = 100, message = "失败率最大为100")
    private int failureRatePercent = 10;
    
    @Min(value = 0, message = "超时率最小为0")
    @Max(value = 100, message = "超时率最大为100")
    private int timeoutRatePercent = 5;
    
    private boolean useMessageQueue = false;
    
    private int messageRedeliveryCount = 3;
}

package com.webhook.sequence.model.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;

@Data
public class EventRequest {
    @NotBlank(message = "事件ID不能为空")
    private String eventId;
    
    @NotBlank(message = "事件主题不能为空")
    private String topic;
    
    @NotBlank(message = "业务键不能为空")
    private String businessKey;
    
    @NotNull(message = "序列号不能为空")
    private Long sequenceNumber;
    
    private Map<String, Object> payload;
}

package com.webhook.sequence.model;

import com.webhook.sequence.enums.EventStatus;
import com.webhook.sequence.enums.OutOfOrderReason;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EventContext implements Serializable {
    private String eventId;
    private String topic;
    private String businessKey;
    private Long sequenceNumber;
    private EventStatus status;
    private OutOfOrderReason outOfOrderReason;
    private String processResult;
    private String errorMessage;
    private Map<String, Object> payload;
    private LocalDateTime receivedAt;
    private LocalDateTime processedAt;
    private LocalDateTime waitingSince;
    private Long expectedNextSequence;
}

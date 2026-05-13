package com.webhook.sequence.model;

import com.webhook.sequence.enums.EventStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.TreeMap;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SequenceState implements Serializable {
    private String topic;
    private String businessKey;
    private Long currentSequence;
    private Long expectedNextSequence;
    private Long lastProcessedSequence;
    private Map<Long, EventContext> waitingQueue;
    private LocalDateTime lastGapDetectedAt;
    private boolean hasGap;
    private Long gapStartSequence;

    public void init() {
        if (this.waitingQueue == null) {
            this.waitingQueue = new TreeMap<>();
        }
        if (this.currentSequence == null) {
            this.currentSequence = 0L;
        }
        if (this.expectedNextSequence == null) {
            this.expectedNextSequence = 1L;
        }
    }
}

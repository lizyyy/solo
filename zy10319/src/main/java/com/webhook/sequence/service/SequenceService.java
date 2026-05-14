package com.webhook.sequence.service;

import com.webhook.sequence.enums.EventStatus;
import com.webhook.sequence.enums.OutOfOrderReason;
import com.webhook.sequence.model.EventContext;
import com.webhook.sequence.model.SequenceState;
import com.webhook.sequence.model.dto.EventRequest;
import com.webhook.sequence.model.dto.EventResponse;
import com.webhook.sequence.store.EventStore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class SequenceService {

    private final EventStore eventStore;

    @Value("${webhook.sequence.gap-timeout-seconds:30}")
    private int gapTimeoutSeconds;

    public EventResponse processEvent(EventRequest request) {
        String stateKey = buildStateKey(request.getTopic(), request.getBusinessKey());
        
        EventContext existingEvent = eventStore.findEventById(request.getEventId());
        if (existingEvent != null) {
            return buildResponse(existingEvent, true);
        }

        SequenceState state = eventStore.getOrCreateSequenceState(stateKey, request.getTopic(), request.getBusinessKey());
        
        EventContext context = EventContext.builder()
                .eventId(request.getEventId())
                .topic(request.getTopic())
                .businessKey(request.getBusinessKey())
                .sequenceNumber(request.getSequenceNumber())
                .payload(request.getPayload())
                .receivedAt(LocalDateTime.now())
                .status(EventStatus.PENDING)
                .outOfOrderReason(OutOfOrderReason.NONE)
                .build();

        long expectedSeq = state.getExpectedNextSequence();
        long currentSeq = request.getSequenceNumber();

        if (currentSeq == expectedSeq) {
            processInOrder(context, state);
        } else if (currentSeq < expectedSeq) {
            if (currentSeq <= state.getLastProcessedSequence()) {
                context.setStatus(EventStatus.SKIPPED);
                context.setOutOfOrderReason(OutOfOrderReason.RETROACTIVE);
                context.setErrorMessage("序列号 " + currentSeq + " 已处理过，跳过");
            } else {
                context.setStatus(EventStatus.SKIPPED);
                context.setOutOfOrderReason(OutOfOrderReason.DUPLICATE);
                context.setErrorMessage("序列号 " + currentSeq + " 重复，跳过");
            }
        } else {
            processOutOfOrder(context, state, expectedSeq);
        }

        context.setExpectedNextSequence(state.getExpectedNextSequence());
        eventStore.saveEvent(context);
        eventStore.saveSequenceState(stateKey, state);

        return buildResponse(context, false);
    }

    private void processInOrder(EventContext context, SequenceState state) {
        context.setStatus(EventStatus.SUCCESS);
        context.setProcessResult("顺序处理成功");
        context.setProcessedAt(LocalDateTime.now());
        
        state.setCurrentSequence(context.getSequenceNumber());
        state.setLastProcessedSequence(context.getSequenceNumber());
        state.setExpectedNextSequence(context.getSequenceNumber() + 1);
        state.setHasGap(false);
        state.setGapStartSequence(null);
        state.setLastGapDetectedAt(null);

        processWaitingQueue(state);
    }

    private void processOutOfOrder(EventContext context, SequenceState state, long expectedSeq) {
        context.setStatus(EventStatus.WAITING);
        context.setOutOfOrderReason(OutOfOrderReason.GAP);
        context.setWaitingSince(LocalDateTime.now());
        context.setErrorMessage("序列号不连续，期望 " + expectedSeq + "，实际 " + context.getSequenceNumber() + "，进入等待队列");

        state.getWaitingQueue().put(context.getSequenceNumber(), context);
        
        if (!state.isHasGap()) {
            state.setHasGap(true);
            state.setGapStartSequence(expectedSeq);
            state.setLastGapDetectedAt(LocalDateTime.now());
            log.warn("检测到序列号缺口: topic={}, businessKey={}, gapStart={}",
                    state.getTopic(), state.getBusinessKey(), expectedSeq);
        }
    }

    private void processWaitingQueue(SequenceState state) {
        List<Long> processedSeqs = new ArrayList<>();
        
        for (Map.Entry<Long, EventContext> entry : state.getWaitingQueue().entrySet()) {
            long seq = entry.getKey();
            EventContext waitingEvent = entry.getValue();
            
            if (seq == state.getExpectedNextSequence()) {
                waitingEvent.setStatus(EventStatus.SUCCESS);
                waitingEvent.setProcessResult("从等待队列恢复处理成功");
                waitingEvent.setProcessedAt(LocalDateTime.now());
                waitingEvent.setOutOfOrderReason(OutOfOrderReason.NONE);
                waitingEvent.setErrorMessage(null);
                
                state.setCurrentSequence(seq);
                state.setLastProcessedSequence(seq);
                state.setExpectedNextSequence(seq + 1);
                
                eventStore.saveEvent(waitingEvent);
                processedSeqs.add(seq);
            } else {
                break;
            }
        }
        
        processedSeqs.forEach(seq -> state.getWaitingQueue().remove(seq));
        
        if (state.getWaitingQueue().isEmpty()) {
            state.setHasGap(false);
            state.setGapStartSequence(null);
            state.setLastGapDetectedAt(null);
        }
    }

    public void checkAndProcessTimeouts() {
        List<SequenceState> allStates = eventStore.getAllSequenceStates();
        LocalDateTime now = LocalDateTime.now();

        for (SequenceState state : allStates) {
            if (state.isHasGap() && state.getLastGapDetectedAt() != null) {
                long secondsSinceGapDetected = java.time.Duration.between(state.getLastGapDetectedAt(), now).getSeconds();
                
                if (secondsSinceGapDetected >= gapTimeoutSeconds) {
                    processTimeout(state);
                }
            }
        }
    }

    private void processTimeout(SequenceState state) {
        log.warn("序列号缺口超时: topic={}, businessKey={}, gapStart={}",
                state.getTopic(), state.getBusinessKey(), state.getGapStartSequence());

        long maxProcessedSeq = state.getGapStartSequence() - 1;
        
        for (Map.Entry<Long, EventContext> entry : state.getWaitingQueue().entrySet()) {
            EventContext waitingEvent = entry.getValue();
            
            if (waitingEvent.getSequenceNumber() >= state.getGapStartSequence()) {
                waitingEvent.setStatus(EventStatus.SUCCESS);
                waitingEvent.setProcessResult("超时强制处理");
                waitingEvent.setProcessedAt(LocalDateTime.now());
                waitingEvent.setOutOfOrderReason(OutOfOrderReason.TIMEOUT);
                waitingEvent.setErrorMessage(null);
                
                if (waitingEvent.getSequenceNumber() > maxProcessedSeq) {
                    maxProcessedSeq = waitingEvent.getSequenceNumber();
                }
                state.setLastProcessedSequence(waitingEvent.getSequenceNumber());
                eventStore.saveEvent(waitingEvent);
            }
        }

        state.getWaitingQueue().clear();
        state.setHasGap(false);
        state.setGapStartSequence(null);
        state.setLastGapDetectedAt(null);
        state.setExpectedNextSequence(maxProcessedSeq + 1);
        
        eventStore.saveSequenceState(buildStateKey(state.getTopic(), state.getBusinessKey()), state);
    }

    private String buildStateKey(String topic, String businessKey) {
        return topic + ":" + businessKey;
    }

    private EventResponse buildResponse(EventContext context, boolean isIdempotent) {
        return EventResponse.builder()
                .eventId(context.getEventId())
                .topic(context.getTopic())
                .businessKey(context.getBusinessKey())
                .sequenceNumber(context.getSequenceNumber())
                .status(context.getStatus())
                .outOfOrderReason(context.getOutOfOrderReason())
                .processResult(context.getProcessResult())
                .errorMessage(context.getErrorMessage())
                .payload(context.getPayload())
                .receivedAt(context.getReceivedAt())
                .processedAt(context.getProcessedAt())
                .expectedNextSequence(context.getExpectedNextSequence())
                .isIdempotent(isIdempotent)
                .waitingQueueSize(context.getOutOfOrderReason() == OutOfOrderReason.GAP ? 1 : 0)
                .build();
    }
}

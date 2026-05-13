package com.webhook.sequence.service;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONWriter;
import com.webhook.sequence.model.EventContext;
import com.webhook.sequence.model.SequenceState;
import com.webhook.sequence.model.dto.EventResponse;
import com.webhook.sequence.store.EventStore;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class QueryService {

    private final EventStore eventStore;

    public EventResponse getEventById(String eventId) {
        EventContext context = eventStore.findEventById(eventId);
        if (context == null) {
            return null;
        }
        return toResponse(context);
    }

    public List<EventResponse> getEventsByTopicAndBusinessKey(String topic, String businessKey) {
        return eventStore.findEventsByTopicAndBusinessKey(topic, businessKey)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List<EventResponse> getAllEvents() {
        return eventStore.findAllEvents()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List<EventResponse> getEventsByStatus(String statusCode) {
        return eventStore.findEventsByStatus(statusCode)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public SequenceState getSequenceState(String topic, String businessKey) {
        return eventStore.findSequenceState(topic, businessKey);
    }

    public String exportEventsAsJson() {
        List<EventResponse> events = getAllEvents();
        return JSON.toJSONString(events, JSONWriter.Feature.PrettyFormat);
    }

    public String exportEventsByBusinessKeyAsJson(String topic, String businessKey) {
        List<EventResponse> events = getEventsByTopicAndBusinessKey(topic, businessKey);
        return JSON.toJSONString(events, JSONWriter.Feature.PrettyFormat);
    }

    private EventResponse toResponse(EventContext context) {
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
                .isIdempotent(false)
                .build();
    }
}

package com.webhook.sequence.store;

import com.webhook.sequence.model.EventContext;
import com.webhook.sequence.model.SequenceState;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Component
public class EventStore {

    private final Map<String, EventContext> eventById = new ConcurrentHashMap<>();
    private final Map<String, SequenceState> sequenceStates = new ConcurrentHashMap<>();

    public EventContext findEventById(String eventId) {
        return eventById.get(eventId);
    }

    public void saveEvent(EventContext context) {
        eventById.put(context.getEventId(), context);
    }

    public SequenceState getOrCreateSequenceState(String key, String topic, String businessKey) {
        return sequenceStates.computeIfAbsent(key, k -> {
            SequenceState state = SequenceState.builder()
                    .topic(topic)
                    .businessKey(businessKey)
                    .build();
            state.init();
            return state;
        });
    }

    public void saveSequenceState(String key, SequenceState state) {
        sequenceStates.put(key, state);
    }

    public List<SequenceState> getAllSequenceStates() {
        return new ArrayList<>(sequenceStates.values());
    }

    public List<EventContext> findEventsByTopicAndBusinessKey(String topic, String businessKey) {
        return eventById.values().stream()
                .filter(e -> e.getTopic().equals(topic) && e.getBusinessKey().equals(businessKey))
                .sorted((a, b) -> a.getSequenceNumber().compareTo(b.getSequenceNumber()))
                .collect(Collectors.toList());
    }

    public List<EventContext> findAllEvents() {
        return new ArrayList<>(eventById.values());
    }

    public List<EventContext> findEventsByStatus(String statusCode) {
        return eventById.values().stream()
                .filter(e -> e.getStatus().getCode().equals(statusCode))
                .collect(Collectors.toList());
    }

    public SequenceState findSequenceState(String topic, String businessKey) {
        String key = topic + ":" + businessKey;
        return sequenceStates.get(key);
    }
}

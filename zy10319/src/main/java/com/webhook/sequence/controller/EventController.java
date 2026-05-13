package com.webhook.sequence.controller;

import com.webhook.sequence.model.SequenceState;
import com.webhook.sequence.model.dto.EventRequest;
import com.webhook.sequence.model.dto.EventResponse;
import com.webhook.sequence.service.QueryService;
import com.webhook.sequence.service.SequenceService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/events")
@RequiredArgsConstructor
public class EventController {

    private final SequenceService sequenceService;
    private final QueryService queryService;

    @PostMapping
    public ResponseEntity<EventResponse> createEvent(@Valid @RequestBody EventRequest request) {
        EventResponse response = sequenceService.processEvent(request);
        
        HttpStatus status;
        switch (response.getStatus()) {
            case SUCCESS:
                status = HttpStatus.OK;
                break;
            case WAITING:
                status = HttpStatus.ACCEPTED;
                break;
            case SKIPPED:
                status = HttpStatus.CONFLICT;
                break;
            default:
                status = HttpStatus.INTERNAL_SERVER_ERROR;
        }
        
        return new ResponseEntity<>(response, status);
    }

    @GetMapping("/{eventId}")
    public ResponseEntity<EventResponse> getEventById(@PathVariable String eventId) {
        EventResponse response = queryService.getEventById(eventId);
        if (response == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<List<EventResponse>> getEvents(
            @RequestParam(required = false) String topic,
            @RequestParam(required = false) String businessKey,
            @RequestParam(required = false) String status) {
        
        List<EventResponse> events;
        if (topic != null && businessKey != null) {
            events = queryService.getEventsByTopicAndBusinessKey(topic, businessKey);
        } else if (status != null) {
            events = queryService.getEventsByStatus(status);
        } else {
            events = queryService.getAllEvents();
        }
        
        return ResponseEntity.ok(events);
    }

    @GetMapping("/state")
    public ResponseEntity<SequenceState> getSequenceState(
            @RequestParam String topic,
            @RequestParam String businessKey) {
        SequenceState state = queryService.getSequenceState(topic, businessKey);
        if (state == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(state);
    }

    @GetMapping("/export")
    public ResponseEntity<String> exportEvents(
            @RequestParam(required = false) String topic,
            @RequestParam(required = false) String businessKey) {
        
        String json;
        if (topic != null && businessKey != null) {
            json = queryService.exportEventsByBusinessKeyAsJson(topic, businessKey);
        } else {
            json = queryService.exportEventsAsJson();
        }
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setContentDispositionFormData("attachment", "events.json");
        
        return new ResponseEntity<>(json, headers, HttpStatus.OK);
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "UP");
        health.put("service", "webhook-sequence-api");
        health.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.ok(health);
    }
}

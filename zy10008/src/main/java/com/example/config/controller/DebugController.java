package com.example.config.controller;

import com.example.config.domain.ConfigEventLog;
import com.example.config.service.DebugService;
import com.example.config.service.EventLogService;
import com.example.config.service.WebSocketService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/debug")
@RequiredArgsConstructor
public class DebugController {

    private final DebugService debugService;
    private final EventLogService eventLogService;
    private final WebSocketService webSocketService;

    @GetMapping("/replay/{traceId}")
    public ResponseEntity<Map<String, Object>> replayEvent(@PathVariable String traceId) {
        return ResponseEntity.ok(debugService.replayEvent(traceId));
    }

    @GetMapping("/release/{releaseId}/timeline")
    public ResponseEntity<Map<String, Object>> getReleaseTimeline(@PathVariable String releaseId) {
        return ResponseEntity.ok(debugService.getReleaseTimeline(releaseId));
    }

    @GetMapping("/release/{releaseId}/report")
    public ResponseEntity<String> getReleaseReport(
            @PathVariable String releaseId,
            @RequestParam(defaultValue = "markdown") String format) {
        if ("json".equalsIgnoreCase(format)) {
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(debugService.getReleaseTimeline(releaseId).toString());
        }
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_PLAIN)
                .body(debugService.generateMarkdownReport(releaseId));
    }

    @GetMapping("/errors")
    public ResponseEntity<Map<String, Object>> getRecentErrors(
            @RequestParam(defaultValue = "60") int minutes) {
        return ResponseEntity.ok(debugService.getRecentErrors(minutes));
    }

    @GetMapping("/events/trace/{traceId}")
    public ResponseEntity<List<ConfigEventLog>> getEventsByTrace(@PathVariable String traceId) {
        return ResponseEntity.ok(eventLogService.getEventsByTraceId(traceId));
    }

    @GetMapping("/events/entity/{entityId}")
    public ResponseEntity<List<ConfigEventLog>> getEventsByEntity(@PathVariable String entityId) {
        return ResponseEntity.ok(eventLogService.getEventsByEntityId(entityId));
    }

    @GetMapping("/clients")
    public ResponseEntity<Map<String, Object>> getClientStatus() {
        return ResponseEntity.ok(Map.of(
                "connectedCount", webSocketService.getConnectedClientCount()
        ));
    }
}

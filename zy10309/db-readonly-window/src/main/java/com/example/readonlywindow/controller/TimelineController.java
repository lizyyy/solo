package com.example.readonlywindow.controller;

import com.example.readonlywindow.entity.TimelineEvent;
import com.example.readonlywindow.service.TimelineService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/timeline")
@RequiredArgsConstructor
public class TimelineController {
    private final TimelineService timelineService;

    @GetMapping("/window/{windowId}")
    public ResponseEntity<List<TimelineEvent>> getWindowTimeline(@PathVariable Long windowId) {
        return ResponseEntity.ok(timelineService.getWindowTimeline(windowId));
    }

    @GetMapping("/request/{requestId}")
    public ResponseEntity<List<TimelineEvent>> getRequestTimeline(@PathVariable Long requestId) {
        return ResponseEntity.ok(timelineService.getRequestTimeline(requestId));
    }

    @GetMapping("/credential/{credentialId}")
    public ResponseEntity<List<TimelineEvent>> getCredentialTimeline(@PathVariable Long credentialId) {
        return ResponseEntity.ok(timelineService.getCredentialTimeline(credentialId));
    }

    @GetMapping("/conflict/{conflictId}")
    public ResponseEntity<List<TimelineEvent>> getConflictTimeline(@PathVariable Long conflictId) {
        return ResponseEntity.ok(timelineService.getConflictTimeline(conflictId));
    }

    @GetMapping("/range")
    public ResponseEntity<List<TimelineEvent>> getEventsByTimeRange(
            @RequestParam LocalDateTime startTime,
            @RequestParam LocalDateTime endTime) {
        return ResponseEntity.ok(timelineService.getEventsByTimeRange(startTime, endTime));
    }
}

package com.version.adapter.controller;

import com.version.adapter.entity.AuditTimeline;
import com.version.adapter.service.AuditTimelineService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/audit")
@RequiredArgsConstructor
@Slf4j
public class AuditController {

    private final AuditTimelineService auditTimelineService;

    @GetMapping
    public ResponseEntity<List<AuditTimeline>> getAllTimelines() {
        List<AuditTimeline> timelines = auditTimelineService.getAllTimelines();
        return ResponseEntity.ok(timelines);
    }

    @GetMapping("/entity/{entityType}/{entityId}")
    public ResponseEntity<List<AuditTimeline>> getEntityTimeline(
            @PathVariable String entityType,
            @PathVariable Long entityId) {
        List<AuditTimeline> timelines = auditTimelineService.getEntityTimeline(entityType, entityId);
        return ResponseEntity.ok(timelines);
    }

    @GetMapping("/type/{entityType}")
    public ResponseEntity<List<AuditTimeline>> getTimelineByEntityType(@PathVariable String entityType) {
        List<AuditTimeline> timelines = auditTimelineService.getAllTimelineByEntityType(entityType);
        return ResponseEntity.ok(timelines);
    }

    @GetMapping("/range")
    public ResponseEntity<List<AuditTimeline>> getTimelineByTimeRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        List<AuditTimeline> timelines = auditTimelineService.getTimelineByTimeRange(start, end);
        return ResponseEntity.ok(timelines);
    }
}

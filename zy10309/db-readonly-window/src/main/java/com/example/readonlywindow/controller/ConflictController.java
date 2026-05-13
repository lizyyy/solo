package com.example.readonlywindow.controller;

import com.example.readonlywindow.entity.ConflictRecord;
import com.example.readonlywindow.service.ConflictService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/conflicts")
@RequiredArgsConstructor
public class ConflictController {
    private final ConflictService conflictService;

    @PostMapping("/record")
    public ResponseEntity<ConflictRecord> recordConflict(
            @RequestParam String windowCode,
            @RequestParam String resourceType,
            @RequestParam String resourceName,
            @RequestParam String operationType,
            @RequestParam(required = false) String operationDetails,
            @RequestParam(required = false) String operator) {
        return ResponseEntity.ok(conflictService.recordConflict(windowCode, resourceType, resourceName,
                operationType, operationDetails, operator));
    }

    @PostMapping("/{conflictCode}/resolve")
    public ResponseEntity<ConflictRecord> resolveConflict(
            @PathVariable String conflictCode,
            @RequestParam String resolution,
            @RequestParam(required = false) String resolvedBy) {
        return ResponseEntity.ok(conflictService.resolveConflict(conflictCode, resolution, resolvedBy));
    }

    @GetMapping("/{conflictCode}")
    public ResponseEntity<ConflictRecord> getConflict(@PathVariable String conflictCode) {
        return ResponseEntity.ok(conflictService.getConflictByCode(conflictCode));
    }

    @GetMapping("/window/{windowCode}")
    public ResponseEntity<List<ConflictRecord>> getConflictsByWindow(@PathVariable String windowCode) {
        return ResponseEntity.ok(conflictService.getConflictsByWindow(windowCode));
    }

    @GetMapping("/window/{windowCode}/unresolved")
    public ResponseEntity<List<ConflictRecord>> getUnresolvedConflictsByWindow(@PathVariable String windowCode) {
        return ResponseEntity.ok(conflictService.getUnresolvedConflictsByWindow(windowCode));
    }

    @GetMapping
    public ResponseEntity<List<ConflictRecord>> getAllConflicts() {
        return ResponseEntity.ok(conflictService.getAllConflicts());
    }
}

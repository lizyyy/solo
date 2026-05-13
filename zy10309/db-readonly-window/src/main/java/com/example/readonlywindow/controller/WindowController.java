package com.example.readonlywindow.controller;

import com.example.readonlywindow.dto.CreateWindowRequest;
import com.example.readonlywindow.entity.FreezeWindow;
import com.example.readonlywindow.entity.WindowStatus;
import com.example.readonlywindow.service.FreezeWindowService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/windows")
@RequiredArgsConstructor
public class WindowController {
    private final FreezeWindowService windowService;

    @PostMapping
    public ResponseEntity<FreezeWindow> createWindow(@Valid @RequestBody CreateWindowRequest request) {
        return ResponseEntity.ok(windowService.createWindow(request));
    }

    @PostMapping("/{windowCode}/activate")
    public ResponseEntity<FreezeWindow> activateWindow(@PathVariable String windowCode,
                                                       @RequestParam(required = false) String operator) {
        return ResponseEntity.ok(windowService.activateWindow(windowCode, operator));
    }

    @PostMapping("/{windowCode}/suspend")
    public ResponseEntity<FreezeWindow> suspendWindow(@PathVariable String windowCode,
                                                      @RequestParam(required = false) String operator) {
        return ResponseEntity.ok(windowService.suspendWindow(windowCode, operator));
    }

    @PostMapping("/{windowCode}/cancel")
    public ResponseEntity<FreezeWindow> cancelWindow(@PathVariable String windowCode,
                                                     @RequestParam(required = false) String operator) {
        return ResponseEntity.ok(windowService.cancelWindow(windowCode, operator));
    }

    @PostMapping("/{windowCode}/complete")
    public ResponseEntity<FreezeWindow> completeWindow(@PathVariable String windowCode,
                                                       @RequestParam(required = false) String operator) {
        return ResponseEntity.ok(windowService.completeWindow(windowCode, operator));
    }

    @GetMapping("/{windowCode}")
    public ResponseEntity<FreezeWindow> getWindow(@PathVariable String windowCode) {
        return ResponseEntity.ok(windowService.getWindowByCode(windowCode));
    }

    @GetMapping
    public ResponseEntity<List<FreezeWindow>> getAllWindows() {
        return ResponseEntity.ok(windowService.getAllWindows());
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<List<FreezeWindow>> getWindowsByStatus(@PathVariable WindowStatus status) {
        return ResponseEntity.ok(windowService.getWindowsByStatus(status));
    }

    @GetMapping("/active")
    public ResponseEntity<List<FreezeWindow>> getActiveWindows() {
        return ResponseEntity.ok(windowService.getActiveWindows());
    }

    @GetMapping("/check-resource")
    public ResponseEntity<Map<String, Boolean>> checkResourceInActiveWindow(
            @RequestParam String resourceType,
            @RequestParam String resourceName) {
        boolean blocked = windowService.isResourceInActiveWindow(resourceType, resourceName);
        return ResponseEntity.ok(Map.of("blocked", blocked));
    }
}

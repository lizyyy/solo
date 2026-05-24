package com.agri.dronespray.controller;

import com.agri.dronespray.entity.*;
import com.agri.dronespray.service.ExportService;
import com.agri.dronespray.service.PermissionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/permissions")
public class PermissionController {

    @Autowired
    private PermissionService permissionService;

    @Autowired
    private ExportService exportService;

    private static final String DEFAULT_OPERATOR = "admin";

    @PostMapping
    public ResponseEntity<Permission> createPermission(@RequestBody Permission permission) {
        return ResponseEntity.ok(permissionService.createPermission(permission, DEFAULT_OPERATOR));
    }

    @PostMapping("/{id}/submit")
    public ResponseEntity<?> submitPermission(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(permissionService.submitPermission(id, DEFAULT_OPERATOR));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/review/start")
    public ResponseEntity<?> startManualReview(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(permissionService.startManualReview(id, DEFAULT_OPERATOR));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<?> approvePermission(@PathVariable Long id,
                                                @RequestBody Map<String, String> request) {
        try {
            String conclusion = request.getOrDefault("conclusion", "批准作业");
            String remark = request.get("remark");
            return ResponseEntity.ok(permissionService.approvePermission(id, conclusion, remark, DEFAULT_OPERATOR));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<?> rejectPermission(@PathVariable Long id,
                                               @RequestBody Map<String, String> request) {
        try {
            String reason = request.getOrDefault("reason", "审批驳回");
            return ResponseEntity.ok(permissionService.rejectPermission(id, reason, DEFAULT_OPERATOR));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/amend")
    public ResponseEntity<?> amendPermission(@PathVariable Long id,
                                              @RequestBody Map<String, String> request) {
        try {
            String oldConclusion = request.get("oldConclusion");
            String newConclusion = request.get("newConclusion");
            String reason = request.get("reason");
            String amendedField = request.get("amendedField");
            return ResponseEntity.ok(permissionService.amendPermission(
                    id, oldConclusion, newConclusion, reason, amendedField, DEFAULT_OPERATOR));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<?> cancelPermission(@PathVariable Long id,
                                               @RequestBody Map<String, String> request) {
        try {
            String reason = request.getOrDefault("reason", "用户取消");
            return ResponseEntity.ok(permissionService.cancelPermission(id, reason, DEFAULT_OPERATOR));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<?> completePermission(@PathVariable Long id,
                                                 @RequestBody OperationReport report) {
        try {
            return ResponseEntity.ok(permissionService.completePermission(id, report, DEFAULT_OPERATOR));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<List<Permission>> getAllPermissions() {
        return ResponseEntity.ok(permissionService.getAllPermissions());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Permission> getPermission(@PathVariable Long id) {
        Permission permission = permissionService.getPermission(id);
        return permission != null ? ResponseEntity.ok(permission) : ResponseEntity.notFound().build();
    }

    @GetMapping("/no/{permissionNo}")
    public ResponseEntity<Permission> getPermissionByNo(@PathVariable String permissionNo) {
        Permission permission = permissionService.getPermissionByNo(permissionNo);
        return permission != null ? ResponseEntity.ok(permission) : ResponseEntity.notFound().build();
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<List<Permission>> getPermissionsByStatus(@PathVariable PermissionStatus status) {
        return ResponseEntity.ok(permissionService.getPermissionsByStatus(status));
    }

    @GetMapping("/{id}/processing-history")
    public ResponseEntity<List<ProcessingRecord>> getProcessingHistory(@PathVariable Long id) {
        return ResponseEntity.ok(permissionService.getProcessingHistory(id));
    }

    @GetMapping("/{id}/amendment-history")
    public ResponseEntity<List<AmendmentHistory>> getAmendmentHistory(@PathVariable Long id) {
        return ResponseEntity.ok(permissionService.getAmendmentHistory(id));
    }

    @GetMapping("/{id}/check-records")
    public ResponseEntity<List<CheckRecord>> getCheckRecords(@PathVariable Long id) {
        return ResponseEntity.ok(permissionService.getCheckRecords(id));
    }

    @GetMapping("/{id}/trace")
    public ResponseEntity<Map<String, Object>> getFullTrace(@PathVariable Long id) {
        Permission permission = permissionService.getPermission(id);
        if (permission == null) {
            return ResponseEntity.notFound().build();
        }

        Map<String, Object> trace = new HashMap<>();
        trace.put("permission", permission);
        trace.put("checkRecords", permissionService.getCheckRecords(id));
        trace.put("processingHistory", permissionService.getProcessingHistory(id));
        trace.put("amendmentHistory", permissionService.getAmendmentHistory(id));
        trace.put("operationReport", permission.getOperationReport());

        return ResponseEntity.ok(trace);
    }

    @GetMapping("/{id}/export")
    public ResponseEntity<byte[]> exportPermission(@PathVariable Long id) throws IOException {
        Permission permission = permissionService.getPermission(id);
        if (permission == null) {
            return ResponseEntity.notFound().build();
        }

        byte[] excelData = exportService.exportPermissionToExcel(permission);
        String filename = "permission-" + permission.getPermissionNo() + ".xlsx";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(excelData);
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportAllPermissions() throws IOException {
        List<Permission> permissions = permissionService.getAllPermissions();
        byte[] excelData = exportService.exportPermissionListToExcel(permissions);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"permissions.xlsx\"")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(excelData);
    }

    @GetMapping("/{id}/items")
    public ResponseEntity<List<PermissionItem>> getPermissionItems(@PathVariable Long id) {
        return ResponseEntity.ok(permissionService.getPermissionItems(id));
    }

    @GetMapping("/{id}/items/{itemId}")
    public ResponseEntity<PermissionItem> getPermissionItem(@PathVariable Long id, @PathVariable Long itemId) {
        PermissionItem item = permissionService.getPermissionItem(id, itemId);
        return item != null ? ResponseEntity.ok(item) : ResponseEntity.notFound().build();
    }

    @PostMapping("/{id}/items")
    public ResponseEntity<?> addPermissionItem(@PathVariable Long id, @RequestBody PermissionItem item) {
        try {
            return ResponseEntity.ok(permissionService.addPermissionItem(id, item, DEFAULT_OPERATOR));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/items/{itemId}")
    public ResponseEntity<?> updatePermissionItem(@PathVariable Long id, @PathVariable Long itemId,
                                                   @RequestBody PermissionItem item) {
        try {
            return ResponseEntity.ok(permissionService.updatePermissionItem(id, itemId, item, DEFAULT_OPERATOR));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}/items/{itemId}")
    public ResponseEntity<?> removePermissionItem(@PathVariable Long id, @PathVariable Long itemId) {
        try {
            permissionService.removePermissionItem(id, itemId, DEFAULT_OPERATOR);
            return ResponseEntity.ok().body(Map.of("message", "明细删除成功"));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}

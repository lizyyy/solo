package com.bus.notify.controller;

import com.bus.notify.dto.ResultDTO;
import com.bus.notify.dto.RouteChangeCreateDTO;
import com.bus.notify.entity.AuditLog;
import com.bus.notify.entity.NotificationRecord;
import com.bus.notify.entity.RouteChange;
import com.bus.notify.enums.NotificationStatus;
import com.bus.notify.service.AuditService;
import com.bus.notify.service.NotificationService;
import com.bus.notify.service.ReportService;
import com.bus.notify.service.RouteChangeService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/route-changes")
public class RouteChangeController {
    private final RouteChangeService routeChangeService;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final ReportService reportService;
    
    public RouteChangeController(RouteChangeService routeChangeService, NotificationService notificationService,
                                 AuditService auditService, ReportService reportService) {
        this.routeChangeService = routeChangeService;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.reportService = reportService;
    }
    
    @PostMapping("/receive")
    public ResultDTO<RouteChange> receive(@Valid @RequestBody RouteChangeCreateDTO dto) {
        RouteChange routeChange = routeChangeService.createRouteChange(dto);
        return ResultDTO.success("收件成功", routeChange);
    }
    
    @PostMapping("/{id}/verify")
    public ResultDTO<RouteChange> verify(
            @PathVariable Long id,
            @RequestParam boolean passed,
            @RequestParam(required = false) String reason,
            @RequestParam String operatorUsername) {
        try {
            RouteChange routeChange = routeChangeService.verifyRouteChange(id, passed, reason, operatorUsername);
            return ResultDTO.success(passed ? "核验通过" : "核验驳回", routeChange);
        } catch (IllegalStateException e) {
            return ResultDTO.fail(e.getMessage());
        }
    }
    
    @PostMapping("/{id}/start-process")
    public ResultDTO<RouteChange> startProcess(
            @PathVariable Long id,
            @RequestParam String operatorUsername) {
        try {
            RouteChange routeChange = routeChangeService.startProcessing(id, operatorUsername);
            return ResultDTO.success("开始处理", routeChange);
        } catch (IllegalStateException e) {
            return ResultDTO.fail(e.getMessage());
        }
    }
    
    @PostMapping("/{id}/complete-process")
    public ResultDTO<RouteChange> completeProcess(
            @PathVariable Long id,
            @RequestParam String operatorUsername) {
        try {
            RouteChange routeChange = routeChangeService.completeProcessing(id, operatorUsername);
            return ResultDTO.success("处理完成", routeChange);
        } catch (IllegalStateException e) {
            return ResultDTO.fail(e.getMessage());
        }
    }
    
    @PostMapping("/{id}/review")
    public ResultDTO<RouteChange> review(
            @PathVariable Long id,
            @RequestParam boolean passed,
            @RequestParam(required = false) String reason,
            @RequestParam String operatorUsername) {
        try {
            RouteChange routeChange = routeChangeService.reviewRouteChange(id, passed, reason, operatorUsername);
            return ResultDTO.success(passed ? "复查通过，已结案" : "复查驳回", routeChange);
        } catch (IllegalStateException e) {
            return ResultDTO.fail(e.getMessage());
        }
    }
    
    @PostMapping("/{id}/correct")
    public ResultDTO<RouteChange> correctConclusion(
            @PathVariable Long id,
            @RequestParam String oldConclusion,
            @RequestParam String newConclusion,
            @RequestParam(required = false) String remark,
            @RequestParam String operatorUsername) {
        RouteChange routeChange = routeChangeService.correctConclusion(id, oldConclusion, newConclusion, remark, operatorUsername);
        return ResultDTO.success("人工修正已记录", routeChange);
    }
    
    @PostMapping("/{id}/recovery-notify")
    public ResultDTO<Void> sendRecoveryNotifications(
            @PathVariable Long id,
            @RequestParam String operatorUsername) {
        routeChangeService.sendRecoveryNotifications(id, operatorUsername);
        return ResultDTO.success("站点恢复通知已生成", null);
    }
    
    @PostMapping("/notifications/{notificationId}/status")
    public ResultDTO<NotificationRecord> updateNotificationStatus(
            @PathVariable Long notificationId,
            @RequestParam NotificationStatus status,
            @RequestParam String reason,
            @RequestParam String operatorUsername) {
        NotificationRecord record = notificationService.updateNotificationStatus(
                notificationId, status, reason, operatorUsername);
        return ResultDTO.success("通知状态已更新", record);
    }
    
    @GetMapping("/{id}")
    public ResultDTO<RouteChange> getById(@PathVariable Long id) {
        RouteChange routeChange = routeChangeService.getRouteChange(id);
        if (routeChange == null) {
            return ResultDTO.fail("改线记录不存在");
        }
        return ResultDTO.success(routeChange);
    }
    
    @GetMapping("/no/{changeNo}")
    public ResultDTO<RouteChange> getByChangeNo(@PathVariable String changeNo) {
        RouteChange routeChange = routeChangeService.getRouteChangeByNo(changeNo);
        if (routeChange == null) {
            return ResultDTO.fail("改线记录不存在");
        }
        return ResultDTO.success(routeChange);
    }
    
    @GetMapping
    public ResultDTO<List<RouteChange>> getAll() {
        return ResultDTO.success(routeChangeService.getAllRouteChanges());
    }
    
    @GetMapping("/{id}/notifications")
    public ResultDTO<List<NotificationRecord>> getNotifications(@PathVariable Long id) {
        return ResultDTO.success(notificationService.getNotificationsByRouteChange(id));
    }
    
    @GetMapping("/{id}/phone-calls")
    public ResultDTO<List<NotificationRecord>> getPhoneCalls(@PathVariable Long id) {
        return ResultDTO.success(notificationService.getPhoneCallNotifications(id));
    }
    
    @GetMapping("/{id}/audit-logs")
    public ResultDTO<List<AuditLog>> getAuditLogs(@PathVariable Long id) {
        return ResultDTO.success(auditService.getAuditLogsByRouteChange(id));
    }
    
    @GetMapping("/{id}/report")
    public ResultDTO<Map<String, Object>> getReport(@PathVariable Long id) {
        return ResultDTO.success(reportService.generateRouteChangeReport(id));
    }
    
    @GetMapping("/{id}/export/csv")
    public ResponseEntity<String> exportCSV(@PathVariable Long id) {
        String csv = reportService.exportAsCSV(id);
        return ResponseEntity.ok()
                .header("Content-Type", "text/csv;charset=UTF-8")
                .header("Content-Disposition", "attachment; filename=route-change-report-" + id + ".csv")
                .body(csv);
    }
}

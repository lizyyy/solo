package com.example.readonlywindow.controller;

import com.example.readonlywindow.dto.ApproveRequest;
import com.example.readonlywindow.dto.CreateWindowRequest;
import com.example.readonlywindow.dto.CreateWriteRequest;
import com.example.readonlywindow.dto.ResourceScopeDTO;
import com.example.readonlywindow.entity.*;
import com.example.readonlywindow.service.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/demo")
@RequiredArgsConstructor
public class DemoController {
    private final FreezeWindowService windowService;
    private final WriteRequestService requestService;
    private final ReleaseCredentialService credentialService;
    private final ConflictService conflictService;
    private final ExportService exportService;

    @PostMapping("/self-test")
    public ResponseEntity<Map<String, Object>> runSelfTest() {
        log.info("Starting self-test for Read-Only Window API");
        Map<String, Object> results = new HashMap<>();
        List<String> steps = new ArrayList<>();

        try {
            steps.add("1. Creating test freeze window...");
            CreateWindowRequest windowRequest = new CreateWindowRequest();
            windowRequest.setName("发布冻结窗口-测试");
            windowRequest.setDescription("用于版本发布期间的数据库写入控制");
            windowRequest.setStartTime(LocalDateTime.now());
            windowRequest.setEndTime(LocalDateTime.now().plusHours(4));
            windowRequest.setOperator("system-admin");

            List<ResourceScopeDTO> scopes = new ArrayList<>();
            ResourceScopeDTO scope1 = new ResourceScopeDTO();
            scope1.setResourceType("DATABASE");
            scope1.setResourceName("user-db");
            scopes.add(scope1);

            ResourceScopeDTO scope2 = new ResourceScopeDTO();
            scope2.setResourceType("TABLE");
            scope2.setResourceName("order-table");
            scopes.add(scope2);

            windowRequest.setResourceScopes(scopes);
            FreezeWindow window = windowService.createWindow(windowRequest);
            String windowCode = window.getWindowCode();
            steps.add("   Created window: " + windowCode);

            steps.add("2. Activating window...");
            windowService.activateWindow(windowCode, "admin");
            steps.add("   Window activated successfully");

            steps.add("3. Creating write request...");
            CreateWriteRequest writeRequest = new CreateWriteRequest();
            writeRequest.setWindowCode(windowCode);
            writeRequest.setRequester("developer1");
            writeRequest.setResourceType("TABLE");
            writeRequest.setResourceName("order-table");
            writeRequest.setOperationDetails("INSERT INTO orders VALUES (1, 'test', 100.00)");
            writeRequest.setJustification("紧急修复订单数据");
            writeRequest.setOperator("developer1");
            WriteRequest request = requestService.createRequest(writeRequest);
            String requestCode = request.getRequestCode();
            steps.add("   Created request: " + requestCode);

            steps.add("4. Approving write request...");
            ApproveRequest approveRequest = new ApproveRequest();
            approveRequest.setRequestCode(requestCode);
            approveRequest.setApprovedBy("manager1");
            approveRequest.setNotes("已审核，允许执行");
            requestService.approveRequest(approveRequest);
            steps.add("   Request approved successfully");

            steps.add("5. Issuing release credential...");
            ReleaseCredential credential = credentialService.issueCredential(
                    windowCode, requestCode, "developer1", "manager1", "用于执行已批准的写入操作"
            );
            String credentialCode = credential.getCredentialCode();
            steps.add("   Issued credential: " + credentialCode);

            steps.add("6. Using credential...");
            credentialService.useCredential(credentialCode, "developer1");
            steps.add("   Credential used successfully");

            steps.add("7. Recording conflict...");
            ConflictRecord conflict = conflictService.recordConflict(
                    windowCode, "TABLE", "user-table", "UPDATE",
                    "未经授权尝试更新用户表", "unauthorized-user"
            );
            steps.add("   Recorded conflict: " + conflict.getConflictCode());

            steps.add("8. Resolving conflict...");
            conflictService.resolveConflict(conflict.getConflictCode(), "已拦截并警告操作者", "admin");
            steps.add("   Conflict resolved successfully");

            steps.add("9. Checking resource block status...");
            boolean blocked = windowService.isResourceInActiveWindow("TABLE", "order-table");
            steps.add("   Resource 'order-table' blocked status: " + blocked);

            steps.add("10. Generating window summary...");
            WindowSummaryDTO summary = exportService.exportWindowSummary(windowCode);
            steps.add("   Summary generated: " + summary.getTotalRequests() + " requests, " +
                      summary.getTotalConflicts() + " conflicts");

            steps.add("11. Suspending window...");
            windowService.suspendWindow(windowCode, "admin");
            steps.add("   Window suspended successfully");

            steps.add("12. Re-activating window...");
            windowService.suspendToActiveWindow(windowCode, "admin");
            steps.add("   Window re-activated successfully");

            steps.add("13. Completing window...");
            windowService.completeWindow(windowCode, "admin");
            steps.add("   Window completed successfully");

            results.put("status", "SUCCESS");
            results.put("windowCode", windowCode);
            results.put("requestCode", requestCode);
            results.put("credentialCode", credentialCode);
            results.put("conflictCode", conflict.getConflictCode());

            log.info("Self-test completed successfully!");

        } catch (Exception e) {
            log.error("Self-test failed", e);
            results.put("status", "FAILED");
            results.put("error", e.getMessage());
            steps.add("   ERROR: " + e.getMessage());
        }

        results.put("steps", steps);
        results.put("timestamp", LocalDateTime.now());
        return ResponseEntity.ok(results);
    }

    @GetMapping("/quick-demo")
    public ResponseEntity<Map<String, Object>> quickDemo() {
        Map<String, Object> demo = new HashMap<>();

        List<String> endpoints = new ArrayList<>();
        endpoints.add("POST /api/windows - Create freeze window");
        endpoints.add("POST /api/windows/{code}/activate - Activate window");
        endpoints.add("POST /api/windows/{code}/suspend - Suspend window");
        endpoints.add("POST /api/windows/{code}/complete - Complete window");
        endpoints.add("POST /api/windows/{code}/cancel - Cancel window");
        endpoints.add("POST /api/requests - Submit write request");
        endpoints.add("POST /api/requests/approve - Approve request");
        endpoints.add("POST /api/requests/reject - Reject request");
        endpoints.add("POST /api/credentials/issue - Issue credential");
        endpoints.add("POST /api/credentials/{code}/use - Use credential");
        endpoints.add("POST /api/conflicts/record - Record conflict");
        endpoints.add("GET /api/export/window/{code}/summary - Export summary");
        endpoints.add("GET /api/export/audit-report - Full audit report");

        List<String> coreEntities = new ArrayList<>();
        coreEntities.add("FreezeWindow - 冻结窗口，定义时间范围和资源");
        coreEntities.add("ResourceScope - 冻结的资源范围");
        coreEntities.add("WriteRequest - 写入请求审批");
        coreEntities.add("ReleaseCredential - 解除冻结凭证");
        coreEntities.add("ConflictRecord - 冲突记录");
        coreEntities.add("TimelineEvent - 时间线事件审计");

        List<String> statuses = new ArrayList<>();
        statuses.add("DRAFT -> ACTIVE -> SUSPENDED -> COMPLETED");
        statuses.add("DRAFT -> ACTIVE -> CANCELLED");

        demo.put("availableEndpoints", endpoints);
        demo.put("coreEntities", coreEntities);
        demo.put("windowStatusFlow", statuses);
        demo.put("selfTestEndpoint", "POST /api/demo/self-test");
        demo.put("h2Console", "/h2-console (jdbc:h2:mem:readonlydb)");

        return ResponseEntity.ok(demo);
    }
}

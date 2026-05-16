package com.audit.logretention.config;

import com.audit.logretention.dto.FreezeCreateRequest;
import com.audit.logretention.entity.FreezeOperationHistory;
import com.audit.logretention.entity.LogRetentionFreeze;
import com.audit.logretention.enums.FreezeReason;
import com.audit.logretention.enums.FreezeStatus;
import com.audit.logretention.repository.FreezeOperationHistoryRepository;
import com.audit.logretention.repository.LogRetentionFreezeRepository;
import com.audit.logretention.service.LogRetentionFreezeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class SampleDataInitializer implements CommandLineRunner {

    private final LogRetentionFreezeService freezeService;
    private final LogRetentionFreezeRepository freezeRepository;
    private final FreezeOperationHistoryRepository historyRepository;

    @Override
    public void run(String... args) {
        if (freezeRepository.count() > 0) {
            log.info("数据库已有数据，跳过初始化");
            return;
        }

        log.info("开始初始化示例数据...");
        initSampleData();
        log.info("示例数据初始化完成");
    }

    private void initSampleData() {
        FreezeCreateRequest request1 = new FreezeCreateRequest();
        request1.setRequestId("REQ-2024-001");
        request1.setLogTopic("user-operation-log");
        request1.setStartTime(LocalDateTime.of(2024, 1, 1, 0, 0, 0));
        request1.setEndTime(LocalDateTime.of(2024, 12, 31, 23, 59, 59));
        request1.setFreezeReason(FreezeReason.AUDIT_INVESTIGATION);
        request1.setFreezeReasonDetail("年度审计调查");
        request1.setApplicant("zhangsan");
        request1.setReleaseCondition("审计报告发布后自动释放");
        freezeService.createFreeze(request1);

        FreezeCreateRequest request2 = new FreezeCreateRequest();
        request2.setRequestId("REQ-2024-002");
        request2.setLogTopic("payment-transaction-log");
        request2.setStartTime(LocalDateTime.of(2024, 3, 1, 0, 0, 0));
        request2.setEndTime(LocalDateTime.of(2024, 3, 31, 23, 59, 59));
        request2.setFreezeReason(FreezeReason.COMPLAINT_INVOLVEMENT);
        request2.setFreezeReasonDetail("用户投诉订单异常，涉及交易日志");
        request2.setApplicant("lisi");
        request2.setReleaseCondition("投诉处理完成且双方无异议后释放");
        freezeService.createFreeze(request2);

        FreezeCreateRequest request3 = new FreezeCreateRequest();
        request3.setRequestId("REQ-2024-003");
        request3.setLogTopic("api-access-log");
        request3.setStartTime(LocalDateTime.of(2024, 5, 1, 0, 0, 0));
        request3.setEndTime(LocalDateTime.of(2024, 5, 15, 23, 59, 59));
        request3.setFreezeReason(FreezeReason.SECURITY_INCIDENT);
        request3.setFreezeReasonDetail("安全事件溯源分析");
        request3.setApplicant("wangwu");
        request3.setReleaseCondition("安全事件闭环后释放");
        freezeService.createFreeze(request3);

        createReleasedFreeze();
        createBlockedFreeze();
        createOverlappingFreeze();

        log.info("已创建 {} 条冻结记录, {} 条操作历史记录",
                freezeRepository.count(), historyRepository.count());
    }

    private void createReleasedFreeze() {
        LogRetentionFreeze freeze = new LogRetentionFreeze();
        freeze.setRequestId("REQ-2023-001");
        freeze.setLogTopic("system-admin-log");
        freeze.setStartTime(LocalDateTime.of(2023, 10, 1, 0, 0, 0));
        freeze.setEndTime(LocalDateTime.of(2023, 10, 31, 23, 59, 59));
        freeze.setFreezeReason(FreezeReason.REGULATORY_INQUIRY);
        freeze.setFreezeReasonDetail("监管机构例行检查");
        freeze.setApplicant("zhaoliu");
        freeze.setReleaseCondition("监管检查完成后释放");
        freeze.setStatus(FreezeStatus.RELEASED);
        freeze.setReviewer("manager-a");
        freeze.setReviewedAt(LocalDateTime.of(2023, 10, 2, 10, 0, 0));
        freeze.setReleasedAt(LocalDateTime.of(2023, 11, 15, 16, 30, 0));
        freeze.setRetentionReport("=== 日志留存冻结报告 ===\n已完成监管检查，日志无异常");
        freeze.setProcessingConclusion("正常释放");
        freezeRepository.save(freeze);

        FreezeOperationHistory history = new FreezeOperationHistory();
        history.setFreezeId(freeze.getId());
        history.setRequestId(freeze.getRequestId());
        history.setPreviousStatus(FreezeStatus.PENDING_REVIEW);
        history.setCurrentStatus(FreezeStatus.ACTIVE);
        history.setOperator("manager-a");
        history.setOperationRemark("审核通过");
        history.setOperatedAt(LocalDateTime.of(2023, 10, 2, 10, 0, 0));
        historyRepository.save(history);
    }

    private void createBlockedFreeze() {
        LogRetentionFreeze freeze = new LogRetentionFreeze();
        freeze.setRequestId("REQ-2024-INVALID-001");
        freeze.setLogTopic("test-log");
        freeze.setStartTime(LocalDateTime.of(2024, 6, 1, 0, 0, 0));
        freeze.setEndTime(LocalDateTime.of(2050, 6, 30, 23, 59, 59));
        freeze.setFreezeReason(FreezeReason.OTHER);
        freeze.setApplicant("tester");
        freeze.setStatus(FreezeStatus.BLOCKED);
        freeze.setProcessingConclusion("冻结时间范围超过10年限制，已拦截");
        freeze.setOriginalInput("{\"requestId\":\"REQ-2024-INVALID-001\",\"logTopic\":\"test-log\"}");
        freezeRepository.save(freeze);

        FreezeOperationHistory history = new FreezeOperationHistory();
        history.setFreezeId(freeze.getId());
        history.setRequestId(freeze.getRequestId());
        history.setPreviousStatus(null);
        history.setCurrentStatus(FreezeStatus.BLOCKED);
        history.setOperator("SYSTEM");
        history.setOperationRemark("冻结时间范围不能超过10年");
        history.setOperatedAt(LocalDateTime.now());
        historyRepository.save(history);
    }

    private void createOverlappingFreeze() {
        FreezeCreateRequest request = new FreezeCreateRequest();
        request.setRequestId("REQ-2024-OVERLAP-001");
        request.setLogTopic("user-operation-log");
        request.setStartTime(LocalDateTime.of(2024, 6, 1, 0, 0, 0));
        request.setEndTime(LocalDateTime.of(2024, 6, 30, 23, 59, 59));
        request.setFreezeReason(FreezeReason.BUSINESS_AUDIT);
        request.setFreezeReasonDetail("业务部门专项审计");
        request.setApplicant("auditor01");
        freezeService.createFreeze(request);
    }
}
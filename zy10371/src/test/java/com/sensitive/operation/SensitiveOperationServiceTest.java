package com.sensitive.operation;

import com.sensitive.operation.config.ConfirmationProperties;
import com.sensitive.operation.dto.CancelRequest;
import com.sensitive.operation.dto.ConfirmRequest;
import com.sensitive.operation.dto.CreateOperationRequest;
import com.sensitive.operation.dto.RejectRequest;
import com.sensitive.operation.enums.OperationStatus;
import com.sensitive.operation.enums.RiskLevel;
import com.sensitive.operation.exception.BusinessException;
import com.sensitive.operation.model.SensitiveOperation;
import com.sensitive.operation.repository.SensitiveOperationRepository;
import com.sensitive.operation.service.SensitiveOperationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import javax.persistence.EntityNotFoundException;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class SensitiveOperationServiceTest {

    @Autowired
    private SensitiveOperationService service;

    @Autowired
    private SensitiveOperationRepository repository;

    @Autowired
    private ConfirmationProperties properties;

    private String generateId() {
        return "OP_" + UUID.randomUUID().toString().substring(0, 8);
    }

    private CreateOperationRequest buildCreateRequest(String id, RiskLevel riskLevel) {
        return CreateOperationRequest.builder()
                .requestId(id)
                .operationType("TEST_OP")
                .requesterId("user001")
                .requesterName("申请人1")
                .riskLevel(riskLevel)
                .operationData("{\"test\":\"data\"}")
                .build();
    }

    @Test
    @DisplayName("创建中低风险操作 - 初始状态为PENDING")
    void createLowMediumRiskOperation() {
        String id = generateId();
        CreateOperationRequest request = buildCreateRequest(id, RiskLevel.MEDIUM);

        SensitiveOperation result = service.createOperation(request);

        assertNotNull(result);
        assertEquals(id, result.getId());
        assertEquals(OperationStatus.PENDING, result.getStatus());
        assertEquals(RiskLevel.MEDIUM, result.getRiskLevel());
    }

    @Test
    @DisplayName("创建高风险操作 - 初始状态为CONFIRMING")
    void createHighRiskOperation() {
        String id = generateId();
        CreateOperationRequest request = buildCreateRequest(id, RiskLevel.HIGH);

        SensitiveOperation result = service.createOperation(request);

        assertNotNull(result);
        assertEquals(OperationStatus.CONFIRMING, result.getStatus());
        assertEquals(RiskLevel.HIGH, result.getRiskLevel());
    }

    @Test
    @DisplayName("幂等测试 - 重复创建同一操作不产生脏数据")
    void idempotentCreate() {
        String id = generateId();
        CreateOperationRequest request = buildCreateRequest(id, RiskLevel.LOW);

        SensitiveOperation first = service.createOperation(request);
        SensitiveOperation second = service.createOperation(request);

        assertEquals(first.getId(), second.getId());
        assertEquals(first.getCreatedAt(), second.getCreatedAt());
        assertEquals(1, repository.count());
    }

    @Test
    @DisplayName("确认测试 - 中低风险1人确认即可通过")
    void confirmMediumRisk() {
        String id = generateId();
        service.createOperation(buildCreateRequest(id, RiskLevel.MEDIUM));

        ConfirmRequest confirmRequest = ConfirmRequest.builder()
                .confirmerId("user002")
                .confirmerName("确认人1")
                .build();

        SensitiveOperation result = service.confirm(id, confirmRequest);

        assertEquals(OperationStatus.CONFIRMED, result.getStatus());
        assertNotNull(result.getExecutionToken());
        assertEquals(1, result.getConfirmations().size());
    }

    @Test
    @DisplayName("确认测试 - 高风险需要2人确认")
    void confirmHighRisk() {
        String id = generateId();
        service.createOperation(buildCreateRequest(id, RiskLevel.HIGH));

        SensitiveOperation afterFirst = service.confirm(id, ConfirmRequest.builder()
                .confirmerId("user002")
                .confirmerName("确认人1")
                .build());

        assertEquals(OperationStatus.CONFIRMING, afterFirst.getStatus());
        assertNull(afterFirst.getExecutionToken());

        SensitiveOperation afterSecond = service.confirm(id, ConfirmRequest.builder()
                .confirmerId("user003")
                .confirmerName("确认人2")
                .build());

        assertEquals(OperationStatus.CONFIRMED, afterSecond.getStatus());
        assertNotNull(afterSecond.getExecutionToken());
    }

    @Test
    @DisplayName("幂等确认 - 同一人重复确认不产生重复记录")
    void idempotentConfirm() {
        String id = generateId();
        service.createOperation(buildCreateRequest(id, RiskLevel.LOW));

        ConfirmRequest request = ConfirmRequest.builder()
                .confirmerId("user002")
                .confirmerName("确认人1")
                .build();

        service.confirm(id, request);
        service.confirm(id, request);

        SensitiveOperation result = service.getById(id);
        assertEquals(1, result.getConfirmations().size());
    }

    @Test
    @DisplayName("申请人不能确认自己的操作")
    void requesterCannotConfirm() {
        String id = generateId();
        service.createOperation(buildCreateRequest(id, RiskLevel.LOW));

        ConfirmRequest request = ConfirmRequest.builder()
                .confirmerId("user001")
                .confirmerName("申请人1")
                .build();

        assertThrows(BusinessException.class, () -> service.confirm(id, request));
    }

    @Test
    @DisplayName("拒绝测试 - 拒绝后状态变为REJECTED")
    void rejectOperation() {
        String id = generateId();
        service.createOperation(buildCreateRequest(id, RiskLevel.LOW));

        RejectRequest request = RejectRequest.builder()
                .rejectorId("user002")
                .rejectorName("审核人")
                .rejectReason("信息不完整")
                .build();

        SensitiveOperation result = service.reject(id, request);

        assertEquals(OperationStatus.REJECTED, result.getStatus());
        assertEquals("信息不完整", result.getRejectReason());
    }

    @Test
    @DisplayName("撤销测试 - 已确认的操作可以撤销")
    void cancelConfirmedOperation() {
        String id = generateId();
        service.createOperation(buildCreateRequest(id, RiskLevel.LOW));
        service.confirm(id, ConfirmRequest.builder()
                .confirmerId("user002")
                .confirmerName("确认人1")
                .build());

        CancelRequest request = CancelRequest.builder()
                .cancellerId("user001")
                .cancellerName("申请人1")
                .build();

        SensitiveOperation result = service.cancel(id, request);

        assertEquals(OperationStatus.CANCELLED, result.getStatus());
        assertNotNull(result.getCancelledAt());
    }

    @Test
    @DisplayName("状态跳转测试 - 已执行的操作不能撤销")
    void cannotCancelExecutedOperation() {
        String id = generateId();
        service.createOperation(buildCreateRequest(id, RiskLevel.LOW));
        SensitiveOperation confirmed = service.confirm(id, ConfirmRequest.builder()
                .confirmerId("user002")
                .confirmerName("确认人1")
                .build());

        service.execute(id, confirmed.getExecutionToken());

        CancelRequest request = CancelRequest.builder()
                .cancellerId("user001")
                .cancellerName("申请人1")
                .build();

        assertThrows(BusinessException.class, () -> service.cancel(id, request));
    }

    @Test
    @DisplayName("状态跳转测试 - 已拒绝的操作不能确认")
    void cannotConfirmRejectedOperation() {
        String id = generateId();
        service.createOperation(buildCreateRequest(id, RiskLevel.LOW));
        service.reject(id, RejectRequest.builder()
                .rejectorId("user002")
                .rejectorName("审核人")
                .rejectReason("拒绝")
                .build());

        ConfirmRequest request = ConfirmRequest.builder()
                .confirmerId("user003")
                .confirmerName("确认人")
                .build();

        assertThrows(BusinessException.class, () -> service.confirm(id, request));
    }

    @Test
    @DisplayName("执行凭证测试 - 凭证正确才能执行")
    void executeWithValidToken() {
        String id = generateId();
        service.createOperation(buildCreateRequest(id, RiskLevel.LOW));
        SensitiveOperation confirmed = service.confirm(id, ConfirmRequest.builder()
                .confirmerId("user002")
                .confirmerName("确认人1")
                .build());

        SensitiveOperation result = service.execute(id, confirmed.getExecutionToken());

        assertEquals(OperationStatus.EXECUTED, result.getStatus());
        assertNotNull(result.getExecutedAt());
        assertNull(result.getExecutionToken());
    }

    @Test
    @DisplayName("执行凭证测试 - 凭证错误不能执行")
    void cannotExecuteWithInvalidToken() {
        String id = generateId();
        service.createOperation(buildCreateRequest(id, RiskLevel.LOW));
        service.confirm(id, ConfirmRequest.builder()
                .confirmerId("user002")
                .confirmerName("确认人1")
                .build());

        assertThrows(BusinessException.class, () -> service.execute(id, "INVALID_TOKEN"));
    }

    @Test
    @DisplayName("脏数据测试 - 查询不存在的操作抛出异常")
    void queryNonExistentOperation() {
        assertThrows(EntityNotFoundException.class, () -> service.getById("NON_EXISTENT"));
    }

    @Test
    @DisplayName("过期测试 - 过期的操作不能确认")
    void cannotConfirmExpiredOperation() {
        String id = generateId();
        CreateOperationRequest request = buildCreateRequest(id, RiskLevel.LOW);
        request.setExpireMinutes(0);
        service.createOperation(request);

        ConfirmRequest confirmRequest = ConfirmRequest.builder()
                .confirmerId("user002")
                .confirmerName("确认人1")
                .build();

        assertThrows(BusinessException.class, () -> service.confirm(id, confirmRequest));
    }
}

package com.sensitive.operation.service;

import com.sensitive.operation.config.ConfirmationProperties;
import com.sensitive.operation.dto.CancelRequest;
import com.sensitive.operation.dto.ConfirmRequest;
import com.sensitive.operation.dto.CreateOperationRequest;
import com.sensitive.operation.dto.RejectRequest;
import com.sensitive.operation.enums.OperationStatus;
import com.sensitive.operation.enums.RiskLevel;
import com.sensitive.operation.exception.BusinessException;
import com.sensitive.operation.model.ConfirmationRecord;
import com.sensitive.operation.model.SensitiveOperation;
import com.sensitive.operation.repository.SensitiveOperationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.persistence.EntityNotFoundException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SensitiveOperationService {

    private final SensitiveOperationRepository repository;
    private final ConfirmationProperties properties;

    private static final Set<OperationStatus> ALLOWED_CONFIRM_STATUSES;
    private static final Set<OperationStatus> ALLOWED_REJECT_STATUSES;
    private static final Set<OperationStatus> ALLOWED_CANCEL_STATUSES;
    private static final Set<OperationStatus> ALLOWED_EXECUTE_STATUSES;

    static {
        ALLOWED_CONFIRM_STATUSES = new HashSet<>();
        ALLOWED_CONFIRM_STATUSES.add(OperationStatus.PENDING);
        ALLOWED_CONFIRM_STATUSES.add(OperationStatus.CONFIRMING);

        ALLOWED_REJECT_STATUSES = new HashSet<>();
        ALLOWED_REJECT_STATUSES.add(OperationStatus.PENDING);
        ALLOWED_REJECT_STATUSES.add(OperationStatus.CONFIRMING);

        ALLOWED_CANCEL_STATUSES = new HashSet<>();
        ALLOWED_CANCEL_STATUSES.add(OperationStatus.PENDING);
        ALLOWED_CANCEL_STATUSES.add(OperationStatus.CONFIRMING);
        ALLOWED_CANCEL_STATUSES.add(OperationStatus.CONFIRMED);

        ALLOWED_EXECUTE_STATUSES = new HashSet<>();
        ALLOWED_EXECUTE_STATUSES.add(OperationStatus.CONFIRMED);
    }

    @Transactional
    public SensitiveOperation createOperation(CreateOperationRequest request) {
        if (repository.existsById(request.getRequestId())) {
            log.info("操作ID已存在，幂等返回: {}", request.getRequestId());
            return repository.findById(request.getRequestId()).orElseThrow();
        }

        int expireMinutes = getExpireMinutes(request);
        LocalDateTime expireTime = LocalDateTime.now().plusMinutes(expireMinutes);

        OperationStatus initialStatus = request.getRiskLevel() == RiskLevel.HIGH
                ? OperationStatus.CONFIRMING
                : OperationStatus.PENDING;

        SensitiveOperation operation = SensitiveOperation.builder()
                .id(request.getRequestId())
                .operationType(request.getOperationType())
                .requesterId(request.getRequesterId())
                .requesterName(request.getRequesterName())
                .riskLevel(request.getRiskLevel())
                .status(initialStatus)
                .operationData(request.getOperationData())
                .expireTime(expireTime)
                .build();

        SensitiveOperation saved = repository.save(operation);
        log.info("创建敏感操作成功: {}, 风险等级: {}, 初始状态: {}",
                saved.getId(), saved.getRiskLevel(), saved.getStatus());
        return saved;
    }

    private int getExpireMinutes(CreateOperationRequest request) {
        if (request.getExpireMinutes() != null && request.getExpireMinutes() > 0) {
            return request.getExpireMinutes();
        }
        return request.getRiskLevel() == RiskLevel.HIGH
                ? properties.getHighRiskExpireMinutes()
                : properties.getDefaultExpireMinutes();
    }

    @Transactional
    public SensitiveOperation confirm(String operationId, ConfirmRequest request) {
        SensitiveOperation operation = getOperation(operationId);

        checkExpired(operation);

        if (!ALLOWED_CONFIRM_STATUSES.contains(operation.getStatus())) {
            throw new BusinessException("当前状态不允许确认: " + operation.getStatus());
        }

        if (operation.getRequesterId().equals(request.getConfirmerId())) {
            throw new BusinessException("申请人不能作为确认人");
        }

        Set<String> existingConfirmers = operation.getConfirmations().stream()
                .map(ConfirmationRecord::getConfirmerId)
                .collect(Collectors.toSet());

        if (existingConfirmers.contains(request.getConfirmerId())) {
            log.info("确认人已确认，幂等返回: {}", request.getConfirmerId());
            return operation;
        }

        ConfirmationRecord record = ConfirmationRecord.builder()
                .operationId(operationId)
                .confirmerId(request.getConfirmerId())
                .confirmerName(request.getConfirmerName())
                .confirmedAt(LocalDateTime.now())
                .comment(request.getComment())
                .build();

        operation.getConfirmations().add(record);

        int requiredConfirmers = operation.getRiskLevel() == RiskLevel.HIGH
                ? properties.getRequiredConfirmers()
                : 1;

        if (operation.getConfirmations().size() >= requiredConfirmers) {
            operation.setStatus(OperationStatus.CONFIRMED);
            operation.setExecutionToken(generateExecutionToken());
            log.info("操作已完成所有确认，生成执行凭证: {}", operationId);
        } else {
            operation.setStatus(OperationStatus.CONFIRMING);
        }

        return repository.save(operation);
    }

    @Transactional
    public SensitiveOperation reject(String operationId, RejectRequest request) {
        SensitiveOperation operation = getOperation(operationId);

        checkExpired(operation);

        if (!ALLOWED_REJECT_STATUSES.contains(operation.getStatus())) {
            throw new BusinessException("当前状态不允许拒绝: " + operation.getStatus());
        }

        operation.setStatus(OperationStatus.REJECTED);
        operation.setRejectReason(request.getRejectReason());

        log.info("操作已被拒绝: {}, 拒绝人: {}, 原因: {}",
                operationId, request.getRejectorName(), request.getRejectReason());
        return repository.save(operation);
    }

    @Transactional
    public SensitiveOperation cancel(String operationId, CancelRequest request) {
        SensitiveOperation operation = getOperation(operationId);

        if (!ALLOWED_CANCEL_STATUSES.contains(operation.getStatus())) {
            throw new BusinessException("当前状态不允许撤销: " + operation.getStatus());
        }

        operation.setStatus(OperationStatus.CANCELLED);
        operation.setCancellerId(request.getCancellerId());
        operation.setCancellerName(request.getCancellerName());
        operation.setCancelledAt(LocalDateTime.now());

        log.info("操作已被撤销: {}, 撤销人: {}", operationId, request.getCancellerName());
        return repository.save(operation);
    }

    @Transactional
    public SensitiveOperation execute(String operationId, String executionToken) {
        SensitiveOperation operation = getOperation(operationId);

        checkExpired(operation);

        if (!ALLOWED_EXECUTE_STATUSES.contains(operation.getStatus())) {
            throw new BusinessException("当前状态不允许执行: " + operation.getStatus());
        }

        if (!operation.getExecutionToken().equals(executionToken)) {
            throw new BusinessException(401, "执行凭证无效");
        }

        operation.setStatus(OperationStatus.EXECUTING);
        repository.save(operation);

        operation.setStatus(OperationStatus.EXECUTED);
        operation.setExecutedAt(LocalDateTime.now());
        operation.setExecutionToken(null);

        log.info("操作执行成功: {}", operationId);
        return repository.save(operation);
    }

    public SensitiveOperation getById(String operationId) {
        return getOperation(operationId);
    }

    public List<SensitiveOperation> listByStatus(OperationStatus status) {
        return repository.findByStatus(status);
    }

    public List<SensitiveOperation> listByRequester(String requesterId) {
        return repository.findByRequesterId(requesterId);
    }

    public List<SensitiveOperation> listAll() {
        return repository.findAll();
    }

    private SensitiveOperation getOperation(String operationId) {
        SensitiveOperation operation = repository.findById(operationId)
                .orElseThrow(() -> new EntityNotFoundException("操作不存在: " + operationId));
        checkAndMarkExpired(operation);
        return operation;
    }

    private void checkExpired(SensitiveOperation operation) {
        if (operation.getExpireTime().isBefore(LocalDateTime.now())) {
            operation.setStatus(OperationStatus.EXPIRED);
            repository.save(operation);
            throw new BusinessException("操作已过期");
        }
    }

    private void checkAndMarkExpired(SensitiveOperation operation) {
        if (operation.getExpireTime().isBefore(LocalDateTime.now())
                && ALLOWED_CONFIRM_STATUSES.contains(operation.getStatus())) {
            operation.setStatus(OperationStatus.EXPIRED);
            repository.save(operation);
        }
    }

    private String generateExecutionToken() {
        return "TOKEN_" + UUID.randomUUID().toString().replace("-", "").toUpperCase();
    }

    @Transactional
    public void cleanupExpiredOperations() {
        List<OperationStatus> activeStatuses = new ArrayList<>();
        activeStatuses.add(OperationStatus.PENDING);
        activeStatuses.add(OperationStatus.CONFIRMING);
        List<SensitiveOperation> expired = repository.findByExpireTimeBeforeAndStatusIn(
                LocalDateTime.now(), activeStatuses);

        expired.forEach(op -> {
            op.setStatus(OperationStatus.EXPIRED);
            log.info("标记过期操作: {}", op.getId());
        });
        repository.saveAll(expired);
    }
}

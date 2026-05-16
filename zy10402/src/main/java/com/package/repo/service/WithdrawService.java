package com.package.repo.service;

import com.package.repo.model.dto.ArbitrationRequestDto;
import com.package.repo.model.dto.WithdrawRequestDto;
import com.package.repo.model.entity.ImpactReport;
import com.package.repo.model.entity.OperationLog;
import com.package.repo.model.entity.PackageVersion;
import com.package.repo.model.entity.WithdrawRequest;
import com.package.repo.model.enums.ArbitrationResult;
import com.package.repo.model.enums.PackageStatus;
import com.package.repo.repository.OperationLogRepository;
import com.package.repo.repository.PackageVersionRepository;
import com.package.repo.repository.WithdrawRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class WithdrawService {

    private final WithdrawRequestRepository withdrawRequestRepository;
    private final PackageVersionRepository packageVersionRepository;
    private final OperationLogRepository operationLogRepository;
    private final StateMachineService stateMachineService;
    private final ImpactCalculationService impactCalculationService;

    @Transactional
    public WithdrawRequest requestWithdraw(WithdrawRequestDto requestDto) {
        String requestId = requestDto.getRequestId() != null ?
                requestDto.getRequestId() : "WD-" + UUID.randomUUID().toString().substring(0, 8);

        if (withdrawRequestRepository.existsByRequestId(requestId)) {
            log.info("幂等处理: 请求已存在 {}", requestId);
            WithdrawRequest existing = withdrawRequestRepository.findByRequestId(requestId).orElseThrow();
            existing.setIdempotentProcessed(true);
            return withdrawRequestRepository.save(existing);
        }

        PackageVersion packageVersion = packageVersionRepository
                .findByPackageNameAndVersionAndDeletedFalse(
                        requestDto.getPackageName(), requestDto.getVersion())
                .orElseThrow(() -> new IllegalArgumentException(
                        "包不存在: " + requestDto.getPackageName() + ":" + requestDto.getVersion()));

        if (packageVersion.getStatus() != PackageStatus.PUBLISHED) {
            String errorMsg = "包当前状态不支持撤回: " + packageVersion.getStatus();
            saveOperationLog("WITHDRAW_REQUEST", requestDto.getRequester(),
                    requestId, requestDto.getRawInput(), errorMsg, false, errorMsg);
            throw new IllegalStateException(errorMsg);
        }

        WithdrawRequest request = WithdrawRequest.builder()
                .requestId(requestId)
                .packageVersion(packageVersion)
                .requester(requestDto.getRequester())
                .reason(requestDto.getReason())
                .arbitrationResult(ArbitrationResult.PENDING)
                .rawInput(requestDto.getRawInput())
                .build();

        packageVersion.setStatus(PackageStatus.WITHDRAW_REQUESTED);
        packageVersion.setLastStatusChangeTime(LocalDateTime.now());
        packageVersion.setStatusChangeReason("撤回申请已提交，等待处理");
        packageVersionRepository.save(packageVersion);

        WithdrawRequest saved = withdrawRequestRepository.save(request);

        List<ImpactReport> reports = impactCalculationService.calculateAndSaveImpact(saved);
        boolean hasHighImpact = impactCalculationService.hasHighImpactDependencies(
                requestDto.getPackageName(), requestDto.getVersion());

        if (hasHighImpact) {
            packageVersion.setStatus(PackageStatus.WITHDRAW_PENDING_REVIEW);
            packageVersion.setStatusChangeReason("检测到高影响依赖，需人工复核");
            packageVersionRepository.save(packageVersion);
            saved.setProcessingConclusion("检测到高影响依赖，需人工复核");
            saved = withdrawRequestRepository.save(saved);
        } else {
            packageVersion.setStatus(PackageStatus.WITHDRAW_PENDING_REVIEW);
            packageVersion.setStatusChangeReason("撤回申请已受理，待仲裁");
            packageVersionRepository.save(packageVersion);
        }

        saveOperationLog("WITHDRAW_REQUEST", requestDto.getRequester(),
                requestId, requestDto.getRawInput(),
                "撤回申请已提交，影响报告数: " + reports.size(), true, null);

        log.info("撤回申请已提交: {}, 影响项目数: {}", requestId, reports.size());
        return saved;
    }

    @Transactional
    public WithdrawRequest arbitrate(ArbitrationRequestDto requestDto) {
        WithdrawRequest request = withdrawRequestRepository.findByRequestId(requestDto.getRequestId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "请求不存在: " + requestDto.getRequestId()));

        if (request.getArbitrationResult() != ArbitrationResult.PENDING) {
            throw new IllegalStateException("请求已仲裁，不可重复处理");
        }

        PackageVersion packageVersion = request.getPackageVersion();
        PackageStatus newStatus = stateMachineService.getNextStatusForArbitration(requestDto.getResult());

        if (!stateMachineService.canTransition(packageVersion.getStatus(), newStatus)) {
            String errorMsg = "无效的状态转换: " + packageVersion.getStatus() + " -> " + newStatus;
            saveOperationLog("ARBITRATION", requestDto.getArbitrator(),
                    requestDto.getRequestId(), requestDto.getRawInput(), errorMsg, false, errorMsg);
            throw new IllegalStateException(errorMsg);
        }

        request.setArbitrationResult(requestDto.getResult());
        request.setArbitrator(requestDto.getArbitrator());
        request.setArbitrationComment(requestDto.getComment());
        request.setArbitrationTime(LocalDateTime.now());
        request.setProcessingConclusion("仲裁完成: " + requestDto.getResult().getDescription());

        packageVersion.setStatus(newStatus);
        packageVersion.setLastStatusChangeTime(LocalDateTime.now());
        packageVersion.setStatusChangeReason("仲裁结果: " + requestDto.getResult().getDescription() +
                ", 仲裁人: " + requestDto.getArbitrator() +
                (requestDto.getComment() != null ? ", 备注: " + requestDto.getComment() : ""));

        withdrawRequestRepository.save(request);
        packageVersionRepository.save(packageVersion);

        saveOperationLog("ARBITRATION", requestDto.getArbitrator(),
                requestDto.getRequestId(), requestDto.getRawInput(),
                "仲裁完成: " + requestDto.getResult(), true, null);

        log.info("仲裁完成: {}, 结果: {}", requestDto.getRequestId(), requestDto.getResult());
        return request;
    }

    @Transactional
    public WithdrawRequest compensate(String requestId, String operator, String reason) {
        WithdrawRequest request = withdrawRequestRepository.findByRequestId(requestId)
                .orElseThrow(() -> new IllegalArgumentException("请求不存在: " + requestId));

        PackageVersion packageVersion = request.getPackageVersion();
        PackageStatus currentStatus = packageVersion.getStatus();

        if (!stateMachineService.canTransition(currentStatus, PackageStatus.WITHDRAW_COMPENSATED)) {
            throw new IllegalStateException("当前状态不支持补偿: " + currentStatus);
        }

        packageVersion.setStatus(PackageStatus.WITHDRAW_COMPENSATED);
        packageVersion.setLastStatusChangeTime(LocalDateTime.now());
        packageVersion.setStatusChangeReason("已补偿: " + reason + ", 操作人: " + operator);

        request.setProcessingConclusion("已完成补偿操作: " + reason);
        withdrawRequestRepository.save(request);
        packageVersionRepository.save(packageVersion);

        saveOperationLog("COMPENSATE", operator, requestId,
                null, "补偿完成: " + reason, true, null);

        log.info("补偿完成: {}", requestId);
        return request;
    }

    public Optional<WithdrawRequest> getRequest(String requestId) {
        return withdrawRequestRepository.findByRequestId(requestId);
    }

    public List<WithdrawRequest> getAllRequests() {
        return withdrawRequestRepository.findAllOrderByRequestTimeDesc();
    }

    public List<WithdrawRequest> getPendingRequests() {
        return withdrawRequestRepository.findByArbitrationResult(ArbitrationResult.PENDING);
    }

    private void saveOperationLog(String operationType, String operator, String resourceKey,
                                  String rawInput, String conclusion, boolean success, String errorMsg) {
        OperationLog log = OperationLog.builder()
                .operationType(operationType)
                .operator(operator)
                .resourceKey(resourceKey)
                .rawInput(rawInput)
                .processingConclusion(conclusion)
                .success(success)
                .errorMessage(errorMsg)
                .build();
        operationLogRepository.save(log);
    }
}

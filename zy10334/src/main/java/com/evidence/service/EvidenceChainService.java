package com.evidence.service;

import com.alibaba.fastjson.JSON;
import com.evidence.dto.*;
import com.evidence.entity.EvidenceAction;
import com.evidence.entity.EvidenceChain;
import com.evidence.entity.EvidenceRemark;
import com.evidence.enums.ActionType;
import com.evidence.enums.EvidenceStatus;
import com.evidence.exception.BusinessException;
import com.evidence.repository.EvidenceChainRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class EvidenceChainService {

    private final EvidenceChainRepository evidenceChainRepository;

    @Transactional
    public ApiResponse<EvidenceChain> createEvidence(CreateEvidenceRequest request) {
        log.info("创建证据链: businessNo={}, requestId={}", request.getBusinessNo(), request.getRequestId());

        Optional<EvidenceChain> existing = evidenceChainRepository.findByRequestId(request.getRequestId());
        if (existing.isPresent()) {
            log.info("幂等返回: requestId={}", request.getRequestId());
            return ApiResponse.idempotent(existing.get());
        }

        EvidenceChain evidenceChain = EvidenceChain.builder()
                .businessNo(request.getBusinessNo())
                .requestId(request.getRequestId())
                .sourceSystem(request.getSourceSystem())
                .targetSystem(request.getTargetSystem())
                .apiName(request.getApiName())
                .requestBody(request.getRequestBody())
                .status(EvidenceStatus.CREATED)
                .createdBy(request.getOperator())
                .updatedBy(request.getOperator())
                .build();

        EvidenceAction inboundAction = EvidenceAction.builder()
                .actionType(ActionType.INBOUND_REQUEST)
                .actionName("入口请求")
                .actionDetail("API请求入口，创建证据链")
                .operator(request.getOperator())
                .build();
        evidenceChain.addAction(inboundAction);

        evidenceChain = evidenceChainRepository.save(evidenceChain);
        log.info("证据链创建成功: id={}, requestId={}", evidenceChain.getId(), evidenceChain.getRequestId());

        return ApiResponse.success(request.getRequestId(), evidenceChain);
    }

    @Transactional
    public ApiResponse<EvidenceChain> addAction(AddActionRequest request) {
        log.info("添加动作: requestId={}, actionType={}", request.getRequestId(), request.getActionType());

        EvidenceChain evidenceChain = getEvidenceChainOrThrow(request.getRequestId());

        EvidenceAction action = EvidenceAction.builder()
                .actionType(request.getActionType())
                .actionName(request.getActionName())
                .actionDetail(request.getActionDetail())
                .externalRefNo(request.getExternalRefNo())
                .receiptData(request.getReceiptData())
                .operator(request.getOperator())
                .extendInfo(request.getExtendInfo())
                .build();

        evidenceChain.addAction(action);
        evidenceChain.setUpdatedBy(request.getOperator());

        evidenceChainRepository.save(evidenceChain);
        log.info("动作添加成功: requestId={}, actionId={}", request.getRequestId(), action.getId());

        return ApiResponse.success(request.getRequestId(), evidenceChain);
    }

    @Transactional
    public ApiResponse<EvidenceChain> updateStatus(StatusUpdateRequest request) {
        log.info("状态更新: requestId={}, targetStatus={}", request.getRequestId(), request.getTargetStatus());

        EvidenceChain evidenceChain = getEvidenceChainOrThrow(request.getRequestId());

        validateStatusTransition(evidenceChain.getStatus(), request.getTargetStatus(), request.getRequestId());

        evidenceChain.setStatus(request.getTargetStatus());
        evidenceChain.setResponseBody(request.getResponseBody());
        evidenceChain.setErrorMessage(request.getErrorMessage());
        evidenceChain.setUpdatedBy(request.getOperator());

        if (request.getTargetStatus() == EvidenceStatus.FAILED) {
            EvidenceAction errorAction = EvidenceAction.builder()
                    .actionType(ActionType.ERROR_HANDLING)
                    .actionName("异常处理")
                    .actionDetail("处理状态更新为失败")
                    .operator(request.getOperator())
                    .build();
            evidenceChain.addAction(errorAction);
        }

        evidenceChainRepository.save(evidenceChain);
        log.info("状态更新成功: requestId={}, status={}", request.getRequestId(), request.getTargetStatus());

        return ApiResponse.success(request.getRequestId(), evidenceChain);
    }

    @Transactional
    public ApiResponse<EvidenceChain> addRemark(AddRemarkRequest request) {
        log.info("添加备注: requestId={}, operator={}", request.getRequestId(), request.getOperator());

        EvidenceChain evidenceChain = getEvidenceChainOrThrow(request.getRequestId());

        EvidenceRemark remark = EvidenceRemark.builder()
                .remarkContent(request.getRemarkContent())
                .operator(request.getOperator())
                .build();
        evidenceChain.addRemark(remark);
        evidenceChain.setUpdatedBy(request.getOperator());

        evidenceChainRepository.save(evidenceChain);
        log.info("备注添加成功: requestId={}, remarkId={}", request.getRequestId(), remark.getId());

        return ApiResponse.success(request.getRequestId(), evidenceChain);
    }

    public ApiResponse<EvidenceChain> getByRequestId(String requestId) {
        EvidenceChain evidenceChain = getEvidenceChainOrThrow(requestId);
        return ApiResponse.success(requestId, evidenceChain);
    }

    public ApiResponse<List<EvidenceChain>> getByBusinessNo(String businessNo) {
        List<EvidenceChain> list = evidenceChainRepository.findByBusinessNoOrderByCreatedAtDesc(businessNo);
        return ApiResponse.success(null, list);
    }

    public ApiResponse<List<EvidenceChain>> query(String businessNo, EvidenceStatus status, String sourceSystem) {
        List<EvidenceChain> list = evidenceChainRepository.findByConditions(businessNo, status, sourceSystem);
        return ApiResponse.success(null, list);
    }

    public ApiResponse<String> exportSummary(String requestId) {
        EvidenceChain evidenceChain = getEvidenceChainOrThrow(requestId);

        StringBuilder summary = new StringBuilder();
        summary.append("=== 证据链摘要 ===\n");
        summary.append("业务单号: ").append(evidenceChain.getBusinessNo()).append("\n");
        summary.append("请求ID: ").append(evidenceChain.getRequestId()).append("\n");
        summary.append("当前状态: ").append(evidenceChain.getStatus().getDesc()).append("\n");
        summary.append("创建时间: ").append(evidenceChain.getCreatedAt()).append("\n\n");

        summary.append("=== 动作序列 ===\n");
        int index = 1;
        for (EvidenceAction action : evidenceChain.getActions()) {
            summary.append(index++).append(". ")
                    .append("[").append(action.getActionTime()).append("] ")
                    .append(action.getActionType().getDesc()).append(" - ")
                    .append(action.getActionName() != null ? action.getActionName() : "")
                    .append("\n");
            if (action.getActionDetail() != null) {
                summary.append("   详情: ").append(action.getActionDetail()).append("\n");
            }
            if (action.getExternalRefNo() != null) {
                summary.append("   外部关联: ").append(action.getExternalRefNo()).append("\n");
            }
            if (action.getReceiptData() != null) {
                summary.append("   回执: ").append(action.getReceiptData()).append("\n");
            }
        }

        summary.append("\n=== 备注记录 ===\n");
        for (EvidenceRemark remark : evidenceChain.getRemarks()) {
            summary.append("[").append(remark.getCreatedAt()).append("] ")
                    .append(remark.getOperator()).append(": ")
                    .append(remark.getRemarkContent()).append("\n");
        }

        return ApiResponse.success(requestId, summary.toString());
    }

    public ApiResponse<Boolean> validate(String requestId) {
        boolean exists = evidenceChainRepository.existsByRequestId(requestId);
        return ApiResponse.success(requestId, exists);
    }

    private EvidenceChain getEvidenceChainOrThrow(String requestId) {
        return evidenceChainRepository.findByRequestId(requestId)
                .orElseThrow(() -> BusinessException.notFound(requestId));
    }

    private void validateStatusTransition(EvidenceStatus current, EvidenceStatus target, String requestId) {
        if (current == EvidenceStatus.SUCCESS && target != EvidenceStatus.MANUAL_HANDLED) {
            throw BusinessException.invalidStatusTransition(requestId,
                    "成功状态下仅能转为人工处理，当前: " + current.getDesc() + ", 目标: " + target.getDesc());
        }
        if (current == EvidenceStatus.MANUAL_HANDLED) {
            throw BusinessException.invalidStatusTransition(requestId,
                    "人工处理状态为终态，不可再变更");
        }
    }
}

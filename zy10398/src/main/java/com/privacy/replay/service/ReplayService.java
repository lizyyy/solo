package com.privacy.replay.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.privacy.replay.dto.ApproveReplayRequest;
import com.privacy.replay.dto.CreateReplayRequest;
import com.privacy.replay.exception.BusinessException;
import com.privacy.replay.exception.ErrorCode;
import com.privacy.replay.model.*;
import com.privacy.replay.repository.ReplayHistoryRepository;
import com.privacy.replay.repository.ReplayRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReplayService {

    private final ReplayRequestRepository replayRequestRepository;
    private final ReplayHistoryRepository replayHistoryRepository;
    private final UserSampleService userSampleService;
    private final PrivacyBudgetService privacyBudgetService;
    private final ObjectMapper objectMapper;

    public ReplayRequest getRequestByRequestId(String requestId) {
        return replayRequestRepository.findByRequestId(requestId)
                .orElseThrow(() -> new BusinessException(ErrorCode.REQUEST_NOT_FOUND));
    }

    public List<ReplayRequest> getRequestsByRequesterId(String requesterId) {
        return replayRequestRepository.findByRequesterId(requesterId);
    }

    public List<ReplayRequest> getRequestsByStatus(ReplayRequestStatus status) {
        return replayRequestRepository.findByStatus(status);
    }

    @Transactional(rollbackFor = Exception.class)
    public ReplayRequest createRequest(CreateReplayRequest request) {
        if (replayRequestRepository.findByRequestId(request.getRequestId()).isPresent()) {
            throw new BusinessException(ErrorCode.DUPLICATE_REQUEST);
        }

        userSampleService.validateSamples(request.getSampleIds());

        if (!privacyBudgetService.isMaskingLevelAllowed(request.getRequesterId(), request.getMaskingLevel())) {
            throw new BusinessException(ErrorCode.MASKING_LEVEL_NOT_ALLOWED);
        }

        BigDecimal cost = calculateBudgetCost(request.getSampleIds(), request.getMaskingLevel());

        privacyBudgetService.checkBudgetAvailability(request.getRequesterId(), cost);

        ReplayRequest replayRequest = new ReplayRequest();
        replayRequest.setRequestId(request.getRequestId());
        replayRequest.setRequesterId(request.getRequesterId());
        replayRequest.setPurpose(request.getPurpose());
        replayRequest.setDescription(request.getDescription());
        replayRequest.setSampleIds(String.join(",", request.getSampleIds()));
        replayRequest.setMaskingLevel(request.getMaskingLevel());
        replayRequest.setBudgetCost(cost);
        replayRequest.setStatus(ReplayRequestStatus.PENDING);
        replayRequest.setExpiredAt(LocalDateTime.now().plusDays(7));

        return replayRequestRepository.save(replayRequest);
    }

    @Transactional(rollbackFor = Exception.class)
    public ReplayRequest approveRequest(ApproveReplayRequest request) {
        ReplayRequest replayRequest = getRequestByRequestId(request.getRequestId());

        if (replayRequest.getStatus() != ReplayRequestStatus.PENDING) {
            throw new BusinessException(ErrorCode.REQUEST_ALREADY_PROCESSED);
        }

        if (request.getApproved()) {
            replayRequest.setStatus(ReplayRequestStatus.APPROVED);
            replayRequest.setApprovedAt(LocalDateTime.now());
        } else {
            replayRequest.setStatus(ReplayRequestStatus.REJECTED);
        }

        replayRequest.setApproverId(request.getApproverId());
        replayRequest.setApprovalComment(request.getComment());

        return replayRequestRepository.save(replayRequest);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> executeRequest(String requestId) {
        ReplayRequest replayRequest = getRequestByRequestId(requestId);

        if (replayRequest.getStatus() != ReplayRequestStatus.APPROVED) {
            throw new BusinessException(ErrorCode.REQUEST_STATUS_INVALID);
        }

        replayRequest.setStatus(ReplayRequestStatus.PROCESSING);
        replayRequest.setExecutedAt(LocalDateTime.now());
        replayRequestRepository.save(replayRequest);

        try {
            privacyBudgetService.deductBudget(replayRequest.getRequesterId(), replayRequest.getBudgetCost());

            List<String> sampleIds = List.of(replayRequest.getSampleIds().split(","));
            Map<String, Object> result = new HashMap<>();
            List<Map<String, Object>> maskedSamples = sampleIds.stream().map(sampleId -> {
                UserSample sample = userSampleService.getSampleBySampleId(sampleId);
                Map<String, Object> masked = new HashMap<>();
                masked.put("sampleId", sampleId);
                masked.put("dataType", sample.getDataType());
                masked.put("maskedData", userSampleService.applyMasking(
                        sample.getSampleData(),
                        replayRequest.getMaskingLevel().getLevel()
                ));
                return masked;
            }).collect(Collectors.toList());

            result.put("requestId", requestId);
            result.put("maskingLevel", replayRequest.getMaskingLevel());
            result.put("samples", maskedSamples);
            result.put("budgetCost", replayRequest.getBudgetCost());
            result.put("executedAt", LocalDateTime.now());

            saveHistory(replayRequest, result, true, null);

            replayRequest.setStatus(ReplayRequestStatus.COMPLETED);
            replayRequest.setCompletedAt(LocalDateTime.now());
            replayRequestRepository.save(replayRequest);

            return result;

        } catch (BusinessException e) {
            saveHistory(replayRequest, null, false, e.getMessage());
            replayRequest.setStatus(ReplayRequestStatus.CANCELLED);
            replayRequest.setErrorMessage(e.getMessage());
            replayRequestRepository.save(replayRequest);
            throw e;
        } catch (Exception e) {
            saveHistory(replayRequest, null, false, e.getMessage());
            replayRequest.setStatus(ReplayRequestStatus.CANCELLED);
            replayRequest.setErrorMessage(e.getMessage());
            replayRequestRepository.save(replayRequest);
            throw new BusinessException(ErrorCode.INTERNAL_ERROR);
        }
    }

    private void saveHistory(ReplayRequest request, Map<String, Object> resultData,
                            boolean success, String errorMessage) {
        ReplayHistory history = new ReplayHistory();
        history.setRequestId(request.getRequestId());
        history.setRequesterId(request.getRequesterId());
        history.setSampleIds(request.getSampleIds());
        history.setMaskingLevel(request.getMaskingLevel());
        history.setBudgetCost(request.getBudgetCost());
        history.setExecutedAt(LocalDateTime.now());
        history.setSuccess(success);
        history.setErrorMessage(errorMessage);
        if (resultData != null) {
            try {
                history.setResultData(objectMapper.writeValueAsString(resultData));
            } catch (Exception e) {
                log.error("Serialize result error", e);
            }
        }
        replayHistoryRepository.save(history);
    }

    public List<ReplayHistory> getHistoryByRequesterId(String requesterId) {
        return replayHistoryRepository.findByRequesterIdOrderByExecutedAtDesc(requesterId);
    }

    private BigDecimal calculateBudgetCost(List<String> sampleIds, MaskingLevel maskingLevel) {
        int baseCost = sampleIds.size() * 15;
        int levelMultiplier = maskingLevel.getLevel() + 1;
        return BigDecimal.valueOf(baseCost * levelMultiplier);
    }

    @Scheduled(cron = "0 0 4 * * ?")
    @Transactional(rollbackFor = Exception.class)
    public void expirePendingRequests() {
        List<ReplayRequest> expiredRequests = replayRequestRepository
                .findByExpiredAtBeforeAndStatus(LocalDateTime.now(), ReplayRequestStatus.PENDING);
        for (ReplayRequest request : expiredRequests) {
            request.setStatus(ReplayRequestStatus.EXPIRED);
            replayRequestRepository.save(request);
        }
        log.info("Expired {} pending requests", expiredRequests.size());
    }
}

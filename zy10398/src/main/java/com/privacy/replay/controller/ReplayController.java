package com.privacy.replay.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.privacy.replay.dto.ApiResponse;
import com.privacy.replay.dto.ApproveReplayRequest;
import com.privacy.replay.dto.CreateReplayRequest;
import com.privacy.replay.dto.ExecuteReplayRequest;
import com.privacy.replay.model.IdempotentRecord;
import com.privacy.replay.model.ReplayHistory;
import com.privacy.replay.model.ReplayRequest;
import com.privacy.replay.model.ReplayRequestStatus;
import com.privacy.replay.service.IdempotentService;
import com.privacy.replay.service.ReplayService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@RestController
@RequestMapping("/api/replay")
@RequiredArgsConstructor
public class ReplayController {

    private final ReplayService replayService;
    private final IdempotentService idempotentService;
    private final ObjectMapper objectMapper;

    @PostMapping("/request")
    public ApiResponse<ReplayRequest> createRequest(
            @Valid @RequestBody CreateReplayRequest request,
            HttpServletRequest httpRequest) {
        String requestKey = "create:" + request.getRequestId();

        Optional<IdempotentRecord> existing = idempotentService.checkDuplicate(requestKey);
        if (existing.isPresent()) {
            log.info("Duplicate request detected: {}", requestKey);
            try {
                return objectMapper.readValue(existing.get().getResponseBody(), ApiResponse.class);
            } catch (Exception e) {
                log.error("Deserialize cached response error", e);
            }
        }

        ReplayRequest result = replayService.createRequest(request);
        ApiResponse<ReplayRequest> response = ApiResponse.success(result);
        idempotentService.saveRecord(requestKey, "POST",
                null, response, 200);
        return response;
    }

    @PostMapping("/approve")
    public ApiResponse<ReplayRequest> approveRequest(
            @Valid @RequestBody ApproveReplayRequest request) {
        ReplayRequest result = replayService.approveRequest(request);
        return ApiResponse.success(result);
    }

    @PostMapping("/execute")
    public ApiResponse<Map<String, Object>> executeRequest(
            @Valid @RequestBody ExecuteReplayRequest request) {
        Map<String, Object> result = replayService.executeRequest(request.getRequestId());
        return ApiResponse.success(result);
    }

    @GetMapping("/request/{requestId}")
    public ApiResponse<ReplayRequest> getRequest(@PathVariable String requestId) {
        ReplayRequest result = replayService.getRequestByRequestId(requestId);
        return ApiResponse.success(result);
    }

    @GetMapping("/requests")
    public ApiResponse<List<ReplayRequest>> getRequests(
            @RequestParam String requesterId,
            @RequestParam(required = false) ReplayRequestStatus status) {
        List<ReplayRequest> result;
        if (status != null) {
            result = replayService.getRequestsByStatus(status);
        } else {
            result = replayService.getRequestsByRequesterId(requesterId);
        }
        return ApiResponse.success(result);
    }

    @GetMapping("/history")
    public ApiResponse<List<ReplayHistory>> getHistory(@RequestParam String requesterId) {
        List<ReplayHistory> result = replayService.getHistoryByRequesterId(requesterId);
        return ApiResponse.success(result);
    }
}

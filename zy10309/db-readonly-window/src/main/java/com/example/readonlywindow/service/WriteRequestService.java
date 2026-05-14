package com.example.readonlywindow.service;

import com.example.readonlywindow.dto.ApproveRequest;
import com.example.readonlywindow.dto.CreateWriteRequest;
import com.example.readonlywindow.dto.RejectRequest;
import com.example.readonlywindow.entity.*;
import com.example.readonlywindow.exception.BusinessException;
import com.example.readonlywindow.exception.ResourceNotFoundException;
import com.example.readonlywindow.repository.WriteRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class WriteRequestService {
    private final WriteRequestRepository requestRepository;
    private final FreezeWindowService windowService;
    private final TimelineService timelineService;

    @Transactional
    public WriteRequest createRequest(CreateWriteRequest request) {
        FreezeWindow window = windowService.getWindowByCode(request.getWindowCode());

        if (window.getStatus() != WindowStatus.ACTIVE) {
            throw new BusinessException("WINDOW_NOT_ACTIVE", "只有活跃状态的窗口才能提交写入请求");
        }

        // 重复提交校验：检查同窗口同资源同操作是否已有待处理或已批准的请求
        List<RequestStatus> activeStatuses = List.of(RequestStatus.PENDING, RequestStatus.APPROVED);
        String operationDetails = request.getOperationDetails() != null ? request.getOperationDetails() : "";

        boolean duplicateExists = requestRepository.existsByFreezeWindowIdAndResourceTypeAndResourceNameAndOperationDetailsAndStatusIn(
                window.getId(),
                request.getResourceType(),
                request.getResourceName(),
                operationDetails,
                activeStatuses
        );

        if (duplicateExists) {
            throw new BusinessException("DUPLICATE_REQUEST", "该资源已有相同的写入请求正在处理或已批准，请勿重复提交");
        }

        String requestCode;
        do {
            requestCode = "REQ-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        } while (requestRepository.existsByRequestCode(requestCode));

        WriteRequest writeRequest = new WriteRequest();
        writeRequest.setRequestCode(requestCode);
        writeRequest.setFreezeWindow(window);
        writeRequest.setRequester(request.getRequester());
        writeRequest.setResourceType(request.getResourceType());
        writeRequest.setResourceName(request.getResourceName());
        writeRequest.setOperationDetails(request.getOperationDetails());
        writeRequest.setJustification(request.getJustification());
        writeRequest.setStatus(RequestStatus.PENDING);
        writeRequest.setCreatedBy(request.getOperator());
        writeRequest.setCreatedAt(LocalDateTime.now());
        writeRequest.setUpdatedAt(LocalDateTime.now());

        WriteRequest savedRequest = requestRepository.save(writeRequest);

        timelineService.createEvent(
                EventType.WRITE_REQUESTED,
                window.getId(),
                savedRequest.getId(),
                null, null,
                request.getOperator(),
                "提交写入请求",
                "请求编码: " + requestCode + ", 资源: " + request.getResourceName()
        );

        return savedRequest;
    }

    @Transactional
    public WriteRequest approveRequest(ApproveRequest request) {
        WriteRequest writeRequest = getRequestByCode(request.getRequestCode());

        if (writeRequest.getStatus() != RequestStatus.PENDING) {
            throw new BusinessException("INVALID_STATUS", "只有待审批状态的请求才能批准");
        }

        writeRequest.setStatus(RequestStatus.APPROVED);
        writeRequest.setApprovedBy(request.getApprovedBy());
        writeRequest.setApprovedAt(LocalDateTime.now());
        writeRequest.setUpdatedAt(LocalDateTime.now());

        timelineService.createEvent(
                EventType.EXCEPTION_APPROVED,
                writeRequest.getFreezeWindow().getId(),
                writeRequest.getId(),
                null, null,
                request.getApprovedBy(),
                "批准写入请求",
                "备注: " + request.getNotes()
        );

        return requestRepository.save(writeRequest);
    }

    @Transactional
    public WriteRequest rejectRequest(RejectRequest request) {
        WriteRequest writeRequest = getRequestByCode(request.getRequestCode());

        if (writeRequest.getStatus() != RequestStatus.PENDING) {
            throw new BusinessException("INVALID_STATUS", "只有待审批状态的请求才能拒绝");
        }

        writeRequest.setStatus(RequestStatus.REJECTED);
        writeRequest.setRejectReason(request.getRejectReason());
        writeRequest.setUpdatedAt(LocalDateTime.now());

        timelineService.createEvent(
                EventType.EXCEPTION_REJECTED,
                writeRequest.getFreezeWindow().getId(),
                writeRequest.getId(),
                null, null,
                request.getRejectedBy(),
                "拒绝写入请求",
                "原因: " + request.getRejectReason()
        );

        return requestRepository.save(writeRequest);
    }

    public WriteRequest getRequestByCode(String requestCode) {
        return requestRepository.findByRequestCode(requestCode)
                .orElseThrow(() -> new ResourceNotFoundException("写入请求", requestCode));
    }

    public List<WriteRequest> getRequestsByWindow(String windowCode) {
        FreezeWindow window = windowService.getWindowByCode(windowCode);
        return requestRepository.findByFreezeWindowId(window.getId());
    }

    public List<WriteRequest> getPendingRequestsByWindow(String windowCode) {
        FreezeWindow window = windowService.getWindowByCode(windowCode);
        return requestRepository.findByFreezeWindowIdAndStatus(window.getId(), RequestStatus.PENDING);
    }

    public List<WriteRequest> getAllRequests() {
        return requestRepository.findAll();
    }
}

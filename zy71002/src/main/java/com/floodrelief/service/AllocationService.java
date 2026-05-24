package com.floodrelief.service;

import com.floodrelief.dto.*;
import com.floodrelief.entity.AllocationEvidence;
import com.floodrelief.entity.AllocationRecord;
import com.floodrelief.entity.MaterialBatch;
import com.floodrelief.entity.Shelter;
import com.floodrelief.entity.TransferRecord;
import com.floodrelief.repository.AllocationEvidenceRepository;
import com.floodrelief.repository.AllocationRecordRepository;
import com.floodrelief.repository.MaterialBatchRepository;
import com.floodrelief.repository.ShelterRepository;
import com.floodrelief.repository.TransferRecordRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
public class AllocationService {
    private static final Logger log = LoggerFactory.getLogger(AllocationService.class);
    
    private final AllocationRecordRepository allocationRepository;
    private final AllocationEvidenceRepository evidenceRepository;
    private final ShelterRepository shelterRepository;
    private final MaterialBatchRepository materialRepository;
    private final TransferRecordRepository transferRepository;

    public AllocationService(AllocationRecordRepository allocationRepository,
                             AllocationEvidenceRepository evidenceRepository,
                             ShelterRepository shelterRepository,
                             MaterialBatchRepository materialRepository,
                             TransferRecordRepository transferRepository) {
        this.allocationRepository = allocationRepository;
        this.evidenceRepository = evidenceRepository;
        this.shelterRepository = shelterRepository;
        this.materialRepository = materialRepository;
        this.transferRepository = transferRepository;
    }

    @Transactional
    public ApiResponse<AllocationRecord> createAllocation(AllocationRequest request) {
        Shelter shelter = shelterRepository.findById(request.getShelterId()).orElse(null);
        if (shelter == null) {
            return ApiResponse.error("安置点不存在");
        }

        MaterialBatch material = materialRepository.findById(request.getMaterialBatchId()).orElse(null);
        if (material == null) {
            return ApiResponse.error("物资批次不存在");
        }

        ApiResponse<String> duplicateCheck = checkDuplicateAllocation(
                request.getShelterId(), 
                request.getMaterialBatchId(), 
                request.getQuantity()
        );
        if (duplicateCheck.getCode() != 200) {
            log.warn("重复申领拦截: shelterId={}, materialId={}", request.getShelterId(), request.getMaterialBatchId());
            return ApiResponse.error(duplicateCheck.getCode(), duplicateCheck.getMessage());
        }

        TransferRecord latestTransfer = transferRepository.findLatestByShelterId(request.getShelterId()).orElse(null);
        if (latestTransfer != null) {
            ApiResponse<String> ratioCheck = checkAllocationRatio(request.getShelterId(), request.getMaterialBatchId(), request.getQuantity());
            if (ratioCheck.getCode() != 200) {
                log.info("配比预警: shelterId={}, materialId={}, message={}", 
                        request.getShelterId(), request.getMaterialBatchId(), ratioCheck.getMessage());
            }
        }

        AllocationRecord allocation = new AllocationRecord();
        allocation.setAllocationNo(generateAllocationNo());
        allocation.setShelterId(request.getShelterId());
        allocation.setMaterialBatchId(request.getMaterialBatchId());
        allocation.setQuantity(request.getQuantity());
        allocation.setUnit(material.getUnit());
        allocation.setStatus(AllocationRecord.AllocationStatus.PENDING);
        allocation.setApplicant(request.getApplicant());
        allocation = allocationRepository.save(allocation);

        log.info("创建调拨申请成功: allocationNo={}", allocation.getAllocationNo());
        return ApiResponse.success("调拨申请创建成功", allocation);
    }

    private ApiResponse<String> checkDuplicateAllocation(Long shelterId, Long materialBatchId, Integer quantity) {
        List<AllocationRecord> activeAllocations = allocationRepository.findActiveAllocations(shelterId, materialBatchId);
        
        if (!activeAllocations.isEmpty()) {
            int totalPending = activeAllocations.stream().mapToInt(AllocationRecord::getQuantity).sum();
            if (totalPending + quantity > 100) {
                return ApiResponse.error(409, 
                    String.format("存在未完成的同类型调拨申请，当前待发放数量: %d，请先完成现有调拨或申请人工复核", totalPending));
            }
        }
        return ApiResponse.success("OK", "OK");
    }

    private ApiResponse<String> checkAllocationRatio(Long shelterId, Long materialBatchId, Integer quantity) {
        TransferRecord latestTransfer = transferRepository.findLatestByShelterId(shelterId).orElse(null);
        if (latestTransfer == null) {
            return ApiResponse.success("OK", "OK");
        }

        MaterialBatch material = materialRepository.findById(materialBatchId).orElse(null);
        if (material == null) {
            return ApiResponse.success("OK", "OK");
        }

        int totalPeople = latestTransfer.getTotalCount();
        double ratio = (double) quantity / totalPeople;

        String materialType = material.getMaterialType();
        if ("FOOD".equals(materialType) && ratio > 5.0) {
            return ApiResponse.error(400, String.format("食品配给超过标准(每人5份)，当前配比: %.2f份/人", ratio));
        }
        if ("MEDICINE".equals(materialType) && ratio > 2.0) {
            return ApiResponse.error(400, String.format("药品配给超过标准(每人2份)，当前配比: %.2f份/人", ratio));
        }
        if ("WATER".equals(materialType) && ratio > 10.0) {
            return ApiResponse.error(400, String.format("饮用水配给超过标准(每人10瓶)，当前配比: %.2f瓶/人", ratio));
        }

        return ApiResponse.success("OK", "OK");
    }

    @Transactional
    public ApiResponse<AllocationRecord> approveAllocation(Long allocationId, AllocationApprovalRequest request) {
        AllocationRecord allocation = allocationRepository.findById(allocationId).orElse(null);
        if (allocation == null) {
            return ApiResponse.error("调拨记录不存在");
        }

        if (allocation.getStatus() != AllocationRecord.AllocationStatus.PENDING) {
            return ApiResponse.error("当前状态不允许审批");
        }

        if (request.getRejectReason() != null && !request.getRejectReason().isEmpty()) {
            allocation.setStatus(AllocationRecord.AllocationStatus.REJECTED);
            allocation.setRejectReason(request.getRejectReason());
            allocation.setApprover(request.getApprover());
            allocationRepository.save(allocation);
            log.info("驳回调拨申请: allocationNo={}, reason={}", allocation.getAllocationNo(), request.getRejectReason());
            return ApiResponse.success("调拨申请已驳回", allocation);
        }

        allocation.setStatus(AllocationRecord.AllocationStatus.APPROVED);
        allocation.setApprover(request.getApprover());
        allocationRepository.save(allocation);
        log.info("审批通过调拨申请: allocationNo={}", allocation.getAllocationNo());
        return ApiResponse.success("调拨申请已通过", allocation);
    }

    @Transactional
    public ApiResponse<AllocationRecord> dispatchAllocation(Long allocationId, AllocationDispatchRequest request) {
        AllocationRecord allocation = allocationRepository.findById(allocationId).orElse(null);
        if (allocation == null) {
            return ApiResponse.error("调拨记录不存在");
        }
        if (allocation.getStatus() != AllocationRecord.AllocationStatus.APPROVED) {
            return ApiResponse.error("当前状态不允许发货");
        }
        allocation.setStatus(AllocationRecord.AllocationStatus.DISPATCHED);
        allocation.setDispatcher(request.getDispatcher());
        allocation.setDispatchedAt(LocalDateTime.now());
        allocationRepository.save(allocation);
        log.info("物资已发货: allocationNo={}", allocation.getAllocationNo());
        return ApiResponse.success("物资已发货", allocation);
    }

    @Transactional
    public ApiResponse<AllocationRecord> receiveAllocation(Long allocationId, AllocationReceiveRequest request) {
        AllocationRecord allocation = allocationRepository.findById(allocationId).orElse(null);
        if (allocation == null) {
            return ApiResponse.error("调拨记录不存在");
        }
        if (allocation.getStatus() != AllocationRecord.AllocationStatus.DISPATCHED) {
            return ApiResponse.error("当前状态不允许签收");
        }
        allocation.setStatus(AllocationRecord.AllocationStatus.RECEIVED);
        allocation.setReceiver(request.getReceiver());
        allocation.setReceivedAt(LocalDateTime.now());
        allocation.setReceiptEvidence(request.getReceiptEvidence());
        allocationRepository.save(allocation);
        log.info("物资已签收: allocationNo={}, receiver={}", allocation.getAllocationNo(), request.getReceiver());
        return ApiResponse.success("物资已签收", allocation);
    }

    @Transactional
    public ApiResponse<AllocationRecord> withdrawAllocation(Long allocationId, AllocationWithdrawRequest request) {
        AllocationRecord allocation = allocationRepository.findById(allocationId).orElse(null);
        if (allocation == null) {
            return ApiResponse.error("调拨记录不存在");
        }
        if (allocation.getStatus() == AllocationRecord.AllocationStatus.RECEIVED ||
            allocation.getStatus() == AllocationRecord.AllocationStatus.CANCELLED) {
            return ApiResponse.error("当前状态不允许撤回");
        }
        allocation.setPreviousStatus(allocation.getStatus().name());
        allocation.setStatus(AllocationRecord.AllocationStatus.WITHDRAWN);
        allocation.setWithdrawReason(request.getWithdrawReason());
        allocationRepository.save(allocation);
        log.info("撤回调拨申请: allocationNo={}, reason={}", allocation.getAllocationNo(), request.getWithdrawReason());
        return ApiResponse.success("调拨已撤回", allocation);
    }

    @Transactional
    public ApiResponse<AllocationRecord> manualCorrectAllocation(Long allocationId, ManualCorrectionRequest request) {
        AllocationRecord allocation = allocationRepository.findById(allocationId).orElse(null);
        if (allocation == null) {
            return ApiResponse.error("调拨记录不存在");
        }
        allocation.setManualCorrection(true);
        allocation.setCorrectedBy(request.getCorrectedBy());
        if (request.getNewQuantity() != null) {
            allocation.setQuantity(request.getNewQuantity());
        }
        allocationRepository.save(allocation);
        log.info("人工修正调拨记录: allocationNo={}, correctedBy={}", allocation.getAllocationNo(), request.getCorrectedBy());
        return ApiResponse.success("人工修正完成", allocation);
    }

    public ApiResponse<AllocationEvidence> addEvidence(EvidenceUploadRequest request) {
        AllocationRecord allocation = allocationRepository.findById(request.getAllocationId()).orElse(null);
        if (allocation == null) {
            return ApiResponse.error("调拨记录不存在");
        }
        AllocationEvidence evidence = new AllocationEvidence();
        evidence.setAllocationId(request.getAllocationId());
        evidence.setEvidenceType(request.getEvidenceType());
        evidence.setEvidenceUrl(request.getEvidenceUrl());
        evidence.setDescription(request.getDescription());
        evidence.setUploader(request.getUploader());
        evidence = evidenceRepository.save(evidence);
        return ApiResponse.success("证据添加成功", evidence);
    }

    public ApiResponse<List<AllocationRecord>> getAllocationsByShelter(Long shelterId) {
        return ApiResponse.success(allocationRepository.findByShelterIdOrderByCreatedAtDesc(shelterId));
    }

    public ApiResponse<AllocationRecord> getAllocationById(Long id) {
        AllocationRecord allocation = allocationRepository.findById(id).orElse(null);
        if (allocation == null) {
            return ApiResponse.error("调拨记录不存在");
        }
        return ApiResponse.success(allocation);
    }

    public ApiResponse<List<AllocationEvidence>> getEvidencesByAllocation(Long allocationId) {
        List<AllocationEvidence> evidences = evidenceRepository.findByAllocationIdOrderByCreatedAtDesc(allocationId);
        return ApiResponse.success(evidences);
    }

    private String generateAllocationNo() {
        String date = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String uuid = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        return "AL" + date + uuid;
    }
}

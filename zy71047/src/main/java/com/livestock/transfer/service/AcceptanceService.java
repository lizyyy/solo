package com.livestock.transfer.service;

import com.livestock.transfer.common.TransferNoGenerator;
import com.livestock.transfer.dto.AcceptanceRequest;
import com.livestock.transfer.entity.*;
import com.livestock.transfer.enums.TransferStatus;
import com.livestock.transfer.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AcceptanceService {
    private static final Logger log = LoggerFactory.getLogger(AcceptanceService.class);
    
    private final AcceptanceRecordRepository acceptanceRepository;
    private final AcceptanceTagRepository acceptanceTagRepository;
    private final TransferOrderRepository transferOrderRepository;
    private final TransferEarTagRepository transferEarTagRepository;
    private final EarTagRepository earTagRepository;
    private final OperationLogRepository operationLogRepository;
    private final TransferNoGenerator noGenerator;

    public AcceptanceService(AcceptanceRecordRepository acceptanceRepository,
            AcceptanceTagRepository acceptanceTagRepository,
            TransferOrderRepository transferOrderRepository,
            TransferEarTagRepository transferEarTagRepository,
            EarTagRepository earTagRepository,
            OperationLogRepository operationLogRepository,
            TransferNoGenerator noGenerator) {
        this.acceptanceRepository = acceptanceRepository;
        this.acceptanceTagRepository = acceptanceTagRepository;
        this.transferOrderRepository = transferOrderRepository;
        this.transferEarTagRepository = transferEarTagRepository;
        this.earTagRepository = earTagRepository;
        this.operationLogRepository = operationLogRepository;
        this.noGenerator = noGenerator;
    }

    @Transactional
    public AcceptanceRecord createAcceptance(AcceptanceRequest request) {
        TransferOrder order = transferOrderRepository.findByTransferNo(request.getTransferNo())
                .orElseThrow(() -> new IllegalArgumentException("转场单不存在: " + request.getTransferNo()));

        if (order.getStatus() != TransferStatus.IN_TRANSIT) {
            throw new IllegalStateException("只有运输中的转场单可以验收");
        }

        order.setStatus(TransferStatus.ACCEPTING);
        transferOrderRepository.save(order);

        AcceptanceRecord acceptance = new AcceptanceRecord();
        acceptance.setAcceptanceNo(noGenerator.generateAcceptanceNo());
        acceptance.setTransferId(order.getId());
        acceptance.setAcceptanceTime(request.getAcceptanceTime() != null ? request.getAcceptanceTime() : LocalDateTime.now());
        acceptance.setAcceptedQuantity(request.getAcceptedTags().size());
        acceptance.setAcceptor(request.getAcceptor());
        acceptance.setRemark(request.getRemark());
        acceptance.setStatus("PROCESSING");
        acceptance = acceptanceRepository.save(acceptance);

        processAcceptanceTags(acceptance.getId(), order.getId(), request.getAcceptedTags());

        logOperation(order.getId(), request.getAcceptor(), "开始验收", "IN_TRANSIT", "ACCEPTING");

        return acceptance;
    }

    @Transactional
    public void processAcceptanceTags(Long acceptanceId, Long transferId, List<String> acceptedTags) {
        acceptanceTagRepository.deleteByAcceptanceId(acceptanceId);

        List<TransferEarTag> transferTags = transferEarTagRepository.findByTransferId(transferId);
        Map<String, TransferEarTag> transferTagMap = transferTags.stream()
                .collect(Collectors.toMap(TransferEarTag::getTagNo, t -> t));

        Set<String> acceptedTagSet = new HashSet<>(acceptedTags);
        Set<String> transferTagSet = transferTagMap.keySet();

        for (String tagNo : acceptedTags) {
            AcceptanceTag acceptanceTag = new AcceptanceTag();
            acceptanceTag.setAcceptanceId(acceptanceId);
            acceptanceTag.setTagNo(tagNo);

            TransferEarTag transferTag = transferTagMap.get(tagNo);
            if (transferTag != null) {
                acceptanceTag.setTransferEarTagId(transferTag.getId());
                acceptanceTag.setIsMatched(true);
                acceptanceTag.setIsExtra(false);
            } else {
                acceptanceTag.setIsMatched(false);
                acceptanceTag.setIsExtra(true);
            }
            acceptanceTagRepository.save(acceptanceTag);
        }

        for (String tagNo : transferTagSet) {
            if (!acceptedTagSet.contains(tagNo)) {
                AcceptanceTag missingTag = new AcceptanceTag();
                missingTag.setAcceptanceId(acceptanceId);
                missingTag.setTagNo(tagNo);
                missingTag.setTransferEarTagId(transferTagMap.get(tagNo).getId());
                missingTag.setIsMatched(false);
                missingTag.setIsMissing(true);
                acceptanceTagRepository.save(missingTag);
            }
        }
    }

    @Transactional
    public AcceptanceRecord confirmAcceptance(Long acceptanceId, String differenceReason, String operator) {
        AcceptanceRecord acceptance = acceptanceRepository.findById(acceptanceId)
                .orElseThrow(() -> new IllegalArgumentException("验收记录不存在"));

        TransferOrder order = transferOrderRepository.findById(acceptance.getTransferId())
                .orElseThrow(() -> new IllegalArgumentException("转场单不存在"));

        List<AcceptanceTag> acceptanceTags = acceptanceTagRepository.findByAcceptanceId(acceptanceId);
        
        long matchedCount = acceptanceTags.stream().filter(AcceptanceTag::getIsMatched).count();
        long extraCount = acceptanceTags.stream().filter(AcceptanceTag::getIsExtra).count();
        long missingCount = acceptanceTags.stream().filter(AcceptanceTag::getIsMissing).count();

        int difference = acceptance.getAcceptedQuantity() - order.getPlannedQuantity();
        acceptance.setDifferenceQuantity(difference);
        acceptance.setDifferenceReason(differenceReason);

        if (missingCount > 0 || extraCount > 0) {
            acceptance.setStatus("DISPUTE");
            order.setStatus(TransferStatus.ACCEPTANCE_DISPUTE);
            logOperation(order.getId(), operator, "验收存在差异", null, 
                    "缺少: " + missingCount + ", 多余: " + extraCount);
        } else {
            acceptance.setStatus("ACCEPTED");
            order.setStatus(TransferStatus.ACCEPTED);
            order.setActualQuantity((int) matchedCount);
            logOperation(order.getId(), operator, "验收通过", "ACCEPTING", "ACCEPTED");

            updateEarTagFarms(order.getId(), order.getTargetFarmId());
        }

        acceptanceRepository.save(acceptance);
        transferOrderRepository.save(order);

        return acceptance;
    }

    @Transactional
    public AcceptanceRecord resolveAcceptanceDispute(Long acceptanceId, boolean acceptAsIs, 
            String resolutionNote, String operator) {
        AcceptanceRecord acceptance = acceptanceRepository.findById(acceptanceId)
                .orElseThrow(() -> new IllegalArgumentException("验收记录不存在"));

        TransferOrder order = transferOrderRepository.findById(acceptance.getTransferId())
                .orElseThrow(() -> new IllegalArgumentException("转场单不存在"));

        if (acceptAsIs) {
            acceptance.setStatus("ACCEPTED");
            order.setStatus(TransferStatus.MANUALLY_ADJUSTED);
            
            List<AcceptanceTag> acceptanceTags = acceptanceTagRepository.findByAcceptanceId(acceptanceId);
            long matchedCount = acceptanceTags.stream().filter(t -> t.getIsMatched() || t.getIsExtra()).count();
            order.setActualQuantity((int) matchedCount);

            updateEarTagFarms(order.getId(), order.getTargetFarmId());

            logOperation(order.getId(), operator, "人工确认验收", "ACCEPTANCE_DISPUTE", 
                    "MANUALLY_ADJUSTED - " + resolutionNote);
        } else {
            acceptance.setStatus("REJECTED");
            order.setStatus(TransferStatus.IN_TRANSIT);
            logOperation(order.getId(), operator, "驳回验收", "ACCEPTANCE_DISPUTE", "IN_TRANSIT");
        }

        acceptanceRepository.save(acceptance);
        transferOrderRepository.save(order);

        return acceptance;
    }

    private void updateEarTagFarms(Long transferId, Long targetFarmId) {
        List<TransferEarTag> transferTags = transferEarTagRepository.findByTransferId(transferId);
        for (TransferEarTag transferTag : transferTags) {
            if (transferTag.getEarTagId() != null && transferTag.getEarTagId() > 0) {
                earTagRepository.findById(transferTag.getEarTagId()).ifPresent(earTag -> {
                    earTag.setCurrentFarmId(targetFarmId);
                    earTagRepository.save(earTag);
                });
            }
        }
    }

    @Transactional
    public TransferOrder completeTransfer(Long transferId, String operator) {
        TransferOrder order = transferOrderRepository.findById(transferId)
                .orElseThrow(() -> new IllegalArgumentException("转场单不存在"));

        if (order.getStatus() != TransferStatus.ACCEPTED && order.getStatus() != TransferStatus.MANUALLY_ADJUSTED) {
            throw new IllegalStateException("只有验收通过或人工修正的转场单可以完成");
        }

        order.setStatus(TransferStatus.COMPLETED);
        order = transferOrderRepository.save(order);

        logOperation(transferId, operator, "完成转场", order.getStatus().name(), "COMPLETED");

        return order;
    }

    public List<AcceptanceTag> getAcceptanceTags(Long acceptanceId) {
        return acceptanceTagRepository.findByAcceptanceId(acceptanceId);
    }

    public List<AcceptanceRecord> getAcceptanceRecords(Long transferId) {
        return acceptanceRepository.findByTransferId(transferId);
    }

    private void logOperation(Long transferId, String operator, String operation, 
            String oldValue, String newValue) {
        OperationLog log = new OperationLog();
        log.setTransferId(transferId);
        log.setOperator(operator);
        log.setOperation(operation);
        log.setOldValue(oldValue);
        log.setNewValue(newValue);
        operationLogRepository.save(log);
    }
}

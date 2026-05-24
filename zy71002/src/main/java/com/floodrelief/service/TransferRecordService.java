package com.floodrelief.service;

import com.floodrelief.dto.ApiResponse;
import com.floodrelief.dto.ManualCorrectionRequest;
import com.floodrelief.dto.TransferRecordRequest;
import com.floodrelief.entity.TransferRecord;
import com.floodrelief.repository.ShelterRepository;
import com.floodrelief.repository.TransferRecordRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class TransferRecordService {
    private static final Logger log = LoggerFactory.getLogger(TransferRecordService.class);
    
    private final TransferRecordRepository transferRecordRepository;
    private final ShelterRepository shelterRepository;

    public TransferRecordService(TransferRecordRepository transferRecordRepository,
                                 ShelterRepository shelterRepository) {
        this.transferRecordRepository = transferRecordRepository;
        this.shelterRepository = shelterRepository;
    }

    public ApiResponse<List<TransferRecord>> getTransferRecords(Long shelterId) {
        List<TransferRecord> records = transferRecordRepository.findByShelterIdOrderByCreatedAtDesc(shelterId);
        return ApiResponse.success(records);
    }

    public ApiResponse<TransferRecord> getLatestTransferRecord(Long shelterId) {
        return transferRecordRepository.findLatestByShelterId(shelterId)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error("暂无转移人数记录"));
    }

    @Transactional
    public ApiResponse<TransferRecord> createTransferRecord(TransferRecordRequest request) {
        if (!shelterRepository.existsById(request.getShelterId())) {
            return ApiResponse.error("安置点不存在");
        }

        TransferRecord record = new TransferRecord();
        record.setShelterId(request.getShelterId());
        record.setTotalCount(request.getTotalCount());
        record.setElderlyCount(request.getElderlyCount());
        record.setChildrenCount(request.getChildrenCount());
        record.setDisabledCount(request.getDisabledCount());
        record.setReporter(request.getReporter());
        record.setRemark(request.getRemark());
        record = transferRecordRepository.save(record);

        log.info("创建转移人数记录: shelterId={}, totalCount={}", request.getShelterId(), request.getTotalCount());
        return ApiResponse.success("转移人数记录创建成功", record);
    }

    @Transactional
    public ApiResponse<TransferRecord> manualCorrectTransfer(Long recordId, ManualCorrectionRequest request) {
        TransferRecord record = transferRecordRepository.findById(recordId).orElse(null);
        if (record == null) {
            return ApiResponse.error("转移记录不存在");
        }

        record.setManualCorrection(true);
        record.setCorrectedBy(request.getCorrectedBy());
        if (request.getNewQuantity() != null) {
            record.setTotalCount(request.getNewQuantity());
        }
        String currentRemark = record.getRemark() != null ? record.getRemark() : "";
        record.setRemark(currentRemark + " | 人工修正原因: " + request.getReason());
        record = transferRecordRepository.save(record);

        log.info("人工修正转移记录: recordId={}, correctedBy={}", recordId, request.getCorrectedBy());
        return ApiResponse.success("人工修正完成", record);
    }
}

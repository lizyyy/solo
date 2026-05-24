package com.hazardous.waste.service;

import com.hazardous.waste.config.WasteStorageConfig;
import com.hazardous.waste.dto.ReviewDTO;
import com.hazardous.waste.dto.WasteRecordDTO;
import com.hazardous.waste.entity.StorageBucket;
import com.hazardous.waste.entity.TransferForm;
import com.hazardous.waste.entity.WasteRecord;
import com.hazardous.waste.enums.ErrorCode;
import com.hazardous.waste.enums.WasteStatus;
import com.hazardous.waste.exception.BusinessException;
import com.hazardous.waste.repository.StorageBucketRepository;
import com.hazardous.waste.repository.TransferFormRepository;
import com.hazardous.waste.repository.WasteRecordRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
public class WasteRecordService {

    private WasteRecordRepository wasteRecordRepository;
    private StorageBucketRepository storageBucketRepository;
    private TransferFormRepository transferFormRepository;
    private WasteStatusMachine statusMachine;
    private WasteValidationService validationService;
    private WasteStorageConfig storageConfig;

    @Transactional
    public WasteRecord submitRecord(WasteRecordDTO dto) {
        if (dto.getRecordNo() != null && !dto.getRecordNo().isBlank()) {
            validationService.validateDuplicateRecord(dto.getRecordNo());
        }

        WasteValidationService.ValidationResult validationResult = validationService.validateSubmission(dto);

        WasteRecord record = new WasteRecord();
        record.setRecordNo(dto.getRecordNo() != null ? dto.getRecordNo() : generateRecordNo());
        record.setCategory(dto.getCategory());
        record.setWasteName(dto.getWasteName());
        record.setWeight(dto.getWeight());
        record.setComponent(dto.getComponent());
        record.setHazardCharacteristics(dto.getHazardCharacteristics());
        record.setInTime(dto.getInTime() != null ? dto.getInTime() : LocalDateTime.now());
        record.setSubmitter(dto.getSubmitter());
        record.setDisposalReason("");
        record.setCheckResult("");

        if (dto.getBucketCode() != null && !dto.getBucketCode().isBlank()) {
            StorageBucket bucket = storageBucketRepository.findByBucketCode(dto.getBucketCode())
                    .orElseThrow(() -> new BusinessException(ErrorCode.MISSING_MATERIAL, "暂存桶不存在: " + dto.getBucketCode()));
            record.setBucket(bucket);
        }

        record.getOperationLogs().add(new WasteRecord.OperationLog(
                "提交记录",
                dto.getSubmitter(),
                "初始提交"
        ));

        if (!validationResult.isPassed()) {
            record.setStatus(WasteStatus.RETURNED);
            record.setReturnReason(validationResult.getErrorSummary());
            record.setDisposalReason("提交校验失败: " + validationResult.getErrorSummary());
            record.getOperationLogs().add(new WasteRecord.OperationLog(
                    "校验失败",
                    "SYSTEM",
                    validationResult.getErrorSummary()
            ));
            wasteRecordRepository.save(record);
            throw new BusinessException(ErrorCode.MISSING_MATERIAL, validationResult.getErrorSummary());
        }

        if (validationResult.getWarnings().size() > 0) {
            record.setCheckResult("警告: " + String.join("; ", validationResult.getWarnings()));
            record.setDisposalReason("需要复核: " + String.join("; ", validationResult.getWarnings()));
        }

        statusMachine.transition(record, WasteStatus.PENDING_REVIEW, dto.getSubmitter(), "提交审核");
        return wasteRecordRepository.save(record);
    }

    @Transactional
    public WasteRecord reviewRecord(ReviewDTO dto) {
        WasteRecord record = wasteRecordRepository.findByRecordNo(dto.getRecordNo())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "记录不存在: " + dto.getRecordNo()));

        if (!statusMachine.canReview(record.getStatus())) {
            throw new BusinessException(ErrorCode.INVALID_STATUS, "当前状态不允许审核: " + record.getStatus());
        }

        record.setReviewer(dto.getReviewer());
        record.setReviewTime(LocalDateTime.now());
        record.setReviewComment(dto.getComment());

        Boolean passed = dto.getPassed();
        if (passed == null) {
            passed = true;
        }

        if (passed) {
            statusMachine.transition(record, WasteStatus.REVIEW_PASSED, dto.getReviewer(),
                    dto.getComment() != null ? dto.getComment() : "审核通过");

            if (record.getBucket() != null) {
                statusMachine.transition(record, WasteStatus.STORING, dto.getReviewer(), "入库暂存");
            }
        } else {
            if (dto.getReturnReason() != null) {
                record.setReturnReason(dto.getReturnReason());
                record.setDisposalReason("审核退回: " + dto.getReturnReason());
            }
            statusMachine.transition(record, WasteStatus.RETURNED, dto.getReviewer(),
                    dto.getReturnReason() != null ? dto.getReturnReason() : "审核未通过");
        }

        return wasteRecordRepository.save(record);
    }

    @Transactional
    public WasteRecord resubmitRecord(WasteRecordDTO dto) {
        WasteRecord record = wasteRecordRepository.findByRecordNo(dto.getRecordNo())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "记录不存在: " + dto.getRecordNo()));

        if (record.getStatus() != WasteStatus.RETURNED) {
            throw new BusinessException(ErrorCode.INVALID_STATUS, "只有退回状态可以重新提交");
        }

        WasteValidationService.ValidationResult validationResult = validationService.validateSubmission(dto);

        record.setCategory(dto.getCategory());
        record.setWasteName(dto.getWasteName());
        record.setWeight(dto.getWeight());
        record.setComponent(dto.getComponent());
        record.setHazardCharacteristics(dto.getHazardCharacteristics());
        record.setResubmitCount(record.getResubmitCount() + 1);

        if (dto.getBucketCode() != null && !dto.getBucketCode().isBlank()) {
            StorageBucket bucket = storageBucketRepository.findByBucketCode(dto.getBucketCode())
                    .orElseThrow(() -> new BusinessException(ErrorCode.MISSING_MATERIAL, "暂存桶不存在: " + dto.getBucketCode()));
            record.setBucket(bucket);
        }

        record.getOperationLogs().add(new WasteRecord.OperationLog(
                "重新提交",
                dto.getSubmitter(),
                "第" + record.getResubmitCount() + "次重新提交"
        ));

        if (!validationResult.isPassed()) {
            record.setReturnReason(validationResult.getErrorSummary());
            record.getOperationLogs().add(new WasteRecord.OperationLog(
                    "校验失败",
                    "SYSTEM",
                    validationResult.getErrorSummary()
            ));
            wasteRecordRepository.save(record);
            throw new BusinessException(ErrorCode.MISSING_MATERIAL, validationResult.getErrorSummary());
        }

        statusMachine.transition(record, WasteStatus.PENDING_REVIEW, dto.getSubmitter(), "重新提交审核");
        return wasteRecordRepository.save(record);
    }

    @Transactional
    public WasteRecord assignBucket(String recordNo, String bucketCode, String operator) {
        WasteRecord record = wasteRecordRepository.findByRecordNo(recordNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "记录不存在: " + recordNo));

        if (record.getStatus() != WasteStatus.REVIEW_PASSED) {
            throw new BusinessException(ErrorCode.INVALID_STATUS, "只有审核通过状态可以分配暂存桶");
        }

        StorageBucket bucket = storageBucketRepository.findByBucketCode(bucketCode)
                .orElseThrow(() -> new BusinessException(ErrorCode.MISSING_MATERIAL, "暂存桶不存在: " + bucketCode));

        if (!bucket.getCategory().equals(record.getCategory())) {
            throw new BusinessException(ErrorCode.CATEGORY_MISMATCH,
                    String.format("暂存桶类别不匹配，桶类别: %s，废物类别: %s", bucket.getCategory(), record.getCategory()));
        }

        record.setBucket(bucket);
        record.getOperationLogs().add(new WasteRecord.OperationLog(
                "分配暂存桶",
                operator,
                "分配到桶: " + bucketCode
        ));

        statusMachine.transition(record, WasteStatus.STORING, operator, "入库暂存");
        return wasteRecordRepository.save(record);
    }

    @Transactional
    public WasteRecord markForTransfer(String recordNo, String transferFormNo, String operator) {
        WasteRecord record = wasteRecordRepository.findByRecordNo(recordNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "记录不存在: " + recordNo));

        if (!statusMachine.canTransfer(record.getStatus())) {
            throw new BusinessException(ErrorCode.INVALID_STATUS, "当前状态不允许转运: " + record.getStatus());
        }

        validationService.validateTransferFormUsage(transferFormNo);

        TransferForm transferForm = transferFormRepository.findByFormNo(transferFormNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.MISSING_MATERIAL, "转运单不存在: " + transferFormNo));
        transferForm.setIsUsed(true);
        transferForm.setTransferTime(LocalDateTime.now());
        transferForm.getWasteRecords().add(record);
        transferFormRepository.save(transferForm);

        record.setTransferFormNo(transferFormNo);
        record.getOperationLogs().add(new WasteRecord.OperationLog(
                "标记待转运",
                operator,
                "转运单号: " + transferFormNo + "，转运单已标记为已使用"
        ));

        statusMachine.transition(record, WasteStatus.PENDING_TRANSFER, operator, "准备转运");
        return wasteRecordRepository.save(record);
    }

    @Transactional
    public WasteRecord confirmTransfer(String recordNo, String receiver, String operator) {
        WasteRecord record = wasteRecordRepository.findByRecordNo(recordNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "记录不存在: " + recordNo));

        if (record.getStatus() != WasteStatus.PENDING_TRANSFER) {
            throw new BusinessException(ErrorCode.INVALID_STATUS, "只有待转运状态可以确认转运");
        }

        if (receiver == null || receiver.isBlank()) {
            throw new BusinessException(ErrorCode.MISSING_MATERIAL, "签收人不能为空");
        }

        record.setReceiver(receiver);
        record.setReceiveTime(LocalDateTime.now());
        record.setOutTime(LocalDateTime.now());
        record.getOperationLogs().add(new WasteRecord.OperationLog(
                "签收确认",
                operator,
                "签收人: " + receiver
        ));

        statusMachine.transition(record, WasteStatus.TRANSFERRED, operator, "已转运，签收人: " + receiver);
        return wasteRecordRepository.save(record);
    }

    @Transactional
    public WasteRecord confirmDisposal(String recordNo, String disposalResult, String operator) {
        WasteRecord record = wasteRecordRepository.findByRecordNo(recordNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "记录不存在: " + recordNo));

        if (record.getStatus() != WasteStatus.TRANSFERRED) {
            throw new BusinessException(ErrorCode.INVALID_STATUS, "只有已转运状态可以确认处置");
        }

        record.setDisposalReason(record.getDisposalReason() + " | 处置结果: " + disposalResult);
        record.getOperationLogs().add(new WasteRecord.OperationLog(
                "处置确认",
                operator,
                disposalResult
        ));

        statusMachine.transition(record, WasteStatus.DISPOSED, operator, "处置完成: " + disposalResult);
        return wasteRecordRepository.save(record);
    }

    @Transactional
    public WasteRecord returnRecord(String recordNo, String returnReason, String operator) {
        WasteRecord record = wasteRecordRepository.findByRecordNo(recordNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "记录不存在: " + recordNo));

        if (record.getStatus() == WasteStatus.PENDING_TRANSFER && record.getTransferFormNo() != null) {
            TransferForm transferForm = transferFormRepository.findByFormNo(record.getTransferFormNo())
                    .orElse(null);
            if (transferForm != null) {
                transferForm.setIsUsed(false);
                transferForm.setTransferTime(null);
                transferForm.getWasteRecords().remove(record);
                transferFormRepository.save(transferForm);
                record.getOperationLogs().add(new WasteRecord.OperationLog(
                        "释放转运单",
                        operator,
                        "因退回释放转运单: " + record.getTransferFormNo()
                ));
            }
        }

        record.setReturnReason(returnReason);
        record.setDisposalReason("退回补充: " + returnReason);
        record.getOperationLogs().add(new WasteRecord.OperationLog(
                "退回补充",
                operator,
                returnReason
        ));

        statusMachine.transition(record, WasteStatus.RETURNED, operator, returnReason);
        return wasteRecordRepository.save(record);
    }

    @Transactional
    public WasteRecord recalculateStatus(String recordNo, String operator) {
        WasteRecord record = wasteRecordRepository.findByRecordNo(recordNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "记录不存在: " + recordNo));

        boolean isOverdue = validationService.checkOverdue(record);

        if (isOverdue && record.getStatus() == WasteStatus.STORING) {
            record.setIsOverdue(true);
            record.setDisposalReason(record.getDisposalReason() + " | 超期告警: 暂存超过" + storageConfig.getMaxStorageDays() + "天");
            statusMachine.transition(record, WasteStatus.OVERDUE, operator, "超期暂存");
        } else if (!isOverdue && record.getStatus() == WasteStatus.OVERDUE) {
            record.setIsOverdue(false);
            statusMachine.transition(record, WasteStatus.STORING, operator, "状态重算后恢复正常");
        }

        record.getOperationLogs().add(new WasteRecord.OperationLog(
                "重新计算",
                operator,
                "当前暂存天数: " + record.getStorageDays() + "天"
        ));

        return wasteRecordRepository.save(record);
    }

    public WasteRecord getRecord(String recordNo) {
        return wasteRecordRepository.findByRecordNo(recordNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "记录不存在: " + recordNo));
    }

    public List<WasteRecord> getRecordsByStatus(WasteStatus status) {
        return wasteRecordRepository.findByStatus(status);
    }

    public List<WasteRecord> getAllRecords() {
        return wasteRecordRepository.findAll();
    }

    private String generateRecordNo() {
        String date = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String uuid = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        return "WF" + date + uuid;
    }
}

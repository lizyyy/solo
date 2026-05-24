package com.hazardous.waste.service;

import com.hazardous.waste.config.WasteStorageConfig;
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
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class WasteValidationService {

    private final WasteStorageConfig storageConfig;
    private final WasteRecordRepository wasteRecordRepository;
    private final StorageBucketRepository storageBucketRepository;
    private final TransferFormRepository transferFormRepository;

    public ValidationResult validateSubmission(WasteRecordDTO dto) {
        ValidationResult result = new ValidationResult();

        validateCategory(dto.getCategory(), result);
        validateRequiredFields(dto, result);
        validateBucketCategory(dto, result);

        return result;
    }

    private void validateCategory(String category, ValidationResult result) {
        if (category == null || category.isBlank()) {
            result.addError(ErrorCode.MISSING_MATERIAL, "危废类别不能为空");
            return;
        }

        if (storageConfig.getAllowedCategories() != null
                && !storageConfig.getAllowedCategories().contains(category)) {
            result.addError(ErrorCode.INVALID_CATEGORY, "不支持的危废类别: " + category);
        }
    }

    private void validateRequiredFields(WasteRecordDTO dto, ValidationResult result) {
        if (dto.getWasteName() == null || dto.getWasteName().isBlank()) {
            result.addError(ErrorCode.MISSING_MATERIAL, "危废名称不能为空");
        }
        if (dto.getWeight() == null || dto.getWeight() <= 0) {
            result.addError(ErrorCode.MISSING_MATERIAL, "重量必须大于0");
        }
    }

    private void validateBucketCategory(WasteRecordDTO dto, ValidationResult result) {
        if (dto.getBucketCode() == null || dto.getBucketCode().isBlank()) {
            return;
        }

        StorageBucket bucket = storageBucketRepository.findByBucketCode(dto.getBucketCode())
                .orElse(null);
        if (bucket == null) {
            result.addWarning("暂存桶不存在: " + dto.getBucketCode());
            return;
        }

        if (!bucket.getCategory().equals(dto.getCategory())) {
            result.addError(ErrorCode.BUCKET_MIXED,
                    String.format("暂存桶类别不匹配，桶类别: %s，废物类别: %s",
                            bucket.getCategory(), dto.getCategory()));
        }

        Double currentWeight = wasteRecordRepository.sumWeightByBucketIdAndStatusIn(
                bucket.getId(),
                List.of(WasteStatus.STORING, WasteStatus.OVERDUE, WasteStatus.PENDING_TRANSFER)
        );
        currentWeight = currentWeight != null ? currentWeight : 0;
        if (currentWeight + dto.getWeight() > bucket.getMaxCapacity()) {
            result.addError(ErrorCode.BUCKET_MIXED,
                    String.format("暂存桶容量不足，当前: %.2f，新增: %.2f，最大: %.2f",
                            currentWeight, dto.getWeight(), bucket.getMaxCapacity()));
        }
    }

    public void validateTransferFormUsage(String formNo) {
        if (formNo == null || formNo.isBlank()) {
            throw new BusinessException(ErrorCode.MISSING_MATERIAL, "转运单号不能为空");
        }

        TransferForm form = transferFormRepository.findByFormNo(formNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.MISSING_MATERIAL, "转运单不存在: " + formNo));

        if (form.getIsUsed()) {
            throw new BusinessException(ErrorCode.TRANSFER_FORM_USED, "转运单已被使用: " + formNo);
        }

        if (!form.getIsSigned()) {
            throw new BusinessException(ErrorCode.NEEDS_REVIEW, "转运单尚未签收");
        }
    }

    public boolean checkOverdue(WasteRecord record) {
        if (record.getInTime() == null) {
            return false;
        }
        long days = ChronoUnit.DAYS.between(record.getInTime(), LocalDateTime.now());
        record.setStorageDays((int) days);
        return days > storageConfig.getMaxStorageDays();
    }

    public void validateDuplicateRecord(String recordNo) {
        if (wasteRecordRepository.existsByRecordNo(recordNo)) {
            throw new BusinessException(ErrorCode.DUPLICATE_REQUEST, "记录编号已存在: " + recordNo);
        }
    }

    @lombok.Data
    public static class ValidationResult {
        private boolean passed = true;
        private boolean needsReview = false;
        private List<String> errors = new ArrayList<>();
        private List<String> warnings = new ArrayList<>();
        private List<ErrorCode> errorCodes = new ArrayList<>();

        public void addError(ErrorCode code, String message) {
            passed = false;
            errors.add(message);
            errorCodes.add(code);
            if (code == ErrorCode.NEEDS_REVIEW) {
                needsReview = true;
            }
        }

        public void addWarning(String message) {
            warnings.add(message);
        }

        public String getErrorSummary() {
            return String.join("; ", errors);
        }
    }
}

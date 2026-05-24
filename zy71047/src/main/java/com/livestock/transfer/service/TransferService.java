package com.livestock.transfer.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.livestock.transfer.common.TransferNoGenerator;
import com.livestock.transfer.dto.TransferCreateRequest;
import com.livestock.transfer.dto.TransferDetailVO;
import com.livestock.transfer.entity.*;
import com.livestock.transfer.enums.TransferStatus;
import com.livestock.transfer.enums.ValidationResult;
import com.livestock.transfer.enums.ValidationType;
import com.livestock.transfer.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class TransferService {
    private static final Logger log = LoggerFactory.getLogger(TransferService.class);
    
    private final TransferOrderRepository transferOrderRepository;
    private final TransferEarTagRepository transferEarTagRepository;
    private final TransferValidationRepository validationRepository;
    private final FarmRepository farmRepository;
    private final EarTagRepository earTagRepository;
    private final QuarantineCertificateRepository certificateRepository;
    private final TransportVehicleRepository vehicleRepository;
    private final OperationLogRepository operationLogRepository;
    private final TransferNoGenerator noGenerator;
    private final ObjectMapper objectMapper;

    public TransferService(TransferOrderRepository transferOrderRepository,
            TransferEarTagRepository transferEarTagRepository,
            TransferValidationRepository validationRepository,
            FarmRepository farmRepository,
            EarTagRepository earTagRepository,
            QuarantineCertificateRepository certificateRepository,
            TransportVehicleRepository vehicleRepository,
            OperationLogRepository operationLogRepository,
            TransferNoGenerator noGenerator,
            ObjectMapper objectMapper) {
        this.transferOrderRepository = transferOrderRepository;
        this.transferEarTagRepository = transferEarTagRepository;
        this.validationRepository = validationRepository;
        this.farmRepository = farmRepository;
        this.earTagRepository = earTagRepository;
        this.certificateRepository = certificateRepository;
        this.vehicleRepository = vehicleRepository;
        this.operationLogRepository = operationLogRepository;
        this.noGenerator = noGenerator;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public TransferOrder createTransfer(TransferCreateRequest request) {
        Farm sourceFarm = farmRepository.findByFarmCode(request.getSourceFarmCode())
                .orElseThrow(() -> new IllegalArgumentException("源牧场不存在: " + request.getSourceFarmCode()));
        Farm targetFarm = farmRepository.findByFarmCode(request.getTargetFarmCode())
                .orElseThrow(() -> new IllegalArgumentException("目标牧场不存在: " + request.getTargetFarmCode()));

        TransferOrder order = new TransferOrder();
        order.setTransferNo(noGenerator.generateTransferNo());
        order.setSourceFarmId(sourceFarm.getId());
        order.setTargetFarmId(targetFarm.getId());
        order.setPlannedQuantity(request.getPlannedQuantity());
        order.setTransferDate(request.getTransferDate());
        order.setRemark(request.getRemark());
        order.setCreatedBy(request.getOperator());
        order.setStatus(TransferStatus.DRAFT);

        if (request.getCertificateNo() != null) {
            QuarantineCertificate cert = certificateRepository.findByCertificateNo(request.getCertificateNo())
                    .orElseThrow(() -> new IllegalArgumentException("检疫证不存在: " + request.getCertificateNo()));
            order.setCertificateId(cert.getId());
        }

        if (request.getVehiclePlateNo() != null) {
            TransportVehicle vehicle = vehicleRepository.findByPlateNo(request.getVehiclePlateNo())
                    .orElseThrow(() -> new IllegalArgumentException("运输车不存在: " + request.getVehiclePlateNo()));
            order.setVehicleId(vehicle.getId());
        }

        order = transferOrderRepository.save(order);

        if (request.getEarTags() != null && !request.getEarTags().isEmpty()) {
            saveEarTags(order.getId(), request.getEarTags());
        }

        logOperation(order.getId(), request.getOperator(), "创建转场单", null, objectMapper.valueToTree(order).toString());

        return order;
    }

    @Transactional
    public void saveEarTags(Long transferId, List<String> tagNos) {
        transferEarTagRepository.deleteByTransferId(transferId);

        Set<String> uniqueTags = new HashSet<>(tagNos);
        Map<String, Long> earTagIdMap = earTagRepository.findByTagNoIn(new ArrayList<>(uniqueTags))
                .stream()
                .collect(Collectors.toMap(EarTag::getTagNo, EarTag::getId));

        for (String tagNo : uniqueTags) {
            TransferEarTag transferEarTag = new TransferEarTag();
            transferEarTag.setTransferId(transferId);
            transferEarTag.setTagNo(tagNo);
            transferEarTag.setEarTagId(earTagIdMap.getOrDefault(tagNo, 0L));
            transferEarTagRepository.save(transferEarTag);
        }
    }

    @Transactional
    public List<TransferValidation> validateTransfer(Long transferId) {
        TransferOrder order = transferOrderRepository.findById(transferId)
                .orElseThrow(() -> new IllegalArgumentException("转场单不存在"));

        validationRepository.deleteByTransferId(transferId);
        List<TransferValidation> validations = new ArrayList<>();

        validations.addAll(validateSourceAndTarget(order));
        validations.addAll(validateEarTags(order));
        validations.addAll(validateQuarantineCertificate(order));
        validations.addAll(validateVehicle(order));
        validations.addAll(validateQuantityMatch(order));

        boolean hasFailed = validations.stream()
                .anyMatch(v -> v.getValidationResult() == ValidationResult.FAIL);

        if (hasFailed) {
            order.setStatus(TransferStatus.VALIDATION_FAILED);
        } else {
            order.setStatus(TransferStatus.APPROVED);
        }
        transferOrderRepository.save(order);

        logOperation(transferId, "SYSTEM", "执行校验", null, 
                "校验结果: " + (hasFailed ? "失败" : "通过") + ", 问题数: " + validations.size());

        return validations;
    }

    private List<TransferValidation> validateSourceAndTarget(TransferOrder order) {
        List<TransferValidation> results = new ArrayList<>();
        if (order.getSourceFarmId().equals(order.getTargetFarmId())) {
            results.add(createValidation(
                    order.getId(),
                    ValidationType.SOURCE_TARGET_SAME,
                    ValidationResult.FAIL,
                    "源牧场和目标牧场不能相同",
                    "请重新选择不同的目标牧场"
            ));
        }
        return results;
    }

    private List<TransferValidation> validateEarTags(TransferOrder order) {
        List<TransferValidation> results = new ArrayList<>();
        List<TransferEarTag> earTags = transferEarTagRepository.findByTransferId(order.getId());

        Set<String> tagSet = new HashSet<>();
        Set<String> duplicateInOrder = new HashSet<>();
        List<String> duplicateAcrossOrders = new ArrayList<>();

        for (TransferEarTag tag : earTags) {
            if (!tagSet.add(tag.getTagNo())) {
                duplicateInOrder.add(tag.getTagNo());
            }

            List<TransferEarTag> crossDuplicates = transferEarTagRepository
                    .findByTagNoExcludeTransfer(tag.getTagNo(), order.getId());
            if (!crossDuplicates.isEmpty()) {
                duplicateAcrossOrders.add(tag.getTagNo());
            }
        }

        for (TransferEarTag tag : earTags) {
            boolean isDupInOrder = duplicateInOrder.contains(tag.getTagNo());
            boolean isDupAcross = duplicateAcrossOrders.contains(tag.getTagNo());
            tag.setDuplicateWithinOrder(isDupInOrder);
            tag.setDuplicateAcrossOrder(isDupAcross);
            tag.setIsDuplicate(isDupInOrder || isDupAcross);
            transferEarTagRepository.save(tag);
        }

        if (!duplicateInOrder.isEmpty()) {
            results.add(createValidation(
                    order.getId(),
                    ValidationType.EAR_TAG_DUPLICATE_IN_ORDER,
                    ValidationResult.FAIL,
                    "单内耳标重复: " + String.join(", ", duplicateInOrder),
                    "请移除重复的耳标，保留唯一值"
            ));
        }

        if (!duplicateAcrossOrders.isEmpty()) {
            results.add(createValidation(
                    order.getId(),
                    ValidationType.EAR_TAG_DUPLICATE_ACROSS_ORDERS,
                    ValidationResult.WARN,
                    "跨单耳标重复: " + String.join(", ", duplicateAcrossOrders),
                    "请确认这些耳标是否正在其他转场单中流转"
            ));
        }

        return results;
    }

    private List<TransferValidation> validateQuarantineCertificate(TransferOrder order) {
        List<TransferValidation> results = new ArrayList<>();
        if (order.getCertificateId() == null) {
            return results;
        }

        QuarantineCertificate cert = certificateRepository.findById(order.getCertificateId()).orElse(null);
        if (cert == null) {
            results.add(createValidation(
                    order.getId(),
                    ValidationType.QUARANTINE_CERT_INVALID,
                    ValidationResult.FAIL,
                    "检疫证不存在或已被删除",
                    "请重新选择有效的检疫证"
            ));
            return results;
        }

        if (cert.isExpired()) {
            results.add(createValidation(
                    order.getId(),
                    ValidationType.QUARANTINE_CERT_EXPIRED,
                    ValidationResult.FAIL,
                    "检疫证已过期，到期日: " + cert.getExpireDate(),
                    "请办理新的检疫证明"
            ));
        }

        if (cert.getCattleCount() < order.getPlannedQuantity()) {
            results.add(createValidation(
                    order.getId(),
                    ValidationType.QUARANTINE_CERT_COUNT_MISMATCH,
                    ValidationResult.WARN,
                    "检疫证数量不足: 证载" + cert.getCattleCount() + "头，计划转场" + order.getPlannedQuantity() + "头",
                    "请确认是否需要分批次转场或更新检疫证"
            ));
        }

        return results;
    }

    private List<TransferValidation> validateVehicle(TransferOrder order) {
        List<TransferValidation> results = new ArrayList<>();
        if (order.getVehicleId() == null) {
            return results;
        }

        TransportVehicle vehicle = vehicleRepository.findById(order.getVehicleId()).orElse(null);
        if (vehicle == null || !"AVAILABLE".equals(vehicle.getStatus())) {
            results.add(createValidation(
                    order.getId(),
                    ValidationType.VEHICLE_UNAVAILABLE,
                    ValidationResult.FAIL,
                    "运输车不可用，当前状态: " + (vehicle != null ? vehicle.getStatus() : "不存在"),
                    "请选择可用的运输车"
            ));
        }

        return results;
    }

    private List<TransferValidation> validateQuantityMatch(TransferOrder order) {
        List<TransferValidation> results = new ArrayList<>();
        List<TransferEarTag> earTags = transferEarTagRepository.findByTransferId(order.getId());

        if (earTags.size() > 0 && earTags.size() != order.getPlannedQuantity()) {
            results.add(createValidation(
                    order.getId(),
                    ValidationType.TAG_COUNT_MISMATCH,
                    ValidationResult.WARN,
                    "耳标数量与计划数量不匹配: 耳标" + earTags.size() + "个，计划" + order.getPlannedQuantity() + "头",
                    "请确认耳标清单是否完整"
            ));
        }

        return results;
    }

    private TransferValidation createValidation(Long transferId, ValidationType type, 
            ValidationResult result, String message, String suggestion) {
        TransferValidation validation = new TransferValidation();
        validation.setTransferId(transferId);
        validation.setValidationType(type);
        validation.setValidationResult(result);
        validation.setMessage(message);
        validation.setSuggestion(suggestion);
        return validationRepository.save(validation);
    }

    @Transactional
    public TransferOrder submitTransfer(Long transferId, String operator) {
        TransferOrder order = transferOrderRepository.findById(transferId)
                .orElseThrow(() -> new IllegalArgumentException("转场单不存在"));

        if (order.getStatus() != TransferStatus.DRAFT) {
            throw new IllegalStateException("只有草稿状态的转场单可以提交");
        }

        order.setStatus(TransferStatus.SUBMITTED);
        order = transferOrderRepository.save(order);

        logOperation(transferId, operator, "提交转场单", "DRAFT", "SUBMITTED");

        validateTransfer(transferId);

        return order;
    }

    @Transactional
    public TransferOrder approveTransfer(Long transferId, String operator) {
        TransferOrder order = transferOrderRepository.findById(transferId)
                .orElseThrow(() -> new IllegalArgumentException("转场单不存在"));

        List<TransferValidation> unresolved = validationRepository
                .findByTransferIdAndIsResolved(transferId, false);

        if (unresolved.stream().anyMatch(v -> v.getValidationResult() == ValidationResult.FAIL)) {
            throw new IllegalStateException("存在未解决的校验失败项，无法核准");
        }

        order.setStatus(TransferStatus.APPROVED);
        order = transferOrderRepository.save(order);

        logOperation(transferId, operator, "核准转场单", order.getStatus().name(), "APPROVED");

        return order;
    }

    @Transactional
    public TransferOrder startTransport(Long transferId, String operator) {
        TransferOrder order = transferOrderRepository.findById(transferId)
                .orElseThrow(() -> new IllegalArgumentException("转场单不存在"));

        if (order.getStatus() != TransferStatus.APPROVED) {
            throw new IllegalStateException("只有核准状态的转场单可以开始运输");
        }

        order.setStatus(TransferStatus.IN_TRANSIT);
        order = transferOrderRepository.save(order);

        logOperation(transferId, operator, "开始运输", "APPROVED", "IN_TRANSIT");

        return order;
    }

    @Transactional
    public TransferOrder cancelTransfer(Long transferId, String operator, String reason) {
        TransferOrder order = transferOrderRepository.findById(transferId)
                .orElseThrow(() -> new IllegalArgumentException("转场单不存在"));

        if (order.getStatus() == TransferStatus.COMPLETED) {
            throw new IllegalStateException("已完成的转场单不能撤回");
        }

        TransferStatus oldStatus = order.getStatus();
        order.setStatus(TransferStatus.CANCELLED);
        order = transferOrderRepository.save(order);

        logOperation(transferId, operator, "撤回转场单", oldStatus.name(), "CANCELLED", reason);

        return order;
    }

    @Transactional
    public void resolveValidation(Long validationId, String resolvedBy, String resolutionNote) {
        TransferValidation validation = validationRepository.findById(validationId)
                .orElseThrow(() -> new IllegalArgumentException("校验记录不存在"));

        validation.setIsResolved(true);
        validation.setResolvedBy(resolvedBy);
        validation.setResolutionNote(resolutionNote);
        validation.setResolvedAt(java.time.LocalDateTime.now());
        validationRepository.save(validation);

        logOperation(validation.getTransferId(), resolvedBy, "解决校验问题", 
                validation.getValidationType().name(), resolutionNote);
    }

    public TransferDetailVO getTransferDetail(Long transferId) {
        TransferOrder order = transferOrderRepository.findById(transferId)
                .orElseThrow(() -> new IllegalArgumentException("转场单不存在"));

        TransferDetailVO vo = new TransferDetailVO();
        vo.setId(order.getId());
        vo.setTransferNo(order.getTransferNo());
        vo.setSourceFarm(farmRepository.findById(order.getSourceFarmId()).orElse(null));
        vo.setTargetFarm(farmRepository.findById(order.getTargetFarmId()).orElse(null));
        vo.setCertificate(order.getCertificateId() != null ? 
                certificateRepository.findById(order.getCertificateId()).orElse(null) : null);
        vo.setVehicle(order.getVehicleId() != null ? 
                vehicleRepository.findById(order.getVehicleId()).orElse(null) : null);
        vo.setPlannedQuantity(order.getPlannedQuantity());
        vo.setActualQuantity(order.getActualQuantity());
        vo.setTransferDate(order.getTransferDate());
        vo.setStatus(order.getStatus());
        vo.setRemark(order.getRemark());
        vo.setCreatedAt(order.getCreatedAt());
        vo.setCreatedBy(order.getCreatedBy());

        vo.setEarTags(transferEarTagRepository.findByTransferId(transferId));
        vo.setValidations(validationRepository.findByTransferId(transferId));
        vo.setAcceptanceRecords(null);
        vo.setOperationLogs(operationLogRepository.findByTransferIdOrderByCreatedAtDesc(transferId));

        return vo;
    }

    private void logOperation(Long transferId, String operator, String operation, 
            String oldValue, String newValue) {
        logOperation(transferId, operator, operation, oldValue, newValue, null);
    }

    private void logOperation(Long transferId, String operator, String operation, 
            String oldValue, String newValue, String remark) {
        OperationLog log = new OperationLog();
        log.setTransferId(transferId);
        log.setOperator(operator);
        log.setOperation(operation);
        log.setOldValue(oldValue);
        log.setNewValue(newValue);
        log.setRemark(remark);
        operationLogRepository.save(log);
    }

    public List<TransferOrder> getAllTransfers() {
        return transferOrderRepository.findAll();
    }
}

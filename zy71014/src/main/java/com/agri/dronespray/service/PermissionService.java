package com.agri.dronespray.service;

import com.agri.dronespray.entity.*;
import com.agri.dronespray.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
public class PermissionService {

    @Autowired
    private PermissionRepository permissionRepository;

    @Autowired
    private PlotRepository plotRepository;

    @Autowired
    private DroneRepository droneRepository;

    @Autowired
    private PesticideBatchRepository pesticideBatchRepository;

    @Autowired
    private WeatherWindowRepository weatherWindowRepository;

    @Autowired
    private PilotRepository pilotRepository;

    @Autowired
    private ValidationService validationService;

    @Autowired
    private StatusMachineService statusMachineService;

    @Autowired
    private AmendmentHistoryRepository amendmentHistoryRepository;

    @Autowired
    private OperationReportRepository operationReportRepository;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd");

    @Transactional
    public Permission createPermission(Permission permission, String creator) {
        String permissionNo = generatePermissionNo();
        permission.setPermissionNo(permissionNo);
        permission.setCreatedBy(creator);
        permission.setStatus(PermissionStatus.DRAFT);

        ProcessingRecord record = new ProcessingRecord();
        record.setFromStatus(null);
        record.setToStatus(PermissionStatus.DRAFT);
        record.setAction("创建许可申请");
        record.setProcessedBy(creator);
        permission.addProcessingRecord(record);

        return permissionRepository.save(permission);
    }

    @Transactional
    public Permission submitPermission(Long permissionId, String operator) {
        Permission permission = permissionRepository.findById(permissionId)
                .orElseThrow(() -> new IllegalArgumentException("许可不存在"));

        ProcessingRecord transitionRecord = statusMachineService.transition(
                permission, PermissionStatus.SUBMITTED, "提交许可申请", null, operator);
        permission.addProcessingRecord(transitionRecord);

        permission = permissionRepository.save(permission);

        return performSystemCheck(permissionId, operator);
    }

    @Transactional
    public Permission performSystemCheck(Long permissionId, String operator) {
        Permission permission = permissionRepository.findById(permissionId)
                .orElseThrow(() -> new IllegalArgumentException("许可不存在"));

        ProcessingRecord checkingRecord = statusMachineService.transition(
                permission, PermissionStatus.SYSTEM_CHECKING, "开始系统校验", null, operator);
        permission.addProcessingRecord(checkingRecord);

        List<CheckRecord> checkRecords = validationService.validatePermission(permission);
        for (CheckRecord record : checkRecords) {
            permission.addCheckRecord(record);
        }

        PermissionStatus nextStatus;
        String action;
        String remark;

        if (validationService.hasSystemRejection(checkRecords)) {
            nextStatus = PermissionStatus.SYSTEM_REJECTED;
            action = "系统校验驳回";
            remark = "存在校验不通过项，请修正后重新提交";
        } else if (validationService.needsManualReview(checkRecords)) {
            nextStatus = PermissionStatus.SYSTEM_APPROVED;
            action = "系统校验通过";
            remark = "存在需要人工复核的项，请复核人员审核";
        } else {
            nextStatus = PermissionStatus.SYSTEM_APPROVED;
            action = "系统校验通过";
            remark = "全部校验通过，请进行人工复核";
        }

        ProcessingRecord resultRecord = statusMachineService.transition(
                permission, nextStatus, action, remark, "SYSTEM");
        permission.addProcessingRecord(resultRecord);

        return permissionRepository.save(permission);
    }

    @Transactional
    public Permission startManualReview(Long permissionId, String reviewer) {
        Permission permission = permissionRepository.findById(permissionId)
                .orElseThrow(() -> new IllegalArgumentException("许可不存在"));

        ProcessingRecord record = statusMachineService.transition(
                permission, PermissionStatus.MANUAL_REVIEWING,
                "开始人工复核", "复核人：" + reviewer, reviewer);
        permission.addProcessingRecord(record);

        return permissionRepository.save(permission);
    }

    @Transactional
    public Permission approvePermission(Long permissionId, String conclusion, String remark, String approver) {
        Permission permission = permissionRepository.findById(permissionId)
                .orElseThrow(() -> new IllegalArgumentException("许可不存在"));

        ProcessingRecord record = statusMachineService.transition(
                permission, PermissionStatus.APPROVED, "审批通过", remark, approver);
        permission.addProcessingRecord(record);

        permission.setFinalConclusion(conclusion);
        permission.setConclusionRemark(remark);
        permission.setConcludedAt(LocalDateTime.now());
        permission.setConcludedBy(approver);

        return permissionRepository.save(permission);
    }

    @Transactional
    public Permission rejectPermission(Long permissionId, String reason, String rejector) {
        Permission permission = permissionRepository.findById(permissionId)
                .orElseThrow(() -> new IllegalArgumentException("许可不存在"));

        ProcessingRecord record = statusMachineService.transition(
                permission, PermissionStatus.REJECTED, "审批驳回", reason, rejector);
        permission.addProcessingRecord(record);

        permission.setFinalConclusion("驳回");
        permission.setConclusionRemark(reason);
        permission.setConcludedAt(LocalDateTime.now());
        permission.setConcludedBy(rejector);

        return permissionRepository.save(permission);
    }

    @Transactional
    public Permission amendPermission(Long permissionId, String oldConclusion, String newConclusion,
                                       String reason, String amendedField, String amender) {
        Permission permission = permissionRepository.findById(permissionId)
                .orElseThrow(() -> new IllegalArgumentException("许可不存在"));

        AmendmentHistory history = new AmendmentHistory();
        history.setOldConclusion(oldConclusion);
        history.setNewConclusion(newConclusion);
        history.setAmendmentReason(reason);
        history.setAmendedField(amendedField);
        history.setAmendedBy(amender);
        permission.addAmendmentHistory(history);

        if (permission.getStatus() == PermissionStatus.REJECTED) {
            ProcessingRecord record = statusMachineService.transition(
                    permission, PermissionStatus.AMENDED, "人工修正后重新生效", reason, amender);
            permission.addProcessingRecord(record);
        }

        permission.setFinalConclusion(newConclusion);
        permission.setConclusionRemark(reason);
        permission.setConcludedAt(LocalDateTime.now());
        permission.setConcludedBy(amender);

        return permissionRepository.save(permission);
    }

    @Transactional
    public Permission cancelPermission(Long permissionId, String reason, String operator) {
        Permission permission = permissionRepository.findById(permissionId)
                .orElseThrow(() -> new IllegalArgumentException("许可不存在"));

        ProcessingRecord record = statusMachineService.transition(
                permission, PermissionStatus.CANCELLED, "取消申请", reason, operator);
        permission.addProcessingRecord(record);

        return permissionRepository.save(permission);
    }

    @Transactional
    public Permission completePermission(Long permissionId, OperationReport report, String operator) {
        Permission permission = permissionRepository.findById(permissionId)
                .orElseThrow(() -> new IllegalArgumentException("许可不存在"));

        ProcessingRecord record = statusMachineService.transition(
                permission, PermissionStatus.COMPLETED, "作业完成", "已提交作业报告", operator);
        permission.addProcessingRecord(record);

        report.setReportNo(generateReportNo());
        report.setPermission(permission);
        report.setCreatedBy(operator);
        permission.setOperationReport(report);

        return permissionRepository.save(permission);
    }

    public Permission getPermission(Long id) {
        return permissionRepository.findById(id).orElse(null);
    }

    public Permission getPermissionByNo(String permissionNo) {
        return permissionRepository.findByPermissionNo(permissionNo).orElse(null);
    }

    public List<Permission> getAllPermissions() {
        return permissionRepository.findAll();
    }

    public List<Permission> getPermissionsByStatus(PermissionStatus status) {
        return permissionRepository.findByStatus(status);
    }

    public List<ProcessingRecord> getProcessingHistory(Long permissionId) {
        return permissionRepository.findById(permissionId)
                .map(Permission::getProcessingRecords)
                .orElse(List.of());
    }

    public List<AmendmentHistory> getAmendmentHistory(Long permissionId) {
        return amendmentHistoryRepository.findByPermissionIdOrderByAmendedAtDesc(permissionId);
    }

    public List<CheckRecord> getCheckRecords(Long permissionId) {
        return permissionRepository.findById(permissionId)
                .map(Permission::getCheckRecords)
                .orElse(List.of());
    }

    private String generatePermissionNo() {
        String date = LocalDateTime.now().format(DATE_FORMATTER);
        String uuid = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        return "XK-" + date + "-" + uuid;
    }

    private String generateReportNo() {
        String date = LocalDateTime.now().format(DATE_FORMATTER);
        String uuid = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        return "BG-" + date + "-" + uuid;
    }
}

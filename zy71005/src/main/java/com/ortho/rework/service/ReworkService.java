package com.ortho.rework.service;

import com.ortho.rework.dto.*;
import com.ortho.rework.entity.*;
import com.ortho.rework.enums.OperationType;
import com.ortho.rework.enums.ReworkStatus;
import com.ortho.rework.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReworkService {
    private final ReworkOrderRepository reworkOrderRepository;
    private final PatientRepository patientRepository;
    private final ImpressionBatchRepository batchRepository;
    private final ExpressOrderRepository expressOrderRepository;
    private final ReworkReportRepository reportRepository;
    private final AuditLogRepository auditLogRepository;
    private final AuditService auditService;
    private final ReworkStateMachine stateMachine;

    @Value("${rework.confirmation.window-hours:48}")
    private int confirmationWindowHours;

    @Value("${rework.max-rework-count:3}")
    private int maxReworkCount;

    @Transactional
    public ApiResponse<ReworkDetailDTO> createRework(CreateReworkRequest request) {
        Patient patient = patientRepository.findByPatientNo(request.getPatientNo())
            .orElseGet(() -> {
                Patient p = new Patient();
                p.setPatientNo(request.getPatientNo());
                p.setName(request.getPatientName());
                p.setPhone(request.getPatientPhone());
                p.setDoctorName(request.getDoctorName());
                return patientRepository.save(p);
            });

        ImpressionBatch batch = batchRepository.findByBatchNo(request.getBatchNo())
            .orElseGet(() -> {
                ImpressionBatch b = new ImpressionBatch();
                b.setBatchNo(request.getBatchNo());
                b.setPatient(patient);
                b.setImpressionType(request.getImpressionType());
                b.setOriginalBatchNo(request.getBatchNo());
                return batchRepository.save(b);
            });

        List<ReworkOrder> activeReworks = reworkOrderRepository.findActiveReworkByBatchNo(request.getBatchNo());
        if (!activeReworks.isEmpty()) {
            String reworkNo = "RW-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
            ReworkOrder duplicateOrder = new ReworkOrder();
            duplicateOrder.setReworkNo(reworkNo);
            duplicateOrder.setBatch(batch);
            duplicateOrder.setPatient(patient);
            duplicateOrder.setStatus(ReworkStatus.CREATED);
            duplicateOrder.setReworkReason(request.getReworkReason());
            duplicateOrder.setIsDuplicate(true);
            duplicateOrder.setDuplicateRemark("该批次存在未完成的返工单: " + activeReworks.get(0).getReworkNo());
            reworkOrderRepository.save(duplicateOrder);

            auditService.logDuplicateAttempt(
                OperationType.DUPLICATE_ATTEMPT,
                reworkNo,
                batch.getBatchNo(),
                patient.getPatientNo(),
                request.getOperator(),
                "重复返工申请被拦截，已有活动返工单"
            );

            return ApiResponse.duplicate(
                "重复返工申请被拦截",
                String.format("批次 %s 已有未完成的返工单: %s", batch.getBatchNo(), activeReworks.get(0).getReworkNo())
            );
        }

        Long reworkCount = reworkOrderRepository.countReworkByOriginalBatchNo(batch.getOriginalBatchNo());
        if (reworkCount >= maxReworkCount) {
            return ApiResponse.badRequest(
                "返工次数超限",
                String.format("原始批次 %s 已返工 %d 次，超过最大限制 %d 次", 
                    batch.getOriginalBatchNo(), reworkCount, maxReworkCount)
            );
        }

        String reworkNo = "RW-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        ReworkOrder order = new ReworkOrder();
        order.setReworkNo(reworkNo);
        order.setBatch(batch);
        order.setPatient(patient);
        order.setStatus(ReworkStatus.CREATED);
        order.setReworkReason(request.getReworkReason());
        order = reworkOrderRepository.save(order);

        batch.setReworkCount(batch.getReworkCount() + 1);
        batchRepository.save(batch);

        auditService.logOperation(
            OperationType.CREATE_REWORK,
            order,
            request.getOperator(),
            "创建返工单，原因: " + request.getReworkReason(),
            null,
            ReworkStatus.CREATED
        );

        return ApiResponse.success(ReworkDetailDTO.fromEntity(order), "返工单创建成功");
    }

    @Transactional
    public ApiResponse<ReworkDetailDTO> receive(ReceiveRequest request) {
        Optional<ReworkOrder> optOrder = reworkOrderRepository.findByReworkNo(request.getReworkNo());
        if (optOrder.isEmpty()) {
            return ApiResponse.notFound("返工单不存在", "未找到返工单: " + request.getReworkNo());
        }

        ReworkOrder order = optOrder.get();
        if (order.getReceivedTime() != null) {
            auditService.logDuplicateAttempt(
                OperationType.DUPLICATE_ATTEMPT,
                order.getReworkNo(),
                order.getBatch().getBatchNo(),
                order.getPatient().getPatientNo(),
                request.getReceivedBy(),
                "重复收件操作被拦截"
            );
            return ApiResponse.success(ReworkDetailDTO.fromEntity(order), "该返工单已完成收件，重复操作已记录");
        }

        if (!stateMachine.canTransition(order.getStatus(), ReworkStatus.RECEIVED)) {
            return ApiResponse.badRequest(
                "状态转换不允许",
                stateMachine.getTransitionError(order.getStatus(), ReworkStatus.RECEIVED)
            );
        }

        ReworkStatus beforeStatus = order.getStatus();
        order.setStatus(ReworkStatus.RECEIVED);
        order.setReceivedTime(LocalDateTime.now());
        order.setReceivedBy(request.getReceivedBy());
        order = reworkOrderRepository.save(order);

        auditService.logOperation(
            OperationType.RECEIVE,
            order,
            request.getReceivedBy(),
            request.getRemark(),
            beforeStatus,
            ReworkStatus.RECEIVED
        );

        return ApiResponse.success(ReworkDetailDTO.fromEntity(order), "收件登记成功");
    }

    @Transactional
    public ApiResponse<ReworkDetailDTO> inspect(InspectionRequest request) {
        Optional<ReworkOrder> optOrder = reworkOrderRepository.findByReworkNo(request.getReworkNo());
        if (optOrder.isEmpty()) {
            return ApiResponse.notFound("返工单不存在", "未找到返工单: " + request.getReworkNo());
        }

        ReworkOrder order = optOrder.get();
        if (order.getInspectionTime() != null) {
            auditService.logDuplicateAttempt(
                OperationType.DUPLICATE_ATTEMPT,
                order.getReworkNo(),
                order.getBatch().getBatchNo(),
                order.getPatient().getPatientNo(),
                request.getInspectionBy(),
                "重复核验操作被拦截"
            );
            return ApiResponse.success(ReworkDetailDTO.fromEntity(order), "该返工单已完成核验，重复操作已记录");
        }

        if (!stateMachine.canTransition(order.getStatus(), ReworkStatus.INSPECTED)) {
            return ApiResponse.badRequest(
                "状态转换不允许",
                stateMachine.getTransitionError(order.getStatus(), ReworkStatus.INSPECTED)
            );
        }

        ReworkStatus beforeStatus = order.getStatus();
        order.setStatus(ReworkStatus.INSPECTED);
        order.setInspectionTime(LocalDateTime.now());
        order.setInspectionResult(request.getInspectionResult());
        order.setInspectionRemark(request.getInspectionRemark());
        order.setInspectionBy(request.getInspectionBy());
        order = reworkOrderRepository.save(order);

        auditService.logOperation(
            OperationType.INSPECT,
            order,
            request.getInspectionBy(),
            String.format("核验结果: %s, 备注: %s", request.getInspectionResult(), request.getInspectionRemark()),
            beforeStatus,
            ReworkStatus.INSPECTED
        );

        return ApiResponse.success(ReworkDetailDTO.fromEntity(order), "到件核验成功");
    }

    @Transactional
    public ApiResponse<ReworkDetailDTO> addTechnicianNote(TechnicianNoteRequest request) {
        Optional<ReworkOrder> optOrder = reworkOrderRepository.findByReworkNo(request.getReworkNo());
        if (optOrder.isEmpty()) {
            return ApiResponse.notFound("返工单不存在", "未找到返工单: " + request.getReworkNo());
        }

        ReworkOrder order = optOrder.get();
        order.setTechnicianNote(request.getTechnicianNote());
        order.setTechnicianNoteTime(LocalDateTime.now());
        order.setTechnicianName(request.getTechnicianName());

        if (order.getStatus() == ReworkStatus.INSPECTED) {
            order.setStatus(ReworkStatus.PROCESSING);
            order.setProcessingStartTime(LocalDateTime.now());
            order.setProcessingBy(request.getTechnicianName());
        }

        order = reworkOrderRepository.save(order);

        auditService.logOperation(
            OperationType.TECHNICIAN_NOTE,
            order,
            request.getTechnicianName(),
            "技师备注: " + request.getTechnicianNote(),
            null,
            null
        );

        return ApiResponse.success(ReworkDetailDTO.fromEntity(order), "技师备注已添加");
    }

    @Transactional
    public ApiResponse<ReworkDetailDTO> doctorConfirm(DoctorConfirmRequest request) {
        Optional<ReworkOrder> optOrder = reworkOrderRepository.findByReworkNo(request.getReworkNo());
        if (optOrder.isEmpty()) {
            return ApiResponse.notFound("返工单不存在", "未找到返工单: " + request.getReworkNo());
        }

        ReworkOrder order = optOrder.get();

        if (order.getShippedTime() != null) {
            return ApiResponse.badRequest(
                "确认超时",
                "该返工单已寄出，医生确认必须在寄出前完成"
            );
        }

        if (order.getDoctorConfirmationTime() != null) {
            auditService.logDuplicateAttempt(
                OperationType.DUPLICATE_ATTEMPT,
                order.getReworkNo(),
                order.getBatch().getBatchNo(),
                order.getPatient().getPatientNo(),
                request.getDoctorName(),
                "重复医生确认操作被拦截"
            );
            return ApiResponse.success(ReworkDetailDTO.fromEntity(order), "该返工单已完成医生确认，重复操作已记录");
        }

        if (!stateMachine.canTransition(order.getStatus(), ReworkStatus.DOCTOR_CONFIRMED)) {
            return ApiResponse.badRequest(
                "状态转换不允许",
                stateMachine.getTransitionError(order.getStatus(), ReworkStatus.DOCTOR_CONFIRMED)
            );
        }

        if (order.getProcessingStartTime() != null) {
            long hoursSinceProcessing = ChronoUnit.HOURS.between(order.getProcessingStartTime(), LocalDateTime.now());
            if (hoursSinceProcessing > confirmationWindowHours) {
                return ApiResponse.badRequest(
                    "确认窗口已过",
                    String.format("已超过 %d 小时确认窗口，当前距开始处理已过 %d 小时", 
                        confirmationWindowHours, hoursSinceProcessing)
                );
            }
        }

        ReworkStatus beforeStatus = order.getStatus();
        order.setStatus(ReworkStatus.DOCTOR_CONFIRMED);
        order.setDoctorConfirmation(request.getDoctorConfirmation());
        order.setDoctorConfirmationTime(LocalDateTime.now());
        order.setDoctorName(request.getDoctorName());
        order = reworkOrderRepository.save(order);

        auditService.logOperation(
            OperationType.DOCTOR_CONFIRM,
            order,
            request.getDoctorName(),
            "医生确认: " + request.getDoctorConfirmation(),
            beforeStatus,
            ReworkStatus.DOCTOR_CONFIRMED
        );

        return ApiResponse.success(ReworkDetailDTO.fromEntity(order), "医生确认成功");
    }

    @Transactional
    public ApiResponse<ReworkDetailDTO> review(ReviewRequest request) {
        Optional<ReworkOrder> optOrder = reworkOrderRepository.findByReworkNo(request.getReworkNo());
        if (optOrder.isEmpty()) {
            return ApiResponse.notFound("返工单不存在", "未找到返工单: " + request.getReworkNo());
        }

        ReworkOrder order = optOrder.get();
        if (order.getReviewTime() != null && order.getStatus() == ReworkStatus.REVIEWED) {
            auditService.logDuplicateAttempt(
                OperationType.DUPLICATE_ATTEMPT,
                order.getReworkNo(),
                order.getBatch().getBatchNo(),
                order.getPatient().getPatientNo(),
                request.getReviewBy(),
                "重复复查操作被拦截"
            );
            return ApiResponse.success(ReworkDetailDTO.fromEntity(order), "该返工单已完成复查，重复操作已记录");
        }

        if (!stateMachine.canTransition(order.getStatus(), ReworkStatus.REVIEWED)) {
            return ApiResponse.badRequest(
                "状态转换不允许",
                stateMachine.getTransitionError(order.getStatus(), ReworkStatus.REVIEWED)
            );
        }

        ReworkStatus beforeStatus = order.getStatus();
        order.setStatus(ReworkStatus.REVIEWED);
        order.setReviewTime(LocalDateTime.now());
        order.setReviewResult(request.getReviewResult());
        order.setReviewBy(request.getReviewBy());
        order = reworkOrderRepository.save(order);

        auditService.logOperation(
            OperationType.REVIEW,
            order,
            request.getReviewBy(),
            "复查结果: " + request.getReviewResult(),
            beforeStatus,
            ReworkStatus.REVIEWED
        );

        return ApiResponse.success(ReworkDetailDTO.fromEntity(order), "复查完成");
    }

    @Transactional
    public ApiResponse<ReworkDetailDTO> ship(ShipRequest request) {
        Optional<ReworkOrder> optOrder = reworkOrderRepository.findByReworkNo(request.getReworkNo());
        if (optOrder.isEmpty()) {
            return ApiResponse.notFound("返工单不存在", "未找到返工单: " + request.getReworkNo());
        }

        ReworkOrder order = optOrder.get();

        if (order.getDoctorConfirmationTime() == null) {
            return ApiResponse.badRequest(
                "缺少医生确认",
                "寄出前必须完成医生确认"
            );
        }

        if (order.getShippedTime() != null) {
            auditService.logDuplicateAttempt(
                OperationType.DUPLICATE_ATTEMPT,
                order.getReworkNo(),
                order.getBatch().getBatchNo(),
                order.getPatient().getPatientNo(),
                request.getShippedBy(),
                "重复寄出操作被拦截"
            );
            return ApiResponse.success(ReworkDetailDTO.fromEntity(order), "该返工单已寄出，重复操作已记录");
        }

        if (!stateMachine.canTransition(order.getStatus(), ReworkStatus.SHIPPED)) {
            return ApiResponse.badRequest(
                "状态转换不允许",
                stateMachine.getTransitionError(order.getStatus(), ReworkStatus.SHIPPED)
            );
        }

        ReworkStatus beforeStatus = order.getStatus();
        order.setStatus(ReworkStatus.SHIPPED);
        order.setShippedTime(LocalDateTime.now());
        order.setShippedBy(request.getShippedBy());
        order = reworkOrderRepository.save(order);

        ExpressOrder express = new ExpressOrder();
        express.setExpressNo(request.getExpressNo());
        express.setExpressCompany(request.getExpressCompany());
        express.setReworkOrder(order);
        express.setSender(request.getShippedBy());
        express.setReceiver(request.getReceiver());
        express.setReceiverPhone(request.getReceiverPhone());
        express.setSentTime(LocalDateTime.now());
        express.setStatus("已寄出");
        expressOrderRepository.save(express);

        auditService.logOperation(
            OperationType.SHIP,
            order,
            request.getShippedBy(),
            String.format("快递单号: %s, 快递公司: %s", request.getExpressNo(), request.getExpressCompany()),
            beforeStatus,
            ReworkStatus.SHIPPED
        );

        ReworkDetailDTO dto = ReworkDetailDTO.fromEntity(order);
        dto.setExpressNo(request.getExpressNo());
        return ApiResponse.success(dto, "寄出成功");
    }

    @Transactional
    public ApiResponse<ReworkDetailDTO> close(CloseRequest request) {
        Optional<ReworkOrder> optOrder = reworkOrderRepository.findByReworkNo(request.getReworkNo());
        if (optOrder.isEmpty()) {
            return ApiResponse.notFound("返工单不存在", "未找到返工单: " + request.getReworkNo());
        }

        ReworkOrder order = optOrder.get();
        if (stateMachine.isTerminalStatus(order.getStatus())) {
            auditService.logDuplicateAttempt(
                OperationType.DUPLICATE_ATTEMPT,
                order.getReworkNo(),
                order.getBatch().getBatchNo(),
                order.getPatient().getPatientNo(),
                request.getClosedBy(),
                "重复结案操作被拦截"
            );
            return ApiResponse.success(ReworkDetailDTO.fromEntity(order), "该返工单已结案，重复操作已记录");
        }

        if (!stateMachine.canTransition(order.getStatus(), ReworkStatus.CLOSED)) {
            return ApiResponse.badRequest(
                "状态转换不允许",
                stateMachine.getTransitionError(order.getStatus(), ReworkStatus.CLOSED)
            );
        }

        ReworkStatus beforeStatus = order.getStatus();
        order.setStatus(ReworkStatus.CLOSED);
        order.setClosedTime(LocalDateTime.now());
        order.setCloseReason(request.getCloseReason());
        order.setClosedBy(request.getClosedBy());
        order = reworkOrderRepository.save(order);

        auditService.logOperation(
            OperationType.CLOSE,
            order,
            request.getClosedBy(),
            "结案原因: " + request.getCloseReason(),
            beforeStatus,
            ReworkStatus.CLOSED
        );

        return ApiResponse.success(ReworkDetailDTO.fromEntity(order), "结案成功");
    }

    @Transactional
    public ApiResponse<ReworkDetailDTO> markLost(MarkLostRequest request) {
        Optional<ExpressOrder> optExpress = expressOrderRepository.findByExpressNo(request.getExpressNo());
        if (optExpress.isEmpty()) {
            return ApiResponse.notFound("快递单不存在", "未找到快递单: " + request.getExpressNo());
        }

        ExpressOrder express = optExpress.get();
        if (express.getIsLost()) {
            return ApiResponse.success(
                ReworkDetailDTO.fromEntity(express.getReworkOrder()),
                "该快递已标记为丢失"
            );
        }

        ReworkOrder order = express.getReworkOrder();
        if (order == null) {
            return ApiResponse.badRequest("快递单未关联返工单", "无法标记丢失");
        }

        if (!stateMachine.canTransition(order.getStatus(), ReworkStatus.LOST)) {
            return ApiResponse.badRequest(
                "状态转换不允许",
                stateMachine.getTransitionError(order.getStatus(), ReworkStatus.LOST)
            );
        }

        ReworkStatus beforeStatus = order.getStatus();
        order.setStatus(ReworkStatus.LOST);
        order = reworkOrderRepository.save(order);

        express.setIsLost(true);
        express.setLostRemark(request.getLostRemark());
        express.setLostMarkTime(LocalDateTime.now());
        express.setLostMarkBy(request.getOperator());
        express.setStatus("已丢失");
        expressOrderRepository.save(express);

        auditService.logOperation(
            OperationType.MARK_LOST,
            order,
            request.getOperator(),
            "丢失备注: " + request.getLostRemark(),
            beforeStatus,
            ReworkStatus.LOST
        );

        return ApiResponse.success(ReworkDetailDTO.fromEntity(order), "快递已标记为丢失");
    }

    public ApiResponse<ReworkDetailDTO> getReworkDetail(String reworkNo) {
        Optional<ReworkOrder> optOrder = reworkOrderRepository.findByReworkNo(reworkNo);
        if (optOrder.isEmpty()) {
            return ApiResponse.notFound("返工单不存在", "未找到返工单: " + reworkNo);
        }

        ReworkOrder order = optOrder.get();
        ReworkDetailDTO dto = ReworkDetailDTO.fromEntity(order);

        Optional<ExpressOrder> optExpress = expressOrderRepository.findByReworkOrderId(order.getId());
        optExpress.ifPresent(e -> dto.setExpressNo(e.getExpressNo()));

        List<AuditLog> logs = auditLogRepository.findByReworkNoOrderByOperationTimeDesc(reworkNo);
        dto.setAuditLogs(logs.stream().map(AuditLogDTO::fromEntity).collect(Collectors.toList()));

        return ApiResponse.success(dto);
    }

    @Transactional
    public ApiResponse<ReworkReport> exportReport(String reworkNo) {
        Optional<ReworkOrder> optOrder = reworkOrderRepository.findByReworkNo(reworkNo);
        if (optOrder.isEmpty()) {
            return ApiResponse.notFound("返工单不存在", "未找到返工单: " + reworkNo);
        }

        ReworkOrder order = optOrder.get();

        Optional<ReworkReport> optReport = reportRepository.findByReworkOrderId(order.getId());
        if (optReport.isPresent()) {
            return ApiResponse.success(optReport.get(), "报告已存在");
        }

        String reportNo = "RPT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        ReworkReport report = new ReworkReport();
        report.setReportNo(reportNo);
        report.setReworkOrder(order);
        report.setReportGeneratedTime(LocalDateTime.now());
        report.setGeneratedBy("system");
        report.setTechnicianNote(order.getTechnicianNote());
        report.setDoctorConfirmation(order.getDoctorConfirmation());
        report.setInspectionResult(order.getInspectionResult());
        report.setReviewResult(order.getReviewResult());
        report.setCloseReason(order.getCloseReason());
        report.setTotalReworkCount(order.getBatch().getReworkCount());

        if (order.getProcessingStartTime() != null && order.getClosedTime() != null) {
            report.setTotalProcessingDays(ChronoUnit.DAYS.between(order.getProcessingStartTime(), order.getClosedTime()));
        }

        StringBuilder summary = new StringBuilder();
        summary.append(String.format("患者: %s, 批次: %s\n", order.getPatient().getName(), order.getBatch().getBatchNo()));
        summary.append(String.format("返工原因: %s\n", order.getReworkReason()));
        summary.append(String.format("返工状态: %s\n", order.getStatus().getDescription()));
        if (order.getTechnicianNote() != null) {
            summary.append(String.format("技师备注: %s\n", order.getTechnicianNote()));
        }
        if (order.getDoctorConfirmation() != null) {
            summary.append(String.format("医生确认: %s\n", order.getDoctorConfirmation()));
        }
        report.setSummary(summary.toString());

        report = reportRepository.save(report);

        auditService.logOperation(
            OperationType.EXPORT_REPORT,
            order,
            "system",
            "导出返工报告: " + reportNo,
            null,
            null
        );

        return ApiResponse.success(report, "报告导出成功");
    }

    public ApiResponse<List<ReworkDetailDTO>> listReworks(ReworkStatus status) {
        List<ReworkOrder> orders;
        if (status != null) {
            orders = reworkOrderRepository.findByStatus(status);
        } else {
            orders = reworkOrderRepository.findAll();
        }
        List<ReworkDetailDTO> dtos = orders.stream()
            .map(ReworkDetailDTO::fromEntity)
            .collect(Collectors.toList());
        return ApiResponse.success(dtos);
    }
}

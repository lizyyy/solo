package com.mold.service.service;

import com.mold.service.common.BusinessException;
import com.mold.service.domain.entity.*;
import com.mold.service.domain.repository.MoldChangeTaskRepository;
import com.mold.service.domain.repository.MoldExtensionApprovalRepository;
import com.mold.service.domain.repository.MoldRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class MoldExtensionService {
    
    private final MoldExtensionApprovalRepository approvalRepository;
    private final MoldRepository moldRepository;
    private final MoldChangeTaskRepository taskRepository;
    private final OperationHistoryService historyService;
    
    @Transactional
    public MoldExtensionApproval requestExtension(String moldCode, Long extensionStrokes,
                                                  String reason, String productionLine,
                                                  String productCode, String requester) {
        Mold mold = moldRepository.findByMoldCode(moldCode)
                .orElseThrow(() -> new BusinessException("模具不存在: " + moldCode));
        
        if (extensionStrokes <= 0) {
            throw new BusinessException("续用次数必须大于0");
        }
        
        if (mold.getStatus() != Mold.MoldStatus.WARNING && 
            mold.getStatus() != Mold.MoldStatus.EXPIRED) {
            throw new BusinessException("只有预警或到期状态的模具才能申请续用");
        }
        
        List<MoldExtensionApproval> pendingApprovals = approvalRepository.findByStatusIn(
                List.of(MoldExtensionApproval.ApprovalStatus.PENDING)
        ).stream()
                .filter(a -> a.getMoldId().equals(mold.getId()))
                .toList();
        
        if (!pendingApprovals.isEmpty()) {
            throw new BusinessException("该模具已有待审批的续用申请");
        }
        
        String approvalNo = generateApprovalNo();
        Long newThreshold = mold.getLifeThreshold() + extensionStrokes;
        
        MoldExtensionApproval approval = new MoldExtensionApproval();
        approval.setApprovalNo(approvalNo);
        approval.setMoldId(mold.getId());
        approval.setMoldCode(mold.getMoldCode());
        approval.setMoldName(mold.getMoldName());
        approval.setOriginalStrokes(mold.getTotalStrokes());
        approval.setOriginalThreshold(mold.getLifeThreshold());
        approval.setExtensionStrokes(extensionStrokes);
        approval.setNewThreshold(newThreshold);
        approval.setReason(reason);
        approval.setProductionLine(productionLine);
        approval.setProductCode(productCode);
        approval.setRequester(requester);
        approval.setStatus(MoldExtensionApproval.ApprovalStatus.PENDING);
        approval.setCreatedBy(requester);
        approval.setUpdatedBy(requester);
        
        List<MoldChangeTask> activeTasks = taskRepository.findActiveTasksByMoldId(mold.getId());
        if (!activeTasks.isEmpty()) {
            approval.setRelatedTaskId(activeTasks.get(0).getId());
        }
        
        approvalRepository.save(approval);
        
        historyService.recordSimpleHistory(
                "MoldExtensionApproval", approval.getId(), approval.getApprovalNo(),
                OperationHistory.OperationType.CREATE,
                String.format("创建续用申请: 原阈值=%d, 续用次数=%d, 新阈值=%d",
                        mold.getLifeThreshold(), extensionStrokes, newThreshold),
                reason, requester, "operator"
        );
        
        log.info("模具续用申请创建: 审批号={}, 模具={}, 续用次数={}", approvalNo, moldCode, extensionStrokes);
        
        return approval;
    }
    
    @Transactional
    public MoldExtensionApproval approveExtension(String approvalNo, String approveRemark, String approver) {
        MoldExtensionApproval approval = approvalRepository.findByApprovalNo(approvalNo)
                .orElseThrow(() -> new BusinessException("审批不存在: " + approvalNo));
        
        if (approval.getStatus() != MoldExtensionApproval.ApprovalStatus.PENDING) {
            throw new BusinessException("只有待审批状态的申请可以审批");
        }
        
        Mold mold = moldRepository.findById(approval.getMoldId())
                .orElseThrow(() -> new BusinessException("模具不存在"));
        
        Long oldLifeThreshold = mold.getLifeThreshold();
        Long oldWarningThreshold = mold.getWarningThreshold();
        
        mold.setLifeThreshold(approval.getNewThreshold());
        mold.setWarningThreshold(calculateNewWarningThreshold(approval.getNewThreshold()));
        mold.setUpdatedBy(approver);
        
        if (mold.getTotalStrokes() < mold.getWarningThreshold()) {
            if (mold.getStatus() == Mold.MoldStatus.EXPIRED) {
                mold.setStatus(Mold.MoldStatus.WARNING);
            }
            if (mold.getTotalStrokes() < mold.getWarningThreshold()) {
                mold.setStatus(Mold.MoldStatus.IN_USE);
            }
        }
        
        moldRepository.save(mold);
        
        approval.setStatus(MoldExtensionApproval.ApprovalStatus.APPROVED);
        approval.setApproveTime(LocalDateTime.now());
        approval.setApproveRemark(approveRemark);
        approval.setApprover(approver);
        approval.setUpdatedBy(approver);
        approvalRepository.save(approval);
        
        if (approval.getRelatedTaskId() != null) {
            taskRepository.findById(approval.getRelatedTaskId()).ifPresent(task -> {
                if (task.getStatus() == MoldChangeTask.TaskStatus.PENDING) {
                    task.setStatus(MoldChangeTask.TaskStatus.CANCELLED);
                    task.setRemark("续用申请已批准，任务取消");
                    task.setUpdatedBy(approver);
                    taskRepository.save(task);
                }
            });
            
            String newTaskNo = generateTaskNo();
            MoldChangeTask extensionTask = new MoldChangeTask();
            extensionTask.setTaskNo(newTaskNo);
            extensionTask.setMoldId(mold.getId());
            extensionTask.setMoldCode(mold.getMoldCode());
            extensionTask.setMoldName(mold.getMoldName());
            extensionTask.setTaskType(MoldChangeTask.TaskType.EXTENSION_APPROVED);
            extensionTask.setStatus(MoldChangeTask.TaskStatus.PENDING);
            extensionTask.setPriority(MoldChangeTask.TaskPriority.NORMAL);
            extensionTask.setTriggeredStrokes(mold.getTotalStrokes());
            extensionTask.setLifeThreshold(approval.getNewThreshold());
            extensionTask.setProductionLine(mold.getProductionLine());
            extensionTask.setCurrentProduct(mold.getCurrentProduct());
            extensionTask.setExpectedCompleteTime(LocalDateTime.now().plusDays(7));
            extensionTask.setCreatedBy(approver);
            extensionTask.setUpdatedBy(approver);
            taskRepository.save(extensionTask);
        }
        
        historyService.recordSimpleHistory(
                "MoldExtensionApproval", approval.getId(), approval.getApprovalNo(),
                OperationHistory.OperationType.APPROVE,
                String.format("续用申请批准: 原阈值=%d->%d, 预警阈值=%d->%d",
                        oldLifeThreshold, approval.getNewThreshold(),
                        oldWarningThreshold, mold.getWarningThreshold()),
                approveRemark, approver, "manager"
        );
        
        log.info("续用申请批准: 审批号={}, 模具={}, 新阈值={}", approvalNo, mold.getMoldCode(), approval.getNewThreshold());
        
        return approval;
    }
    
    @Transactional
    public MoldExtensionApproval rejectExtension(String approvalNo, String rejectReason, String approver) {
        MoldExtensionApproval approval = approvalRepository.findByApprovalNo(approvalNo)
                .orElseThrow(() -> new BusinessException("审批不存在: " + approvalNo));
        
        if (approval.getStatus() != MoldExtensionApproval.ApprovalStatus.PENDING) {
            throw new BusinessException("只有待审批状态的申请可以驳回");
        }
        
        approval.setStatus(MoldExtensionApproval.ApprovalStatus.REJECTED);
        approval.setApproveTime(LocalDateTime.now());
        approval.setApproveRemark(rejectReason);
        approval.setApprover(approver);
        approval.setUpdatedBy(approver);
        approvalRepository.save(approval);
        
        historyService.recordSimpleHistory(
                "MoldExtensionApproval", approval.getId(), approval.getApprovalNo(),
                OperationHistory.OperationType.REJECT,
                "续用申请被驳回",
                rejectReason, approver, "manager"
        );
        
        log.info("续用申请驳回: 审批号={}, 原因={}", approvalNo, rejectReason);
        
        return approval;
    }
    
    private Long calculateNewWarningThreshold(Long newLifeThreshold) {
        return (long) (newLifeThreshold * 0.9);
    }
    
    private String generateApprovalNo() {
        return "MEA" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
                + String.format("%04d", (int) (Math.random() * 10000));
    }
    
    private String generateTaskNo() {
        return "MCT" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
                + String.format("%04d", (int) (Math.random() * 10000));
    }
}

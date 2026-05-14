package com.compensation.service;

import com.compensation.dto.*;
import com.compensation.entity.*;
import com.compensation.enums.InstructionStatus;
import com.compensation.enums.NodeStatus;
import com.compensation.enums.ProcessStatus;
import com.compensation.exception.BusinessException;
import com.compensation.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CompensationService {

    private final BusinessProcessRepository processRepository;
    private final FailedNodeRepository failedNodeRepository;
    private final CompensationInstructionRepository instructionRepository;
    private final CompensationExecutionRepository executionRepository;
    private final CompensationSummaryRepository summaryRepository;

    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<Map<String, Object>> createCompensation(CreateCompensationRequest request) {
        String processId = request.getProcessId();
        
        if (processRepository.existsByProcessId(processId)) {
            BusinessProcess existProcess = processRepository.findByProcessId(processId)
                    .orElseThrow(() -> new BusinessException("流程不存在"));
            return ApiResponse.success("流程已存在，返回已有数据", getProcessDetail(processId));
        }

        BusinessProcess process = new BusinessProcess();
        process.setProcessId(processId);
        process.setProcessName(request.getProcessName());
        process.setServiceName(request.getServiceName());
        process.setTotalNodes(request.getTotalNodes());
        process.setFailedNodes(request.getFailedNodes().size());
        process.setStatus(ProcessStatus.FAILED);
        processRepository.save(process);

        int instructionIndex = 1;
        for (FailedNodeDTO nodeDTO : request.getFailedNodes()) {
            FailedNode node = new FailedNode();
            node.setProcessId(processId);
            node.setNodeId(nodeDTO.getNodeId());
            node.setNodeName(nodeDTO.getNodeName());
            node.setServiceName(nodeDTO.getServiceName());
            node.setErrorCode(nodeDTO.getErrorCode());
            node.setErrorMessage(nodeDTO.getErrorMessage());
            node.setStatus(NodeStatus.FAILED);
            failedNodeRepository.save(node);

            for (CompensationInstructionDTO instDTO : nodeDTO.getInstructions()) {
                CompensationInstruction instruction = new CompensationInstruction();
                instruction.setInstructionId("INST-" + processId + "-" + instructionIndex++);
                instruction.setProcessId(processId);
                instruction.setNodeId(nodeDTO.getNodeId());
                instruction.setInstructionType(instDTO.getInstructionType());
                instruction.setInstructionContent(instDTO.getInstructionContent());
                instruction.setExecutionOrder(instDTO.getExecutionOrder());
                instruction.setRequireManualConfirm(instDTO.getRequireManualConfirm());
                instruction.setMaxRetry(instDTO.getMaxRetry());
                instruction.setStatus(InstructionStatus.PENDING);
                instructionRepository.save(instruction);
            }
        }

        CompensationSummary summary = new CompensationSummary();
        summary.setProcessId(processId);
        summary.setTotalInstructions((int) instructionRepository.count());
        summary.setPendingCount(summary.getTotalInstructions());
        summary.setOverallStatus(ProcessStatus.FAILED);
        summary.setStartedAt(LocalDateTime.now());
        summaryRepository.save(summary);

        return ApiResponse.success("补偿流程创建成功", getProcessDetail(processId));
    }

    public ApiResponse<Map<String, Object>> getProcessDetail(String processId) {
        BusinessProcess process = processRepository.findByProcessId(processId)
                .orElseThrow(() -> new BusinessException(404, "流程不存在"));

        List<FailedNode> failedNodes = failedNodeRepository.findByProcessId(processId);
        List<CompensationInstruction> instructions = instructionRepository.findByProcessIdOrderByExecutionOrderAsc(processId);
        CompensationSummary summary = summaryRepository.findByProcessId(processId).orElse(null);

        Map<String, Object> result = new HashMap<>();
        result.put("process", process);
        result.put("failedNodes", failedNodes);
        result.put("instructions", instructions);
        result.put("summary", summary);

        return ApiResponse.success(result);
    }

    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<String> startCompensation(String processId) {
        BusinessProcess process = processRepository.findByProcessId(processId)
                .orElseThrow(() -> new BusinessException(404, "流程不存在"));

        if (process.getStatus() != ProcessStatus.FAILED && process.getStatus() != ProcessStatus.COMPENSATION_FAILED) {
            throw new BusinessException("当前状态不允许启动补偿");
        }

        process.setStatus(ProcessStatus.COMPENSATING);
        processRepository.save(process);

        CompensationSummary summary = summaryRepository.findByProcessId(processId)
                .orElseThrow(() -> new BusinessException("汇总数据不存在"));
        summary.setOverallStatus(ProcessStatus.COMPENSATING);
        summary.setStartedAt(LocalDateTime.now());
        summaryRepository.save(summary);

        List<CompensationInstruction> instructions = instructionRepository.findByProcessIdOrderByExecutionOrderAsc(processId);
        for (CompensationInstruction instruction : instructions) {
            if (instruction.getStatus() == InstructionStatus.PENDING || instruction.getStatus() == InstructionStatus.FAILED) {
                if (instruction.getRequireManualConfirm()) {
                    instruction.setStatus(InstructionStatus.WAITING_MANUAL_CONFIRM);
                } else {
                    instruction.setStatus(InstructionStatus.PENDING);
                }
                instructionRepository.save(instruction);
            }
        }

        return ApiResponse.success("补偿流程已启动", processId);
    }

    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<String> manualConfirm(String instructionId, ManualConfirmRequest request) {
        CompensationInstruction instruction = instructionRepository.findByInstructionId(instructionId)
                .orElseThrow(() -> new BusinessException(404, "指令不存在"));

        if (instruction.getStatus() != InstructionStatus.WAITING_MANUAL_CONFIRM) {
            throw new BusinessException("当前状态不允许人工确认");
        }

        instruction.setStatus(InstructionStatus.PENDING);
        instructionRepository.save(instruction);

        CompensationSummary summary = summaryRepository.findByProcessId(instruction.getProcessId()).orElse(null);
        if (summary != null) {
            summary.setManualConfirmedCount(summary.getManualConfirmedCount() + 1);
            summaryRepository.save(summary);
        }

        return ApiResponse.success("人工确认成功", instructionId);
    }

    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<String> executeInstruction(String instructionId, ExecuteInstructionRequest request) {
        if (executionRepository.existsByExecutionId(request.getExecutionId())) {
            return ApiResponse.success("执行ID已存在，幂等处理", request.getExecutionId());
        }

        CompensationInstruction instruction = instructionRepository.findByInstructionId(instructionId)
                .orElseThrow(() -> new BusinessException(404, "指令不存在"));

        if (instruction.getStatus() != InstructionStatus.PENDING) {
            throw new BusinessException("当前状态不允许执行");
        }

        instruction.setStatus(InstructionStatus.EXECUTING);
        instructionRepository.save(instruction);

        boolean success = simulateExecution(instruction);
        
        CompensationExecution execution = new CompensationExecution();
        execution.setInstructionId(instructionId);
        execution.setExecutionId(request.getExecutionId());
        execution.setExecutor(request.getExecutor());
        execution.setExecutedAt(LocalDateTime.now());
        execution.setResultDetail(request.getResultDetail());
        
        if (success) {
            instruction.setStatus(InstructionStatus.SUCCESS);
            execution.setExecutionResult("SUCCESS");
        } else {
            instruction.setRetryCount(instruction.getRetryCount() + 1);
            if (instruction.getRetryCount() >= instruction.getMaxRetry()) {
                instruction.setStatus(InstructionStatus.FAILED);
                execution.setExecutionResult("FAILED");
            } else {
                instruction.setStatus(InstructionStatus.PENDING);
                execution.setExecutionResult("RETRY");
            }
        }
        
        instructionRepository.save(instruction);
        executionRepository.save(execution);

        updateProcessStatus(instruction.getProcessId());

        return ApiResponse.success(success ? "执行成功" : "执行失败，等待重试", instructionId);
    }

    private boolean simulateExecution(CompensationInstruction instruction) {
        return new Random().nextInt(10) > 2;
    }

    private void updateProcessStatus(String processId) {
        List<CompensationInstruction> instructions = instructionRepository.findByProcessIdOrderByExecutionOrderAsc(processId);
        
        long successCount = instructions.stream().filter(i -> i.getStatus() == InstructionStatus.SUCCESS).count();
        long failedCount = instructions.stream().filter(i -> i.getStatus() == InstructionStatus.FAILED).count();
        long pendingCount = instructions.stream().filter(i -> 
            i.getStatus() == InstructionStatus.PENDING || 
            i.getStatus() == InstructionStatus.WAITING_MANUAL_CONFIRM ||
            i.getStatus() == InstructionStatus.EXECUTING
        ).count();

        CompensationSummary summary = summaryRepository.findByProcessId(processId).orElse(null);
        if (summary != null) {
            summary.setSuccessCount((int) successCount);
            summary.setFailedCount((int) failedCount);
            summary.setPendingCount((int) pendingCount);
        }

        BusinessProcess process = processRepository.findByProcessId(processId).orElse(null);
        if (process != null) {
            if (failedCount > 0) {
                process.setStatus(ProcessStatus.COMPENSATION_FAILED);
                if (summary != null) {
                    summary.setOverallStatus(ProcessStatus.COMPENSATION_FAILED);
                    summary.setCompletedAt(LocalDateTime.now());
                }
            } else if (pendingCount == 0) {
                process.setStatus(ProcessStatus.COMPENSATED);
                if (summary != null) {
                    summary.setOverallStatus(ProcessStatus.COMPENSATED);
                    summary.setCompletedAt(LocalDateTime.now());
                }
            }
            processRepository.save(process);
        }
        
        if (summary != null) {
            summaryRepository.save(summary);
        }
    }

    public ApiResponse<List<Map<String, Object>>> getHistory(LocalDateTime startTime, LocalDateTime endTime, String status) {
        List<BusinessProcess> processes = processRepository.findAll();
        
        List<Map<String, Object>> result = processes.stream()
                .filter(p -> startTime == null || p.getCreatedAt().isAfter(startTime))
                .filter(p -> endTime == null || p.getCreatedAt().isBefore(endTime))
                .filter(p -> status == null || p.getStatus().name().equals(status))
                .map(p -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("processId", p.getProcessId());
                    map.put("processName", p.getProcessName());
                    map.put("serviceName", p.getServiceName());
                    map.put("status", p.getStatus());
                    map.put("createdAt", p.getCreatedAt());
                    map.put("updatedAt", p.getUpdatedAt());
                    
                    CompensationSummary summary = summaryRepository.findByProcessId(p.getProcessId()).orElse(null);
                    if (summary != null) {
                        map.put("totalInstructions", summary.getTotalInstructions());
                        map.put("successCount", summary.getSuccessCount());
                        map.put("failedCount", summary.getFailedCount());
                    }
                    return map;
                })
                .sorted((a, b) -> ((LocalDateTime) b.get("createdAt")).compareTo((LocalDateTime) a.get("createdAt")))
                .collect(Collectors.toList());

        return ApiResponse.success(result);
    }

    public ApiResponse<String> exportResult(String processId) {
        BusinessProcess process = processRepository.findByProcessId(processId)
                .orElseThrow(() -> new BusinessException(404, "流程不存在"));

        List<FailedNode> failedNodes = failedNodeRepository.findByProcessId(processId);
        List<CompensationInstruction> instructions = instructionRepository.findByProcessIdOrderByExecutionOrderAsc(processId);
        CompensationSummary summary = summaryRepository.findByProcessId(processId).orElse(null);

        StringBuilder sb = new StringBuilder();
        sb.append("=====================================\n");
        sb.append("跨服务补偿指令执行报告\n");
        sb.append("=====================================\n\n");
        sb.append("流程ID: ").append(process.getProcessId()).append("\n");
        sb.append("流程名称: ").append(process.getProcessName()).append("\n");
        sb.append("服务名称: ").append(process.getServiceName()).append("\n");
        sb.append("流程状态: ").append(process.getStatus()).append("\n");
        sb.append("创建时间: ").append(process.getCreatedAt()).append("\n\n");

        if (summary != null) {
            sb.append("-------------------------------------\n");
            sb.append("执行汇总:\n");
            sb.append("  总指令数: ").append(summary.getTotalInstructions()).append("\n");
            sb.append("  成功: ").append(summary.getSuccessCount()).append("\n");
            sb.append("  失败: ").append(summary.getFailedCount()).append("\n");
            sb.append("  待执行: ").append(summary.getPendingCount()).append("\n");
            sb.append("  人工确认: ").append(summary.getManualConfirmedCount()).append("\n");
            sb.append("  开始时间: ").append(summary.getStartedAt()).append("\n");
            sb.append("  完成时间: ").append(summary.getCompletedAt()).append("\n\n");
        }

        sb.append("-------------------------------------\n");
        sb.append("失败节点列表:\n");
        for (FailedNode node : failedNodes) {
            sb.append("  节点ID: ").append(node.getNodeId()).append("\n");
            sb.append("    节点名称: ").append(node.getNodeName()).append("\n");
            sb.append("    错误码: ").append(node.getErrorCode()).append("\n");
            sb.append("    错误信息: ").append(node.getErrorMessage()).append("\n\n");
        }

        sb.append("-------------------------------------\n");
        sb.append("补偿指令执行详情:\n");
        for (CompensationInstruction inst : instructions) {
            sb.append("  指令ID: ").append(inst.getInstructionId()).append("\n");
            sb.append("    执行顺序: ").append(inst.getExecutionOrder()).append("\n");
            sb.append("    类型: ").append(inst.getInstructionType()).append("\n");
            sb.append("    状态: ").append(inst.getStatus()).append("\n");
            sb.append("    重试次数: ").append(inst.getRetryCount()).append("/").append(inst.getMaxRetry()).append("\n");
            
            List<CompensationExecution> executions = executionRepository.findByInstructionId(inst.getInstructionId());
            sb.append("    执行记录: ").append(executions.size()).append(" 次\n");
            for (CompensationExecution exec : executions) {
                sb.append("      - ").append(exec.getExecutedAt())
                  .append(" | ").append(exec.getExecutionResult())
                  .append(" | ").append(exec.getExecutor()).append("\n");
            }
            sb.append("\n");
        }

        sb.append("=====================================\n");
        sb.append("报告生成时间: ").append(LocalDateTime.now()).append("\n");

        return ApiResponse.success(sb.toString());
    }

    public ApiResponse<List<CompensationInstruction>> getNextInstructions(String processId) {
        List<CompensationInstruction> instructions = instructionRepository.findByProcessIdAndStatus(processId, InstructionStatus.PENDING);
        instructions.sort(Comparator.comparing(CompensationInstruction::getExecutionOrder));
        return ApiResponse.success(instructions);
    }
}

#!/bin/bash
# 移除 Lombok 依赖，手动展开所有注解

cd "$(dirname "$0")"

echo "正在移除 Lombok 注解..."

# 1. ApiResponse.java
cat > src/main/java/com/compensation/dto/ApiResponse.java << 'EOF'
package com.compensation.dto;

public class ApiResponse<T> {

    private Integer code;
    private String message;
    private T data;
    private Long timestamp;

    public ApiResponse() {
        this.timestamp = System.currentTimeMillis();
    }

    public ApiResponse(Integer code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
        this.timestamp = System.currentTimeMillis();
    }

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(200, "success", data);
    }

    public static <T> ApiResponse<T> success(String message, T data) {
        return new ApiResponse<>(200, message, data);
    }

    public static <T> ApiResponse<T> error(Integer code, String message) {
        return new ApiResponse<>(code, message, null);
    }

    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(500, message, null);
    }

    public Integer getCode() { return code; }
    public void setCode(Integer code) { this.code = code; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public T getData() { return data; }
    public void setData(T data) { this.data = data; }
    public Long getTimestamp() { return timestamp; }
    public void setTimestamp(Long timestamp) { this.timestamp = timestamp; }
}
EOF
echo "✅ ApiResponse.java"

# 2. CreateCompensationRequest.java
cat > src/main/java/com/compensation/dto/CreateCompensationRequest.java << 'EOF'
package com.compensation.dto;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import java.util.List;

public class CreateCompensationRequest {

    @NotBlank(message = "业务流程ID不能为空")
    private String processId;

    @NotBlank(message = "业务流程名称不能为空")
    private String processName;

    @NotBlank(message = "服务名称不能为空")
    private String serviceName;

    @NotNull(message = "总节点数不能为空")
    private Integer totalNodes;

    @NotEmpty(message = "失败节点列表不能为空")
    @Valid
    private List<FailedNodeDTO> failedNodes;

    public String getProcessId() { return processId; }
    public void setProcessId(String processId) { this.processId = processId; }
    public String getProcessName() { return processName; }
    public void setProcessName(String processName) { this.processName = processName; }
    public String getServiceName() { return serviceName; }
    public void setServiceName(String serviceName) { this.serviceName = serviceName; }
    public Integer getTotalNodes() { return totalNodes; }
    public void setTotalNodes(Integer totalNodes) { this.totalNodes = totalNodes; }
    public List<FailedNodeDTO> getFailedNodes() { return failedNodes; }
    public void setFailedNodes(List<FailedNodeDTO> failedNodes) { this.failedNodes = failedNodes; }
}
EOF
echo "✅ CreateCompensationRequest.java"

# 3. FailedNodeDTO.java
cat > src/main/java/com/compensation/dto/FailedNodeDTO.java << 'EOF'
package com.compensation.dto;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;
import java.util.List;

public class FailedNodeDTO {

    @NotBlank(message = "节点ID不能为空")
    private String nodeId;

    @NotBlank(message = "节点名称不能为空")
    private String nodeName;

    @NotBlank(message = "服务名称不能为空")
    private String serviceName;

    private String errorCode;

    private String errorMessage;

    @NotEmpty(message = "补偿指令列表不能为空")
    @Valid
    private List<CompensationInstructionDTO> instructions;

    public String getNodeId() { return nodeId; }
    public void setNodeId(String nodeId) { this.nodeId = nodeId; }
    public String getNodeName() { return nodeName; }
    public void setNodeName(String nodeName) { this.nodeName = nodeName; }
    public String getServiceName() { return serviceName; }
    public void setServiceName(String serviceName) { this.serviceName = serviceName; }
    public String getErrorCode() { return errorCode; }
    public void setErrorCode(String errorCode) { this.errorCode = errorCode; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public List<CompensationInstructionDTO> getInstructions() { return instructions; }
    public void setInstructions(List<CompensationInstructionDTO> instructions) { this.instructions = instructions; }
}
EOF
echo "✅ FailedNodeDTO.java"

# 4. CompensationInstructionDTO.java
cat > src/main/java/com/compensation/dto/CompensationInstructionDTO.java << 'EOF'
package com.compensation.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

public class CompensationInstructionDTO {

    @NotBlank(message = "指令类型不能为空")
    private String instructionType;

    @NotBlank(message = "指令内容不能为空")
    private String instructionContent;

    @NotNull(message = "执行顺序不能为空")
    private Integer executionOrder;

    private Boolean requireManualConfirm = false;

    private Integer maxRetry = 3;

    public String getInstructionType() { return instructionType; }
    public void setInstructionType(String instructionType) { this.instructionType = instructionType; }
    public String getInstructionContent() { return instructionContent; }
    public void setInstructionContent(String instructionContent) { this.instructionContent = instructionContent; }
    public Integer getExecutionOrder() { return executionOrder; }
    public void setExecutionOrder(Integer executionOrder) { this.executionOrder = executionOrder; }
    public Boolean getRequireManualConfirm() { return requireManualConfirm; }
    public void setRequireManualConfirm(Boolean requireManualConfirm) { this.requireManualConfirm = requireManualConfirm; }
    public Integer getMaxRetry() { return maxRetry; }
    public void setMaxRetry(Integer maxRetry) { this.maxRetry = maxRetry; }
}
EOF
echo "✅ CompensationInstructionDTO.java"

# 5. ExecuteInstructionRequest.java
cat > src/main/java/com/compensation/dto/ExecuteInstructionRequest.java << 'EOF'
package com.compensation.dto;

import javax.validation.constraints.NotBlank;

public class ExecuteInstructionRequest {

    @NotBlank(message = "执行ID不能为空")
    private String executionId;

    private String executor;

    private String resultDetail;

    private Boolean forceFail = false;

    public String getExecutionId() { return executionId; }
    public void setExecutionId(String executionId) { this.executionId = executionId; }
    public String getExecutor() { return executor; }
    public void setExecutor(String executor) { this.executor = executor; }
    public String getResultDetail() { return resultDetail; }
    public void setResultDetail(String resultDetail) { this.resultDetail = resultDetail; }
    public Boolean getForceFail() { return forceFail; }
    public void setForceFail(Boolean forceFail) { this.forceFail = forceFail; }
}
EOF
echo "✅ ExecuteInstructionRequest.java"

# 6. ManualConfirmRequest.java
cat > src/main/java/com/compensation/dto/ManualConfirmRequest.java << 'EOF'
package com.compensation.dto;

import javax.validation.constraints.NotBlank;

public class ManualConfirmRequest {

    @NotBlank(message = "操作人不能为空")
    private String operator;

    private String remark;

    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
}
EOF
echo "✅ ManualConfirmRequest.java"

# 7. BusinessProcess.java
cat > src/main/java/com/compensation/entity/BusinessProcess.java << 'EOF'
package com.compensation.entity;

import com.compensation.enums.ProcessStatus;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "business_process")
public class BusinessProcess {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "process_id", unique = true, nullable = false, length = 64)
    private String processId;

    @Column(name = "process_name", nullable = false, length = 128)
    private String processName;

    @Column(name = "service_name", nullable = false, length = 64)
    private String serviceName;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private ProcessStatus status;

    @Column(name = "total_nodes")
    private Integer totalNodes = 0;

    @Column(name = "failed_nodes")
    private Integer failedNodes = 0;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getProcessId() { return processId; }
    public void setProcessId(String processId) { this.processId = processId; }
    public String getProcessName() { return processName; }
    public void setProcessName(String processName) { this.processName = processName; }
    public String getServiceName() { return serviceName; }
    public void setServiceName(String serviceName) { this.serviceName = serviceName; }
    public ProcessStatus getStatus() { return status; }
    public void setStatus(ProcessStatus status) { this.status = status; }
    public Integer getTotalNodes() { return totalNodes; }
    public void setTotalNodes(Integer totalNodes) { this.totalNodes = totalNodes; }
    public Integer getFailedNodes() { return failedNodes; }
    public void setFailedNodes(Integer failedNodes) { this.failedNodes = failedNodes; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
EOF
echo "✅ BusinessProcess.java"

# 8. FailedNode.java
cat > src/main/java/com/compensation/entity/FailedNode.java << 'EOF'
package com.compensation.entity;

import com.compensation.enums.NodeStatus;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "failed_node", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"process_id", "node_id"})
})
public class FailedNode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "process_id", nullable = false, length = 64)
    private String processId;

    @Column(name = "node_id", nullable = false, length = 64)
    private String nodeId;

    @Column(name = "node_name", nullable = false, length = 128)
    private String nodeName;

    @Column(name = "service_name", nullable = false, length = 64)
    private String serviceName;

    @Column(name = "error_code", length = 64)
    private String errorCode;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "failed_at")
    private LocalDateTime failedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private NodeStatus status;

    @PrePersist
    protected void onCreate() {
        failedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getProcessId() { return processId; }
    public void setProcessId(String processId) { this.processId = processId; }
    public String getNodeId() { return nodeId; }
    public void setNodeId(String nodeId) { this.nodeId = nodeId; }
    public String getNodeName() { return nodeName; }
    public void setNodeName(String nodeName) { this.nodeName = nodeName; }
    public String getServiceName() { return serviceName; }
    public void setServiceName(String serviceName) { this.serviceName = serviceName; }
    public String getErrorCode() { return errorCode; }
    public void setErrorCode(String errorCode) { this.errorCode = errorCode; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public LocalDateTime getFailedAt() { return failedAt; }
    public void setFailedAt(LocalDateTime failedAt) { this.failedAt = failedAt; }
    public NodeStatus getStatus() { return status; }
    public void setStatus(NodeStatus status) { this.status = status; }
}
EOF
echo "✅ FailedNode.java"

# 9. CompensationInstruction.java
cat > src/main/java/com/compensation/entity/CompensationInstruction.java << 'EOF'
package com.compensation.entity;

import com.compensation.enums.InstructionStatus;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "compensation_instruction")
public class CompensationInstruction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "instruction_id", unique = true, nullable = false, length = 64)
    private String instructionId;

    @Column(name = "process_id", nullable = false, length = 64)
    private String processId;

    @Column(name = "node_id", nullable = false, length = 64)
    private String nodeId;

    @Column(name = "instruction_type", nullable = false, length = 32)
    private String instructionType;

    @Column(name = "instruction_content", nullable = false, columnDefinition = "TEXT")
    private String instructionContent;

    @Column(name = "execution_order", nullable = false)
    private Integer executionOrder;

    @Column(name = "require_manual_confirm")
    private Boolean requireManualConfirm = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private InstructionStatus status;

    @Column(name = "retry_count")
    private Integer retryCount = 0;

    @Column(name = "max_retry")
    private Integer maxRetry = 3;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getInstructionId() { return instructionId; }
    public void setInstructionId(String instructionId) { this.instructionId = instructionId; }
    public String getProcessId() { return processId; }
    public void setProcessId(String processId) { this.processId = processId; }
    public String getNodeId() { return nodeId; }
    public void setNodeId(String nodeId) { this.nodeId = nodeId; }
    public String getInstructionType() { return instructionType; }
    public void setInstructionType(String instructionType) { this.instructionType = instructionType; }
    public String getInstructionContent() { return instructionContent; }
    public void setInstructionContent(String instructionContent) { this.instructionContent = instructionContent; }
    public Integer getExecutionOrder() { return executionOrder; }
    public void setExecutionOrder(Integer executionOrder) { this.executionOrder = executionOrder; }
    public Boolean getRequireManualConfirm() { return requireManualConfirm; }
    public void setRequireManualConfirm(Boolean requireManualConfirm) { this.requireManualConfirm = requireManualConfirm; }
    public InstructionStatus getStatus() { return status; }
    public void setStatus(InstructionStatus status) { this.status = status; }
    public Integer getRetryCount() { return retryCount; }
    public void setRetryCount(Integer retryCount) { this.retryCount = retryCount; }
    public Integer getMaxRetry() { return maxRetry; }
    public void setMaxRetry(Integer maxRetry) { this.maxRetry = maxRetry; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
EOF
echo "✅ CompensationInstruction.java"

# 10. CompensationExecution.java
cat > src/main/java/com/compensation/entity/CompensationExecution.java << 'EOF'
package com.compensation.entity;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "compensation_execution")
public class CompensationExecution {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "instruction_id", nullable = false, length = 64)
    private String instructionId;

    @Column(name = "execution_id", unique = true, nullable = false, length = 64)
    private String executionId;

    @Column(name = "executor", length = 64)
    private String executor;

    @Column(name = "executed_at")
    private LocalDateTime executedAt;

    @Column(name = "execution_result", length = 32)
    private String executionResult;

    @Column(name = "result_detail", columnDefinition = "TEXT")
    private String resultDetail;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getInstructionId() { return instructionId; }
    public void setInstructionId(String instructionId) { this.instructionId = instructionId; }
    public String getExecutionId() { return executionId; }
    public void setExecutionId(String executionId) { this.executionId = executionId; }
    public String getExecutor() { return executor; }
    public void setExecutor(String executor) { this.executor = executor; }
    public LocalDateTime getExecutedAt() { return executedAt; }
    public void setExecutedAt(LocalDateTime executedAt) { this.executedAt = executedAt; }
    public String getExecutionResult() { return executionResult; }
    public void setExecutionResult(String executionResult) { this.executionResult = executionResult; }
    public String getResultDetail() { return resultDetail; }
    public void setResultDetail(String resultDetail) { this.resultDetail = resultDetail; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
EOF
echo "✅ CompensationExecution.java"

# 11. CompensationSummary.java
cat > src/main/java/com/compensation/entity/CompensationSummary.java << 'EOF'
package com.compensation.entity;

import com.compensation.enums.ProcessStatus;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "compensation_summary")
public class CompensationSummary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "process_id", unique = true, nullable = false, length = 64)
    private String processId;

    @Column(name = "total_instructions")
    private Integer totalInstructions = 0;

    @Column(name = "success_count")
    private Integer successCount = 0;

    @Column(name = "failed_count")
    private Integer failedCount = 0;

    @Column(name = "pending_count")
    private Integer pendingCount = 0;

    @Column(name = "manual_confirmed_count")
    private Integer manualConfirmedCount = 0;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "overall_status", nullable = false, length = 32)
    private ProcessStatus overallStatus;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getProcessId() { return processId; }
    public void setProcessId(String processId) { this.processId = processId; }
    public Integer getTotalInstructions() { return totalInstructions; }
    public void setTotalInstructions(Integer totalInstructions) { this.totalInstructions = totalInstructions; }
    public Integer getSuccessCount() { return successCount; }
    public void setSuccessCount(Integer successCount) { this.successCount = successCount; }
    public Integer getFailedCount() { return failedCount; }
    public void setFailedCount(Integer failedCount) { this.failedCount = failedCount; }
    public Integer getPendingCount() { return pendingCount; }
    public void setPendingCount(Integer pendingCount) { this.pendingCount = pendingCount; }
    public Integer getManualConfirmedCount() { return manualConfirmedCount; }
    public void setManualConfirmedCount(Integer manualConfirmedCount) { this.manualConfirmedCount = manualConfirmedCount; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
    public ProcessStatus getOverallStatus() { return overallStatus; }
    public void setOverallStatus(ProcessStatus overallStatus) { this.overallStatus = overallStatus; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
EOF
echo "✅ CompensationSummary.java"

# 12. BusinessException.java
cat > src/main/java/com/compensation/exception/BusinessException.java << 'EOF'
package com.compensation.exception;

public class BusinessException extends RuntimeException {

    private final Integer code;

    public BusinessException(String message) {
        super(message);
        this.code = 500;
    }

    public BusinessException(Integer code, String message) {
        super(message);
        this.code = code;
    }

    public Integer getCode() { return code; }
}
EOF
echo "✅ BusinessException.java"

# 13. GlobalExceptionHandler.java
cat > src/main/java/com/compensation/exception/GlobalExceptionHandler.java << 'EOF'
package com.compensation.exception;

import com.compensation.dto.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ApiResponse<Void> handleBusinessException(BusinessException e) {
        return ApiResponse.error(e.getCode(), e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleValidationException(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "));
        return ApiResponse.error(400, message);
    }

    @ExceptionHandler(BindException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleBindException(BindException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "));
        return ApiResponse.error(400, message);
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> handleException(Exception e) {
        return ApiResponse.error(500, "系统异常: " + e.getMessage());
    }
}
EOF
echo "✅ GlobalExceptionHandler.java"

# 14. CompensationService.java - 移除 @RequiredArgsConstructor
cat > src/main/java/com/compensation/service/CompensationService.java << 'EOF'
package com.compensation.service;

import com.compensation.dto.*;
import com.compensation.entity.*;
import com.compensation.enums.InstructionStatus;
import com.compensation.enums.NodeStatus;
import com.compensation.enums.ProcessStatus;
import com.compensation.exception.BusinessException;
import com.compensation.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CompensationService {

    private final BusinessProcessRepository processRepository;
    private final FailedNodeRepository failedNodeRepository;
    private final CompensationInstructionRepository instructionRepository;
    private final CompensationExecutionRepository executionRepository;
    private final CompensationSummaryRepository summaryRepository;

    public CompensationService(BusinessProcessRepository processRepository,
                               FailedNodeRepository failedNodeRepository,
                               CompensationInstructionRepository instructionRepository,
                               CompensationExecutionRepository executionRepository,
                               CompensationSummaryRepository summaryRepository) {
        this.processRepository = processRepository;
        this.failedNodeRepository = failedNodeRepository;
        this.instructionRepository = instructionRepository;
        this.executionRepository = executionRepository;
        this.summaryRepository = summaryRepository;
    }

    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<Map<String, Object>> createCompensation(CreateCompensationRequest request) {
        String processId = request.getProcessId();
        
        if (processRepository.existsByProcessId(processId)) {
            return ApiResponse.success("流程已存在，返回已有数据", getProcessDetailInternal(processId));
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

        return ApiResponse.success("补偿流程创建成功", getProcessDetailInternal(processId));
    }

    public ApiResponse<Map<String, Object>> getProcessDetail(String processId) {
        return ApiResponse.success(getProcessDetailInternal(processId));
    }

    private Map<String, Object> getProcessDetailInternal(String processId) {
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
        return result;
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
            CompensationExecution existExec = executionRepository.findByExecutionId(request.getExecutionId())
                    .orElseThrow(() -> new BusinessException("执行记录不存在"));
            return ApiResponse.success("执行ID已存在，幂等处理", existExec.getInstructionId());
        }

        CompensationInstruction instruction = instructionRepository.findByInstructionId(instructionId)
                .orElseThrow(() -> new BusinessException(404, "指令不存在"));

        if (instruction.getStatus() != InstructionStatus.PENDING) {
            throw new BusinessException("当前状态不允许执行，状态: " + instruction.getStatus());
        }

        List<CompensationInstruction> allInstructions = instructionRepository
                .findByProcessIdOrderByExecutionOrderAsc(instruction.getProcessId());
        
        for (CompensationInstruction prev : allInstructions) {
            if (prev.getExecutionOrder() < instruction.getExecutionOrder()) {
                if (prev.getStatus() != InstructionStatus.SUCCESS && prev.getStatus() != InstructionStatus.SKIPPED) {
                    throw new BusinessException("前序指令未完成: " + prev.getInstructionId() 
                            + " (顺序: " + prev.getExecutionOrder() + ", 状态: " + prev.getStatus() + ")");
                }
            }
        }

        instruction.setStatus(InstructionStatus.EXECUTING);
        instructionRepository.save(instruction);

        boolean success = executeCompensation(instruction, request.getForceFail());
        
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

        String msg = success ? "执行成功" : 
                (instruction.getStatus() == InstructionStatus.FAILED ? "执行失败，已达最大重试次数" : "执行失败，等待重试");
        return ApiResponse.success(msg, instructionId);
    }

    private boolean executeCompensation(CompensationInstruction instruction, Boolean forceFail) {
        return forceFail == null || !forceFail;
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

    public ApiResponse<Map<String, Object>> getNextInstructions(String processId) {
        List<CompensationInstruction> allInstructions = instructionRepository
                .findByProcessIdOrderByExecutionOrderAsc(processId);
        
        CompensationInstruction next = null;
        List<String> blockingReasons = new ArrayList<>();
        
        for (CompensationInstruction inst : allInstructions) {
            if (inst.getStatus() == InstructionStatus.SUCCESS || inst.getStatus() == InstructionStatus.SKIPPED) {
                continue;
            }
            if (inst.getStatus() == InstructionStatus.WAITING_MANUAL_CONFIRM) {
                blockingReasons.add(inst.getInstructionId() + " 等待人工确认 (顺序: " + inst.getExecutionOrder() + ")");
            } else if (inst.getStatus() == InstructionStatus.FAILED) {
                blockingReasons.add(inst.getInstructionId() + " 已失败 (顺序: " + inst.getExecutionOrder() + ")");
            } else if (inst.getStatus() == InstructionStatus.PENDING) {
                if (blockingReasons.isEmpty()) {
                    next = inst;
                }
                blockingReasons.add(inst.getInstructionId() + " 待执行 (顺序: " + inst.getExecutionOrder() + ")");
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("next", next);
        result.put("allPending", blockingReasons);
        result.put("hasNext", next != null);
        
        return ApiResponse.success(result);
    }
}
EOF
echo "✅ CompensationService.java"

# 15. CompensationController.java - 移除 @RequiredArgsConstructor
cat > src/main/java/com/compensation/controller/CompensationController.java << 'EOF'
package com.compensation.controller;

import com.compensation.dto.*;
import com.compensation.service.CompensationService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/compensation")
public class CompensationController {

    private final CompensationService compensationService;

    public CompensationController(CompensationService compensationService) {
        this.compensationService = compensationService;
    }

    @PostMapping
    public ApiResponse<Map<String, Object>> createCompensation(@Valid @RequestBody CreateCompensationRequest request) {
        return compensationService.createCompensation(request);
    }

    @GetMapping("/{processId}")
    public ApiResponse<Map<String, Object>> getProcessDetail(@PathVariable String processId) {
        return compensationService.getProcessDetail(processId);
    }

    @PostMapping("/{processId}/start")
    public ApiResponse<String> startCompensation(@PathVariable String processId) {
        return compensationService.startCompensation(processId);
    }

    @PostMapping("/instruction/{instructionId}/confirm")
    public ApiResponse<String> manualConfirm(
            @PathVariable String instructionId,
            @Valid @RequestBody ManualConfirmRequest request) {
        return compensationService.manualConfirm(instructionId, request);
    }

    @PostMapping("/instruction/{instructionId}/execute")
    public ApiResponse<String> executeInstruction(
            @PathVariable String instructionId,
            @Valid @RequestBody ExecuteInstructionRequest request) {
        return compensationService.executeInstruction(instructionId, request);
    }

    @GetMapping("/{processId}/next")
    public ApiResponse<Map<String, Object>> getNextInstructions(@PathVariable String processId) {
        return compensationService.getNextInstructions(processId);
    }

    @GetMapping("/history")
    public ApiResponse<List<Map<String, Object>>> getHistory(
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime startTime,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime endTime,
            @RequestParam(required = false) String status) {
        return compensationService.getHistory(startTime, endTime, status);
    }

    @GetMapping("/{processId}/export")
    public ApiResponse<String> exportResult(@PathVariable String processId) {
        return compensationService.exportResult(processId);
    }
}
EOF
echo "✅ CompensationController.java"

echo ""
echo "✅ 所有 Lombok 注解已移除，代码可以在任何 JDK 8+ 环境编译！"

package com.devicecommand.service;

import com.devicecommand.dto.ConfirmCommandRequest;
import com.devicecommand.dto.CreateCommandRequest;
import com.devicecommand.entity.*;
import com.devicecommand.enums.CommandStatus;
import com.devicecommand.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class CommandService {

    private static final Logger log = LoggerFactory.getLogger(CommandService.class);

    @Autowired
    private CommandBatchRepository commandBatchRepository;

    @Autowired
    private CommandStatusHistoryRepository statusHistoryRepository;

    @Autowired
    private DeviceRepository deviceRepository;

    @Autowired
    private DispatchChannelRepository channelRepository;

    @Autowired
    private ExecutionConfirmRepository executionConfirmRepository;

    @Autowired
    private TimeoutReasonRepository timeoutReasonRepository;

    @Autowired
    private RetryRecordRepository retryRecordRepository;

    @Transactional
    public CommandBatch createCommand(CreateCommandRequest request) {
        if (commandBatchRepository.existsByBatchNo(request.getBatchNo())) {
            log.info("批次号已存在，直接返回已有记录: {}", request.getBatchNo());
            return commandBatchRepository.findByBatchNo(request.getBatchNo()).get();
        }

        Device device = deviceRepository.findById(request.getDeviceId())
                .orElseThrow(() -> new RuntimeException("设备不存在"));

        CommandBatch command = new CommandBatch();
        command.setBatchNo(request.getBatchNo());
        command.setCommandCode(request.getCommandCode());
        command.setCommandName(request.getCommandName());
        command.setCommandParams(request.getCommandParams());
        command.setDeviceId(request.getDeviceId());
        command.setDeviceCode(request.getDeviceCode());
        command.setChannelId(request.getChannelId());
        command.setChannelCode(request.getChannelCode());
        command.setTimeoutSeconds(request.getTimeoutSeconds());
        command.setMaxRetryCount(request.getMaxRetryCount());
        command.setHandler(request.getHandler());
        command.setStatus(CommandStatus.CREATED);

        command = commandBatchRepository.save(command);
        saveStatusHistory(command, null, CommandStatus.CREATED, "创建命令", request.getHandler());

        return command;
    }

    @Transactional
    public CommandBatch validateCommand(String batchNo, String handler) {
        CommandBatch command = getCommandByBatchNo(batchNo);

        if (command.getStatus() != CommandStatus.CREATED) {
            throw new RuntimeException("当前状态不允许校验");
        }

        if (command.getChannelId() != null) {
            DispatchChannel channel = channelRepository.findById(command.getChannelId())
                    .orElseThrow(() -> new RuntimeException("下发通道不存在"));
            if (!"ACTIVE".equals(channel.getStatus())) {
                throw new RuntimeException("下发通道不可用");
            }
        }

        updateStatus(command, CommandStatus.VALIDATED, "校验通过", handler);
        return command;
    }

    @Transactional
    public CommandBatch dispatchCommand(String batchNo, String handler) {
        CommandBatch command = getCommandByBatchNo(batchNo);

        if (command.getStatus() != CommandStatus.VALIDATED && command.getStatus() != CommandStatus.RETRYING) {
            throw new RuntimeException("当前状态不允许下发");
        }

        LocalDateTime now = LocalDateTime.now();
        command.setDispatchTime(now);
        command.setExpectedConfirmTime(now.plusSeconds(command.getTimeoutSeconds()));
        commandBatchRepository.save(command);

        updateStatus(command, CommandStatus.CONFIRMING, "命令已下发，等待确认", handler);

        log.info("命令已下发: batchNo={}, 预计确认时间={}", batchNo, command.getExpectedConfirmTime());
        return command;
    }

    @Transactional
    public CommandBatch confirmCommand(ConfirmCommandRequest request) {
        CommandBatch command = getCommandByBatchNo(request.getBatchNo());

        if (command.getStatus() != CommandStatus.CONFIRMING && command.getStatus() != CommandStatus.RETRYING) {
            log.warn("当前状态不允许确认: batchNo={}, status={}", request.getBatchNo(), command.getStatus());
            return command;
        }

        String confirmNo = "CFM" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        ExecutionConfirm confirm = new ExecutionConfirm();
        confirm.setBatchId(command.getId());
        confirm.setBatchNo(command.getBatchNo());
        confirm.setConfirmNo(confirmNo);
        confirm.setDeviceId(command.getDeviceId());
        confirm.setDeviceCode(command.getDeviceCode());
        confirm.setConfirmSource(request.getConfirmSource());
        confirm.setConfirmResult(request.getConfirmResult());
        confirm.setResultCode(request.getResultCode());
        confirm.setResultMessage(request.getResultMessage());
        confirm.setResultDetail(request.getResultDetail());
        confirm.setConfirmTime(LocalDateTime.now());
        confirm.setHandler(request.getHandler());
        executionConfirmRepository.save(confirm);

        command.setConfirmTime(LocalDateTime.now());
        command.setResultCode(request.getResultCode());
        command.setResultMessage(request.getResultMessage());

        CommandStatus targetStatus = "SUCCESS".equals(request.getConfirmResult()) 
                ? CommandStatus.SUCCESS : CommandStatus.FAILED;
        
        updateStatus(command, targetStatus, 
                "执行确认: " + request.getConfirmResult() + ", " + request.getResultMessage(), 
                request.getHandler());

        command.setFinalConclusion(buildFinalConclusion(command));
        commandBatchRepository.save(command);

        return command;
    }

    @Transactional
    public void processTimeoutCommands() {
        List<CommandBatch> timeoutCommands = commandBatchRepository.findTimeoutCommands(LocalDateTime.now());
        
        for (CommandBatch command : timeoutCommands) {
            processTimeout(command);
        }
    }

    @Transactional
    public void processTimeout(CommandBatch command) {
        log.info("检测到命令超时: batchNo={}", command.getBatchNo());

        TimeoutReason timeoutReason = new TimeoutReason();
        timeoutReason.setBatchId(command.getId());
        timeoutReason.setBatchNo(command.getBatchNo());
        timeoutReason.setDeviceId(command.getDeviceId());
        timeoutReason.setDeviceCode(command.getDeviceCode());
        timeoutReason.setTimeoutType("CONFIRM_TIMEOUT");
        timeoutReason.setReasonCode("T001");
        timeoutReason.setReasonDescription("设备确认超时");
        timeoutReason.setDetailInfo("超过预计确认时间: " + command.getExpectedConfirmTime());
        timeoutReason.setDetectTime(LocalDateTime.now());
        timeoutReason.setHandler("SYSTEM");
        timeoutReasonRepository.save(timeoutReason);

        if (command.getCurrentRetryCount() < command.getMaxRetryCount()) {
            retryCommand(command, "确认超时，自动补发");
        } else {
            updateStatus(command, CommandStatus.TIMEOUT, 
                    "已达到最大重试次数，超时终止: 当前重试次数=" + command.getCurrentRetryCount(), 
                    "SYSTEM");
            command.setFinalConclusion(buildFinalConclusion(command));
            commandBatchRepository.save(command);
        }
    }

    @Transactional
    public CommandBatch retryCommand(CommandBatch command, String reason) {
        command.setCurrentRetryCount(command.getCurrentRetryCount() + 1);

        String retryNo = "RTY" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        RetryRecord retryRecord = new RetryRecord();
        retryRecord.setBatchId(command.getId());
        retryRecord.setBatchNo(command.getBatchNo());
        retryRecord.setRetryNo(retryNo);
        retryRecord.setDeviceId(command.getDeviceId());
        retryRecord.setDeviceCode(command.getDeviceCode());
        retryRecord.setRetryCount(command.getCurrentRetryCount());
        retryRecord.setChannelId(command.getChannelId());
        retryRecord.setChannelCode(command.getChannelCode());
        retryRecord.setRetryReason(reason);
        retryRecord.setRetryTime(LocalDateTime.now());
        retryRecord.setExpectedConfirmTime(LocalDateTime.now().plusSeconds(command.getTimeoutSeconds()));
        retryRecord.setHandler("SYSTEM");
        retryRecordRepository.save(retryRecord);

        command.setExpectedConfirmTime(retryRecord.getExpectedConfirmTime());
        updateStatus(command, CommandStatus.RETRYING, 
                "第" + command.getCurrentRetryCount() + "次补发: " + reason, 
                "SYSTEM");

        log.info("命令已补发: batchNo={}, retryCount={}", command.getBatchNo(), command.getCurrentRetryCount());
        return command;
    }

    private void updateStatus(CommandBatch command, CommandStatus newStatus, String reason, String handler) {
        CommandStatus oldStatus = command.getStatus();
        command.setStatus(newStatus);
        commandBatchRepository.save(command);
        saveStatusHistory(command, oldStatus, newStatus, reason, handler);
    }

    private void saveStatusHistory(CommandBatch command, CommandStatus fromStatus, CommandStatus toStatus, 
                                   String reason, String handler) {
        CommandStatusHistory history = new CommandStatusHistory();
        history.setBatchId(command.getId());
        history.setBatchNo(command.getBatchNo());
        history.setFromStatus(fromStatus);
        history.setToStatus(toStatus);
        history.setChangeReason(reason);
        history.setHandler(handler);
        statusHistoryRepository.save(history);
    }

    private String buildFinalConclusion(CommandBatch command) {
        StringBuilder sb = new StringBuilder();
        sb.append("最终状态: ").append(command.getStatus().getDescription());
        sb.append(", 下发次数: ").append(command.getCurrentRetryCount() + 1);
        
        if (command.getConfirmTime() != null && command.getDispatchTime() != null) {
            long seconds = java.time.Duration.between(command.getDispatchTime(), command.getConfirmTime()).getSeconds();
            sb.append(", 耗时: ").append(seconds).append("秒");
        }
        
        if (command.getResultMessage() != null) {
            sb.append(", 结果: ").append(command.getResultMessage());
        }
        
        return sb.toString();
    }

    public CommandBatch getCommandByBatchNo(String batchNo) {
        return commandBatchRepository.findByBatchNo(batchNo)
                .orElseThrow(() -> new RuntimeException("命令批次不存在: " + batchNo));
    }

    public List<CommandStatusHistory> getStatusHistory(String batchNo) {
        return statusHistoryRepository.findByBatchNoOrderByCreateTimeAsc(batchNo);
    }

    public List<ExecutionConfirm> getConfirmRecords(String batchNo) {
        return executionConfirmRepository.findByBatchNo(batchNo);
    }

    public List<RetryRecord> getRetryRecords(String batchNo) {
        return retryRecordRepository.findByBatchNo(batchNo);
    }

    public List<TimeoutReason> getTimeoutReasons(String batchNo) {
        return timeoutReasonRepository.findByBatchNo(batchNo);
    }

    public List<CommandBatch> getCommandsByDevice(String deviceCode) {
        return commandBatchRepository.findByDeviceCode(deviceCode);
    }
}

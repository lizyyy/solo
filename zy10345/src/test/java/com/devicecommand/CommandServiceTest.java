package com.devicecommand;

import com.devicecommand.dto.ConfirmCommandRequest;
import com.devicecommand.dto.CreateCommandRequest;
import com.devicecommand.entity.CommandBatch;
import com.devicecommand.entity.CommandStatusHistory;
import com.devicecommand.enums.CommandStatus;
import com.devicecommand.service.CommandService;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class CommandServiceTest {

    private static final Logger log = LoggerFactory.getLogger(CommandServiceTest.class);

    @Autowired
    private CommandService commandService;

    @Test
    void testSuccessFlow() {
        String batchNo = "BATCH-SUCCESS-" + UUID.randomUUID().toString().substring(0, 8);
        String handler = "TEST_USER";

        log.info("========== 成功流测试开始 ==========");

        CreateCommandRequest createRequest = new CreateCommandRequest();
        createRequest.setBatchNo(batchNo);
        createRequest.setCommandCode("REBOOT");
        createRequest.setCommandName("重启设备");
        createRequest.setDeviceId(1L);
        createRequest.setDeviceCode("DEV001");
        createRequest.setChannelId(1L);
        createRequest.setChannelCode("MQTT001");
        createRequest.setTimeoutSeconds(300);
        createRequest.setMaxRetryCount(3);
        createRequest.setHandler(handler);

        CommandBatch command = commandService.createCommand(createRequest);
        assertEquals(CommandStatus.CREATED, command.getStatus());
        log.info("1. 命令创建成功: status={}", command.getStatus());

        command = commandService.validateCommand(batchNo, handler);
        assertEquals(CommandStatus.VALIDATED, command.getStatus());
        log.info("2. 命令校验成功: status={}", command.getStatus());

        command = commandService.dispatchCommand(batchNo, handler);
        assertEquals(CommandStatus.CONFIRMING, command.getStatus());
        log.info("3. 命令下发成功: status={}, expectedConfirmTime={}", 
                command.getStatus(), command.getExpectedConfirmTime());

        ConfirmCommandRequest confirmRequest = new ConfirmCommandRequest();
        confirmRequest.setBatchNo(batchNo);
        confirmRequest.setConfirmResult("SUCCESS");
        confirmRequest.setResultCode("0000");
        confirmRequest.setResultMessage("设备重启成功");
        confirmRequest.setConfirmSource("DEVICE_REPORT");
        confirmRequest.setHandler(handler);

        command = commandService.confirmCommand(confirmRequest);
        assertEquals(CommandStatus.SUCCESS, command.getStatus());
        log.info("4. 命令确认成功: status={}, finalConclusion={}", 
                command.getStatus(), command.getFinalConclusion());

        List<CommandStatusHistory> history = commandService.getStatusHistory(batchNo);
        assertEquals(4, history.size());
        log.info("5. 状态历史完整: 共{}条记录", history.size());
        history.forEach(h -> log.info("   {} -> {} : {}", 
                h.getFromStatus(), h.getToStatus(), h.getChangeReason()));

        log.info("========== 成功流测试完成 ==========");
    }

    @Test
    void testTimeoutRetryFlow() throws InterruptedException {
        String batchNo = "BATCH-TIMEOUT-" + UUID.randomUUID().toString().substring(0, 8);
        String handler = "TEST_USER";

        log.info("========== 超时补发流测试开始 ==========");

        CreateCommandRequest createRequest = new CreateCommandRequest();
        createRequest.setBatchNo(batchNo);
        createRequest.setCommandCode("CONFIG_SYNC");
        createRequest.setCommandName("配置同步");
        createRequest.setDeviceId(1L);
        createRequest.setDeviceCode("DEV001");
        createRequest.setTimeoutSeconds(2);
        createRequest.setMaxRetryCount(2);
        createRequest.setHandler(handler);

        CommandBatch command = commandService.createCommand(createRequest);
        command = commandService.validateCommand(batchNo, handler);
        command = commandService.dispatchCommand(batchNo, handler);
        log.info("1. 命令已下发，超时设置为2秒: expectedConfirmTime={}", command.getExpectedConfirmTime());

        log.info("2. 等待超时...");
        Thread.sleep(3000);

        commandService.processTimeoutCommands();

        command = commandService.getCommandByBatchNo(batchNo);
        assertEquals(CommandStatus.RETRYING, command.getStatus());
        assertEquals(1, command.getCurrentRetryCount());
        log.info("3. 超时已自动补发: status={}, retryCount={}", command.getStatus(), command.getCurrentRetryCount());

        log.info("4. 再次等待超时...");
        Thread.sleep(3000);
        commandService.processTimeoutCommands();

        command = commandService.getCommandByBatchNo(batchNo);
        assertEquals(CommandStatus.RETRYING, command.getStatus());
        assertEquals(2, command.getCurrentRetryCount());
        log.info("5. 第二次补发完成: status={}, retryCount={}", command.getStatus(), command.getCurrentRetryCount());

        log.info("6. 等待最后一次超时...");
        Thread.sleep(3000);
        commandService.processTimeoutCommands();

        command = commandService.getCommandByBatchNo(batchNo);
        assertEquals(CommandStatus.TIMEOUT, command.getStatus());
        log.info("7. 达到最大重试次数，超时终止: status={}, finalConclusion={}", 
                command.getStatus(), command.getFinalConclusion());

        log.info("========== 超时补发流测试完成 ==========");
    }

    @Test
    void testIdempotentCreate() {
        String batchNo = "BATCH-IDEMPOTENT-" + UUID.randomUUID().toString().substring(0, 8);
        String handler = "TEST_USER";

        log.info("========== 幂等性测试开始 ==========");

        CreateCommandRequest createRequest = new CreateCommandRequest();
        createRequest.setBatchNo(batchNo);
        createRequest.setCommandCode("TEST_CMD");
        createRequest.setDeviceId(1L);
        createRequest.setDeviceCode("DEV001");
        createRequest.setHandler(handler);

        CommandBatch command1 = commandService.createCommand(createRequest);
        Long id1 = command1.getId();
        log.info("1. 第一次创建: id={}", id1);

        CommandBatch command2 = commandService.createCommand(createRequest);
        Long id2 = command2.getId();
        log.info("2. 第二次创建: id={}", id2);

        assertEquals(id1, id2);
        log.info("3. 幂等性验证通过: 两次创建返回同一ID");

        log.info("========== 幂等性测试完成 ==========");
    }

    @Test
    void testFailedFlow() {
        String batchNo = "BATCH-FAILED-" + UUID.randomUUID().toString().substring(0, 8);
        String handler = "TEST_USER";

        log.info("========== 失败流测试开始 ==========");

        CreateCommandRequest createRequest = new CreateCommandRequest();
        createRequest.setBatchNo(batchNo);
        createRequest.setCommandCode("FIRMWARE_UPGRADE");
        createRequest.setCommandName("固件升级");
        createRequest.setDeviceId(1L);
        createRequest.setDeviceCode("DEV001");
        createRequest.setHandler(handler);

        CommandBatch command = commandService.createCommand(createRequest);
        command = commandService.validateCommand(batchNo, handler);
        command = commandService.dispatchCommand(batchNo, handler);
        log.info("1. 命令已下发");

        ConfirmCommandRequest confirmRequest = new ConfirmCommandRequest();
        confirmRequest.setBatchNo(batchNo);
        confirmRequest.setConfirmResult("FAILED");
        confirmRequest.setResultCode("E001");
        confirmRequest.setResultMessage("固件校验失败，版本不兼容");
        confirmRequest.setConfirmSource("DEVICE_REPORT");
        confirmRequest.setHandler(handler);

        command = commandService.confirmCommand(confirmRequest);
        assertEquals(CommandStatus.FAILED, command.getStatus());
        log.info("2. 命令确认失败: status={}, finalConclusion={}", 
                command.getStatus(), command.getFinalConclusion());

        log.info("========== 失败流测试完成 ==========");
    }
}

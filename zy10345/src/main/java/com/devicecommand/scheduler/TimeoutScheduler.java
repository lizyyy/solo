package com.devicecommand.scheduler;

import com.devicecommand.service.CommandService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class TimeoutScheduler {

    @Autowired
    private CommandService commandService;

    @Scheduled(fixedDelay = 10000)
    public void checkTimeoutCommands() {
        try {
            commandService.processTimeoutCommands();
        } catch (Exception e) {
            log.error("超时检测任务执行异常", e);
        }
    }
}

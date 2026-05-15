package com.devicecommand.scheduler;

import com.devicecommand.service.CommandService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class TimeoutScheduler {

    private static final Logger log = LoggerFactory.getLogger(TimeoutScheduler.class);

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

package com.tea.compensation.schedule;

import com.tea.compensation.service.CompensationTaskService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class RetryScheduler {

    private final CompensationTaskService taskService;

    @Scheduled(fixedDelayString = "${compensation.queue.retry-interval-minutes:5}000")
    public void processRetryTasks() {
        try {
            taskService.processRetryTasks();
        } catch (Exception e) {
            log.error("定时重试任务执行失败", e);
        }
    }

    @Scheduled(cron = "0 0 * * * ?")
    public void processDeadLetterCheck() {
        try {
            taskService.processDeadLetterCheck();
        } catch (Exception e) {
            log.error("死信检查任务执行失败", e);
        }
    }
}

package com.example.lock.scheduler;

import com.example.lock.service.ResourceLockService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class LockExpirationScheduler {

    private final ResourceLockService lockService;

    @Scheduled(fixedDelay = 10000)
    public void processExpiredLocks() {
        try {
            lockService.processExpiredLocks();
        } catch (Exception e) {
            log.error("处理超时锁时发生异常", e);
        }
    }
}

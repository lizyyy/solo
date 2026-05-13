package com.webhook.sequence.scheduler;

import com.webhook.sequence.service.SequenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class TimeoutScheduler {

    private final SequenceService sequenceService;

    @Scheduled(fixedRate = 5000)
    public void checkTimeouts() {
        sequenceService.checkAndProcessTimeouts();
    }
}

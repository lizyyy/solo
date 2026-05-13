package com.batchqueue.service;

import com.batchqueue.model.entity.ExecutionSlot;
import com.batchqueue.repository.ExecutionSlotRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExecutionSlotService {
    private final ExecutionSlotRepository executionSlotRepository;
    
    @Value("${batchqueue.execution.max-slots:5}")
    private int maxSlots;

    @PostConstruct
    @Transactional
    public void initializeSlots() {
        for (int i = 1; i <= maxSlots; i++) {
            if (!executionSlotRepository.existsBySlotNumber(i)) {
                ExecutionSlot slot = ExecutionSlot.builder()
                        .slotNumber(i)
                        .isOccupied(false)
                        .build();
                executionSlotRepository.save(slot);
                log.info("初始化执行槽位: {}", i);
            }
        }
    }

    public Optional<ExecutionSlot> getAvailableSlot() {
        List<ExecutionSlot> availableSlots = executionSlotRepository.findAvailableSlots();
        return availableSlots.isEmpty() ? Optional.empty() : Optional.of(availableSlots.get(0));
    }

    @Transactional
    public ExecutionSlot occupySlot(Integer slotNumber, Long taskId, String taskName) {
        ExecutionSlot slot = executionSlotRepository.findBySlotNumber(slotNumber)
                .orElseThrow(() -> new IllegalArgumentException("槽位不存在: " + slotNumber));
        slot.setOccupied(true);
        slot.setCurrentTaskId(taskId);
        slot.setCurrentTaskName(taskName);
        slot.setOccupiedAt(LocalDateTime.now());
        return executionSlotRepository.save(slot);
    }

    @Transactional
    public ExecutionSlot releaseSlot(Integer slotNumber) {
        ExecutionSlot slot = executionSlotRepository.findBySlotNumber(slotNumber)
                .orElseThrow(() -> new IllegalArgumentException("槽位不存在: " + slotNumber));
        slot.setOccupied(false);
        slot.setCurrentTaskId(null);
        slot.setCurrentTaskName(null);
        slot.setReleasedAt(LocalDateTime.now());
        return executionSlotRepository.save(slot);
    }

    public long getAvailableSlotCount() {
        return executionSlotRepository.countAvailableSlots();
    }

    public long getOccupiedSlotCount() {
        return executionSlotRepository.countOccupiedSlots();
    }

    public List<ExecutionSlot> getAllSlots() {
        return executionSlotRepository.findAll();
    }
}

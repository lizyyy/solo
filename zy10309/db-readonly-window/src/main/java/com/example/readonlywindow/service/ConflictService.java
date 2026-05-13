package com.example.readonlywindow.service;

import com.example.readonlywindow.entity.ConflictRecord;
import com.example.readonlywindow.entity.EventType;
import com.example.readonlywindow.entity.FreezeWindow;
import com.example.readonlywindow.exception.ResourceNotFoundException;
import com.example.readonlywindow.repository.ConflictRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConflictService {
    private final ConflictRecordRepository conflictRepository;
    private final FreezeWindowService windowService;
    private final TimelineService timelineService;

    @Transactional
    public ConflictRecord recordConflict(String windowCode, String resourceType, String resourceName,
                                         String operationType, String operationDetails, String operator) {
        FreezeWindow window = windowService.getWindowByCode(windowCode);

        String conflictCode;
        do {
            conflictCode = "CNF-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        } while (conflictRepository.existsByConflictCode(conflictCode));

        ConflictRecord conflict = new ConflictRecord();
        conflict.setConflictCode(conflictCode);
        conflict.setFreezeWindow(window);
        conflict.setResourceType(resourceType);
        conflict.setResourceName(resourceName);
        conflict.setOperationType(operationType);
        conflict.setOperationDetails(operationDetails);
        conflict.setOperator(operator);
        conflict.setDetectedAt(LocalDateTime.now());
        conflict.setResolved(false);

        ConflictRecord savedConflict = conflictRepository.save(conflict);

        timelineService.createEvent(
                EventType.CONFLICT_DETECTED,
                window.getId(),
                null, null,
                savedConflict.getId(),
                operator,
                "检测到写入冲突",
                "资源: " + resourceName + ", 操作: " + operationType
        );

        return savedConflict;
    }

    @Transactional
    public ConflictRecord resolveConflict(String conflictCode, String resolution, String resolvedBy) {
        ConflictRecord conflict = getConflictByCode(conflictCode);

        if (conflict.isResolved()) {
            return conflict;
        }

        conflict.setResolved(true);
        conflict.setResolution(resolution);
        conflict.setResolvedBy(resolvedBy);
        conflict.setResolvedAt(LocalDateTime.now());

        return conflictRepository.save(conflict);
    }

    public ConflictRecord getConflictByCode(String conflictCode) {
        return conflictRepository.findByConflictCode(conflictCode)
                .orElseThrow(() -> new ResourceNotFoundException("冲突记录", conflictCode));
    }

    public List<ConflictRecord> getConflictsByWindow(String windowCode) {
        FreezeWindow window = windowService.getWindowByCode(windowCode);
        return conflictRepository.findByFreezeWindowId(window.getId());
    }

    public List<ConflictRecord> getUnresolvedConflictsByWindow(String windowCode) {
        FreezeWindow window = windowService.getWindowByCode(windowCode);
        return conflictRepository.findByFreezeWindowIdAndResolvedFalse(window.getId());
    }

    public List<ConflictRecord> getAllConflicts() {
        return conflictRepository.findAll();
    }
}

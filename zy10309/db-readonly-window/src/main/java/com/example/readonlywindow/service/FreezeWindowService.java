package com.example.readonlywindow.service;

import com.example.readonlywindow.dto.CreateWindowRequest;
import com.example.readonlywindow.entity.*;
import com.example.readonlywindow.exception.BusinessException;
import com.example.readonlywindow.exception.ResourceNotFoundException;
import com.example.readonlywindow.repository.FreezeWindowRepository;
import com.example.readonlywindow.repository.ResourceScopeRepository;
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
public class FreezeWindowService {
    private final FreezeWindowRepository windowRepository;
    private final ResourceScopeRepository scopeRepository;
    private final TimelineService timelineService;

    @Transactional
    public FreezeWindow createWindow(CreateWindowRequest request) {
        if (request.getEndTime().isBefore(request.getStartTime())) {
            throw new BusinessException("INVALID_TIME_RANGE", "结束时间不能早于开始时间");
        }

        String windowCode;
        do {
            windowCode = "WIN-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        } while (windowRepository.existsByWindowCode(windowCode));

        FreezeWindow window = new FreezeWindow();
        window.setWindowCode(windowCode);
        window.setName(request.getName());
        window.setDescription(request.getDescription());
        window.setStatus(WindowStatus.DRAFT);
        window.setStartTime(request.getStartTime());
        window.setEndTime(request.getEndTime());
        window.setCreatedBy(request.getOperator());
        window.setCreatedAt(LocalDateTime.now());
        window.setUpdatedAt(LocalDateTime.now());

        FreezeWindow savedWindow = windowRepository.save(window);

        if (request.getResourceScopes() != null) {
            for (var scopeDTO : request.getResourceScopes()) {
                ResourceScope scope = new ResourceScope();
                scope.setFreezeWindow(savedWindow);
                scope.setResourceType(scopeDTO.getResourceType());
                scope.setResourceName(scopeDTO.getResourceName());
                scope.setSchemaName(scopeDTO.getSchemaName());
                scope.setTableName(scopeDTO.getTableName());
                scope.setCreatedBy(request.getOperator());
                scope.setCreatedAt(LocalDateTime.now());
                savedWindow.getResourceScopes().add(scopeRepository.save(scope));
            }
        }

        timelineService.createEvent(
                EventType.WINDOW_CREATED,
                savedWindow.getId(),
                null, null, null,
                request.getOperator(),
                "创建冻结窗口",
                "窗口名称: " + request.getName() + ", 时间范围: " + request.getStartTime() + " 到 " + request.getEndTime()
        );

        return savedWindow;
    }

    @Transactional
    public FreezeWindow activateWindow(String windowCode, String operator) {
        FreezeWindow window = getWindowByCode(windowCode);

        if (window.getStatus() != WindowStatus.DRAFT) {
            throw new BusinessException("INVALID_STATUS", "只有草稿状态的窗口才能激活");
        }

        window.setStatus(WindowStatus.ACTIVE);
        window.setUpdatedBy(operator);
        window.setUpdatedAt(LocalDateTime.now());

        timelineService.createEvent(
                EventType.WINDOW_ACTIVATED,
                window.getId(),
                null, null, null,
                operator,
                "激活冻结窗口",
                "窗口已激活，开始拦截写入操作"
        );

        return windowRepository.save(window);
    }

    @Transactional
    public FreezeWindow suspendWindow(String windowCode, String operator) {
        FreezeWindow window = getWindowByCode(windowCode);

        if (window.getStatus() != WindowStatus.ACTIVE) {
            throw new BusinessException("INVALID_STATUS", "只有活跃状态的窗口才能暂停");
        }

        window.setStatus(WindowStatus.SUSPENDED);
        window.setUpdatedBy(operator);
        window.setUpdatedAt(LocalDateTime.now());

        timelineService.createEvent(
                EventType.WINDOW_SUSPENDED,
                window.getId(),
                null, null, null,
                operator,
                "暂停冻结窗口",
                "窗口已暂停，暂时解除写入限制"
        );

        return windowRepository.save(window);
    }

    @Transactional
    public FreezeWindow cancelWindow(String windowCode, String operator) {
        FreezeWindow window = getWindowByCode(windowCode);

        if (window.getStatus() == WindowStatus.COMPLETED) {
            throw new BusinessException("INVALID_STATUS", "已完成的窗口不能撤销");
        }

        window.setStatus(WindowStatus.CANCELLED);
        window.setUpdatedBy(operator);
        window.setUpdatedAt(LocalDateTime.now());

        timelineService.createEvent(
                EventType.WINDOW_CANCELLED,
                window.getId(),
                null, null, null,
                operator,
                "撤销冻结窗口",
                "窗口已撤销，写入限制解除"
        );

        return windowRepository.save(window);
    }

    @Transactional
    public FreezeWindow completeWindow(String windowCode, String operator) {
        FreezeWindow window = getWindowByCode(windowCode);

        if (window.getStatus() != WindowStatus.ACTIVE) {
            throw new BusinessException("INVALID_STATUS", "只有活跃状态的窗口才能标记完成");
        }

        window.setStatus(WindowStatus.COMPLETED);
        window.setUpdatedBy(operator);
        window.setUpdatedAt(LocalDateTime.now());

        timelineService.createEvent(
                EventType.WINDOW_COMPLETED,
                window.getId(),
                null, null, null,
                operator,
                "完成冻结窗口",
                "窗口已完成，写入限制解除"
        );

        return windowRepository.save(window);
    }

    public FreezeWindow getWindowByCode(String windowCode) {
        return windowRepository.findByWindowCode(windowCode)
                .orElseThrow(() -> new ResourceNotFoundException("冻结窗口", windowCode));
    }

    public List<FreezeWindow> getAllWindows() {
        return windowRepository.findAll();
    }

    public List<FreezeWindow> getWindowsByStatus(WindowStatus status) {
        return windowRepository.findByStatus(status);
    }

    public List<FreezeWindow> getActiveWindows() {
        LocalDateTime now = LocalDateTime.now();
        return windowRepository.findByStatusAndStartTimeBeforeAndEndTimeAfter(
                WindowStatus.ACTIVE, now, now);
    }

    public boolean isResourceInActiveWindow(String resourceType, String resourceName) {
        List<FreezeWindow> activeWindows = getActiveWindows();
        for (FreezeWindow window : activeWindows) {
            for (ResourceScope scope : window.getResourceScopes()) {
                if (scope.getResourceType().equals(resourceType) &&
                    scope.getResourceName().equals(resourceName)) {
                    return true;
                }
            }
        }
        return false;
    }
}

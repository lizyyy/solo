package com.hotel.lostfound.service;

import com.hotel.lostfound.entity.LostItem;
import com.hotel.lostfound.entity.enums.LostItemStatus;
import com.hotel.lostfound.repository.LostItemRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ScheduledTaskService {

    private static final Logger log = LoggerFactory.getLogger(ScheduledTaskService.class);

    private final LostItemRepository lostItemRepository;
    private final StatusMachineService statusMachineService;

    public ScheduledTaskService(LostItemRepository lostItemRepository, StatusMachineService statusMachineService) {
        this.lostItemRepository = lostItemRepository;
        this.statusMachineService = statusMachineService;
    }

    @Scheduled(cron = "0 0 9 * * ?")
    @Transactional
    public void checkExpiredItems() {
        log.info("开始检查到期物品...");
        
        LocalDateTime now = LocalDateTime.now();
        List<LostItemStatus> excludeStatuses = List.of(
                LostItemStatus.CLAIMED,
                LostItemStatus.MAILED,
                LostItemStatus.DISPOSED,
                LostItemStatus.EXPIRED
        );

        List<LostItem> expiredItems = lostItemRepository
                .findByExpiredTimeBeforeAndStatusNotIn(now, excludeStatuses);

        for (LostItem item : expiredItems) {
            try {
                statusMachineService.transition(item, LostItemStatus.EXPIRED,
                        "SYSTEM", "系统自动标记到期，90天无人认领");
                lostItemRepository.save(item);
                log.info("物品 {} 已标记为到期状态", item.getItemNo());
            } catch (Exception e) {
                log.error("处理到期物品 {} 失败: {}", item.getItemNo(), e.getMessage());
            }
        }

        log.info("到期物品检查完成，共处理 {} 件", expiredItems.size());
    }

    @Scheduled(cron = "0 30 8 * * ?")
    @Transactional(readOnly = true)
    public void sendExpirationReminder() {
        log.info("发送到期提醒...");
        
        LocalDateTime warningTime = LocalDateTime.now().plusDays(7);
        List<LostItemStatus> excludeStatuses = List.of(
                LostItemStatus.CLAIMED,
                LostItemStatus.MAILED,
                LostItemStatus.DISPOSED,
                LostItemStatus.EXPIRED
        );

        List<LostItem> expiringItems = lostItemRepository
                .findByExpiredTimeBeforeAndStatusNotIn(warningTime, excludeStatuses);

        if (!expiringItems.isEmpty()) {
            log.warn("有 {} 件物品将在7天内到期，请及时处理:", expiringItems.size());
            for (LostItem item : expiringItems) {
                log.warn("  - {}: {} (到期时间: {})", 
                        item.getItemNo(), 
                        item.getItemName(),
                        item.getExpiredTime());
            }
        }
    }

    @Scheduled(cron = "0 0 10 * * ?")
    @Transactional(readOnly = true)
    public void checkPendingReviews() {
        log.info("检查待审批贵重物品...");
        
        List<LostItem> pendingItems = lostItemRepository.findPendingManagerReviewItems();
        
        if (!pendingItems.isEmpty()) {
            log.warn("有 {} 件贵重物品等待处置审批:", pendingItems.size());
            for (LostItem item : pendingItems) {
                log.warn("  - {}: {} (价值: {})",
                        item.getItemNo(),
                        item.getItemName(),
                        item.getEstimatedValue());
            }
        }
    }
}

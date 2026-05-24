package com.hotel.lostfound.service;

import com.hotel.lostfound.dto.response.StatisticsVO;
import com.hotel.lostfound.entity.LostItem;
import com.hotel.lostfound.entity.enums.LostItemStatus;
import com.hotel.lostfound.repository.LostItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class StatisticsService {

    private final LostItemRepository lostItemRepository;

    @Transactional(readOnly = true)
    public StatisticsVO getStatistics() {
        StatisticsVO vo = new StatisticsVO();
        vo.setQueryTime(LocalDateTime.now());

        List<LostItem> allItems = lostItemRepository.findAll();
        
        vo.setTotalItems(allItems.size());
        vo.setRegisteredCount(countByStatus(allItems, LostItemStatus.REGISTERED));
        vo.setVerifiedCount(countByStatus(allItems, LostItemStatus.VERIFIED));
        vo.setPendingClaimCount(countByStatus(allItems, LostItemStatus.PENDING_CLAIM));
        vo.setClaimedCount(countByStatus(allItems, LostItemStatus.CLAIMED));
        vo.setMailedCount(countByStatus(allItems, LostItemStatus.MAILED));
        vo.setDisposedCount(countByStatus(allItems, LostItemStatus.DISPOSED));
        vo.setExpiredCount(countByStatus(allItems, LostItemStatus.EXPIRED));
        
        vo.setValuableCount(allItems.stream().filter(LostItem::isValuable).count());
        vo.setPendingReviewCount(allItems.stream()
                .filter(item -> item.isRequireManagerReview() && 
                        item.getStatus() == LostItemStatus.PENDING_DISPOSAL)
                .count());

        LocalDateTime monthStart = LocalDateTime.now().withDayOfMonth(1).withHour(0).withMinute(0);
        vo.setNewItemsThisMonth(allItems.stream()
                .filter(item -> item.getCreatedAt() != null && 
                        item.getCreatedAt().isAfter(monthStart))
                .count());

        Map<String, Long> categoryStats = allItems.stream()
                .collect(Collectors.groupingBy(
                        item -> item.getCategory() != null ? item.getCategory().name() : "UNKNOWN",
                        Collectors.counting()
                ));
        vo.setCategoryStats(categoryStats);

        return vo;
    }

    private long countByStatus(List<LostItem> items, LostItemStatus status) {
        return items.stream()
                .filter(item -> item.getStatus() == status)
                .count();
    }
}

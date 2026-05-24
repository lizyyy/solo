package com.hotel.lostfound.repository;

import com.hotel.lostfound.entity.LostItem;
import com.hotel.lostfound.entity.enums.LostItemStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface LostItemRepository extends JpaRepository<LostItem, Long>, JpaSpecificationExecutor<LostItem> {

    Optional<LostItem> findByItemNo(String itemNo);

    Optional<LostItem> findByRequestId(String requestId);

    boolean existsByItemNo(String itemNo);

    boolean existsByRequestId(String requestId);

    List<LostItem> findByStatusIn(List<LostItemStatus> statuses);

    List<LostItem> findByExpiredTimeBeforeAndStatusNotIn(
            LocalDateTime time,
            List<LostItemStatus> excludeStatuses
    );

    @Query("SELECT l FROM LostItem l WHERE l.isValuable = true AND l.verified = false")
    List<LostItem> findValuableUnverifiedItems();

    @Query("SELECT l FROM LostItem l WHERE l.requireManagerReview = true AND l.status = 'PENDING_DISPOSAL'")
    List<LostItem> findPendingManagerReviewItems();

    @Query("SELECT COUNT(l) FROM LostItem l WHERE l.status = ?1")
    long countByStatus(LostItemStatus status);

    @Query("SELECT COUNT(l) FROM LostItem l WHERE l.createdAt BETWEEN ?1 AND ?2")
    long countByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

    @Query("SELECT l FROM LostItem l WHERE l.ownerPhone = ?1 AND l.status NOT IN ('CLAIMED', 'MAILED', 'DISPOSED')")
    List<LostItem> findActiveItemsByOwnerPhone(String phone);
}

package com.example.lock.repository;

import com.example.lock.entity.WaitQueueItem;
import com.example.lock.enums.LockStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WaitQueueItemRepository extends JpaRepository<WaitQueueItem, Long> {

    List<WaitQueueItem> findByResourceIdOrderByQueuePositionAsc(String resourceId);

    Optional<WaitQueueItem> findByRequestId(String requestId);

    List<WaitQueueItem> findByResourceIdAndStatusOrderByQueuePositionAsc(String resourceId, LockStatus status);

    Optional<WaitQueueItem> findFirstByResourceIdAndStatusOrderByQueuePositionAsc(String resourceId, LockStatus status);

    int countByResourceIdAndStatus(String resourceId, LockStatus status);

    boolean existsByRequestId(String requestId);
}

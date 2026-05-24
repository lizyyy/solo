package com.hotel.lostfound.repository;

import com.hotel.lostfound.entity.ClaimRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClaimRecordRepository extends JpaRepository<ClaimRecord, Long> {

    Optional<ClaimRecord> findByRequestId(String requestId);

    List<ClaimRecord> findByLostItemIdOrderByCreatedAtDesc(Long lostItemId);

    boolean existsByLostItemIdAndApprovedTrue(Long lostItemId);

    long countByLostItemIdAndApprovedTrue(Long lostItemId);
}

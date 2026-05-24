package com.ski.rental.repository;

import com.ski.rental.enums.RentalStatus;
import com.ski.rental.model.RentalOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface RentalOrderRepository extends JpaRepository<RentalOrder, Long> {
    Optional<RentalOrder> findByOrderNo(String orderNo);
    List<RentalOrder> findByBatchNo(String batchNo);
    List<RentalOrder> findByStatus(RentalStatus status);
    List<RentalOrder> findByIsExceptionTrue();
    List<RentalOrder> findByArchivedFalse();

    @Query("SELECT r FROM RentalOrder r WHERE r.snowboard.boardCode = ?1 AND r.status IN ('RENTED', 'RETURN_PENDING', 'RETURN_INSPECTING', 'DAMAGE_FOUND', 'DAMAGE_REVIEWING')")
    List<RentalOrder> findActiveRentalsByBoardCode(String boardCode);

    boolean existsBySnowboardBoardCodeAndStatusIn(String boardCode, List<RentalStatus> statuses);
}

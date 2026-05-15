package com.compensation.repository;

import com.compensation.entity.UndoRequest;
import com.compensation.enums.RequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface UndoRequestRepository extends JpaRepository<UndoRequest, Long> {
    
    Optional<UndoRequest> findByRequestId(String requestId);
    
    boolean existsByRequestId(String requestId);
    
    List<UndoRequest> findByStatus(RequestStatus status);
    
    List<UndoRequest> findByBusinessType(String businessType);
    
    List<UndoRequest> findByBusinessKey(String businessKey);
    
    @Query("SELECT u FROM UndoRequest u WHERE u.status IN :statuses AND u.createdAt BETWEEN :startTime AND :endTime")
    List<UndoRequest> findByStatusInAndCreatedAtBetween(
            @Param("statuses") List<RequestStatus> statuses,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );
    
    @Query("SELECT u FROM UndoRequest u WHERE u.expireTime < :now AND u.status NOT IN :terminalStatuses")
    List<UndoRequest> findExpiredRequests(
            @Param("now") LocalDateTime now,
            @Param("terminalStatuses") List<RequestStatus> terminalStatuses
    );
}

package com.mold.service.domain.repository;

import com.mold.service.domain.entity.MoldExtensionApproval;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MoldExtensionApprovalRepository extends JpaRepository<MoldExtensionApproval, Long> {
    
    Optional<MoldExtensionApproval> findByApprovalNo(String approvalNo);
    
    List<MoldExtensionApproval> findByMoldIdOrderByCreatedAtDesc(Long moldId);
    
    List<MoldExtensionApproval> findByStatusIn(List<MoldExtensionApproval.ApprovalStatus> statuses);
    
    @Query("SELECT a FROM MoldExtensionApproval a WHERE a.moldId = :moldId AND a.status = 'APPROVED' ORDER BY a.createdAt DESC")
    List<MoldExtensionApproval> findApprovedExtensionsByMoldId(Long moldId);
    
    @Query("SELECT COUNT(a) FROM MoldExtensionApproval a WHERE a.status = 'PENDING'")
    Long countPendingApprovals();
}

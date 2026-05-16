package com.privacy.export.repository;

import com.privacy.export.entity.ApprovalNode;
import com.privacy.export.enums.ApprovalNodeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ApprovalNodeRepository extends JpaRepository<ApprovalNode, Long> {

    List<ApprovalNode> findByExportRequestIdOrderBySequenceAsc(Long exportRequestId);

    Optional<ApprovalNode> findByExportRequestIdAndNodeType(Long exportRequestId, ApprovalNodeType nodeType);

    List<ApprovalNode> findByExportRequestIdAndIsCompletedFalse(Long exportRequestId);

    List<ApprovalNode> findByAssignedUserAndIsCompletedFalse(String assignedUser);
}

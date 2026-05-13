package com.apigate.voting.repository;

import com.apigate.voting.model.ChangeProposal;
import com.apigate.voting.model.ProposalStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ChangeProposalRepository extends JpaRepository<ChangeProposal, Long> {
    Optional<ChangeProposal> findByProposalNo(String proposalNo);
    boolean existsByProposalNo(String proposalNo);
    
    Page<ChangeProposal> findByStatus(ProposalStatus status, Pageable pageable);
    
    @Query("SELECT p FROM ChangeProposal p WHERE " +
           "(:proposalNo IS NULL OR p.proposalNo LIKE %:proposalNo%) AND " +
           "(:title IS NULL OR p.title LIKE %:title%) AND " +
           "(:apiName IS NULL OR p.apiName LIKE %:apiName%) AND " +
           "(:status IS NULL OR p.status = :status) AND " +
           "(:submitterId IS NULL OR p.submitter.callerId = :submitterId) AND " +
           "(:startTime IS NULL OR p.createdAt >= :startTime) AND " +
           "(:endTime IS NULL OR p.createdAt <= :endTime)")
    Page<ChangeProposal> findByConditions(
            @Param("proposalNo") String proposalNo,
            @Param("title") String title,
            @Param("apiName") String apiName,
            @Param("status") ProposalStatus status,
            @Param("submitterId") String submitterId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            Pageable pageable);
    
    @Query("SELECT p FROM ChangeProposal p WHERE p.status = 'VOTING' AND p.votingEndTime <= :now")
    List<ChangeProposal> findExpiredVotingProposals(@Param("now") LocalDateTime now);
    
    @Query("SELECT p FROM ChangeProposal p WHERE p.status IN :statuses")
    List<ChangeProposal> findByStatusIn(@Param("statuses") List<ProposalStatus> statuses);
}

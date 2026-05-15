package com.crossborder.approval.repository;

import com.crossborder.approval.model.entity.DataAccessApplication;
import com.crossborder.approval.model.enums.ApplicationStatus;
import com.crossborder.approval.model.enums.RegionType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DataAccessApplicationRepository extends JpaRepository<DataAccessApplication, Long> {

    Optional<DataAccessApplication> findByApplicationNo(String applicationNo);

    List<DataAccessApplication> findByApplicantId(String applicantId);

    List<DataAccessApplication> findByStatus(ApplicationStatus status);

    List<DataAccessApplication> findByTargetRegion(RegionType targetRegion);

    @Query("SELECT a FROM DataAccessApplication a WHERE a.applicantId = :applicantId " +
           "AND a.dataDomain.id = :dataDomainId AND a.targetRegion = :targetRegion " +
           "AND a.status IN ('DRAFT', 'PENDING_REGION_VALIDATION', 'REGION_VALIDATED', 'PENDING_APPROVAL', 'APPROVED', 'TOKEN_ISSUED')")
    List<DataAccessApplication> findDuplicateApplications(
            @Param("applicantId") String applicantId,
            @Param("dataDomainId") Long dataDomainId,
            @Param("targetRegion") RegionType targetRegion);

    boolean existsByApplicationNo(String applicationNo);
}

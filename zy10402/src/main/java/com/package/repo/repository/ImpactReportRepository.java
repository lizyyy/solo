package com.package.repo.repository;

import com.package.repo.model.entity.ImpactReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ImpactReportRepository extends JpaRepository<ImpactReport, Long> {

    List<ImpactReport> findByWithdrawRequestRequestIdOrderByImpactLevelDesc(String requestId);

    List<ImpactReport> findByRequiresCompensationTrue();
}

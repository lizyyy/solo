package com.package.repo.repository;

import com.package.repo.model.entity.WithdrawRequest;
import com.package.repo.model.enums.ArbitrationResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WithdrawRequestRepository extends JpaRepository<WithdrawRequest, Long> {

    Optional<WithdrawRequest> findByRequestId(String requestId);

    List<WithdrawRequest> findByArbitrationResult(ArbitrationResult result);

    @Query("SELECT w FROM WithdrawRequest w JOIN w.packageVersion p WHERE p.packageName = :packageName AND p.version = :version ORDER BY w.requestTime DESC")
    List<WithdrawRequest> findByPackageNameAndVersion(String packageName, String version);

    List<WithdrawRequest> findByRequester(String requester);

    boolean existsByRequestId(String requestId);

    @Query("SELECT w FROM WithdrawRequest w ORDER BY w.requestTime DESC")
    List<WithdrawRequest> findAllOrderByRequestTimeDesc();
}

package com.riskcontrol.graylist.repository;

import com.riskcontrol.graylist.entity.ImportResultDetail;
import com.riskcontrol.graylist.enums.ImportResultType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ImportResultDetailRepository extends JpaRepository<ImportResultDetail, Long> {

    List<ImportResultDetail> findByBatchNo(String batchNo);

    List<ImportResultDetail> findByBatchNoAndResultType(String batchNo, ImportResultType resultType);

    int countByBatchNoAndResultType(String batchNo, ImportResultType resultType);
}

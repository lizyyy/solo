package com.livestock.transfer.repository;

import com.livestock.transfer.entity.TransferEarTag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TransferEarTagRepository extends JpaRepository<TransferEarTag, Long> {
    List<TransferEarTag> findByTransferId(Long transferId);
    
    @Query("SELECT t FROM TransferEarTag t WHERE t.tagNo = :tagNo AND t.transferId != :excludeTransferId")
    List<TransferEarTag> findByTagNoExcludeTransfer(@Param("tagNo") String tagNo, @Param("excludeTransferId") Long excludeTransferId);
    
    void deleteByTransferId(Long transferId);
}

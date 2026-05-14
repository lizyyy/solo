package com.feiyong.feecalc.repository;

import com.feiyong.feecalc.entity.FeeDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FeeDetailRepository extends JpaRepository<FeeDetail, Long> {

    List<FeeDetail> findByRequestNoOrderBySortOrder(String requestNo);

    void deleteByRequestNo(String requestNo);
}

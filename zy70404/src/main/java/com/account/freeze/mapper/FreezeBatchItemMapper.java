package com.account.freeze.mapper;

import com.account.freeze.entity.FreezeBatchItem;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface FreezeBatchItemMapper extends BaseMapper<FreezeBatchItem> {

    @Select("SELECT * FROM freeze_batch_item WHERE batch_id = #{batchId} AND deleted = 0")
    List<FreezeBatchItem> selectByBatchId(@Param("batchId") Long batchId);

    @Select("SELECT COUNT(*) FROM freeze_batch_item WHERE batch_id = #{batchId} AND status = #{status} AND deleted = 0")
    Integer countByBatchIdAndStatus(@Param("batchId") Long batchId, @Param("status") String status);
}

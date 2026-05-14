package com.account.freeze.mapper;

import com.account.freeze.entity.FreezeBatch;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface FreezeBatchMapper extends BaseMapper<FreezeBatch> {

    @Select("SELECT * FROM freeze_batch WHERE input_hash = #{inputHash} AND deleted = 0 LIMIT 1")
    FreezeBatch selectByInputHash(@Param("inputHash") String inputHash);
}

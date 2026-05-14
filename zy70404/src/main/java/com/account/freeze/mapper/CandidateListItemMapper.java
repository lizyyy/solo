package com.account.freeze.mapper;

import com.account.freeze.entity.CandidateListItem;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface CandidateListItemMapper extends BaseMapper<CandidateListItem> {

    @Select("SELECT * FROM candidate_list_item WHERE list_id = #{listId} AND deleted = 0")
    List<CandidateListItem> selectByListId(@Param("listId") Long listId);
}

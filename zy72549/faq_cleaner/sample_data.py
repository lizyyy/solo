from datetime import datetime, timedelta
from typing import List, Tuple
from .models import FAQRecord, ManualCorrection, RecordStatus, RecordSource


def create_sample_data() -> Tuple[List[FAQRecord], List[ManualCorrection], List[FAQRecord]]:
    now = datetime.now()
    yesterday = now - timedelta(days=1)
    three_days_ago = now - timedelta(days=3)

    manual_corrections = [
        ManualCorrection(
            correction_id="corr_001",
            faq_id="faq_002",
            original_question="怎么开发票？",
            original_answer="在订单页点击申请发票",
            corrected_question="如何申请开具发票？开票流程是什么？",
            corrected_answer="登录后进入【我的订单】，找到对应订单点击【申请发票】，填写发票信息后提交，一般3-5个工作日开出。电子发票将发送至您的邮箱，纸质发票将快递寄出。",
            remark="用户经常找不到开票入口，需要把路径写得更详细，补充电子发票和纸质发票的区别",
            operator="老唐",
            correction_time=yesterday,
            batch_id="batch_20260606",
            is_overwritten=True,
            overwritten_by_batch="batch_20260607",
            overwritten_time=now,
        ),
        ManualCorrection(
            correction_id="corr_002",
            faq_id="faq_003",
            original_question="退款多久到账？",
            original_answer="3个工作日",
            corrected_question="申请退款后多久能到账？",
            corrected_answer="退款审核通过后，微信/支付宝支付的订单1-2个工作日原路退回，银行卡支付的订单3-5个工作日到账。如超时未到账请联系客服。",
            remark="旧口径：统一说3个工作日。新口径要区分支付渠道，补充联系客服的指引。这是从历史人工改判表补录的旧口径数据",
            operator="老王",
            correction_time=three_days_ago,
            batch_id="batch_20260604",
            is_overwritten=False,
        ),
    ]

    model_output_records = [
        FAQRecord(
            faq_id="faq_001",
            question="怎么修改收货地址？",
            answer="登录账户后，进入【个人中心】-【收货地址管理】，可以添加、编辑或删除收货地址。下单时也可以直接新增地址。",
            source=RecordSource.MODEL_OUTPUT,
            status=RecordStatus.NORMAL,
            create_time=now,
            update_time=now,
            batch_id="batch_20260607",
            model_output_snippet="用户询问修改收货地址的方法，模型根据知识库中的地址管理流程生成回答...",
        ),
        FAQRecord(
            faq_id="faq_002",
            question="如何开票？",
            answer="在订单详情页申请开票即可。",
            source=RecordSource.MODEL_OUTPUT,
            status=RecordStatus.NORMAL,
            create_time=now,
            update_time=now,
            batch_id="batch_20260607",
            model_output_snippet="模型根据最新知识库生成的简短回答，覆盖了昨日的人工改判版本...",
        ),
    ]

    supplement_records = [
        FAQRecord(
            faq_id="faq_003",
            question="退款多久到账？",
            answer="3个工作日",
            source=RecordSource.MODEL_OUTPUT,
            status=RecordStatus.NORMAL,
            create_time=three_days_ago,
            update_time=three_days_ago,
            batch_id="batch_20260604",
            model_output_snippet="旧批次的模型输出，使用旧口径...",
        ),
    ]

    return model_output_records, manual_corrections, supplement_records


def create_conflict_sample() -> Tuple[List[FAQRecord], List[ManualCorrection]]:
    now = datetime.now()
    yesterday = now - timedelta(days=1)

    manual_corrections = [
        ManualCorrection(
            correction_id="corr_003",
            faq_id="faq_004",
            original_question="会员有什么权益？",
            original_answer="享受折扣",
            corrected_question="VIP会员享有哪些专属权益？",
            corrected_answer="VIP会员专享：1）全场9折优惠；2）每月5张优惠券；3）专属客服通道；4）生日双倍积分；5）优先发货。",
            remark="模型漏了专属客服和生日积分权益，必须改全",
            operator="老唐",
            correction_time=yesterday,
            batch_id="batch_20260606",
            is_overwritten=False,
        ),
    ]

    model_output_records = [
        FAQRecord(
            faq_id="faq_004",
            question="会员有什么权益？",
            answer="会员享受全场9折优惠，每月可领优惠券，还有优先发货服务。",
            source=RecordSource.MODEL_OUTPUT,
            status=RecordStatus.NORMAL,
            create_time=now,
            update_time=now,
            batch_id="batch_20260607",
            model_output_snippet="模型生成的会员权益回答，但不完整...",
        ),
    ]

    return model_output_records, manual_corrections

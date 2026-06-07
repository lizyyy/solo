from core import (
    import_tuner_comment,
    supplement_rehearsal_signup,
    manual_correct,
    rerun_review,
    review_rework_complete,
)
from models import DemoReview, NextStep


def create_demo_review() -> DemoReview:
    review = import_tuner_comment(
        song_name="夏天的风",
        track_name="主唱人声",
        comment="人声整体还行，但第二段副歌有两个字咬字不对，需要返工重唱，另外注意口径统一",
    )

    review = supplement_rehearsal_signup(
        review=review,
        signer="小明",
        remark="收到，这周排练会补录第二段，上次口径确实没对齐",
    )

    review = manual_correct(
        review=review,
        why_kept="人工确认：确实是口径问题，第二段需要重录，已和主唱沟通",
        missing_materials=["重录后的音频文件"],
        next_step=NextStep.CONTACT_COPYRIGHT_OPS,
    )

    review = rerun_review(review)

    return review


def create_normal_demo_review() -> DemoReview:
    review = import_tuner_comment(
        song_name="晴天",
        track_name="吉他伴奏",
        comment="音准、节奏都没问题，音色也很好",
    )

    review = supplement_rehearsal_signup(
        review=review,
        signer="小红",
        remark="没问题，排练时直接用",
    )

    return review


def create_three_step_demo() -> DemoReview:
    review = import_tuner_comment(
        song_name="稻香",
        track_name="合声",
        comment="合声部分有一处跑调，需要返工，另外第三段音量有点小",
    )

    review = supplement_rehearsal_signup(
        review=review,
        signer="合唱团",
        remark="收到，下周一重录合声部分，会注意音量",
    )

    review = review_rework_complete(review)

    return review

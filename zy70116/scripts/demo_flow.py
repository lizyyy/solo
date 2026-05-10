import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from decimal import Decimal
from app.database import SessionLocal
from app.models.store import Store
from app.models.account import PrepaidAccount
from app.services.account_service import DepositService, ConsumeService, AccountService
from app.services.refund_service import RefundRequestService, RefundCalculationService, RefundVoidService
from app.services.settlement_service import SettlementService


def print_account(account: PrepaidAccount, title: str):
    print(f"\n=== {title} ===")
    print(f"账户: {account.account_no} ({account.member_name})")
    print(f"  本金余额: {account.principal_balance}")
    print(f"  赠金余额: {account.bonus_balance}")
    print(f"  总余额  : {account.total_balance}")
    print(f"  累计充值: {account.total_deposited}")
    print(f"  累计赠金: {account.total_bonus}")
    print(f"  累计消费: {account.total_consumed}")
    print(f"  累计退款: {account.total_refunded}")


def run_demo():
    db = SessionLocal()
    
    try:
        store = db.query(Store).first()
        if not store:
            print("请先运行 init_db.py 初始化数据")
            return
        
        account = db.query(PrepaidAccount).filter(
            PrepaidAccount.account_no == "TEST001"
        ).first()
        if not account:
            print("测试账户不存在")
            return
        
        print("=" * 60)
        print("餐饮储值卡退款系统 - 业务演示")
        print("=" * 60)
        
        print_account(account, "初始状态")
        
        print("\n--- 1. 充值 2000 元 (按规则应送 300 赠金) ---")
        deposit1 = DepositService.create_deposit(
            db=db,
            account=account,
            store_id=store.id,
            deposit_amount=Decimal("2000"),
            operator="demo"
        )
        db.commit()
        db.refresh(account)
        print(f"充值单号: {deposit1.order_no}")
        print(f"本金: {deposit1.deposit_amount}, 赠金: {deposit1.bonus_amount}")
        print_account(account, "充值后")
        
        print("\n--- 2. 消费 500 元 (FIFO: 先扣充值的本金) ---")
        consume1 = ConsumeService.create_consume(
            db=db,
            account=account,
            store_id=store.id,
            total_amount=Decimal("500"),
            operator="demo"
        )
        db.commit()
        db.refresh(account)
        print(f"消费单号: {consume1.order_no}")
        print(f"本金支付: {consume1.principal_paid}, 赠金支付: {consume1.bonus_paid}")
        print_account(account, "第一次消费后")
        
        print("\n--- 3. 再消费 1500 元 (用完本金后开始扣赠金) ---")
        consume2 = ConsumeService.create_consume(
            db=db,
            account=account,
            store_id=store.id,
            total_amount=Decimal("1500"),
            operator="demo"
        )
        db.commit()
        db.refresh(account)
        print(f"消费单号: {consume2.order_no}")
        print(f"本金支付: {consume2.principal_paid}, 赠金支付: {consume2.bonus_paid}")
        print_account(account, "第二次消费后")
        
        print("\n--- 4. 退款预览: 申请退款 1000 元 ---")
        preview = RefundCalculationService.calculate_refund(db, account, Decimal("1000"))
        print(f"请求金额: 1000")
        print(f"实际可退: {preview.total_refund}")
        print(f"  - 本金退款: {preview.principal_refund}")
        print(f"  - 赠金退款: {preview.bonus_refund}")
        print(f"  - 赠金没收: {preview.bonus_forfeit}")
        print(f"  (赠金部分消费后退款会被没收，这是关键规则)")
        
        print("\n--- 5. 创建退款申请 ---")
        request = RefundRequestService.create_request(
            db=db,
            account=account,
            store_id=store.id,
            requested_amount=Decimal("1000"),
            reason_type="customer_complain",
            reason_detail="菜品不满意",
            operator="waiter"
        )
        db.commit()
        print(f"申请单号: {request.request_no}")
        print(f"申请金额: {request.requested_amount}")
        print(f"状态: {request.status}")
        
        print("\n--- 6. 审批通过 ---")
        refund_order = RefundRequestService.approve_request(
            db=db,
            request=request,
            approver="manager",
            approval_remark="情况属实，同意退款"
        )
        db.commit()
        db.refresh(account)
        print(f"退款单号: {refund_order.order_no}")
        print(f"总退款: {refund_order.total_refund}")
        print(f"  - 本金退款: {refund_order.principal_refund}")
        print(f"  - 赠金退款: {refund_order.bonus_refund}")
        print(f"  - 赠金没收: {refund_order.bonus_forfeit}")
        print_account(account, "退款后")
        
        print("\n--- 7. 撤回退款 (演示撤销功能) ---")
        voided_order = RefundVoidService.void_refund(
            db=db,
            refund_order=refund_order,
            void_reason="客户放弃退款",
            operator="manager"
        )
        db.commit()
        db.refresh(account)
        print(f"原退款单已作废: {voided_order.is_void}")
        print_account(account, "撤回退款后")
        
        print("\n--- 8. 门店分账 (按月份) ---")
        from datetime import datetime
        period = datetime.now().strftime("%Y-%m")
        settlement = SettlementService.calculate_store_settlement(
            db=db,
            store_id=store.id,
            settlement_period=period,
            operator="finance"
        )
        db.commit()
        print(f"结算单号: {settlement.settlement_no}")
        print(f"结算周期: {settlement.settlement_period}")
        print(f"  充值笔数: {settlement.deposit_count}, 金额: {settlement.deposit_amount}")
        print(f"  消费笔数: {settlement.consume_count}, 金额: {settlement.consume_amount}")
        print(f"  退款笔数: {settlement.refund_count}, 金额: {settlement.refund_amount}")
        print(f"  净结算: {settlement.net_amount}")
        
        print("\n" + "=" * 60)
        print("演示完成！")
        print("=" * 60)
        print("\n关键规则总结:")
        print("1. 消费采用 FIFO: 先充先消费，每笔充值独立追踪剩余额")
        print("2. 退款按消费逆序: 后消费的先退")
        print("3. 赠金没收: 消费时用的赠金，退款时不予退还")
        print("4. 全程留痕: 流水、操作历史、作废记录全部保留")
        print("5. 分账按门店+月份: 充值/消费/退款分别汇总")
        
    except Exception as e:
        db.rollback()
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    run_demo()

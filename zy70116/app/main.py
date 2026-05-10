from fastapi import FastAPI
from contextlib import asynccontextmanager

from .config import settings
from .database import engine, Base

from .models.store import Store
from .models.account import PrepaidAccount, BonusRule
from .models.deposit import DepositOrder, DepositConsumption, DepositRefund
from .models.consume import ConsumeOrder
from .models.refund import RefundRequest, RefundOrder, RefundConsume
from .models.settlement import StoreSettlement, SettlementDetail
from .models.journal import AccountJournal, OperationHistory

from .routers import store, account, transaction, refund, settlement, export


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    lifespan=lifespan
)

app.include_router(store.router)
app.include_router(account.router)
app.include_router(transaction.router)
app.include_router(refund.router)
app.include_router(settlement.router)
app.include_router(export.router)


@app.get("/")
def root():
    return {
        "app": settings.app_name,
        "version": settings.version,
        "docs": "/docs",
        "redoc": "/redoc"
    }

from fastapi import APIRouter
from app.api.routes import health, alerts, analyses, dashboard, evaluation, knowledge

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
api_router.include_router(analyses.router, prefix="/analyses", tags=["analyses"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(evaluation.router, prefix="/evaluation", tags=["evaluation"])
api_router.include_router(knowledge.router, prefix="/knowledge", tags=["knowledge"])

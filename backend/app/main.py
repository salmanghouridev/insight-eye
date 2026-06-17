from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import session, websocket
from app.db.session import engine, Base

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="InsightEye production-ready backend for real-time eye analytics streaming and session management.",
    version="2.0.0"
)

# Configure CORS Middleware
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Register endpoints routers
app.include_router(session.router, prefix=settings.API_V1_STR)
app.include_router(websocket.router)

@app.on_event("startup")
async def startup_event():
    # Async database schema initialization
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[Database] Schema tables initialized.")

@app.get("/", tags=["root"])
def read_root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": "2.0.0",
        "docs": "/docs"
    }

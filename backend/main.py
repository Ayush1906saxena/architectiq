from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from api import health, lessons, tts, quiz, progress, curriculum, design_challenge, ask, interview, auth, history
from db.database import init_db
from middleware.security import RateLimitMiddleware, RequestSizeLimitMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="ArchitectIQ API", version="0.1.0", lifespan=lifespan)

# Security middleware (order matters — outermost runs first)
app.add_middleware(RequestSizeLimitMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(lessons.router, prefix="/api", tags=["lessons"])
app.include_router(tts.router, prefix="/api", tags=["tts"])
app.include_router(quiz.router, prefix="/api", tags=["quiz"])
app.include_router(progress.router, prefix="/api", tags=["progress"])
app.include_router(curriculum.router, prefix="/api", tags=["curriculum"])
app.include_router(design_challenge.router, prefix="/api", tags=["design-challenge"])
app.include_router(ask.router, prefix="/api", tags=["ask"])
app.include_router(interview.router, prefix="/api", tags=["interview"])
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(history.router, prefix="/api", tags=["history"])

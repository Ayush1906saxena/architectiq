from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from api import health, lessons, tts, quiz, progress, curriculum, design_challenge, ask, interview
from db.database import init_db

app = FastAPI(title="ArchitectIQ API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.on_event("startup")
async def startup():
    await init_db()

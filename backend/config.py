from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    content_dir: str = str(Path(__file__).parent.parent / "content")
    tts_cache_dir: str = str(Path(__file__).parent.parent / "data" / "tts_cache")
    db_path: str = str(Path(__file__).parent.parent / "data" / "architectiq.db")

    # LLM provider: "groq" (cloud, free) or "ollama" (local)
    llm_provider: str = "groq"
    groq_api_key: str = ""
    groq_model: str = "llama-3.1-8b-instant"
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"

    # JWT auth
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080  # 7 days

    # OAuth — Google
    google_client_id: str = ""
    google_client_secret: str = ""

    # OAuth — GitHub
    github_client_id: str = ""
    github_client_secret: str = ""

    # Frontend URL (for OAuth redirect)
    frontend_url: str = "http://localhost:3000"

    cors_origins: list[str] = [
        "http://localhost:3000", "http://localhost:3001", "http://localhost:3002",
        "http://localhost:3003", "http://localhost:3004", "http://localhost:3005",
    ]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

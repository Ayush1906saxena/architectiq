from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # Runtime environment: "development" or "production". In production the app
    # refuses to start with an insecure JWT secret (see validate_runtime()).
    app_env: str = "development"

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

    # Auth cookie attributes. For a truly cross-site frontend/backend (different
    # registrable domains) set cookie_samesite="none" and cookie_secure=true.
    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    cors_origins: list[str] = [
        "http://localhost:3000", "http://localhost:3001", "http://localhost:3002",
        "http://localhost:3003", "http://localhost:3004", "http://localhost:3005",
    ]

    class Config:
        env_file = ".env"
        extra = "ignore"

    def validate_runtime(self) -> None:
        """Fail fast on insecure configuration in production.

        Called at startup (not import) so tests and local dev aren't blocked.
        """
        if self.app_env.lower() == "production":
            if self.jwt_secret in ("", "change-me-in-production") or len(self.jwt_secret) < 32:
                raise RuntimeError(
                    "JWT_SECRET must be set to a strong (>=32 char) value in production. "
                    "Refusing to start with the default/empty secret."
                )


settings = Settings()

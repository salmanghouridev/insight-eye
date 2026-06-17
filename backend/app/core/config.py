import os
import socket
from typing import List

def get_db_host() -> str:
    """
    Detects if the application is running inside a Docker container network 
    by attempting to resolve the 'db' hostname, falling back to 'localhost'.
    """
    try:
        socket.gethostbyname("db")
        return "db"
    except socket.gaierror:
        return "localhost"

class Settings:
    PROJECT_NAME: str = "InsightEye Analytics Service"
    API_V1_STR: str = "/api"
    
    # CORS Origins
    BACKEND_CORS_ORIGINS: List[str] = ["*"]
    
    # Server configuration
    PORT: int = int(os.getenv("PORT", 8000))

    # Database Configuration - Default to SQLite for easy local runs
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite+aiosqlite:///./insighteye.db"
    )

    # NLP Report Engine Configuration
    DB_HOST: str = get_db_host()
    OLLAMA_HOST: str = "host.docker.internal" if DB_HOST == "db" else "localhost"
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", f"http://{OLLAMA_HOST}:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3")

settings = Settings()

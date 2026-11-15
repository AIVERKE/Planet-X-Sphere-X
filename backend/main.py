import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Certificados del SO (Windows): evita fallos SSL al hablar con IRSA.
try:
    import truststore

    truststore.inject_into_ssl()
except ImportError:
    pass

from routers import cutouts, example, observations, presets

load_dotenv()

app = FastAPI(title="Planet-X Sphere-X API", version="0.1.0")

cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(example.router, prefix="/api")
app.include_router(observations.router, prefix="/api")
app.include_router(cutouts.router, prefix="/api")
app.include_router(presets.router, prefix="/api")

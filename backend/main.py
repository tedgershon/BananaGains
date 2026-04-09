from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from routers import admin, auth, bets, leaderboard, markets, notifications, portfolio, resolution, rewards

app = FastAPI(title="BananaGains API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(auth.router)
app.include_router(markets.router)
app.include_router(bets.router)
app.include_router(notifications.router)
app.include_router(portfolio.router)
app.include_router(leaderboard.router)
app.include_router(resolution.router)
app.include_router(rewards.router)


@app.get("/")
def health_check():
    return {"status": "ok", "service": "bananagains-api"}

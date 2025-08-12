# main.py
from fastapi import FastAPI
from contextlib import asynccontextmanager
import asyncio
import httpx
import escrowService
import userService
import propertyService
from xrpl.wallet import Wallet

from config import client, WALLET_SEED
from database import create_db_and_tables

# Global variable to hold our wallet
# This will be shared with the escrowService
shared_wallet = None

async def get_wallet_from_faucet() -> Wallet:
    """Manually and asynchronously gets a new funded wallet from the testnet faucet."""
    faucet_url = "https://faucet.altnet.rippletest.net/accounts"
    async with httpx.AsyncClient() as http_client:
        response = await http_client.post(faucet_url)
        if response.status_code != 200:
            print(f"Faucet API returned status {response.status_code} with body: {response.text}")
            response.raise_for_status()
        
        data = response.json()

        print(f"Faucet response: {data}")
        
        if "seed" not in data:
            print(f"Faucet response did not contain expected 'seed' key. Full response: {data}")
            raise KeyError("Faucet response did not contain seed")

        return Wallet(seed=data["seed"])

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles application startup and shutdown."""
    # Create the database and tables
    create_db_and_tables()

    global shared_wallet
    if WALLET_SEED:
        shared_wallet = Wallet.from_seed(WALLET_SEED)
        print(f"Loaded wallet from .env: {shared_wallet.classic_address}")
    else:
        print("No WALLET_SEED found. Generating a new wallet from faucet...")
        try:
            shared_wallet = await get_wallet_from_faucet()
            print("--- URGENT: SAVE THIS SEED ---")
            print(f"Generated new wallet address: {shared_wallet.classic_address}")
            print(f"Generated new wallet seed: {shared_wallet.seed}")
            print(f"Add this to your .env file: WALLET_SEED={shared_wallet.seed}")
            print("---------------------------------")
        except Exception as e:
            print(f"FATAL: Could not get wallet from faucet. The application cannot start. Error: {e}")
            shared_wallet = None
    
    # This is the dependency injection step
    escrowService.wallet = shared_wallet

    yield
    # This code runs on shutdown

app = FastAPI(lifespan=lifespan)
app.include_router(escrowService.router)
app.include_router(userService.router)
app.include_router(propertyService.router)


@app.get("/")
def read_root():
    if shared_wallet:
        return {"message": "XRPL Escrow Backend is running", "wallet_address": shared_wallet.classic_address}
    return {"message": "XRPL Escrow Backend is starting or failed to start. Check logs."}
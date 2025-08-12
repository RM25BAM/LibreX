# config.py
import os
from dotenv import load_dotenv
from xrpl.asyncio.clients import AsyncJsonRpcClient

load_dotenv()

JSON_RPC_URL = os.getenv("JSON_RPC_URL", "https://s.altnet.rippletest.net:51234/")
client = AsyncJsonRpcClient(JSON_RPC_URL)
WALLET_SEED = os.getenv("WALLET_SEED")


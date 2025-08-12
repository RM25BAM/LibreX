from xrpl.clients import JsonRpcClient
from xrpl.wallet import Wallet
from xrpl.models.transactions import EscrowCreate
from xrpl.transaction import submit_and_wait  # v2+
from xrpl.utils import xrp_to_drops, datetime_to_ripple_time
import datetime as dt
import os
from dotenv import load_dotenv

load_dotenv()

client = JsonRpcClient("https://s.altnet.rippletest.net:51234")
wallet = Wallet.from_seed(os.getenv("WALLET_SEED"))

tx = EscrowCreate(
    account=wallet.classic_address,
    destination="rDjrFgaC28BuujfDyFdPErnYRCn9uhTCr5",
    amount=xrp_to_drops(1),
    finish_after=datetime_to_ripple_time(dt.datetime.utcnow() + dt.timedelta(hours=1)),
)

resp = submit_and_wait(tx, client, wallet)  # autofills + signs + waits
print(resp.result)






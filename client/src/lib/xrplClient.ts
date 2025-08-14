// src/lib/xrplClient.ts
import { Client } from "xrpl";

const XRPL_WS = "wss://s.altnet.rippletest.net:51233"; // XRPL Testnet

let client: Client | null = null;

export async function getClient(): Promise<Client> {
  if (client && client.isConnected()) return client;
  client = new Client(XRPL_WS);
  await client.connect();
  return client;
}

export async function getXrpBalance(address: string): Promise<string> {
  const c = await getClient();
  const acc = await c.request({
    command: "account_info",
    account: address,
    ledger_index: "validated",
  });
  // XRP is in drops (1 XRP = 1,000,000 drops) 
  const drops = acc.result.account_data.Balance;
  const xrp = Number(drops) / 1_000_000;
  return xrp.toFixed(6);
}

export function toDrops(xrp: string | number) {
  const n = typeof xrp === "string" ? Number(xrp) : xrp;
  return (Math.round(n * 1_000_000)).toString();
}

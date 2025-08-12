import sdk from "@crossmarkio/sdk";
import { toDrops } from "./xrplClient";

// Connect (prompts Crossmark if needed) and return the XRPL address
export async function connectCrossmark(): Promise<string> {
    // Sign-in returns the currently active wallet address
    const { response } = await sdk.methods.signInAndWait();

    // Different SDK versions shape response slightly differently:
    const address =
        (response as any)?.address ||
        (response as any)?.data?.address ||
        (response as any)?.data?.account;

    if (!address) throw new Error("Crossmark sign-in failed: no address");
    return address as string;
}

// Sign + submit a Payment on XRPL Testnet via Crossmark
export async function payWithCrossmark(params: {
    from: string;        // source XRPL address (the one returned by connectCrossmark)
    to: string;          // destination XRPL address
    amountXrp: number;   // amount in XRP (not drops)
    memotext?: string;
}): Promise<string> {
    const Memos = params.memotext
        ? [{ Memo: { MemoData: Buffer.from(params.memotext, "utf8").toString("hex") } }]
        : undefined;

    const tx = {
        TransactionType: "Payment",
        Account: params.from,
        Destination: params.to,
        Amount: toDrops(params.amountXrp),
        Memos,
    };

    // One-shot sign + submit + wait until result is available
    const { response } = await sdk.methods.signAndSubmitAndWait(tx);

    // Hash location differs across versions; try common paths:
    const hash =
        (response as any)?.data?.resp?.result?.hash ||
        (response as any)?.data?.resp?.hash ||
        (response as any)?.result?.hash ||
        (response as any)?.hash;

    if (!hash) throw new Error("XRPL transaction failed: no hash in response");
    return String(hash);
}


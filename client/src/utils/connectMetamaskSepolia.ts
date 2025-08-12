// help func to help connect MetaMask and force Sepolia test net

const SEPOLIA_PARAMS = {
    chainId: "0xaa36a7", // 11155111
    chainName: "Sepolia Test Network",
    nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
    rpcUrls: [
      `https://sepolia.infura.io/v3/${import.meta.env.VITE_INFURA_PROJECT_ID || ""}`.replace(/\/$/, ""),
      "https://rpc.sepolia.org"
    ],
    blockExplorerUrls: ["https://sepolia.etherscan.io"],
  };
  
  export async function connectMetamaskSepolia(): Promise<string | null> {
    const eth = (window as any).ethereum;
    if (!eth) {
      alert("MetaMask not detected. Please install the extension.");
      return null;
    }
  
    // request accounts
    const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
    const account = (accounts?.[0] || "").toLowerCase();
    if (!account) return null;
  
    // ensure Sepolia is selected
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_PARAMS.chainId }] });
    } catch (err: any) {
      if (err?.code === 4902) {
        // chain not added yet
        await eth.request({ method: "wallet_addEthereumChain", params: [SEPOLIA_PARAMS] });
      } else {
        console.error("wallet_switchEthereumChain error:", err);
        throw err;
      }
    }
  
    // listeners 
    eth.removeAllListeners?.("accountsChanged");
    eth.on?.("accountsChanged", () => {
      // location.reload();
    });
    eth.on?.("chainChanged", () => {
      // reload to pick up new chain
      // location.reload();
    });
  
    return account;
  }
  
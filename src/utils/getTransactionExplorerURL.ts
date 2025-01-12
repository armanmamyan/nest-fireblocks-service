export const getTransactionExplorerURL = (chainId: number, transactionHash: string) => {
    // Define a mapping of chainId to explorer URLs
    const explorers = {
        1: 'https://etherscan.io/tx/',        // Ethereum Mainnet
        56: 'https://bscscan.com/tx/',         // Binance Smart Chain Mainnet
        137: 'https://polygonscan.com/tx/',    // Polygon Mainnet
        43114: 'https://snowtrace.io/tx/'      // Avalanche C-Chain Mainnet
    };

    // Check if the chainId is supported
    if (!explorers[chainId]) {
        throw new Error(`Unsupported chainId: ${chainId}`);
    }

    // Return the explorer URL with the transaction hash
    return `${explorers[chainId]}${transactionHash}`;
}
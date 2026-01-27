export interface Web3UseCaseDefinition {
  port: string
  entity: string | null
}

export const DISCOURAGED_SUFFIXES = ['service', 'api', 'client', 'sdk', 'utils']

export const WEB3_USE_CASES: Record<string, Web3UseCaseDefinition> = {
  'transfer-token': { port: 'token-transfer-writer', entity: 'Token' },
  'approve-token-allowance': { port: 'token-allowance-writer', entity: 'TokenAllowance' },
  'check-token-allowance': { port: 'token-allowance-reader', entity: 'TokenAllowance' },
  'mint-nft': { port: 'nft-mint-writer', entity: 'NFT' },
  'burn-nft': { port: 'nft-burn-writer', entity: 'NFT' },
  'stake-token': { port: 'staking-contract', entity: 'StakingPosition' },
  'claim-reward': { port: 'reward-publisher', entity: 'Reward' },
  'deposit-asset': { port: 'vault-writer', entity: 'VaultAsset' },
  'withdraw-asset': { port: 'vault-reader', entity: 'VaultAsset' },
  'verify-signature': { port: 'signature-verifier', entity: null },
  'fetch-chain-data': { port: 'chain-api-reader', entity: null },
  'estimate-gas': { port: 'gas-estimator', entity: null },
  'swap-token': { port: 'dex-executor', entity: 'Swap' },
  'create-pool': { port: 'liquidity-pool-repository', entity: 'Pool' },
  'add-liquidity': { port: 'liquidity-pool-writer', entity: 'Pool' },
  'remove-liquidity': { port: 'liquidity-pool-writer', entity: 'Pool' },
  'register-user': { port: 'user-repository', entity: 'User' },
  'authenticate-user': { port: 'auth-provider', entity: 'User' },
  'fetch-nft-metadata': { port: 'nft-api-reader', entity: 'NFT' },
  'list-nft-for-sale': { port: 'marketplace-writer', entity: 'NFTListing' },
  'buy-nft': { port: 'marketplace-executor', entity: 'NFTListing' },
  'update-profile': { port: 'profile-repository', entity: 'Profile' },
  'sync-wallet': { port: 'wallet-gateway', entity: 'Wallet' },
  'lock-token': { port: 'token-locker', entity: 'TokenLock' },
  'unlock-token': { port: 'token-locker', entity: 'TokenLock' },
}

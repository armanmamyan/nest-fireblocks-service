import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  Fireblocks,
  BasePath,
  FireblocksResponse,
  VaultAccount,
  VaultAsset,
  TransferPeerPathType,
  TransactionResponse,
  TransactionFee,
} from '@fireblocks/ts-sdk';
import { ConfigService } from '@nestjs/config';
import {
  SUPPORTED_ASSETS_LIST_TESTNET,
  SUPPORTED_ASSETS_LIST,
} from '@/utils/fireblocks.assets.supported';
import { IwithdrawalDetails } from './types';
import { FEE_BRACKETS } from '@/utils/serviceFeeBrackets';
import { CMCService } from '@/third-parties/cmc/cmc.service';

interface IFeeCalculator {
  assetId: string;
  amount: number;
  high: TransactionFee;
}

@Injectable()
export class FireblocksService {
  private fireblocksInstanceSigner;
  private fireblocksInstanceViewer;
  private fireblocksAssetList;

  constructor(
    private configService: ConfigService,
    private cmcService: CMCService,
  ) {
    this.fireblocksAssetList =
      this.configService.get<string>('STAGE') !== 'prod'
        ? SUPPORTED_ASSETS_LIST_TESTNET
        : SUPPORTED_ASSETS_LIST;
  }

  async onModuleInit() {
    await this.processInstanceReading();
  }

  async processInstanceReading() {
    try {
      this.fireblocksInstanceSigner = new Fireblocks({
        apiKey: this.configService.get<string>('FIREBLOCKS_SIGNER_API'),
        basePath: BasePath.US,
        secretKey: this.configService.get<string>('FIREBLOCKS_SIGNER_KEY'),
      });
      this.fireblocksInstanceViewer = new Fireblocks({
        apiKey: this.configService.get<string>('FIREBLOCKS_VIEWER_API'),
        basePath: BasePath.US,
        secretKey: this.configService.get<string>('FIREBLOCKS_VIEWER_KEY'),
      });
    } catch (error) {
      console.error('Error initializing Fireblocks instance:', error);
    }
  }

  async createFireblocksAccountWithAssets(
    userId: number,
    userEmail: string
  ): Promise<{ fireblocksId: string; assets: VaultAccount[] }> {
    try {
      const processVaultAccount = await this.createVault(userId, userEmail);
      await this.createUserAssets(processVaultAccount.data.id);
      const getAssetList = await this.getVaultAccountDetails(processVaultAccount.data.id);
      return {
        fireblocksId: processVaultAccount.data.id,
        assets: getAssetList.data.assets,
      };
    } catch (error) {
      console.log('Error During Creating Fireblocks Account For User', error);
      throw error;
    }
  }

  async createVault(userId, userEmail): Promise<FireblocksResponse<VaultAccount>> {
    try {
      const vault = await this.fireblocksInstanceSigner.vaults.createVaultAccount({
        createVaultAccountRequest: {
          name: `${userId}_${userEmail}`,
          hiddenOnUI: false,
          autoFuel: true,
        },
      });
      return vault || null;
    } catch (error) {
      console.log('Error During Creating Vault Account For User', error);
      throw error;
    }
  }

  async getVaultAccountDetails(vaultAccountId: string): Promise<FireblocksResponse<VaultAccount>> {
    try {
      if (!vaultAccountId) return null;
      const retrieveVault = await this.fireblocksInstanceViewer.vaults.getVaultAccount({
        vaultAccountId,
      });
      return retrieveVault || null;
    } catch (error) {
      console.error('Error during retrieving Vault Account', { error });
      throw error;
    }
  }

  async getSupportedListOfAssets() {
    try {
      const fetchAssetList =
        await this.fireblocksInstanceViewer.blockchainsAssets.getSupportedAssets();
      return JSON.stringify(fetchAssetList, null, 2);
    } catch (error) {
      console.error('Error During Fetching list of assets', { error });
      throw error;
    }
  }

  async activateVaultWallet(vaultAccountId: number, assetId: string) {
    try {
      await this.fireblocksInstanceSigner.vaults.activateAssetForVaultAccount({
        vaultAccountId,
        assetId,
      });
    } catch (error) {
      console.log('Error during wallet activation', { error });

      throw error;
    }
  }

  // FOR THE SAKE OF TESTING DURING THE SIGNUP, idempotencyKey will be optional
  async createUserAssets(vaultAccountId: string, idempotencyKey?: string) {
    try {
      return await Promise.all(
        this.fireblocksAssetList.map(async ({ id }) => {
          const data = await this.fireblocksInstanceSigner.vaults.createVaultAccountAsset({
            vaultAccountId,
            assetId: id,
            // string | A unique identifier for the request. If the request is sent multiple times with the same idempotency key,
            // the server will return the same response as the first request. The idempotency key is valid for 24 hours. (optional)
            // idempotencyKey MUST BE PASSED FROM FRONT END in order to properly trace data
            idempotencyKey,
          });
          // ACTIVATE WALLETS FOR USER
          // In Fireblocks, you need to activate a wallet in a vault account because some tokens require an on-chain transaction to "initialize" or "create" the wallet before it can store or interact with assets. This process is essential for certain tokens, like Stellar (XLM) and Solana (SOL),
          // which use unique mechanisms for account and wallet creation that involve a small transaction to initialize the wallet on their blockchain.
          await this.activateVaultWallet(Number(vaultAccountId), id);
          return {
            [id]: data,
          };
        })
      );
    } catch (error) {
      console.error('Error During Assets creation for Vault Account', { error });
      throw error;
    }
  }

  async getAccountBasedDepositAddress(
    vaultAccountId: string,
    assetId: string
  ): Promise<FireblocksResponse<VaultAsset>> {
    try {
      const retrieveAsset =
        await this.fireblocksInstanceViewer.vaults.getVaultAccountAssetAddressesPaginated({
          vaultAccountId,
          assetId,
        });

      return retrieveAsset?.data || null;
    } catch (error) {
      console.error('Error During retrieving asset details', { error });

      throw error;
    }
  }

  async updateVaultAccountAssetBalance(vaultAccountId: string) {
    try {
      return await Promise.all(
        this.fireblocksAssetList.map(async ({ id }) => {
          const updatedAsset =
            await this.fireblocksInstanceSigner.vaults.updateVaultAccountAssetBalance({
              vaultAccountId,
              assetId: id,
            });
          return {
            [id]: updatedAsset.data,
          };
        })
      );
    } catch (error) {
      console.error('Error During retrieving asset details', { error });
      throw error;
    }
  }

  async getTransactionFee(vaultAccountId: string, withdrawalDetails: IwithdrawalDetails) {
    try {
      const { type, amount, withdrawalAddress, assetId } = withdrawalDetails;

      const transferAsset = this.getTransferAsset(assetId);

      // For USDT, need to get ETH price as well
      const feeAsset = this.getFeeAsset(assetId);

      const isUSDT = assetId === 'USDT_ERC20' || assetId === 'USDT_BSC_TEST';

      // Get USD prices for both assets
      const [transferAssetQuote, feeAssetQuote] = await Promise.all([
        this.cmcService.getTokenLatestQuotes(transferAsset.cmcID.toString()),
        this.cmcService.getTokenLatestQuotes(feeAsset.cmcID.toString()),
      ]);

      const transferAssetUSDPrice = transferAssetQuote?.quote?.USD.price;
      const feeAssetUSDPrice = feeAssetQuote?.quote?.USD.price;

      // Calculate service fee in USD and convert to transfer asset
      const serviceFeeUSD = this.calculateServiceFee(Number(amount) * transferAssetUSDPrice);
      const serviceFeeInTransferAsset = serviceFeeUSD / transferAssetUSDPrice;

      // 1. Estimate transaction fee for user transfer
      const userTransferPayload = {
        assetId,
        amount,
        source: {
          type: TransferPeerPathType.VaultAccount,
          id: String(vaultAccountId),
        },
        destination:
          type === 'external'
            ? {
                type: TransferPeerPathType.OneTimeAddress,
                oneTimeAddress: {
                  address: withdrawalAddress,
                },
              }
            : type === 'servicePayment'
              ? {
                  type: TransferPeerPathType.VaultAccount,
                  id: this.configService.get<string>('FB_FEE_ACCOUNT'),
                }
              : {
                  type: TransferPeerPathType.VaultAccount,
                  id: withdrawalAddress,
                },
      };

      // 2. Estimate transaction fee for service fee transfer
      const serviceFeePayload = {
        assetId,
        amount: serviceFeeInTransferAsset,
        source: {
          type: TransferPeerPathType.VaultAccount,
          id: String(vaultAccountId),
        },
        destination: {
          type: TransferPeerPathType.VaultAccount,
          id: this.configService.get<string>('FB_FEE_ACCOUNT'),
        },
      };

      // Get fee estimates for both transactions
      const [userTransferFee, serviceFee] = await Promise.all([
        this.fireblocksInstanceSigner.transactions.estimateTransactionFee({
          transactionRequest: userTransferPayload,
        }),
        this.fireblocksInstanceSigner.transactions.estimateTransactionFee({
          transactionRequest: serviceFeePayload,
        }),
      ]);

      // Calculate network fee
      const networkFeeInFeeAsset =
        Number(userTransferFee.data.high.networkFee * 1.1) +
        Number(serviceFee.data.high.networkFee * 1.1);

      const networkFeeUSD = networkFeeInFeeAsset * feeAssetUSDPrice;

      return {
        serviceFee: {
          amountInAsset: serviceFeeInTransferAsset,
          amountInUSD: serviceFeeUSD,
          assetId: transferAsset.id,
          assetUSDPrice: transferAssetUSDPrice,
        },
        networkFee: {
          amountInAsset: networkFeeInFeeAsset,
          amountInUSD: networkFeeUSD,
          assetId: feeAsset.id,
          assetUSDPrice: feeAssetUSDPrice,
        },
        totalFeeUSD: serviceFeeUSD + networkFeeUSD,
      };
    } catch (error) {
      console.error('Error calculating total transaction fees', {
        message: error.message,
        details: error.response?.data,
      });
      throw error;
    }
  }

  async processVaultAccountCardPayment(
    vaultAccountId: string,
    withdrawalDetails: IwithdrawalDetails
  ) {
    try {
      const { amount, withdrawalAddress, assetId, type } = withdrawalDetails;

      const payload = {
        assetId,
        amount,
        source: {
          type: TransferPeerPathType.VaultAccount,
          id: String(vaultAccountId),
        },
        destination:
          type === 'external'
            ? {
                type: TransferPeerPathType.OneTimeAddress,
                oneTimeAddress: {
                  address: withdrawalAddress,
                },
              }
            : {
                type: TransferPeerPathType.VaultAccount,
                id: withdrawalAddress,
              },
      };
      const result = await this.fireblocksInstanceSigner.transactions.createTransaction({
        transactionRequest: payload,
      });

      if (result?.data?.id) {
        return await this.getTransactionById(result?.data?.id);
      }
      return result;
    } catch (error) {
      console.error('Error during transaction', { error });
      throw error;
    }
  }

  // For Account Withdrawals
  async processExternalWithdrawTransaction(
    vaultAccountId: string,
    withdrawalDetails: IwithdrawalDetails
  ) {
    try {
      const { amount, withdrawalAddress, assetId } = withdrawalDetails;
      const asset = this.fireblocksAssetList.find((item) => item.id === assetId);
      const latestQuote = await this.cmcService.getTokenLatestQuotes(asset.cmcID.toString());
      const assetUSDPrice = latestQuote?.quote?.USD.price;
      const calculatedServiceFee = this.calculateServiceFee(Number(amount) * assetUSDPrice);
      const serviceFeeInNativeAsset = calculatedServiceFee / assetUSDPrice;

      const serviceFeePayload = {
        assetId,
        amount: serviceFeeInNativeAsset,
        feeLevel: 'HIGH',
        source: {
          type: TransferPeerPathType.VaultAccount,
          id: String(vaultAccountId),
        },
        destination: {
          type: TransferPeerPathType.VaultAccount,
          id: this.configService.get<string>('FB_FEE_ACCOUNT'),
        },
      };

      // Process Service Fee Transaction
      await this.fireblocksInstanceSigner.transactions.createTransaction({
        transactionRequest: serviceFeePayload,
      });

      const payload = {
        assetId,
        amount: Number(amount),
        feeLevel: 'HIGH',
        source: {
          type: TransferPeerPathType.VaultAccount,
          id: String(vaultAccountId),
        },
        destination: {
          type: TransferPeerPathType.OneTimeAddress,
          oneTimeAddress: {
            address: withdrawalAddress,
          },
        },
      };
      const result = await this.fireblocksInstanceSigner.transactions.createTransaction({
        transactionRequest: payload,
      });
      if (result?.data?.id) {
        return await this.getTransactionById(result?.data?.id);
      }
      return result;
    } catch (error) {
      console.error('Error during transaction', { error });
      throw error;
    }
  }

  async getTransactionById(
    transactionId: string
  ): Promise<FireblocksResponse<TransactionResponse>> {
    try {
      const process = await this.fireblocksInstanceViewer.transactions.getTransaction({
        txId: transactionId,
      });
      return process?.data;
    } catch (error) {
      console.log('Error during Transaction fetch');

      throw error;
    }
  }

  async getCustomerTransactions(
    vaultAccountId: string,
    limit: number,
    before?: number,
    after?: number
  ) {
    try {
      const fetchLimit = limit * 2; // Fetch extra transactions to ensure enough data

      const retrieveReceivedTransactions =
        await this.fireblocksInstanceViewer.transactions.getTransactions({
          destType: TransferPeerPathType.VaultAccount,
          destId: vaultAccountId,
          limit: fetchLimit || 56,
          before, // Optional parameter for pagination
          after, // Optional parameter for pagination,
          orderBy: 'createdAt',
          sort: 'DESC',
        });
      const retrieveSentTransactions =
        await this.fireblocksInstanceViewer.transactions.getTransactions({
          sourceId: vaultAccountId,
          sourceType: TransferPeerPathType.VaultAccount,
          limit: fetchLimit || 56,
          before, // Optional parameter for pagination
          after, // Optional parameter for pagination,
          orderBy: 'createdAt',
          sort: 'DESC',
        });

      // Combine, sort, and limit the transactions
      const combinedTransactions = [
        ...retrieveReceivedTransactions.data,
        ...retrieveSentTransactions.data,
      ];

      // TO avoid duplications
      const uniqueTransactionsMap = new Map();
      combinedTransactions.forEach((tx) => uniqueTransactionsMap.set(tx.id, tx));
      const uniqueTransactions = Array.from(uniqueTransactionsMap.values());

      // Sort by createdAt descending
      uniqueTransactions.sort((a, b) => b.createdAt - a.createdAt);

      const transactions = uniqueTransactions.slice(0, limit || 56);

      return {
        transactions,
        nextBeforeTimestamp: transactions.length
          ? transactions[transactions.length - 1].createdAt
          : null,
        nextAfterTimestamp: transactions.length
          ? transactions[transactions.length - 1].createdAt
          : null,
      };
    } catch (error) {
      console.log('Erro During Fetching User Transactions');
      throw error;
    }
  }
  async manualUpdateVaultAccountAssetBalance(
    vaultAccountId: string,
    assetId: string,
    idempotencyKey: string
  ): Promise<FireblocksResponse<VaultAsset>> {
    try {
      const updateAsset = this.fireblocksInstanceSigner.vaults.updateVaultAccountAssetBalance({
        vaultAccountId,
        assetId,
        idempotencyKey,
      });
      return updateAsset?.data || null;
    } catch (error) {
      console.error('Error During manually updating asset details', { error });

      throw error;
    }
  }

  private getTransferAsset(assetId: string) {
    const asset = this.fireblocksAssetList.find((item) => item.id === assetId);
    if (!asset) {
      throw new Error('Transfer asset not found in supported assets list.');
    }
    return asset;
  }

  private getFeeAsset(assetId: string) {
    if (assetId === 'USDT_BSC_TEST') {
      const asset = this.fireblocksAssetList.find((item) => item.id === 'ETH_TEST5');

      if (!asset) {
        throw new Error('ETH asset not found for fee calculation.');
      }
      return asset;
    }
    if (assetId === 'USDT_ERC20') {
      const ethAsset = this.fireblocksAssetList.find((item) => item.id === 'ETH');
      if (!ethAsset) {
        throw new Error('ETH asset not found for fee calculation.');
      }
      return ethAsset;
    }
    return this.getTransferAsset(assetId);
  }

  /**
   * calculateServiceFee - Determine the service fee based on withdrawable amount.
   *
   * @param {number} amt - The withdrawable amount.
   * @returns {number} The final service fee.
   */
  private calculateServiceFee(withdrawableAmount: number) {
    if (withdrawableAmount <= 0) return 0;

    const bracket: any = FEE_BRACKETS.find(
      (b) => withdrawableAmount >= b.min && withdrawableAmount < b.max
    );

    if (!bracket) {
      // Fallback if none found; this theoretically shouldn’t happen if Infinity is used above
      return 0;
    }

    if (typeof bracket.fixedFee === 'number') {
      // We have a fixed fee bracket
      return bracket.fixedFee;
    } else if (typeof bracket?.percentFee === 'number') {
      // We have a percentage-based bracket (above 100K)
      return withdrawableAmount * bracket?.percentFee;
    }
  }
}

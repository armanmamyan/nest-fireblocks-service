import { JwtAuthGuard } from '@/auth/strategy/jwt-auth.guard';
import { GetUser } from '@/users/decorators/get-user.decorator';
import { User } from '@/users/entities/user.entity';
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import { FireblocksService } from './fireblocks.service';
import { CMCTokenIDs } from '@/utils/fireblocks.assets.supported';
import { WithdrawalDetailsDto } from './dto/withdrawalDetails.dto';
import { CMCService } from '@/third-parties/cmc/cmc.service';

@Controller('Fireblocks')
@UseGuards(JwtAuthGuard)
@ApiSecurity('JWT-auth')
export class FireblocksController {
  constructor(
    private fireblocksService: FireblocksService,
    private cmcService: CMCService
  ) {}

  @Get('/query-deposit-address')
  async getUserData(@GetUser() user: User, @Query('chainId') chainId: string) {
    return await this.fireblocksService.getAccountBasedDepositAddress(
      user.fireblocksVaultId,
      chainId
    );
  }

  @Get('/get-updated-balances')
  async getUpdatedBalances(@GetUser() user: User) {
    return await this.fireblocksService.getVaultAccountDetails(user.fireblocksVaultId);
  }

  @Get('/get-token-prices')
  async getSupportedTokensPrices(): Promise<any> {
    try {
      const processFetching = await Promise.all(
        CMCTokenIDs.map(async (id) => {
          const latestQuote = await this.cmcService.getTokenLatestQuotes(id.toString());
          return latestQuote;
        })
      );

      return processFetching;
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  @Post('/get-transaction-fee')
  async getTransactionFee(
    @GetUser() user: User,
    @Body() withdrawalDetails: WithdrawalDetailsDto
  ): Promise<any> {
    try {
      return await this.fireblocksService.getTransactionFee(
        user.fireblocksVaultId,
        withdrawalDetails
      );
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Post('/withdraw-funds')
  async processWithdrawal(
    @GetUser() user: User,
    @Body() withdrawalDetails: WithdrawalDetailsDto
  ): Promise<any> {
    try {
      return await this.fireblocksService.processExternalWithdrawTransaction(
        user.fireblocksVaultId,
        withdrawalDetails
      );
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Post('/estimate-gas')
  async estimateTxGas(
    @GetUser() user: User,
    @Body() txDetails: WithdrawalDetailsDto
  ): Promise<any> {
    try {
      return await this.fireblocksService.getTransactionFee(user.fireblocksVaultId, txDetails);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Get('/transaction-history')
  async getTransactionHistory(
    @GetUser() user: User,
    @Query('limit') limit: number,
    @Query('before') before: number,
    @Query('after') after: number
  ): Promise<any> {
    try {
      return await this.fireblocksService.getCustomerTransactions(
        user.fireblocksVaultId,
        limit,
        before,
        after
      );
    } catch (error) {
      throw error;
    }
  }
}

import { forwardRef, Module } from '@nestjs/common';
import { FireblocksController } from './fireblocks.controller';
import { FireblocksService } from './fireblocks.service';
import { UsersModule } from '@/users/users.module';
import { CMCService } from '@/third-parties/cmc/cmc.service';

@Module({
  controllers: [FireblocksController],
  imports: [forwardRef(() => UsersModule)],
  providers: [FireblocksService, CMCService],
  exports: [FireblocksService, CMCService],
})
export class FireblocksModule {}

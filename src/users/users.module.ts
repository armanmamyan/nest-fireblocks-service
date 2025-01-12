import { forwardRef, Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserController } from './controllers/user.controller';
import { UserAuthController } from './controllers/user.auth.controller';
import { AuthModule } from 'src/auth/auth.module';
import { FireblocksModule } from '@/fireblocks/fireblocks.module';


@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    forwardRef(() => AuthModule),
    forwardRef(() => FireblocksModule),
  ],
  providers: [UsersService],
  controllers: [UserController, UserAuthController],
  exports: [UsersService],
})
export class UsersModule {}

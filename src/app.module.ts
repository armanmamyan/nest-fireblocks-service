import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { configValidationSchema } from './config.schema';
import { typeOrmAsyncConfig } from './config/typeorm.config';
import { AppService } from './app.service';
import * as dotenv from 'dotenv';
import { FireblocksModule } from './fireblocks/fireblocks.module';
dotenv.config();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env`],
      validationSchema: configValidationSchema,
    }),
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    AuthModule,
    UsersModule,
    FireblocksModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

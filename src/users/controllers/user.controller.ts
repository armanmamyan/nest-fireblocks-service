// Cores
import {
  Body,
  Controller,
  BadRequestException,
  Get,
  Post,
  Query,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';

import { User } from '../entities/user.entity';

// Services
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from 'src/auth/auth.service';
import { UsersService } from '../users.service';
import { hashSync } from 'bcryptjs';
import { FireblocksService } from '@/fireblocks/fireblocks.service';

@Controller('user')
@ApiTags('User')
export class UserController {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    private userService: UsersService,
    private authService: AuthService,
    private fireblocksService: FireblocksService,
  ) {}

  @Post('/signup')
  async createUser(@Body() user: Partial<User>): Promise<Partial<User>> {
    try {
      const { email, password } = user;
      // Check if there is a user.
      if (!user.email) {
        throw new BadRequestException(`You must define a user.`);
      }

      // Check if the wallet already exists within the database.
      const existingUser = await this.userService.findUser(user.email);
      const theJWTToken = await this.authService.generateToken(user.email);

      if (!existingUser) {
        const createUser = {
          email,
          username: email,
          password: hashSync(password, 10),
          token: theJWTToken,
        };
        const storeUser = await this.userService.create(createUser);

        const { id, name, avatar, username, surName } = storeUser;
        const fireblocksVaultId = await this.userService.createFireblocksAccountForUser(id);
        return {
          id,
          email,
          token: theJWTToken,
          name,
          avatar,
          username,
          surName,
          fireblocksVaultId
        };
      }
      throw new UnauthorizedException('User Already Exists');
    } catch (error) {
      this.logger.debug(error.message);
      throw new UnauthorizedException(error?.message || 'Something Went Wrong');
    }
  }

  @Get('validate-token')
  async checkTokenExpiration(@Query('token') token: string) {
    if (!token) {
      throw new BadRequestException('Token is required');
    }
    return await this.authService.validateUserToken(token);
  }
}

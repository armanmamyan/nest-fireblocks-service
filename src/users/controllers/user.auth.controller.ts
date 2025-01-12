import { BadRequestException, Body, Controller, Get, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AuthService } from 'src/auth/auth.service';
import { User } from '../entities/user.entity';
import { UsersService } from '../users.service';
import { JwtAuthGuard } from 'src/auth/strategy/jwt-auth.guard';
import { GetUser } from '../decorators/get-user.decorator';

@Controller('user')
@UseGuards(JwtAuthGuard)
@ApiTags('User Auth')
@ApiSecurity('JWT-auth')
export class UserAuthController {
	constructor(
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		private userService: UsersService,
		private authService: AuthService,
	) {}

  @Post('/update-user')
  async updateUser(@Body() user: Partial<User>): Promise<User | UnauthorizedException> {
    // Check if there is a user.
    if (!user) {
      throw new BadRequestException(`You must define a user.`);
    }

    const existingUser = await this.userRepository.findOne({
      where: {
        email: user.email,
      },
    });
    const theJWTToken = await this.authService.generateToken(user.email);

    if (existingUser) {
      const newUser = await this.userRepository
        .createQueryBuilder()
        .update({ token: theJWTToken })
        .where({ email: existingUser.email })
        .returning('*')
        .execute();
      const userReturned = this.userService.findUser(newUser.raw[0]['email']);
      return userReturned;
    }
  }

  @Get()
  async getUserData(@GetUser() user: User) {
    return await this.userService.findUser(user.email);
  }

}

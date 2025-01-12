import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SigninDto } from './dto/signin.dto';
import { User } from 'src/users/entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('/sign-in')
  signin(@Body() signinDto: SigninDto): Promise<Partial<User>> {
    return this.authService.login(signinDto);
  }

  @Post('/forget-password')
  async updatePassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    await this.authService.resetPassword(token, newPassword);
    return { message: 'Password updated successfully.' };
  }

}

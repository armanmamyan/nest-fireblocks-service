import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compareSync, hashSync } from 'bcryptjs';
import { validate } from 'class-validator';
import { UsersService } from 'src/users/users.service';
import { SigninDto } from './dto/signin.dto';
import { User } from 'src/users/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { PasswordReset } from './entities/passwordReset.entity';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    @InjectRepository(PasswordReset) private passwordResetRepository: Repository<PasswordReset>,
    @InjectRepository(User) private userRepository: Repository<User>,
    
    private jwtService: JwtService,
    private userservice: UsersService
  ) {
  }

  async generateToken(email: string): Promise<string> {
    const jwtPayload = { email };

    return this.jwtService.sign(jwtPayload);
  }

  async validateUserToken(token: string) {
    const decoded = this.jwtService.decode(token) as any;

    // Check if the token is decoded successfully and is an object
    if (!decoded || typeof decoded !== 'object') {
      return { isValid: false };
    }

    // Ensure the 'exp' field exists and is a number
    if (typeof decoded['exp'] !== 'number') {
      return { isValid: false };
    }

    const currentUnixTimestamp = Math.floor(Date.now() / 1000);

    if (currentUnixTimestamp > decoded.exp) {
      await this.userservice.updateData(decoded.email, { token: '' });
    }

    return { isValid: currentUnixTimestamp < decoded.exp };
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const passwordReset = await this.passwordResetRepository.findOne({
      where: { token },
      relations: ['user'],
    });

    if (!passwordReset) {
      throw new BadRequestException('Invalid or expired token.');
    }

    if (passwordReset.expiresAt < new Date()) {
      throw new BadRequestException('Token has expired.');
    }

    // Hash the new password
    const hashedPassword = await hashSync(newPassword, 10);
    passwordReset.user.password = hashedPassword;

    await this.userRepository.save(passwordReset.user);

    // Delete token
    await this.passwordResetRepository.delete(passwordReset.id);
  }

  async login(signinDto: SigninDto): Promise<Partial<User>> {
    const { email, password } = signinDto;
    // Validation Flag
    let isOk = false;

    // Validate DTO against validate function from class-validator
    await validate(signinDto).then((errors) => {
      if (errors.length > 0) {
        this.logger.debug(`${errors}`);
      } else {
        isOk = true;
      }
    });

    if (isOk) {
      // Get user information
      const userDetails = await this.userservice.findOne(email);

      // Check if user exists
      if (userDetails == null) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Check if the given password match with saved password
      const isValid = compareSync(password, userDetails.password);
      if (isValid) {
        // Generate JWT token
        const accessToken = await this.jwtService.sign({ email });
        const { password, ...userInformation } = userDetails;
        return { ...userInformation, token: accessToken };
      } else {
        // Password or email does not match
        throw new UnauthorizedException('Please check your login credentials');
      }
    } else {
      throw new UnauthorizedException('Please check your login credentials');
    }
  }
}

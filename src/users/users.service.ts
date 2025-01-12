import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { FireblocksService } from '@/fireblocks/fireblocks.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private fireblocksService: FireblocksService,
  ) {}

  async create(createUser: Partial<User>): Promise<User> {
    return await this.usersRepository.save(new User(createUser));
  }

  async findUser(email: string): Promise<User> {
    return await this.usersRepository.findOne({
      where: { email },
      select: [
        'avatar',
        'email',
        'id',
        'name',
        'surName',
        'username',
        'fireblocksVaultId',
      ],
    });
  }

  // Get all user information
  async findOne(email: string): Promise<User> {
    return await this.usersRepository.findOne({
      where: { email },
    });
  }

  async updateData(userEmail, data) {
    return await this.usersRepository.update({ email: userEmail }, data);
  }

  async createFireblocksAccountForUser(id: number) {
    const user = await this.usersRepository.findOne({
      where: { id },
    });

    const { fireblocksId } =
      await this.fireblocksService.createFireblocksAccountWithAssets(
        id,
        user.email,
      );

    await this.usersRepository
      .createQueryBuilder()
      .update(User)
      .set({ fireblocksVaultId: fireblocksId })
      .where({
        id,
      })
      .returning('*')
      .execute();

    return fireblocksId;
  }

  async findUserByFireblocksId(id: string) {
    return await this.usersRepository.findOne({
      where: { fireblocksVaultId: id },
    });
  }
}

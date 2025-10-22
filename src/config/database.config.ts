import { ConfigService } from '@nestjs/config';
import { MongooseModuleOptions } from '@nestjs/mongoose';

export const getDatabaseConfig = (configService: ConfigService): MongooseModuleOptions => ({
  uri: configService.get<string>('MONGODB_URI') || 'mongodb://localhost:27017/roll-strong',
  retryAttempts: 3,
  retryDelay: 1000,
});
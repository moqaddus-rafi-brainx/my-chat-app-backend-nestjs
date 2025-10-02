import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getDatabaseConfig } from './config/database.config';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';


@Module({
  imports: 
  [
    ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: [
      `.env.${process.env.NODE_ENV}`,
      '.env.production',
      '.env'
      ],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
   
  ],
})
export class AppModule {}

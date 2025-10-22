import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  
  const app = await NestFactory.create(AppModule);
  
  // Configure WebSocket adapter
  app.useWebSocketAdapter(new IoAdapter(app));
  
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Enable validation globally
  app.useGlobalPipes(new ValidationPipe());

  // Set global API prefix
  app.setGlobalPrefix('api/v1');
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 4000;
  

  await app.listen(process.env.PORT ?? 4000);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();

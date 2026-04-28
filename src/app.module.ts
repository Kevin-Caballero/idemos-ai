import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Initiative,
  InitiativeSummary,
  InitiativeStep,
  InitiativeLink,
} from '@idemos/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? '5432'),
      database: process.env.DB_NAME ?? 'idemos',
      username: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      synchronize: process.env.NODE_ENV === 'development',
      autoLoadEntities: true,
    }),
    TypeOrmModule.forFeature([
      Initiative,
      InitiativeSummary,
      InitiativeStep,
      InitiativeLink,
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

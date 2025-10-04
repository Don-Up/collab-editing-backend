import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TextGateway } from './text/text.gateway';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, TextGateway],
})
export class AppModule {}

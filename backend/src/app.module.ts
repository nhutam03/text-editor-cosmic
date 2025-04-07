import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SpellCheckService } from './plugins/spell-check.plugin';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, SpellCheckService],
})
export class AppModule {}

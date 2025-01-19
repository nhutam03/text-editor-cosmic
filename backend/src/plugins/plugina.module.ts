import { Module } from '@nestjs/common';
import { SpellCheckService } from './spell-check.plugin';

@Module({
  providers: [SpellCheckService],
  exports: [SpellCheckService],
})
export class PluginsModule {}

// import { Controller, Get } from '@nestjs/common';
// import { AppService } from './app.service';

// @Controller()
// export class AppController {
//   constructor(private readonly appService: AppService) {}

//   @Get()
//   getHello(): string {
//     return this.appService.getHello();
//   }
// }
import { Controller, Post, Body } from '@nestjs/common';
import { SpellCheckService } from './plugins/spell-check.plugin';

@Controller('api')
export class AppController {
  constructor(private readonly spellCheckService: SpellCheckService) {}

  @Post('spell-check')
  checkSpelling(@Body('text') text: string) {
    return this.spellCheckService.checkSpelling(text);
  }
}

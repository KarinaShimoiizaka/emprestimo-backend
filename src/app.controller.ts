import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  /** GET / — fora do prefixo `api`; serve para ver se o servidor está de pé. */
  @Get()
  raiz(): string {
    return "Hello World";
  }
}

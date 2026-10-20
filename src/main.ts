import "reflect-metadata";

import { Logger, RequestMethod, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { FiltroDeExcecao } from "./comum/filtro-de-excecao";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api", { exclude: [{ path: "/", method: RequestMethod.GET }] });
  app.useGlobalFilters(new FiltroDeExcecao());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // O front sobe separado do back (ADR-001), então a origem dele é explícita.
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
  });

  const porta = Number(process.env.PORT ?? 3001);
  await app.listen(porta, "0.0.0.0");
  new Logger("bootstrap").log(`EMPREST.AI backend em :${porta}`);
}

void bootstrap();

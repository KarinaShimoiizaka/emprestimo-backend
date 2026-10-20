-- CreateEnum
CREATE TYPE "papel" AS ENUM ('colaborador', 'operacoes');

-- CreateTable
CREATE TABLE "perfil" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "papel" "papel" NOT NULL DEFAULT 'colaborador',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perfil_pkey" PRIMARY KEY ("id")
);

-- RLS ligado e sem política: a API REST do Supabase (chave pública) não lê
-- nem escreve nada em `perfil`. Só o backend, pela conexão direta, acessa.
ALTER TABLE "perfil" ENABLE ROW LEVEL SECURITY;

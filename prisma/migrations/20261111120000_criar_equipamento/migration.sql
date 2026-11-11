-- BE-03 §2: tabela equipamento (modelo da BE-01 §3 mais os campos da foto).
-- A tabela emprestimo não entra aqui: nasce com a spec de solicitar empréstimo.

-- CreateEnum
CREATE TYPE "categoria" AS ENUM ('notebook', 'monitor', 'cabo', 'camera', 'acessorio');

-- CreateEnum
CREATE TYPE "situacao_fisica" AS ENUM ('disponivel', 'manutencao');

-- CreateTable
CREATE TABLE "equipamento" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" "categoria" NOT NULL,
    "patrimonio" TEXT NOT NULL,
    "situacao" "situacao_fisica" NOT NULL DEFAULT 'disponivel',
    "observacao" TEXT,
    "imagem_caminho" TEXT,
    "imagem_autor" TEXT,
    "imagem_origem" TEXT,
    "imagem_licenca" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipamento_patrimonio_key" ON "equipamento"("patrimonio");

-- RLS ligado e sem política, como em `perfil`: a API REST do Supabase (chave
-- pública) não lê nem escreve `equipamento`. Só o backend, pela conexão direta.
ALTER TABLE "equipamento" ENABLE ROW LEVEL SECURITY;

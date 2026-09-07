-- AlterTable
ALTER TABLE `Usuario` ADD COLUMN `pinBloqueado` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `pinHash` VARCHAR(191) NULL,
    ADD COLUMN `pinIntentosFallidos` INTEGER NOT NULL DEFAULT 0;

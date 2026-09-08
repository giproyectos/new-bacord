/*
  Warnings:

  - You are about to drop the column `cerrado` on the `BatchRecordDetalleData` table. All the data in the column will be lost.
  - You are about to drop the column `fechaCierre` on the `BatchRecordDetalleData` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `BatchRecordDetalleData` DROP COLUMN `cerrado`,
    DROP COLUMN `fechaCierre`;

-- CreateTable
CREATE TABLE `BatchRecordProcesoCierre` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `idBatchRecord` INTEGER NOT NULL,
    `idProceso` INTEGER NOT NULL,
    `idUsuario` INTEGER NOT NULL,
    `cerradoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BatchRecordProcesoCierre_idBatchRecord_idProceso_key`(`idBatchRecord`, `idProceso`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BatchRecord` ADD CONSTRAINT `BatchRecord_idRecetaMaestra_fkey` FOREIGN KEY (`idRecetaMaestra`) REFERENCES `RecetaMaestra`(`idRecetaMaestra`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchRecord` ADD CONSTRAINT `BatchRecord_idOrdenProceso_fkey` FOREIGN KEY (`idOrdenProceso`) REFERENCES `OrdenProceso`(`idOrdenProceso`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchRecordProcesoCierre` ADD CONSTRAINT `BatchRecordProcesoCierre_idBatchRecord_fkey` FOREIGN KEY (`idBatchRecord`) REFERENCES `BatchRecord`(`idBatchRecord`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchRecordProcesoCierre` ADD CONSTRAINT `BatchRecordProcesoCierre_idProceso_fkey` FOREIGN KEY (`idProceso`) REFERENCES `Proceso`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchRecordProcesoCierre` ADD CONSTRAINT `BatchRecordProcesoCierre_idUsuario_fkey` FOREIGN KEY (`idUsuario`) REFERENCES `Usuario`(`idUsuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

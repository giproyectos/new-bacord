-- DropForeignKey
ALTER TABLE `BatchRecordFirma` DROP FOREIGN KEY `BatchRecordFirma_idBatchRecord_fkey`;

-- DropForeignKey
ALTER TABLE `MaterialReceta` DROP FOREIGN KEY `MaterialReceta_idMaterial_fkey`;

-- DropForeignKey
ALTER TABLE `MaterialReceta` DROP FOREIGN KEY `MaterialReceta_idRecetaMaestra_fkey`;

-- DropForeignKey
ALTER TABLE `Usuario` DROP FOREIGN KEY `Usuario_idCentro_fkey`;

-- DropIndex
DROP INDEX `BatchRecordFirma_idBatchRecord_idDetalle_idFirma_key` ON `BatchRecordFirma`;

-- DropIndex
DROP INDEX `Centro_nombre_key` ON `Centro`;

-- DropIndex
DROP INDEX `Proceso_codigo_key` ON `Proceso`;

-- DropIndex
DROP INDEX `Usuario_idCentro_fkey` ON `Usuario`;

-- AlterTable
ALTER TABLE `BatchRecordFirma` ADD COLUMN `bloqueKey` VARCHAR(191) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE `Centro` DROP COLUMN `nombre`,
    ADD COLUMN `codigo` VARCHAR(191) NOT NULL,
    ADD COLUMN `direccion` VARCHAR(191) NULL,
    MODIFY `descripcion` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Detalle` ADD COLUMN `jsonData` LONGTEXT NULL,
    MODIFY `estado` VARCHAR(191) NOT NULL DEFAULT 'En creación';

-- AlterTable
ALTER TABLE `Material` ADD COLUMN `tipo` ENUM('PRODUCTO_TERMINADO', 'MATERIAL_EMPAQUE', 'MATERIAL_ENVASE', 'EXCIPIENTE', 'PRINCIPIO_ACTIVO') NOT NULL DEFAULT 'PRODUCTO_TERMINADO';

-- AlterTable
ALTER TABLE `Proceso` ADD COLUMN `idMaterial` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `RecetaMaestra` ADD COLUMN `idMaterial` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `Usuario` ADD COLUMN `fechaCaducidad` DATETIME(3) NULL,
    ADD COLUMN `idRol` INTEGER NULL,
    ADD COLUMN `pinBloqueado` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `pinHash` VARCHAR(191) NULL,
    ADD COLUMN `pinIntentosFallidos` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `tokenActivacion` VARCHAR(191) NULL,
    ADD COLUMN `tokenActivacionExpira` DATETIME(3) NULL,
    MODIFY `passwordHash` VARCHAR(191) NULL,
    MODIFY `idCentro` INTEGER NULL;

-- DropTable
DROP TABLE `MaterialReceta`;

-- CreateTable
CREATE TABLE `Parametro` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `valor` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,

    UNIQUE INDEX `Parametro_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Rol` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `modulos` TEXT NOT NULL,
    `modulosEdicion` TEXT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Rol_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CargueMaterialRegistro` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `archivo` VARCHAR(191) NOT NULL,
    `fechaCargue` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `idUsuario` INTEGER NOT NULL,
    `totalMateriales` INTEGER NOT NULL,
    `errores` INTEGER NOT NULL,
    `estado` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `BatchRecordFirma_idBatchRecord_idDetalle_bloqueKey_idFirma_key` ON `BatchRecordFirma`(`idBatchRecord`, `idDetalle`, `bloqueKey`, `idFirma`);

-- CreateIndex
CREATE UNIQUE INDEX `Centro_codigo_key` ON `Centro`(`codigo`);

-- CreateIndex
CREATE UNIQUE INDEX `Proceso_idMaterial_codigo_key` ON `Proceso`(`idMaterial`, `codigo`);

-- CreateIndex
CREATE UNIQUE INDEX `Usuario_tokenActivacion_key` ON `Usuario`(`tokenActivacion`);

-- AddForeignKey
ALTER TABLE `Usuario` ADD CONSTRAINT `Usuario_idCentro_fkey` FOREIGN KEY (`idCentro`) REFERENCES `Centro`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Usuario` ADD CONSTRAINT `Usuario_idRol_fkey` FOREIGN KEY (`idRol`) REFERENCES `Rol`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Proceso` ADD CONSTRAINT `Proceso_idMaterial_fkey` FOREIGN KEY (`idMaterial`) REFERENCES `Material`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
-- (RecetaMaestra_idCentro_fkey ya existe desde 20260820164048_init — el generador de este
-- diff lo repitió por error; agregarlo de nuevo produce "Duplicate foreign key constraint name".)
ALTER TABLE `RecetaMaestra` ADD CONSTRAINT `RecetaMaestra_idMaterial_fkey` FOREIGN KEY (`idMaterial`) REFERENCES `Material`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CargueMaterialRegistro` ADD CONSTRAINT `CargueMaterialRegistro_idUsuario_fkey` FOREIGN KEY (`idUsuario`) REFERENCES `Usuario`(`idUsuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
-- El generador del diff quitó esta FK arriba (para poder ampliar el índice único de
-- BatchRecordFirma a 4 columnas) pero no la volvió a agregar — sin esto, BatchRecordFirma
-- queda sin la restricción de integridad referencial hacia BatchRecord.
ALTER TABLE `BatchRecordFirma` ADD CONSTRAINT `BatchRecordFirma_idBatchRecord_fkey` FOREIGN KEY (`idBatchRecord`) REFERENCES `BatchRecord`(`idBatchRecord`) ON DELETE CASCADE ON UPDATE CASCADE;


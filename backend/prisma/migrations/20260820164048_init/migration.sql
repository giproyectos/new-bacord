-- CreateTable
CREATE TABLE `Centro` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Centro_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GrupoResponsable` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `colorKey` VARCHAR(191) NOT NULL DEFAULT 'slate',
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GrupoResponsable_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Usuario` (
    `idUsuario` INTEGER NOT NULL AUTO_INCREMENT,
    `numeroIdentificacion` VARCHAR(191) NOT NULL,
    `nombres` VARCHAR(191) NOT NULL,
    `apellidos` VARCHAR(191) NOT NULL,
    `login` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `esAdministrador` BOOLEAN NOT NULL DEFAULT false,
    `bloqueado` BOOLEAN NOT NULL DEFAULT false,
    `intentosFallidos` INTEGER NOT NULL DEFAULT 0,
    `idCentro` INTEGER NOT NULL,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Usuario_numeroIdentificacion_key`(`numeroIdentificacion`),
    UNIQUE INDEX `Usuario_login_key`(`login`),
    UNIQUE INDEX `Usuario_email_key`(`email`),
    PRIMARY KEY (`idUsuario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UsuarioGrupo` (
    `idUsuario` INTEGER NOT NULL,
    `idGrupo` INTEGER NOT NULL,

    PRIMARY KEY (`idUsuario`, `idGrupo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Material` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Material_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Proceso` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL,
    `orden` INTEGER NOT NULL DEFAULT 1,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Proceso_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Detalle` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL,
    `estado` VARCHAR(191) NOT NULL DEFAULT 'Activo',
    `idEstrategiaFirma` INTEGER NULL,
    `jsonSchema` LONGTEXT NOT NULL,
    `jsonOptions` LONGTEXT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadoEn` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Detalle_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Firma` (
    `idFirma` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL,
    `texto` VARCHAR(191) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `idGrupo` INTEGER NOT NULL,

    UNIQUE INDEX `Firma_codigo_key`(`codigo`),
    PRIMARY KEY (`idFirma`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EstrategiaFirma` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `gruposDerogacion` TEXT NULL,
    `usuarioCreacion` VARCHAR(191) NOT NULL,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EstrategiaFirma_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EstrategiaFirmaItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `idEstrategiaFirma` INTEGER NOT NULL,
    `idFirma` INTEGER NOT NULL,
    `texto` VARCHAR(191) NOT NULL,
    `orden` INTEGER NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RecetaMaestra` (
    `idRecetaMaestra` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `idCentro` INTEGER NOT NULL,
    `idEstado` INTEGER NOT NULL DEFAULT 1,
    `motivo` TEXT NULL,
    `usuarioCreacion` VARCHAR(191) NOT NULL,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `usuarioModificacion` VARCHAR(191) NOT NULL,
    `fechaModificacion` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RecetaMaestra_codigo_key`(`codigo`),
    PRIMARY KEY (`idRecetaMaestra`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MaterialReceta` (
    `idRecetaMaestra` INTEGER NOT NULL,
    `idMaterial` INTEGER NOT NULL,

    PRIMARY KEY (`idRecetaMaestra`, `idMaterial`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RecetaProceso` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `idRecetaMaestra` INTEGER NOT NULL,
    `idProceso` INTEGER NOT NULL,
    `orden` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RecetaDetalle` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `idRecetaProceso` INTEGER NOT NULL,
    `idDetalle` INTEGER NOT NULL,
    `orden` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrdenProceso` (
    `idOrdenProceso` INTEGER NOT NULL AUTO_INCREMENT,
    `idRecetaMaestra` INTEGER NOT NULL,
    `numeroOrdenProceso` VARCHAR(191) NOT NULL,
    `codigoMaterial` VARCHAR(191) NOT NULL,
    `descripcionMaterial` VARCHAR(191) NOT NULL,
    `idCentro` INTEGER NOT NULL,
    `loteLogistico` VARCHAR(191) NOT NULL,
    `cantidadOrden` DOUBLE NOT NULL,
    `unidadMedida` VARCHAR(191) NOT NULL,
    `loteInspeccion` VARCHAR(191) NOT NULL,
    `fechaFabricacion` DATETIME(3) NOT NULL,
    `fechaCaducidad` DATETIME(3) NOT NULL,
    `registroSanitario` VARCHAR(191) NOT NULL,
    `formaFarmaceutica` VARCHAR(191) NOT NULL,
    `idEstado` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `OrdenProceso_numeroOrdenProceso_key`(`numeroOrdenProceso`),
    PRIMARY KEY (`idOrdenProceso`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ComponenteOrden` (
    `idComponente` INTEGER NOT NULL AUTO_INCREMENT,
    `idOrdenProceso` INTEGER NOT NULL,
    `codigoMaterialComponente` VARCHAR(191) NOT NULL,
    `descripcionMaterialComponente` VARCHAR(191) NOT NULL,
    `cantidad` DOUBLE NOT NULL,
    `unidadMedida` VARCHAR(191) NOT NULL,
    `loteComponente` VARCHAR(191) NOT NULL,
    `codigoListaMateriales` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`idComponente`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CargueRegistro` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `archivo` VARCHAR(191) NOT NULL,
    `fechaCargue` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `idUsuario` INTEGER NOT NULL,
    `totalOrdenes` INTEGER NOT NULL,
    `totalComponentes` INTEGER NOT NULL,
    `errores` INTEGER NOT NULL,
    `estado` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FormulaControl` (
    `idFormulaControl` INTEGER NOT NULL AUTO_INCREMENT,
    `idRecetaMaestra` INTEGER NOT NULL,
    `idOrdenProceso` INTEGER NOT NULL,
    `motivoEstado` TEXT NULL,
    `idEstado` INTEGER NOT NULL DEFAULT 1,
    `idCentro` INTEGER NOT NULL,
    `idUsuarioCreacion` INTEGER NOT NULL,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`idFormulaControl`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BatchRecord` (
    `idBatchRecord` INTEGER NOT NULL AUTO_INCREMENT,
    `idFormulaControl` INTEGER NOT NULL,
    `idRecetaMaestra` INTEGER NOT NULL,
    `idOrdenProceso` INTEGER NOT NULL,
    `motivoEstado` TEXT NULL,
    `idEstado` INTEGER NOT NULL DEFAULT 1,
    `idCentro` INTEGER NOT NULL,
    `idUsuarioCreacion` INTEGER NOT NULL,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `idUsuarioModificacion` INTEGER NOT NULL,
    `fechaModificacion` DATETIME(3) NOT NULL,
    `porcentajeAvance` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `BatchRecord_idFormulaControl_key`(`idFormulaControl`),
    PRIMARY KEY (`idBatchRecord`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BatchRecordDetalleData` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `idBatchRecord` INTEGER NOT NULL,
    `idDetalle` INTEGER NOT NULL,
    `jsonData` LONGTEXT NOT NULL,
    `cerrado` BOOLEAN NOT NULL DEFAULT false,
    `fechaCierre` DATETIME(3) NULL,
    `actualizadoEn` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BatchRecordDetalleData_idBatchRecord_idDetalle_key`(`idBatchRecord`, `idDetalle`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BatchRecordFirma` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `idBatchRecord` INTEGER NOT NULL,
    `idDetalle` INTEGER NOT NULL,
    `idFirma` INTEGER NOT NULL,
    `idUsuario` INTEGER NOT NULL,
    `firmadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BatchRecordFirma_idBatchRecord_idDetalle_idFirma_key`(`idBatchRecord`, `idDetalle`, `idFirma`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BatchRecordLiberacion` (
    `idBatchRecord` INTEGER NOT NULL,
    `idUsuario` INTEGER NOT NULL,
    `observacion` TEXT NULL,
    `liberadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`idBatchRecord`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Desviacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `idBatchRecord` INTEGER NOT NULL,
    `idDetalle` INTEGER NOT NULL,
    `campo` VARCHAR(191) NOT NULL,
    `labelCampo` VARCHAR(191) NOT NULL,
    `valorIngresado` VARCHAR(191) NOT NULL,
    `limiteInfo` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NOT NULL,
    `estado` VARCHAR(191) NOT NULL DEFAULT 'abierta',
    `idUsuarioReporta` INTEGER NOT NULL,
    `fechaHora` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `observacionCierre` TEXT NULL,
    `fechaCierre` DATETIME(3) NULL,
    `idUsuarioCierre` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditEntry` (
    `id` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `idUsuario` INTEGER NULL,
    `nombreUsuario` VARCHAR(191) NOT NULL,
    `loginUsuario` VARCHAR(191) NOT NULL,
    `cargo` VARCHAR(191) NOT NULL,
    `entidad` VARCHAR(191) NOT NULL,
    `idEntidad` VARCHAR(191) NOT NULL,
    `descripcionEntidad` VARCHAR(191) NOT NULL,
    `accion` VARCHAR(191) NOT NULL,
    `modulo` VARCHAR(191) NOT NULL,
    `cambios` LONGTEXT NULL,
    `motivo` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Usuario` ADD CONSTRAINT `Usuario_idCentro_fkey` FOREIGN KEY (`idCentro`) REFERENCES `Centro`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UsuarioGrupo` ADD CONSTRAINT `UsuarioGrupo_idUsuario_fkey` FOREIGN KEY (`idUsuario`) REFERENCES `Usuario`(`idUsuario`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UsuarioGrupo` ADD CONSTRAINT `UsuarioGrupo_idGrupo_fkey` FOREIGN KEY (`idGrupo`) REFERENCES `GrupoResponsable`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Detalle` ADD CONSTRAINT `Detalle_idEstrategiaFirma_fkey` FOREIGN KEY (`idEstrategiaFirma`) REFERENCES `EstrategiaFirma`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Firma` ADD CONSTRAINT `Firma_idGrupo_fkey` FOREIGN KEY (`idGrupo`) REFERENCES `GrupoResponsable`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EstrategiaFirmaItem` ADD CONSTRAINT `EstrategiaFirmaItem_idEstrategiaFirma_fkey` FOREIGN KEY (`idEstrategiaFirma`) REFERENCES `EstrategiaFirma`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EstrategiaFirmaItem` ADD CONSTRAINT `EstrategiaFirmaItem_idFirma_fkey` FOREIGN KEY (`idFirma`) REFERENCES `Firma`(`idFirma`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecetaMaestra` ADD CONSTRAINT `RecetaMaestra_idCentro_fkey` FOREIGN KEY (`idCentro`) REFERENCES `Centro`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaterialReceta` ADD CONSTRAINT `MaterialReceta_idRecetaMaestra_fkey` FOREIGN KEY (`idRecetaMaestra`) REFERENCES `RecetaMaestra`(`idRecetaMaestra`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaterialReceta` ADD CONSTRAINT `MaterialReceta_idMaterial_fkey` FOREIGN KEY (`idMaterial`) REFERENCES `Material`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecetaProceso` ADD CONSTRAINT `RecetaProceso_idRecetaMaestra_fkey` FOREIGN KEY (`idRecetaMaestra`) REFERENCES `RecetaMaestra`(`idRecetaMaestra`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecetaProceso` ADD CONSTRAINT `RecetaProceso_idProceso_fkey` FOREIGN KEY (`idProceso`) REFERENCES `Proceso`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecetaDetalle` ADD CONSTRAINT `RecetaDetalle_idRecetaProceso_fkey` FOREIGN KEY (`idRecetaProceso`) REFERENCES `RecetaProceso`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecetaDetalle` ADD CONSTRAINT `RecetaDetalle_idDetalle_fkey` FOREIGN KEY (`idDetalle`) REFERENCES `Detalle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrdenProceso` ADD CONSTRAINT `OrdenProceso_idRecetaMaestra_fkey` FOREIGN KEY (`idRecetaMaestra`) REFERENCES `RecetaMaestra`(`idRecetaMaestra`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrdenProceso` ADD CONSTRAINT `OrdenProceso_idCentro_fkey` FOREIGN KEY (`idCentro`) REFERENCES `Centro`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ComponenteOrden` ADD CONSTRAINT `ComponenteOrden_idOrdenProceso_fkey` FOREIGN KEY (`idOrdenProceso`) REFERENCES `OrdenProceso`(`idOrdenProceso`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CargueRegistro` ADD CONSTRAINT `CargueRegistro_idUsuario_fkey` FOREIGN KEY (`idUsuario`) REFERENCES `Usuario`(`idUsuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FormulaControl` ADD CONSTRAINT `FormulaControl_idOrdenProceso_fkey` FOREIGN KEY (`idOrdenProceso`) REFERENCES `OrdenProceso`(`idOrdenProceso`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FormulaControl` ADD CONSTRAINT `FormulaControl_idCentro_fkey` FOREIGN KEY (`idCentro`) REFERENCES `Centro`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FormulaControl` ADD CONSTRAINT `FormulaControl_idUsuarioCreacion_fkey` FOREIGN KEY (`idUsuarioCreacion`) REFERENCES `Usuario`(`idUsuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchRecord` ADD CONSTRAINT `BatchRecord_idFormulaControl_fkey` FOREIGN KEY (`idFormulaControl`) REFERENCES `FormulaControl`(`idFormulaControl`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchRecord` ADD CONSTRAINT `BatchRecord_idCentro_fkey` FOREIGN KEY (`idCentro`) REFERENCES `Centro`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchRecord` ADD CONSTRAINT `BatchRecord_idUsuarioCreacion_fkey` FOREIGN KEY (`idUsuarioCreacion`) REFERENCES `Usuario`(`idUsuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchRecord` ADD CONSTRAINT `BatchRecord_idUsuarioModificacion_fkey` FOREIGN KEY (`idUsuarioModificacion`) REFERENCES `Usuario`(`idUsuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchRecordDetalleData` ADD CONSTRAINT `BatchRecordDetalleData_idBatchRecord_fkey` FOREIGN KEY (`idBatchRecord`) REFERENCES `BatchRecord`(`idBatchRecord`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchRecordDetalleData` ADD CONSTRAINT `BatchRecordDetalleData_idDetalle_fkey` FOREIGN KEY (`idDetalle`) REFERENCES `Detalle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchRecordFirma` ADD CONSTRAINT `BatchRecordFirma_idBatchRecord_fkey` FOREIGN KEY (`idBatchRecord`) REFERENCES `BatchRecord`(`idBatchRecord`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchRecordFirma` ADD CONSTRAINT `BatchRecordFirma_idDetalle_fkey` FOREIGN KEY (`idDetalle`) REFERENCES `Detalle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchRecordFirma` ADD CONSTRAINT `BatchRecordFirma_idFirma_fkey` FOREIGN KEY (`idFirma`) REFERENCES `Firma`(`idFirma`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchRecordFirma` ADD CONSTRAINT `BatchRecordFirma_idUsuario_fkey` FOREIGN KEY (`idUsuario`) REFERENCES `Usuario`(`idUsuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchRecordLiberacion` ADD CONSTRAINT `BatchRecordLiberacion_idBatchRecord_fkey` FOREIGN KEY (`idBatchRecord`) REFERENCES `BatchRecord`(`idBatchRecord`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchRecordLiberacion` ADD CONSTRAINT `BatchRecordLiberacion_idUsuario_fkey` FOREIGN KEY (`idUsuario`) REFERENCES `Usuario`(`idUsuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Desviacion` ADD CONSTRAINT `Desviacion_idBatchRecord_fkey` FOREIGN KEY (`idBatchRecord`) REFERENCES `BatchRecord`(`idBatchRecord`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Desviacion` ADD CONSTRAINT `Desviacion_idDetalle_fkey` FOREIGN KEY (`idDetalle`) REFERENCES `Detalle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Desviacion` ADD CONSTRAINT `Desviacion_idUsuarioReporta_fkey` FOREIGN KEY (`idUsuarioReporta`) REFERENCES `Usuario`(`idUsuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Desviacion` ADD CONSTRAINT `Desviacion_idUsuarioCierre_fkey` FOREIGN KEY (`idUsuarioCierre`) REFERENCES `Usuario`(`idUsuario`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditEntry` ADD CONSTRAINT `AuditEntry_idUsuario_fkey` FOREIGN KEY (`idUsuario`) REFERENCES `Usuario`(`idUsuario`) ON DELETE SET NULL ON UPDATE CASCADE;

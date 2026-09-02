// Descarga contenido de texto como archivo en el navegador del usuario — usado por las
// plantillas de cargue (Materiales, Órdenes de Proceso) y cualquier otro export a archivo.
export function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8;') {
  // BOM para que Excel reconozca UTF-8 al abrir el CSV directamente (tildes/ñ correctas).
  const blob = new Blob(['﻿' + content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

import type { EstadoPartido, PeriodoControl, TipoEventoPartido } from '@saas/shared';

export const REGLAS_PARTIDO = {
  maxTitulares: 11,
  minTitularesAdvertencia: 7,
  minSuplentesAdvertencia: 1,
  permiteReingreso: false,
} as const;

export const ESTADOS_PREPARACION: EstadoPartido[] = ['ASIGNADO', 'EN_PREPARACION'];
export const ESTADOS_EN_JUEGO: EstadoPartido[] = ['PRIMER_TIEMPO', 'SEGUNDO_TIEMPO'];
export const ESTADOS_SOLO_LECTURA: EstadoPartido[] = ['PENDIENTE_ACTA', 'ACTA_CERRADA', 'CANCELADO'];
export const ESTADOS_BLOQUEAN_EDICION: EstadoPartido[] = ['ACTA_CERRADA', 'CANCELADO', 'SUSPENDIDO'];

export function puedePrepararAlineacion(estado: EstadoPartido) {
  return ESTADOS_PREPARACION.includes(estado);
}

export function puedeRegistrarEventoDeportivo(estado: EstadoPartido, tipo: TipoEventoPartido) {
  const eventosSistema: TipoEventoPartido[] = [
    'INICIO_PRIMER_TIEMPO',
    'FIN_PRIMER_TIEMPO',
    'INICIO_SEGUNDO_TIEMPO',
    'FIN_SEGUNDO_TIEMPO',
    'SUSPENSION',
    'REANUDACION',
    'FIN_PARTIDO',
  ];
  if (eventosSistema.includes(tipo)) return !ESTADOS_SOLO_LECTURA.includes(estado);
  return ESTADOS_EN_JUEGO.includes(estado);
}

export function puedeAgregarNovedad(estado: EstadoPartido) {
  return !ESTADOS_SOLO_LECTURA.includes(estado);
}

export function puedeCerrarActa(estado: EstadoPartido) {
  return estado === 'REVISION_ACTA';
}

export function periodoDesdeEstado(estado: EstadoPartido): PeriodoControl | undefined {
  if (estado === 'PRIMER_TIEMPO') return 'PRIMER_TIEMPO';
  if (estado === 'DESCANSO') return 'DESCANSO';
  if (estado === 'SEGUNDO_TIEMPO') return 'SEGUNDO_TIEMPO';
  return undefined;
}

export function numeroPeriodo(periodo: PeriodoControl): 1 | 2 {
  return periodo === 'SEGUNDO_TIEMPO' ? 2 : 1;
}

export function accionDashboard(estado: EstadoPartido) {
  if (estado === 'ASIGNADO' || estado === 'EN_PREPARACION') return 'Preparar partido';
  if (estado === 'PRIMER_TIEMPO' || estado === 'DESCANSO' || estado === 'SEGUNDO_TIEMPO') return 'Continuar vocalia';
  if (estado === 'REVISION_ACTA') return 'Revisar y enviar acta';
  if (estado === 'ACTA_CERRADA') return 'Ver acta';
  if (estado === 'SUSPENDIDO') return 'Revisar suspension';
  return 'Abrir';
}

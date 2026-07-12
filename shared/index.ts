// ==========================================
// 1. USUARIOS Y ROLES
// ==========================================
export type UserRole =
  | 'SUPERADMIN'
  | 'ADMIN_LIGA'
  | 'ORGANIZADOR'
  | 'VOCAL'
  | 'ARBITRO'
  | 'DELEGADO'
  | 'CONSULTA';

export interface Usuario {
  id: string;
  nombre: string;
  apellido?: string;
  nombres?: string;
  apellidos?: string;
  nombreCompleto?: string;
  email: string;
  cedula?: string;
  telefono?: string;
  role: UserRole;
  rol?: UserRole;
  ligaId?: string;
  activo: boolean;
  creadoEn?: string;
  actualizadoEn?: string;
}

export interface SesionLocal {
  usuarioId: string;
  iniciadaEn: string;
}

// ==========================================
// 2. ESTRUCTURA DEPORTIVA
// ==========================================
export interface Liga {
  id: string;
  nombre: string;
  logoUrl?: string;
}

export interface Torneo {
  id: string;
  ligaId: string;
  nombre: string;
  estado: 'PLANIFICACION' | 'EN_CURSO' | 'FINALIZADO';
}

export type EstadoCampeonato = 'BORRADOR' | 'CONFIGURADO' | 'ACTIVO' | 'PLANIFICACION' | 'EN_CURSO' | 'FINALIZADO';

export interface Campeonato {
  id: string;
  ligaId: string;
  nombre: string;
  temporada: string;
  fechaInicio?: string;
  fechaFin?: string;
  cantidadFechas?: number;
  estado: EstadoCampeonato;
  puntosVictoria: number;
  puntosEmpate: number;
  puntosDerrota: number;
  amarillasParaSuspension?: number;
  creadoEn: string;
}

export interface Categoria {
  id: string;
  campeonatoId: string;
  nombre: string;
  edadMinima?: number;
  edadMaxima?: number;
  activa: boolean;
}

export interface Cancha {
  id: string;
  nombre: string;
  direccion?: string;
  activa: boolean;
}

export interface Jornada {
  id: string;
  campeonatoId: string;
  numero: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estado: 'PENDIENTE' | 'BORRADOR' | 'PROGRAMADA' | 'EN_CURSO' | 'FINALIZADA' | 'CERRADA';
}

export type FechaCampeonato = Jornada;

export interface InscripcionEquipo {
  id: string;
  campeonatoId: string;
  equipoId: string;
  categoriaId?: string;
  activa: boolean;
  inscritaEn: string;
}

export interface Equipo {
  id: string;
  torneoId: string;
  campeonatoId?: string;
  categoriaId?: string;
  nombre: string;
  nombreCorto?: string;
  logoUrl?: string;
  escudo?: string;
  representanteId: string;
  delegadoId?: string;
  categoria: string;
  activo?: boolean;
  creadoEn?: string;
}

export type EstadoJugador = 'HABILITADO' | 'SUSPENDIDO' | 'INACTIVO';
export type RolAlineacion = 'TITULAR' | 'SUPLENTE';
export type EstadoJugadorPartido =
  | 'EN_CANCHA'
  | 'SUPLENTE_DISPONIBLE'
  | 'SUSTITUIDO'
  | 'EXPULSADO'
  | 'NO_DISPONIBLE';

export interface Jugador {
  id: string;
  equipoId: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  fechaNacimiento: number;
  fotoUrl: string;
  numeroDorsal: number;
  posicion?: string;
  esArquero?: boolean;
  activo?: boolean;
  habilitado?: boolean;
  estadoHabilitacion: EstadoJugador;
  motivoInhabilitacion?: string;
}

// ==========================================
// 3. OPERATIVA DE PARTIDOS (Offline-First)
// ==========================================
export type EstadoPartido =
  | 'PROGRAMADO'
  | 'ASIGNADO'
  | 'EN_PREPARACION'
  | 'PRIMER_TIEMPO'
  | 'DESCANSO'
  | 'SEGUNDO_TIEMPO'
  | 'REVISION_ACTA'
  | 'PENDIENTE_ACTA'
  | 'ACTA_CERRADA'
  | 'SUSPENDIDO'
  | 'CANCELADO';

export interface Partido {
  id: string;
  torneoId: string;
  campeonatoId?: string;
  categoriaId?: string;
  jornadaId?: string;
  canchaId?: string;
  fecha: string;
  hora: string;
  jornada: string;
  escenario: string;
  equipoLocalId: string;
  equipoVisitanteId: string;
  idVocalAsignado?: string;
  vocalId?: string;
  arbitroId?: string;
  resultadoLocal?: number;
  resultadoVisitante?: number;
  estado: EstadoPartido;
  colorCamisetaLocal?: string;
  colorCamisetaVisitante?: string;
  contabilizado?: boolean;
  eliminado?: boolean;
  inicioRealEn?: string;
  finRealEn?: string;
  estadoAnteriorSuspension?: EstadoPartido;
  cerradaEn?: string;
  cerradaPor?: string;
}

export interface AsignacionVocal {
  id: string;
  partidoId: string;
  vocalId: string;
  asignadoEn: string;
  activa: boolean;
}

export interface AsignacionArbitro {
  id: string;
  partidoId: string;
  arbitroId: string;
  asignadoEn: string;
  activa: boolean;
}

export interface AlineacionPartido {
  id: string;
  partidoId: string;
  equipoId: string;
  jugadorId: string;
  rol: RolAlineacion;
  esArquero: boolean;
  esCapitan: boolean;
  enCancha: boolean;
  esInicial?: boolean;
  estadoActual?: EstadoJugadorPartido;
  orden: number;
  actualizadoEn: string;
}

export type TipoEventoPartido =
  | 'INICIO_PARTIDO'
  | 'INICIO_PRIMER_TIEMPO'
  | 'FIN_PRIMER_TIEMPO'
  | 'INICIO_SEGUNDO_TIEMPO'
  | 'FIN_SEGUNDO_TIEMPO'
  | 'GOL'
  | 'AUTOGOL'
  | 'TARJETA_AMARILLA'
  | 'TARJETA_ROJA'
  | 'DOBLE_AMARILLA'
  | 'CAMBIO'
  | 'LESION'
  | 'OBSERVACION'
  | 'SUSPENSION'
  | 'REANUDACION'
  | 'FIN_PARTIDO';

export interface EventoPartido {
  id: string;
  partidoId: string;
  equipoId?: string;
  jugadorId?: string;
  jugadorEntraId?: string;
  jugadorSaleId?: string;
  tipoEvento: TipoEventoPartido;
  minuto: number;
  periodo: 1 | 2;
  descripcion?: string;
  registradoEn: string;
  registradoPorUsuarioId: string;
  activo: boolean;
  timestampOriginal: number;
}

export type PeriodoControl = 'PRIMER_TIEMPO' | 'DESCANSO' | 'SEGUNDO_TIEMPO';

export interface ControlTiempoPartido {
  id: string;
  partidoId: string;
  periodo: PeriodoControl;
  iniciadoEn?: string;
  pausadoEn?: string;
  segundosAcumulados: number;
  activo: boolean;
  actualizadoEn: string;
}

export type TipoNovedad =
  | 'GENERAL'
  | 'EQUIPO_LOCAL'
  | 'EQUIPO_VISITANTE'
  | 'ARBITRAL'
  | 'ESCENARIO'
  | 'INCIDENTE'
  | 'SUSPENSION';

export interface NovedadPartido {
  id: string;
  partidoId: string;
  tipo: TipoNovedad;
  descripcion: string;
  minuto?: number;
  periodo?: PeriodoControl;
  creadaPor: string;
  creadaEn: string;
  activa: boolean;
}

export interface ResultadoValidacion {
  valido: boolean;
  errores: string[];
  advertencias: string[];
}

export interface ActaSnapshot {
  partido: Partido;
  torneo: Torneo;
  equipoLocal: Equipo;
  equipoVisitante: Equipo;
  vocal: Usuario;
  alineaciones: AlineacionPartido[];
  eventos: EventoPartido[];
  novedades: NovedadPartido[];
  marcador: { local: number; visitante: number };
  controlesTiempo: ControlTiempoPartido[];
}

export interface ActaPartido {
  id: string;
  partidoId: string;
  version: number;
  contenido: ActaSnapshot;
  cerradaPor: string;
  cerradaEn: string;
  activa: boolean;
}

export interface ProcesamientoActa {
  partidoId: string;
  versionActa: number;
  procesadaEn: string;
  golesProcesados: number;
  tarjetasProcesadas: number;
  sancionesGeneradas: number;
}

export interface VocaliaPartido {
  partido: Partido;
  torneo: Torneo;
  equipoLocal: Equipo;
  equipoVisitante: Equipo;
  vocal: Usuario;
  jugadoresLocal: Jugador[];
  jugadoresVisitante: Jugador[];
  alineaciones: AlineacionPartido[];
  eventos: EventoPartido[];
  novedades: NovedadPartido[];
  controlesTiempo: ControlTiempoPartido[];
  acta?: ActaPartido;
}

// ==========================================
// 4. SANCIONES (Tribunal de penas)
// ==========================================
export type EstadoSancion = 'PENDIENTE' | 'ACTIVA' | 'CUMPLIDA' | 'ANULADA' | 'APELADA';
export type TipoSancion = 'TARJETA_ROJA' | 'ROJA_DIRECTA' | 'DOBLE_AMARILLA' | 'ACUMULACION_AMARILLAS' | 'CONDUCTA' | 'DISCIPLINARIA' | 'ADMINISTRATIVA';

export interface Sancion {
  id: string;
  campeonatoId?: string;
  equipoId?: string;
  jugadorId: string;
  partidoOrigenId: string;
  eventoOrigenId?: string;
  tipo?: TipoSancion;
  motivo: string;
  fechasDeCastigo: number;
  fechasCumplidas: number;
  partidosSuspension?: number;
  partidosCumplidos?: number;
  estado: EstadoSancion;
  creadaEn?: string;
  creadaPor?: string;
  observaciones?: string;
}

export interface SancionFecha {
  id: string;
  sancionId: string;
  fechaCampeonatoId: string;
  cumplida: boolean;
  partidoCumplimientoId?: string;
}

export interface PosicionEquipo {
  equipoId: string;
  equipo: string;
  categoria: string;
  jugados: number;
  ganados: number;
  empatados: number;
  perdidos: number;
  golesFavor: number;
  golesContra: number;
  diferencia: number;
  puntos: number;
}

export interface EstadisticaGoleador {
  jugadorId: string;
  jugador: string;
  equipoId: string;
  equipo: string;
  goles: number;
}

export interface EstadisticaTarjeta {
  jugadorId: string;
  jugador: string;
  equipoId: string;
  equipo: string;
  amarillas: number;
  rojas: number;
}

export interface DisponibilidadJugador {
  jugadorId: string;
  habilitado: boolean;
  motivo?: string;
  sancionActiva?: Sancion;
}

export interface EstadoJugadorCompetitivo {
  habilitado: boolean;
  motivo?: string;
  sancionesActivas: Sancion[];
  amarillasAcumuladas: number;
  partidosPendientesSuspension: number;
}

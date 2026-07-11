// ==========================================
// 1. USUARIOS Y ROLES
// ==========================================
export type UserRole = 'ADMINISTRADOR' | 'VOCAL' | 'ARBITRO';

export interface Usuario {
  id: string;
  nombreCompleto: string;
  email: string;
  rol: UserRole;
  ligaId?: string;
  activo: boolean;
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

export interface Equipo {
  id: string;
  torneoId: string;
  nombre: string;
  logoUrl?: string;
  representanteId: string; 
  categoria: string;       
}

export type EstadoJugador = 'HABILITADO' | 'SUSPENDIDO' | 'INACTIVO';

export interface Jugador {
  id: string;
  equipoId: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  fechaNacimiento: number;
  fotoUrl: string; 
  numeroDorsal: number;
  estadoHabilitacion: EstadoJugador;
}

// ==========================================
// 3. OPERATIVA DE PARTIDOS (Offline-First)
// ==========================================
export type EstadoPartido = 'PROGRAMADO' | 'EN_CURSO' | 'FINALIZADO' | 'VALIDADO';

export interface Partido {
  id: string;
  fecha: string; // ISO String (ej: 2026-07-11T16:00:00)
  jornada: string; // "Fecha 1", "Fecha 2", etc.
  equipoLocalId: string;
  equipoVisitanteId: string;
  idVocalAsignado: string;
  resultadoLocal?: number;
  resultadoVisitante?: number;
  estado: EstadoPartido;
}

export type TipoEventoPartido = 'GOL' | 'AMARILLA' | 'ROJA' | 'CAMBIO';

export interface EventoPartido {
  id: string;
  partidoId: string;
  equipoId: string;
  jugadorId?: string;
  tipoEvento: TipoEventoPartido;
  minuto: number;
  timestampOriginal: number; // Clave para la sincronización cuando regrese el WiFi
}

// ==========================================
// 4. SANCIONES (Tribunal de penas)
// ==========================================
export type EstadoSancion = 'ACTIVA' | 'CUMPLIDA' | 'APELADA';

export interface Sancion {
  id: string;
  jugadorId: string;
  partidoOrigenId: string;
  motivo: string;
  fechasDeCastigo: number;
  fechasCumplidas: number;
  estado: EstadoSancion;
}
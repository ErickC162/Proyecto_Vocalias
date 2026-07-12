import type { Campeonato, Cancha, Categoria, Jornada } from '@saas/shared';
import { db } from '../db/dexie';

export interface FechaResumen {
  jornada: Jornada;
  partidos: number;
  finalizados: number;
  pendientes: number;
  suspendidos: number;
}

export interface FlujoCampeonatoResumen {
  campeonato?: Campeonato;
  equiposInscritos: number;
  fechasCreadas: number;
  partidosProgramados: number;
  partidosSinArbitro: number;
  partidosSinVocal: number;
  fechas: FechaResumen[];
}

export const competicionService = {
  obtenerCampeonatos: async (): Promise<Campeonato[]> => {
    return await db.campeonatos.toArray();
  },

  obtenerCategorias: async (): Promise<Categoria[]> => {
    return (await db.categorias.toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  },

  obtenerCanchas: async (): Promise<Cancha[]> => {
    return (await db.canchas.toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  },

  obtenerJornadas: async (): Promise<Jornada[]> => {
    return (await db.jornadas.toArray()).sort((a, b) => a.numero - b.numero);
  },

  obtenerFlujoCampeonato: async (campeonatoId = 'camp-1'): Promise<FlujoCampeonatoResumen> => {
    const [campeonato, inscripciones, jornadas, partidos, sanciones, sancionesFechas] = await Promise.all([
      db.campeonatos.get(campeonatoId),
      db.inscripcionesEquipo.where('campeonatoId').equals(campeonatoId).and((inscripcion) => inscripcion.activa).toArray(),
      db.jornadas.where('campeonatoId').equals(campeonatoId).sortBy('numero'),
      db.partidos.where('campeonatoId').equals(campeonatoId).and((partido) => !partido.eliminado).toArray(),
      db.sanciones.where('campeonatoId').equals(campeonatoId).and((sancion) => sancion.estado === 'ACTIVA').toArray(),
      db.sancionesFechas.toArray(),
    ]);
    const sancionesActivas = new Set(sanciones.map((sancion) => sancion.id));
    const fechas = jornadas.map((jornada) => {
      const partidosFecha = partidos.filter((partido) => partido.jornadaId === jornada.id);
      return {
        jornada,
        partidos: partidosFecha.length,
        finalizados: partidosFecha.filter((partido) => partido.estado === 'ACTA_CERRADA').length,
        pendientes: partidosFecha.filter((partido) => partido.estado !== 'ACTA_CERRADA' && partido.estado !== 'CANCELADO').length,
        suspendidos: sancionesFechas.filter((fecha) => !fecha.cumplida && fecha.fechaCampeonatoId === jornada.id && sancionesActivas.has(fecha.sancionId)).length,
      };
    });
    return {
      campeonato,
      equiposInscritos: inscripciones.length,
      fechasCreadas: jornadas.length,
      partidosProgramados: partidos.length,
      partidosSinArbitro: partidos.filter((partido) => !partido.arbitroId).length,
      partidosSinVocal: partidos.filter((partido) => !partido.vocalId && !partido.idVocalAsignado).length,
      fechas,
    };
  },

  generarFechasCampeonato: async (campeonatoId: string, cantidad = 24): Promise<void> => {
    const campeonato = await db.campeonatos.get(campeonatoId);
    if (!campeonato) throw new Error('No existe el campeonato.');
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 24) throw new Error('La cantidad de fechas debe estar entre 1 y 24.');
    const existentes = await db.jornadas.where('campeonatoId').equals(campeonatoId).toArray();
    const numerosExistentes = new Set(existentes.map((jornada) => jornada.numero));
    const inicio = campeonato.fechaInicio ? new Date(`${campeonato.fechaInicio}T00:00:00`) : new Date();
    const nuevas: Jornada[] = [];
    for (let numero = 1; numero <= cantidad; numero += 1) {
      if (numerosExistentes.has(numero)) continue;
      const desde = new Date(inicio);
      desde.setDate(inicio.getDate() + (numero - 1) * 7);
      const hasta = new Date(desde);
      hasta.setDate(desde.getDate() + 1);
      nuevas.push({
        id: `jor-${numero}`,
        campeonatoId,
        numero,
        nombre: `Fecha ${numero}`,
        fechaInicio: desde.toISOString().slice(0, 10),
        fechaFin: hasta.toISOString().slice(0, 10),
        estado: 'PROGRAMADA',
      });
    }
    if (nuevas.length > 0) {
      await db.transaction('rw', db.jornadas, db.fechasCampeonato, async () => {
        for (const jornada of nuevas) {
          if (!(await db.jornadas.get(jornada.id))) await db.jornadas.add(jornada);
          if (!(await db.fechasCampeonato.get(jornada.id))) await db.fechasCampeonato.add(jornada);
        }
      });
    }
  },

  crearCancha: async (nombre: string, direccion?: string): Promise<Cancha> => {
    if (!nombre.trim()) throw new Error('El nombre de la cancha es obligatorio.');
    const cancha: Cancha = { id: crypto.randomUUID(), nombre: nombre.trim(), direccion: direccion?.trim(), activa: true };
    await db.canchas.add(cancha);
    return cancha;
  },

  crearJornada: async (campeonatoId: string, nombre: string, fechaInicio: string, fechaFin: string): Promise<Jornada> => {
    if (!nombre.trim() || !fechaInicio || !fechaFin) throw new Error('Completa los datos de la jornada.');
    const existentes = await db.jornadas.where('campeonatoId').equals(campeonatoId).toArray();
    const jornada: Jornada = {
      id: crypto.randomUUID(),
      campeonatoId,
      numero: existentes.length + 1,
      nombre: nombre.trim(),
      fechaInicio,
      fechaFin,
      estado: 'PROGRAMADA',
    };
    await db.jornadas.add(jornada);
    return jornada;
  },
};

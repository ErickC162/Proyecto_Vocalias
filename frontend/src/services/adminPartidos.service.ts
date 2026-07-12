import type { AsignacionArbitro, AsignacionVocal, Cancha, Equipo, Jornada, Partido, Usuario } from '@saas/shared';
import { db } from '../db/dexie';

export interface PartidoAdminResumen {
  partido: Partido;
  local?: Equipo;
  visitante?: Equipo;
  cancha?: Cancha;
  jornada?: Jornada;
  vocal?: Usuario;
  arbitro?: Usuario;
  suspendidosLocal: number;
  suspendidosVisitante: number;
}

export interface CrearPartidoInput {
  campeonatoId: string;
  categoriaId: string;
  jornadaId: string;
  canchaId: string;
  fecha: string;
  hora: string;
  equipoLocalId: string;
  equipoVisitanteId: string;
  vocalId?: string;
  arbitroId?: string;
}

const mismaFranja = (partido: Partido, fecha: string, hora: string) => partido.fecha === fecha && partido.hora === hora && !partido.eliminado && partido.estado !== 'CANCELADO';

async function validarCruces(input: CrearPartidoInput) {
  if (input.equipoLocalId === input.equipoVisitanteId) throw new Error('El equipo local y visitante deben ser diferentes.');
  const partidos = await db.partidos.toArray();
  const equipoEnLaJornada = partidos.find((partido) => {
    if (partido.eliminado || partido.estado === 'CANCELADO' || partido.jornadaId !== input.jornadaId) return false;
    return [partido.equipoLocalId, partido.equipoVisitanteId].includes(input.equipoLocalId) || [partido.equipoLocalId, partido.equipoVisitanteId].includes(input.equipoVisitanteId);
  });
  if (equipoEnLaJornada) throw new Error('Un equipo no puede tener dos partidos en la misma fecha.');
  const conflicto = partidos.find((partido) => {
    if (!mismaFranja(partido, input.fecha, input.hora)) return false;
    return (
      partido.canchaId === input.canchaId ||
      partido.equipoLocalId === input.equipoLocalId ||
      partido.equipoVisitanteId === input.equipoLocalId ||
      partido.equipoLocalId === input.equipoVisitanteId ||
      partido.equipoVisitanteId === input.equipoVisitanteId ||
      (input.vocalId && (partido.vocalId === input.vocalId || partido.idVocalAsignado === input.vocalId)) ||
      (input.arbitroId && partido.arbitroId === input.arbitroId)
    );
  });
  if (conflicto) throw new Error('Existe un cruce de horario con cancha, equipo, vocal o arbitro.');
}

export const adminPartidosService = {
  obtenerResumen: async (): Promise<PartidoAdminResumen[]> => {
    const partidos = (await db.partidos.toArray()).filter((partido) => !partido.eliminado);
    const [equipos, canchas, jornadas, usuarios] = await Promise.all([
      db.equipos.toArray(),
      db.canchas.toArray(),
      db.jornadas.toArray(),
      db.usuarios.toArray(),
    ]);
    const [sanciones, sancionesFechas] = await Promise.all([db.sanciones.toArray(), db.sancionesFechas.toArray()]);
    const contarSuspendidos = (equipoId: string, jornadaId?: string) => {
      if (!jornadaId) return 0;
      const sancionesEquipo = new Set(sanciones.filter((sancion) => sancion.estado === 'ACTIVA' && sancion.equipoId === equipoId).map((sancion) => sancion.id));
      return sancionesFechas.filter((fecha) => !fecha.cumplida && fecha.fechaCampeonatoId === jornadaId && sancionesEquipo.has(fecha.sancionId)).length;
    };
    return partidos
      .sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`))
      .map((partido) => ({
        partido,
        local: equipos.find((equipo) => equipo.id === partido.equipoLocalId),
        visitante: equipos.find((equipo) => equipo.id === partido.equipoVisitanteId),
        cancha: canchas.find((cancha) => cancha.id === partido.canchaId),
        jornada: jornadas.find((jornada) => jornada.id === partido.jornadaId),
        vocal: usuarios.find((usuario) => usuario.id === (partido.vocalId ?? partido.idVocalAsignado)),
        arbitro: usuarios.find((usuario) => usuario.id === partido.arbitroId),
        suspendidosLocal: contarSuspendidos(partido.equipoLocalId, partido.jornadaId),
        suspendidosVisitante: contarSuspendidos(partido.equipoVisitanteId, partido.jornadaId),
      }));
  },

  crear: async (input: CrearPartidoInput): Promise<Partido> => {
    if (!input.fecha || !input.hora) throw new Error('La fecha y hora son obligatorias.');
    await validarCruces(input);
    const [jornada, cancha, local, visitante, vocal, arbitro] = await Promise.all([
      db.jornadas.get(input.jornadaId),
      db.canchas.get(input.canchaId),
      db.equipos.get(input.equipoLocalId),
      db.equipos.get(input.equipoVisitanteId),
      input.vocalId ? db.usuarios.get(input.vocalId) : undefined,
      input.arbitroId ? db.usuarios.get(input.arbitroId) : undefined,
    ]);
    if (!jornada || !cancha) throw new Error('La jornada o cancha seleccionada no existe.');
    if (!local || !visitante || local.activo === false || visitante.activo === false) throw new Error('Los equipos seleccionados deben estar activos.');
    if (local.categoriaId && visitante.categoriaId && local.categoriaId !== visitante.categoriaId) throw new Error('Los equipos deben pertenecer a la misma categoria.');
    if (cancha.activa === false) throw new Error('No se puede programar en una cancha inactiva.');
    if (input.vocalId && (!vocal || !vocal.activo || vocal.role !== 'VOCAL')) throw new Error('El vocal seleccionado no esta activo.');
    if (input.arbitroId && (!arbitro || !arbitro.activo || arbitro.role !== 'ARBITRO')) throw new Error('El arbitro seleccionado no esta activo.');

    const partido: Partido = {
      id: crypto.randomUUID(),
      torneoId: 'torneo-1',
      campeonatoId: input.campeonatoId,
      categoriaId: input.categoriaId,
      jornadaId: input.jornadaId,
      canchaId: input.canchaId,
      fecha: input.fecha,
      hora: input.hora,
      jornada: jornada.nombre,
      escenario: cancha.nombre,
      equipoLocalId: input.equipoLocalId,
      equipoVisitanteId: input.equipoVisitanteId,
      idVocalAsignado: input.vocalId,
      vocalId: input.vocalId,
      arbitroId: input.arbitroId,
      resultadoLocal: 0,
      resultadoVisitante: 0,
      estado: input.vocalId ? 'ASIGNADO' : 'PROGRAMADO',
      contabilizado: false,
      eliminado: false,
    };
    const asignacionVocal: AsignacionVocal | undefined = input.vocalId
      ? { id: `asig-vocal-${partido.id}`, partidoId: partido.id, vocalId: input.vocalId, asignadoEn: new Date().toISOString(), activa: true }
      : undefined;
    const asignacionArbitro: AsignacionArbitro | undefined = input.arbitroId
      ? { id: `asig-arbitro-${partido.id}`, partidoId: partido.id, arbitroId: input.arbitroId, asignadoEn: new Date().toISOString(), activa: true }
      : undefined;

    await db.transaction('rw', db.partidos, db.asignacionesVocal, db.asignacionesArbitro, async () => {
      await db.partidos.add(partido);
      if (asignacionVocal) await db.asignacionesVocal.add(asignacionVocal);
      if (asignacionArbitro) await db.asignacionesArbitro.add(asignacionArbitro);
    });
    return partido;
  },
};

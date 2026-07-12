import type {
  ActaPartido,
  AlineacionPartido,
  AsignacionArbitro,
  AsignacionVocal,
  Cancha,
  ControlTiempoPartido,
  Equipo,
  EventoPartido,
  Jornada,
  Jugador,
  NovedadPartido,
  Partido,
  ResultadoValidacion,
  Torneo,
  Usuario,
} from '@saas/shared';
import { db } from '../db/dexie';
import { calcularMarcadorDesdeEventos, vocaliaService } from './vocalia.service';
import { sancionesService } from './sanciones.service';

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

export interface RevisionActaAdmin {
  partido: Partido;
  torneo: Torneo;
  equipoLocal: Equipo;
  equipoVisitante: Equipo;
  vocal: Usuario;
  arbitro?: Usuario;
  jornada?: Jornada;
  cancha?: Cancha;
  jugadoresLocal: Jugador[];
  jugadoresVisitante: Jugador[];
  alineaciones: AlineacionPartido[];
  eventos: EventoPartido[];
  novedades: NovedadPartido[];
  controlesTiempo: ControlTiempoPartido[];
  marcador: { local: number; visitante: number };
  validacion: ResultadoValidacion;
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

async function cargarRevisionActa(partidoId: string): Promise<RevisionActaAdmin> {
  const partido = await db.partidos.get(partidoId);
  if (!partido || partido.eliminado) throw new Error('No se encontro el partido.');

  const [torneo, equipoLocal, equipoVisitante, vocal, arbitro, jornada, cancha, alineaciones, eventos, novedades, controlesTiempo] = await Promise.all([
    db.torneos.get(partido.torneoId),
    db.equipos.get(partido.equipoLocalId),
    db.equipos.get(partido.equipoVisitanteId),
    partido.vocalId || partido.idVocalAsignado ? db.usuarios.get((partido.vocalId ?? partido.idVocalAsignado)!) : undefined,
    partido.arbitroId ? db.usuarios.get(partido.arbitroId) : undefined,
    partido.jornadaId ? db.jornadas.get(partido.jornadaId) : undefined,
    partido.canchaId ? db.canchas.get(partido.canchaId) : undefined,
    db.alineaciones.where('partidoId').equals(partidoId).toArray(),
    db.eventos.where('partidoId').equals(partidoId).toArray(),
    db.novedades.where('partidoId').equals(partidoId).toArray(),
    db.controlesTiempo.where('partidoId').equals(partidoId).toArray(),
  ]);
  if (!torneo || !equipoLocal || !equipoVisitante || !vocal) throw new Error('El partido no tiene todos los datos para revisar el acta.');

  const [jugadoresLocal, jugadoresVisitante, preparacion] = await Promise.all([
    db.jugadores.where('equipoId').equals(equipoLocal.id).toArray(),
    db.jugadores.where('equipoId').equals(equipoVisitante.id).toArray(),
    vocaliaService.validarPreparacionPartido(partidoId),
  ]);
  const errores = [...preparacion.errores];
  const advertencias = [...preparacion.advertencias];
  if (partido.estado !== 'PENDIENTE_ACTA') errores.push('El partido debe estar pendiente de acta para cerrar.');
  if (eventos.some((evento) => evento.minuto < 0 || !Number.isInteger(evento.minuto))) errores.push('Hay eventos con minutos invalidos.');
  if (eventos.some((evento) => evento.tipoEvento === 'SUSPENSION') && !novedades.some((novedad) => novedad.tipo === 'SUSPENSION' && novedad.activa)) {
    errores.push('Existe una suspension sin novedad activa de motivo.');
  }
  if (novedades.length === 0) advertencias.push('No se registraron novedades u observaciones.');

  return {
    partido,
    torneo: torneo as Torneo,
    equipoLocal,
    equipoVisitante,
    vocal,
    arbitro,
    jornada,
    cancha,
    jugadoresLocal: jugadoresLocal.sort((a, b) => a.numeroDorsal - b.numeroDorsal),
    jugadoresVisitante: jugadoresVisitante.sort((a, b) => a.numeroDorsal - b.numeroDorsal),
    alineaciones: alineaciones.sort((a, b) => a.orden - b.orden),
    eventos: eventos.sort((a, b) => a.timestampOriginal - b.timestampOriginal),
    novedades: novedades.sort((a, b) => new Date(a.creadaEn).getTime() - new Date(b.creadaEn).getTime()),
    controlesTiempo,
    marcador: calcularMarcadorDesdeEventos(partido, eventos),
    validacion: { valido: errores.length === 0, errores, advertencias },
  };
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

  obtenerRevisionActa: async (partidoId: string): Promise<RevisionActaAdmin> => cargarRevisionActa(partidoId),

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

  cerrarRevisionAdministrativa: async (partidoId: string, adminId = 'usr-admin-1'): Promise<ActaPartido> => {
    const revision = await cargarRevisionActa(partidoId);
    const { partido } = revision;
    if (partido.estado !== 'PENDIENTE_ACTA') throw new Error('Solo se revisan partidos enviados por el vocal.');
    if (!revision.validacion.valido) throw new Error(revision.validacion.errores[0] ?? 'El acta tiene errores pendientes.');

    const previas = await db.actas.where('partidoId').equals(partidoId).toArray();

    const cerradaEn = new Date().toISOString();
    const partidoCerrado: Partido = { ...partido, estado: 'ACTA_CERRADA', cerradaEn, cerradaPor: adminId };
    const acta: ActaPartido = {
      id: `${partidoId}-v${previas.length + 1}`,
      partidoId,
      version: previas.length + 1,
      contenido: {
        partido: partidoCerrado,
        torneo: revision.torneo,
        equipoLocal: revision.equipoLocal,
        equipoVisitante: revision.equipoVisitante,
        vocal: revision.vocal,
        alineaciones: revision.alineaciones,
        eventos: revision.eventos,
        novedades: revision.novedades,
        marcador: revision.marcador,
        controlesTiempo: revision.controlesTiempo,
      },
      cerradaPor: adminId,
      cerradaEn,
      activa: true,
    };

    await db.transaction('rw', db.actas, db.partidos, async () => {
      for (const previa of previas) await db.actas.update(previa.id, { activa: false });
      await db.actas.add(acta);
      await db.partidos.update(partidoId, { estado: 'ACTA_CERRADA', cerradaEn, cerradaPor: adminId, contabilizado: true });
    });
    await sancionesService.procesarActaCerrada(partidoId, acta.version, adminId);
    return acta;
  },
};

import type {
  ActaPartido,
  AlineacionPartido,
  ControlTiempoPartido,
  Equipo,
  EventoPartido,
  Jugador,
  NovedadPartido,
  PeriodoControl,
  ResultadoValidacion,
  TipoEventoPartido,
  TipoNovedad,
  Usuario,
  VocaliaPartido,
} from '@saas/shared';
import {
  puedeAgregarNovedad,
  puedeCerrarActa,
  puedePrepararAlineacion,
  puedeRegistrarEventoDeportivo,
  periodoDesdeEstado,
  REGLAS_PARTIDO,
} from '../domain/partidos/reglasPartido';
import { db } from '../db/dexie';
import { sancionesService } from './sanciones.service';

export interface PartidoAsignadoResumen {
  partido: VocaliaPartido['partido'];
  equipoLocal: Equipo;
  equipoVisitante: Equipo;
  campeonato: string;
}

export interface CrearEventoInput {
  partidoId: string;
  tipoEvento: TipoEventoPartido;
  equipoId?: string;
  jugadorId?: string;
  jugadorEntraId?: string;
  jugadorSaleId?: string;
  minuto: number;
  periodo: 1 | 2;
  descripcion?: string;
  registradoPorUsuarioId: string;
}

export interface CrearNovedadInput {
  partidoId: string;
  tipo: TipoNovedad;
  descripcion: string;
  minuto?: number;
  periodo?: PeriodoControl;
  creadaPor: string;
}

export interface Marcador {
  local: number;
  visitante: number;
}

const EVENTOS_DEPORTIVOS: TipoEventoPartido[] = ['GOL', 'AUTOGOL', 'TARJETA_AMARILLA', 'TARJETA_ROJA', 'CAMBIO'];

function ahoraIso() {
  return new Date().toISOString();
}

function controlId(partidoId: string, periodo: PeriodoControl) {
  return `${partidoId}-${periodo}`;
}

function nombreJugador(jugador?: Jugador) {
  return jugador ? `${jugador.nombres} ${jugador.apellidos}` : 'Jugador no encontrado';
}

async function obtenerJugadoresDelPartido(partido: VocaliaPartido['partido']) {
  const [jugadoresLocal, jugadoresVisitante] = await Promise.all([
    db.jugadores.where('equipoId').equals(partido.equipoLocalId).toArray(),
    db.jugadores.where('equipoId').equals(partido.equipoVisitanteId).toArray(),
  ]);
  const unicos = (jugadores: Jugador[]) => [...new Map(jugadores.map((jugador) => [jugador.id, jugador])).values()];
  const conDisponibilidad = async (jugadores: Jugador[]) => Promise.all(unicos(jugadores).map(async (jugador) => {
    const disponibilidad = await sancionesService.obtenerEstadoJugadorParaPartido(jugador.id, partido.id);
    return {
      ...jugador,
      habilitado: disponibilidad.habilitado,
      estadoHabilitacion: disponibilidad.habilitado ? jugador.estadoHabilitacion : 'SUSPENDIDO',
      motivoInhabilitacion: disponibilidad.habilitado ? jugador.motivoInhabilitacion : disponibilidad.motivo,
    };
  }));
  const [localConEstado, visitanteConEstado] = await Promise.all([
    conDisponibilidad(jugadoresLocal),
    conDisponibilidad(jugadoresVisitante),
  ]);
  return {
    jugadoresLocal: localConEstado.sort((a, b) => a.numeroDorsal - b.numeroDorsal),
    jugadoresVisitante: visitanteConEstado.sort((a, b) => a.numeroDorsal - b.numeroDorsal),
  };
}

async function validarAccesoVocal(partidoId: string, vocalId: string) {
  const asignacion = await db.asignacionesVocal
    .where('[partidoId+vocalId]')
    .equals([partidoId, vocalId])
    .and((item) => item.activa)
    .first();

  if (!asignacion) throw new Error('No tienes una asignacion activa para este partido.');
}

async function obtenerPartidoConAcceso(partidoId: string, vocalId: string) {
  const partido = await db.partidos.get(partidoId);
  if (!partido || partido.eliminado) throw new Error('No se encontro el partido solicitado.');
  await validarAccesoVocal(partidoId, vocalId);
  return partido;
}

async function validarJugadorDelPartido(partido: VocaliaPartido['partido'], jugadorId?: string) {
  if (!jugadorId) return undefined;
  const jugador = await db.jugadores.get(jugadorId);
  if (!jugador) throw new Error('El jugador seleccionado no existe.');
  if (jugador.equipoId !== partido.equipoLocalId && jugador.equipoId !== partido.equipoVisitanteId) {
    throw new Error('El jugador no pertenece a este partido.');
  }
  const disponibilidad = await sancionesService.obtenerEstadoJugadorParaPartido(jugador.id, partido.id);
  if (!disponibilidad.habilitado) throw new Error(disponibilidad.motivo ?? 'El jugador no esta habilitado.');
  return jugador;
}

function contarDuplicadosDorsal(jugadores: Jugador[], equipo: Equipo, errores: string[]) {
  const jugadoresUnicos = [...new Map(jugadores.map((jugador) => [jugador.id, jugador])).values()];
  const dorsales = new Map<number, Jugador>();
  for (const jugador of jugadoresUnicos) {
    const existente = dorsales.get(jugador.numeroDorsal);
    if (existente && existente.id !== jugador.id) {
      errores.push(`Equipo ${equipo.nombre}: dorsal ${jugador.numeroDorsal} repetido entre ${nombreJugador(existente)} y ${nombreJugador(jugador)}.`);
    }
    dorsales.set(jugador.numeroDorsal, jugador);
  }
}

function deduplicarAlineaciones(alineaciones: AlineacionPartido[]) {
  const porJugador = new Map<string, AlineacionPartido>();
  for (const alineacion of alineaciones) {
    const clave = `${alineacion.partidoId}|${alineacion.equipoId}|${alineacion.jugadorId}`;
    const actual = porJugador.get(clave);
    if (!actual || new Date(alineacion.actualizadoEn).getTime() > new Date(actual.actualizadoEn).getTime()) {
      porJugador.set(clave, alineacion);
    }
  }
  return [...porJugador.values()];
}

async function repararAlineacionesDuplicadas(partidoId: string) {
  const alineaciones = await db.alineaciones.where('partidoId').equals(partidoId).toArray();
  const porJugador = new Map<string, AlineacionPartido[]>();
  for (const alineacion of alineaciones) {
    const clave = `${alineacion.partidoId}|${alineacion.equipoId}|${alineacion.jugadorId}`;
    porJugador.set(clave, [...(porJugador.get(clave) ?? []), alineacion]);
  }
  const idsDuplicados: string[] = [];
  for (const grupo of porJugador.values()) {
    if (grupo.length <= 1) continue;
    const [vigente, ...duplicados] = [...grupo].sort((a, b) => new Date(b.actualizadoEn).getTime() - new Date(a.actualizadoEn).getTime());
    idsDuplicados.push(...duplicados.map((item) => item.id));
    if (vigente.id !== `${vigente.partidoId}-${vigente.equipoId}-${vigente.jugadorId}`) {
      const idCanonico = `${vigente.partidoId}-${vigente.equipoId}-${vigente.jugadorId}`;
      if (!(await db.alineaciones.get(idCanonico))) {
        await db.alineaciones.add({ ...vigente, id: idCanonico, actualizadoEn: ahoraIso() });
        idsDuplicados.push(vigente.id);
      }
    }
  }
  if (idsDuplicados.length > 0) await db.alineaciones.bulkDelete([...new Set(idsDuplicados)]);
}

export function calcularMarcadorDesdeEventos(partido: VocaliaPartido['partido'], eventos: EventoPartido[]): Marcador {
  return eventos
    .filter((evento) => evento.activo && (evento.tipoEvento === 'GOL' || evento.tipoEvento === 'AUTOGOL'))
    .reduce<Marcador>(
      (marcador, evento) => {
        if (evento.tipoEvento === 'GOL') {
          if (evento.equipoId === partido.equipoLocalId) marcador.local += 1;
          if (evento.equipoId === partido.equipoVisitanteId) marcador.visitante += 1;
        }
        if (evento.tipoEvento === 'AUTOGOL') {
          if (evento.equipoId === partido.equipoLocalId) marcador.visitante += 1;
          if (evento.equipoId === partido.equipoVisitanteId) marcador.local += 1;
        }
        return marcador;
      },
      { local: 0, visitante: 0 },
    );
}

export function calcularSegundosControl(control?: ControlTiempoPartido) {
  if (!control) return 0;
  if (!control.activo || !control.iniciadoEn) return control.segundosAcumulados;
  return control.segundosAcumulados + Math.floor((Date.now() - new Date(control.iniciadoEn).getTime()) / 1000);
}

async function crearEventoSistema(partidoId: string, usuarioId: string, tipoEvento: TipoEventoPartido, periodo: 1 | 2, descripcion?: string) {
  const evento: EventoPartido = {
    id: crypto.randomUUID(),
    partidoId,
    tipoEvento,
    minuto: 0,
    periodo,
    descripcion,
    registradoEn: ahoraIso(),
    registradoPorUsuarioId: usuarioId,
    activo: true,
    timestampOriginal: Date.now(),
  };
  await db.eventos.add(evento);
  return evento;
}

async function snapshot(partidoId: string, vocal: Usuario) {
  const vocalia = await vocaliaService.cargarPartidoParaVocal(partidoId, vocal);
  return {
    partido: vocalia.partido,
    torneo: vocalia.torneo,
    equipoLocal: vocalia.equipoLocal,
    equipoVisitante: vocalia.equipoVisitante,
    vocal,
    alineaciones: vocalia.alineaciones,
    eventos: vocalia.eventos,
    novedades: vocalia.novedades,
    marcador: calcularMarcadorDesdeEventos(vocalia.partido, vocalia.eventos),
    controlesTiempo: vocalia.controlesTiempo,
  };
}

export const vocaliaService = {
  obtenerPartidosAsignados: async (vocalId: string): Promise<PartidoAsignadoResumen[]> => {
    const asignaciones = await db.asignacionesVocal.where('vocalId').equals(vocalId).and((a) => a.activa).toArray();
    const partidos = await Promise.all(asignaciones.map((asignacion) => db.partidos.get(asignacion.partidoId)));
    const activos = partidos.filter((partido): partido is VocaliaPartido['partido'] => Boolean(partido && !partido.eliminado && partido.estado !== 'CANCELADO' && partido.estado !== 'PENDIENTE_ACTA' && partido.estado !== 'ACTA_CERRADA'));

    return await Promise.all(
      activos.map(async (partido) => {
        const [equipoLocal, equipoVisitante, torneo] = await Promise.all([
          db.equipos.get(partido.equipoLocalId),
          db.equipos.get(partido.equipoVisitanteId),
          db.torneos.get(partido.torneoId),
        ]);
        if (!equipoLocal || !equipoVisitante) throw new Error('El partido asignado tiene equipos incompletos.');
        return { partido, equipoLocal, equipoVisitante, campeonato: torneo?.nombre ?? partido.torneoId };
      }),
    );
  },

  cargarPartidoParaVocal: async (partidoId: string, vocal: Usuario): Promise<VocaliaPartido> => {
    if (vocal.role !== 'VOCAL') throw new Error('El usuario activo no tiene rol de vocal.');
    const partido = await obtenerPartidoConAcceso(partidoId, vocal.id);
    await repararAlineacionesDuplicadas(partidoId);

    const [torneo, equipoLocal, equipoVisitante, asignacion] = await Promise.all([
      db.torneos.get(partido.torneoId),
      db.equipos.get(partido.equipoLocalId),
      db.equipos.get(partido.equipoVisitanteId),
      db.asignacionesVocal.where('[partidoId+vocalId]').equals([partidoId, vocal.id]).first(),
    ]);
    if (!torneo || !equipoLocal || !equipoVisitante || !asignacion?.activa) throw new Error('El partido no tiene todos los datos necesarios.');

    const { jugadoresLocal, jugadoresVisitante } = await obtenerJugadoresDelPartido(partido);
    const [alineaciones, eventos, novedades, controlesTiempo, acta] = await Promise.all([
      db.alineaciones.where('partidoId').equals(partidoId).toArray(),
      db.eventos.where('partidoId').equals(partidoId).toArray(),
      db.novedades.where('partidoId').equals(partidoId).toArray(),
      db.controlesTiempo.where('partidoId').equals(partidoId).toArray(),
      db.actas.where('partidoId').equals(partidoId).and((item) => item.activa).last(),
    ]);

    return {
      partido,
      torneo,
      equipoLocal,
      equipoVisitante,
      vocal,
      jugadoresLocal,
      jugadoresVisitante,
      alineaciones: deduplicarAlineaciones(alineaciones).sort((a, b) => a.orden - b.orden),
      eventos: eventos.sort((a, b) => a.timestampOriginal - b.timestampOriginal),
      novedades: novedades.sort((a, b) => new Date(a.creadaEn).getTime() - new Date(b.creadaEn).getTime()),
      controlesTiempo,
      acta,
    };
  },

  validarPreparacionPartido: async (partidoId: string): Promise<ResultadoValidacion> => {
    const partido = await db.partidos.get(partidoId);
    const errores: string[] = [];
    const advertencias: string[] = [];
    if (!partido) return { valido: false, errores: ['No se encontro el partido.'], advertencias };
    await repararAlineacionesDuplicadas(partidoId);

    const [equipoLocal, equipoVisitante, asignacion] = await Promise.all([
      db.equipos.get(partido.equipoLocalId),
      db.equipos.get(partido.equipoVisitanteId),
      db.asignacionesVocal.where('partidoId').equals(partidoId).and((item) => item.activa).first(),
    ]);
    if (!equipoLocal || !equipoVisitante) errores.push('El partido no tiene equipos completos.');
    if (!asignacion) errores.push('El partido no tiene vocal activo asignado.');
    if (!equipoLocal || !equipoVisitante) return { valido: false, errores, advertencias };

    const { jugadoresLocal, jugadoresVisitante } = await obtenerJugadoresDelPartido(partido);
    contarDuplicadosDorsal(jugadoresLocal, equipoLocal, errores);
    contarDuplicadosDorsal(jugadoresVisitante, equipoVisitante, errores);

    const alineaciones = deduplicarAlineaciones(await db.alineaciones.where('partidoId').equals(partidoId).toArray());
    const validarEquipo = async (equipo: Equipo, jugadores: Jugador[]) => {
      const delEquipo = alineaciones.filter((item) => item.equipoId === equipo.id);
      const titulares = delEquipo.filter((item) => item.rol === 'TITULAR');
      const suplentes = delEquipo.filter((item) => item.rol === 'SUPLENTE');
      const capitanesTitulares = titulares.filter((item) => item.esCapitan);
      if (titulares.length > REGLAS_PARTIDO.maxTitulares) {
        errores.push(`${equipo.nombre}: no puede tener mas de ${REGLAS_PARTIDO.maxTitulares} titulares. Tiene ${titulares.length}.`);
      }
      if (titulares.length < REGLAS_PARTIDO.minTitularesAdvertencia) {
        errores.push(`${equipo.nombre}: necesita al menos ${REGLAS_PARTIDO.minTitularesAdvertencia} titulares. Tiene ${titulares.length}; faltan ${REGLAS_PARTIDO.minTitularesAdvertencia - titulares.length}.`);
      }
      if (suplentes.length < REGLAS_PARTIDO.minSuplentesAdvertencia) advertencias.push(`${equipo.nombre}: tiene pocos suplentes.`);
      if (delEquipo.filter((item) => item.esCapitan).length > 1) errores.push(`${equipo.nombre}: tiene mas de un capitan seleccionado.`);
      if (capitanesTitulares.length === 0) errores.push(`${equipo.nombre}: debe tener un capitan titular antes de iniciar el partido.`);
      if (capitanesTitulares.length > 1) errores.push(`${equipo.nombre}: tiene mas de un capitan titular.`);

      const usados = new Set<string>();
      for (const alineacion of delEquipo) {
        if (usados.has(alineacion.jugadorId)) errores.push(`${equipo.nombre}: el jugador ${alineacion.jugadorId} esta repetido.`);
        usados.add(alineacion.jugadorId);
        const jugador = jugadores.find((item) => item.id === alineacion.jugadorId);
        if (!jugador) errores.push(`${equipo.nombre}: contiene un jugador de otro equipo (${alineacion.jugadorId}).`);
        else {
          const disponibilidad = await sancionesService.obtenerEstadoJugadorParaPartido(jugador.id, partidoId);
          if (!disponibilidad.habilitado) errores.push(`${equipo.nombre}: ${nombreJugador(jugador)} no esta habilitado. ${disponibilidad.motivo ?? ''}`.trim());
        }
      }
    };

    await validarEquipo(equipoLocal, jugadoresLocal);
    await validarEquipo(equipoVisitante, jugadoresVisitante);
    return { valido: errores.length === 0, errores, advertencias };
  },

  validarRevisionActa: async (partidoId: string, vocal: Usuario): Promise<ResultadoValidacion> => {
    const vocalia = await vocaliaService.cargarPartidoParaVocal(partidoId, vocal);
    const preparacion = await vocaliaService.validarPreparacionPartido(partidoId);
    const errores = [...preparacion.errores];
    const advertencias = [...preparacion.advertencias];
    if (vocalia.partido.estado !== 'REVISION_ACTA') errores.push('El partido debe estar en revision del acta antes de enviarlo.');
    if (vocalia.eventos.some((evento) => evento.minuto < 0 || !Number.isInteger(evento.minuto))) errores.push('Hay eventos con minutos invalidos.');
    if (vocalia.eventos.some((evento) => evento.tipoEvento === 'SUSPENSION') && !vocalia.novedades.some((novedad) => novedad.tipo === 'SUSPENSION' && novedad.activa)) {
      errores.push('Existe una suspension sin novedad activa de motivo.');
    }
    if (vocalia.novedades.length === 0) advertencias.push('No se registraron novedades u observaciones.');
    return { valido: errores.length === 0, errores, advertencias };
  },

  guardarAlineacionEquipo: async (
    partidoId: string,
    equipoId: string,
    alineacion: Omit<AlineacionPartido, 'id' | 'partidoId' | 'equipoId' | 'actualizadoEn'>[],
  ): Promise<void> => {
    const partido = await db.partidos.get(partidoId);
    if (!partido) throw new Error('No se encontro el partido.');
    if (!puedePrepararAlineacion(partido.estado)) throw new Error('La alineacion inicial solo se puede editar durante la preparacion.');
    if (equipoId !== partido.equipoLocalId && equipoId !== partido.equipoVisitanteId) throw new Error('El equipo no pertenece al partido.');

    const ids = new Set<string>();
    const titulares = alineacion.filter((item) => item.rol === 'TITULAR');
    if (titulares.length > REGLAS_PARTIDO.maxTitulares) throw new Error(`No se pueden seleccionar mas de ${REGLAS_PARTIDO.maxTitulares} titulares.`);
    if (alineacion.filter((item) => item.esCapitan).length > 1) throw new Error('Cada equipo puede tener un solo capitan.');

    for (const item of alineacion) {
      if (ids.has(item.jugadorId)) throw new Error('Un jugador no puede repetirse en la alineacion.');
      ids.add(item.jugadorId);
      const jugador = await db.jugadores.get(item.jugadorId);
      if (!jugador || jugador.equipoId !== equipoId) throw new Error('La alineacion contiene un jugador de otro equipo.');
      const disponibilidad = await sancionesService.obtenerEstadoJugadorParaPartido(jugador.id, partidoId);
      if (!disponibilidad.habilitado) throw new Error(`La alineacion contiene un jugador no habilitado. ${disponibilidad.motivo ?? ''}`.trim());
    }

    const existentes = await db.alineaciones.where('[partidoId+equipoId]').equals([partidoId, equipoId]).toArray();
    const registros: AlineacionPartido[] = alineacion.map((item, index) => ({
      ...item,
      id: `${partidoId}-${equipoId}-${item.jugadorId}`,
      partidoId,
      equipoId,
      enCancha: item.rol === 'TITULAR',
      esInicial: true,
      estadoActual: item.rol === 'TITULAR' ? 'EN_CANCHA' : 'SUPLENTE_DISPONIBLE',
      orden: index,
      actualizadoEn: ahoraIso(),
    }));

    await db.transaction('rw', db.alineaciones, db.partidos, async () => {
      if (existentes.length > 0) await db.alineaciones.bulkDelete(existentes.map((item) => item.id));
      await db.alineaciones.bulkPut(registros);
      if (partido.estado === 'ASIGNADO') await db.partidos.update(partidoId, { estado: 'EN_PREPARACION' });
    });
  },

  limpiarAlineacionEquipo: async (partidoId: string, equipoId: string): Promise<void> => {
    const partido = await db.partidos.get(partidoId);
    if (!partido) throw new Error('No se encontro el partido.');
    if (!puedePrepararAlineacion(partido.estado)) throw new Error('La alineacion solo se puede limpiar durante la preparacion.');
    if (equipoId !== partido.equipoLocalId && equipoId !== partido.equipoVisitanteId) throw new Error('El equipo no pertenece al partido.');
    const existentes = await db.alineaciones.where('[partidoId+equipoId]').equals([partidoId, equipoId]).toArray();
    if (existentes.length > 0) await db.alineaciones.bulkDelete(existentes.map((item) => item.id));
  },

  actualizarCapitanEquipo: async (partidoId: string, equipoId: string, jugadorId: string, esCapitan: boolean): Promise<void> => {
    const partido = await db.partidos.get(partidoId);
    if (!partido) throw new Error('No se encontro el partido.');
    if (partido.estado === 'ACTA_CERRADA' || partido.estado === 'CANCELADO' || partido.estado === 'PENDIENTE_ACTA' || partido.estado === 'REVISION_ACTA') {
      throw new Error('No se puede modificar el capitan en el estado actual.');
    }
    if (equipoId !== partido.equipoLocalId && equipoId !== partido.equipoVisitanteId) throw new Error('El equipo no pertenece al partido.');
    const alineaciones = await db.alineaciones.where('[partidoId+equipoId]').equals([partidoId, equipoId]).toArray();
    const jugador = alineaciones.find((item) => item.jugadorId === jugadorId);
    if (!jugador) throw new Error('Primero agrega al jugador como titular o suplente.');
    if (esCapitan && (jugador.rol !== 'TITULAR' || jugador.estadoActual !== 'EN_CANCHA')) {
      throw new Error('Solo un jugador titular puede ser capitan.');
    }
    await db.transaction('rw', db.alineaciones, async () => {
      for (const alineacion of alineaciones) {
        await db.alineaciones.update(alineacion.id, { esCapitan: esCapitan && alineacion.jugadorId === jugadorId });
      }
    });
  },

  agregarJugadorTarde: async (partidoId: string, equipoId: string, jugadorId: string, rol: 'TITULAR' | 'SUPLENTE' = 'SUPLENTE'): Promise<void> => {
    const partido = await db.partidos.get(partidoId);
    if (!partido) throw new Error('No se encontro el partido.');
    if (partido.estado === 'ACTA_CERRADA' || partido.estado === 'CANCELADO' || partido.estado === 'PENDIENTE_ACTA' || partido.estado === 'REVISION_ACTA') {
      throw new Error('No se pueden incorporar jugadores en el estado actual.');
    }
    if (equipoId !== partido.equipoLocalId && equipoId !== partido.equipoVisitanteId) throw new Error('El equipo no pertenece al partido.');
    const jugador = await db.jugadores.get(jugadorId);
    if (!jugador || jugador.equipoId !== equipoId) throw new Error('El jugador no pertenece al equipo seleccionado.');
    const disponibilidad = await sancionesService.obtenerEstadoJugadorParaPartido(jugador.id, partidoId);
    if (!disponibilidad.habilitado) throw new Error(disponibilidad.motivo ?? 'El jugador no esta habilitado.');
    const existente = await db.alineaciones.where('[partidoId+jugadorId]').equals([partidoId, jugadorId]).first();
    if (existente) throw new Error('El jugador ya esta registrado en este partido.');
    const delEquipo = await db.alineaciones.where('[partidoId+equipoId]').equals([partidoId, equipoId]).toArray();
    if (rol === 'TITULAR' && delEquipo.filter((alineacion) => alineacion.estadoActual === 'EN_CANCHA').length >= REGLAS_PARTIDO.maxTitulares) {
      throw new Error(`No se pueden registrar mas de ${REGLAS_PARTIDO.maxTitulares} titulares.`);
    }
    const registro: AlineacionPartido = {
      id: `${partidoId}-${equipoId}-${jugadorId}`,
      partidoId,
      equipoId,
      jugadorId,
      rol,
      esArquero: false,
      esCapitan: false,
      enCancha: rol === 'TITULAR',
      esInicial: false,
      estadoActual: rol === 'TITULAR' ? 'EN_CANCHA' : 'SUPLENTE_DISPONIBLE',
      orden: delEquipo.length,
      actualizadoEn: ahoraIso(),
    };
    await db.alineaciones.add(registro);
  },

  guardarColoresCamiseta: async (partidoId: string, colorLocal: string, colorVisitante: string): Promise<void> => {
    const partido = await db.partidos.get(partidoId);
    if (!partido) throw new Error('No se encontro el partido.');
    if (!puedePrepararAlineacion(partido.estado)) throw new Error('Los colores se definen antes de iniciar el partido.');
    if (!colorLocal.trim() || !colorVisitante.trim()) throw new Error('Define el color de camiseta de los dos equipos.');
    await db.partidos.update(partidoId, { colorCamisetaLocal: colorLocal.trim(), colorCamisetaVisitante: colorVisitante.trim() });
  },

  iniciarPrimerTiempo: async (partidoId: string, usuarioId: string): Promise<void> => {
    const partido = await obtenerPartidoConAcceso(partidoId, usuarioId);
    if (partido.estado !== 'ASIGNADO' && partido.estado !== 'EN_PREPARACION') throw new Error('El partido no esta listo para iniciar.');
    if (!partido.colorCamisetaLocal || !partido.colorCamisetaVisitante) throw new Error('Define el color de camiseta de ambos equipos antes de iniciar.');
    const validacion = await vocaliaService.validarPreparacionPartido(partidoId);
    if (!validacion.valido) throw new Error(validacion.errores.join(' '));
    const control: ControlTiempoPartido = {
      id: controlId(partidoId, 'PRIMER_TIEMPO'),
      partidoId,
      periodo: 'PRIMER_TIEMPO',
      iniciadoEn: ahoraIso(),
      segundosAcumulados: 0,
      activo: true,
      actualizadoEn: ahoraIso(),
    };
    await db.transaction('rw', db.partidos, db.eventos, db.controlesTiempo, async () => {
      await db.partidos.update(partidoId, { estado: 'PRIMER_TIEMPO', inicioRealEn: control.iniciadoEn });
      await db.controlesTiempo.put(control);
      await crearEventoSistema(partidoId, usuarioId, 'INICIO_PRIMER_TIEMPO', 1, 'Inicio del primer tiempo');
    });
  },

  pausarTiempo: async (partidoId: string, usuarioId: string): Promise<void> => {
    const partido = await obtenerPartidoConAcceso(partidoId, usuarioId);
    const periodo = periodoDesdeEstado(partido.estado);
    if (!periodo || periodo === 'DESCANSO') throw new Error('No hay un periodo en juego para pausar.');
    const control = await db.controlesTiempo.get(controlId(partidoId, periodo));
    if (!control || !control.activo) return;
    await db.controlesTiempo.update(control.id, {
      activo: false,
      pausadoEn: ahoraIso(),
      segundosAcumulados: calcularSegundosControl(control),
      actualizadoEn: ahoraIso(),
    });
  },

  reanudarTiempo: async (partidoId: string, usuarioId: string): Promise<void> => {
    const partido = await obtenerPartidoConAcceso(partidoId, usuarioId);
    const periodo = periodoDesdeEstado(partido.estado);
    if (!periodo || periodo === 'DESCANSO') throw new Error('No hay un periodo en juego para reanudar.');
    const control = await db.controlesTiempo.get(controlId(partidoId, periodo));
    if (!control || control.activo) return;
    await db.controlesTiempo.update(control.id, {
      activo: true,
      iniciadoEn: ahoraIso(),
      pausadoEn: undefined,
      actualizadoEn: ahoraIso(),
    });
  },

  finalizarPrimerTiempo: async (partidoId: string, usuarioId: string): Promise<void> => {
    const partido = await obtenerPartidoConAcceso(partidoId, usuarioId);
    if (partido.estado !== 'PRIMER_TIEMPO') throw new Error('Solo puedes finalizar el primer tiempo mientras esta en juego.');
    const control = await db.controlesTiempo.get(controlId(partidoId, 'PRIMER_TIEMPO'));
    await db.transaction('rw', db.partidos, db.eventos, db.controlesTiempo, async () => {
      if (control) await db.controlesTiempo.update(control.id, { activo: false, segundosAcumulados: calcularSegundosControl(control), actualizadoEn: ahoraIso() });
      await db.partidos.update(partidoId, { estado: 'DESCANSO' });
      await crearEventoSistema(partidoId, usuarioId, 'FIN_PRIMER_TIEMPO', 1, 'Fin del primer tiempo');
    });
  },

  iniciarSegundoTiempo: async (partidoId: string, usuarioId: string): Promise<void> => {
    const partido = await obtenerPartidoConAcceso(partidoId, usuarioId);
    if (partido.estado !== 'DESCANSO') throw new Error('Primero debes finalizar el primer tiempo.');
    const [equipoLocal, equipoVisitante, alineaciones] = await Promise.all([
      db.equipos.get(partido.equipoLocalId),
      db.equipos.get(partido.equipoVisitanteId),
      db.alineaciones.where('partidoId').equals(partidoId).toArray(),
    ]);
    const validarCapitanEnCancha = (equipoId: string, nombreEquipo: string) => {
      const capitanes = alineaciones.filter((item) => item.equipoId === equipoId && item.esCapitan && item.estadoActual === 'EN_CANCHA');
      if (capitanes.length === 0) throw new Error(`${nombreEquipo}: selecciona un capitan titular antes de iniciar el segundo tiempo.`);
      if (capitanes.length > 1) throw new Error(`${nombreEquipo}: tiene mas de un capitan titular.`);
    };
    validarCapitanEnCancha(partido.equipoLocalId, equipoLocal?.nombre ?? 'Equipo local');
    validarCapitanEnCancha(partido.equipoVisitanteId, equipoVisitante?.nombre ?? 'Equipo visitante');
    const control: ControlTiempoPartido = {
      id: controlId(partidoId, 'SEGUNDO_TIEMPO'),
      partidoId,
      periodo: 'SEGUNDO_TIEMPO',
      iniciadoEn: ahoraIso(),
      segundosAcumulados: 0,
      activo: true,
      actualizadoEn: ahoraIso(),
    };
    await db.transaction('rw', db.partidos, db.eventos, db.controlesTiempo, async () => {
      await db.partidos.update(partidoId, { estado: 'SEGUNDO_TIEMPO' });
      await db.controlesTiempo.put(control);
      await crearEventoSistema(partidoId, usuarioId, 'INICIO_SEGUNDO_TIEMPO', 2, 'Inicio del segundo tiempo');
    });
  },

  finalizarPartido: async (partidoId: string, usuarioId: string): Promise<void> => {
    const partido = await obtenerPartidoConAcceso(partidoId, usuarioId);
    if (partido.estado !== 'SEGUNDO_TIEMPO') throw new Error('Solo puedes finalizar el partido durante el segundo tiempo.');
    const control = await db.controlesTiempo.get(controlId(partidoId, 'SEGUNDO_TIEMPO'));
    await db.transaction('rw', db.partidos, db.eventos, db.controlesTiempo, async () => {
      if (control) await db.controlesTiempo.update(control.id, { activo: false, segundosAcumulados: calcularSegundosControl(control), actualizadoEn: ahoraIso() });
      await db.partidos.update(partidoId, { estado: 'REVISION_ACTA', finRealEn: ahoraIso() });
      await crearEventoSistema(partidoId, usuarioId, 'FIN_SEGUNDO_TIEMPO', 2, 'Fin del segundo tiempo');
      await crearEventoSistema(partidoId, usuarioId, 'FIN_PARTIDO', 2, 'Fin del partido');
    });
  },

  crearEvento: async (input: CrearEventoInput): Promise<EventoPartido[]> => {
    if (!Number.isInteger(input.minuto) || input.minuto < 0) throw new Error('El minuto debe ser un entero positivo.');
    const partido = await obtenerPartidoConAcceso(input.partidoId, input.registradoPorUsuarioId);
    if (input.tipoEvento === 'DOBLE_AMARILLA') throw new Error('La doble amarilla se genera automaticamente al registrar la segunda amarilla.');
    if (!puedeRegistrarEventoDeportivo(partido.estado, input.tipoEvento)) throw new Error('No se pueden registrar eventos deportivos en el estado actual.');
    const jugador = await validarJugadorDelPartido(partido, input.jugadorId);

    if ((input.tipoEvento === 'GOL' || input.tipoEvento === 'AUTOGOL' || input.tipoEvento === 'TARJETA_AMARILLA' || input.tipoEvento === 'TARJETA_ROJA') && (!jugador || !input.equipoId || jugador.equipoId !== input.equipoId)) {
      throw new Error('El evento debe estar asociado a un jugador valido del equipo.');
    }
    if (input.tipoEvento === 'TARJETA_ROJA' && !input.descripcion?.trim()) throw new Error('El motivo de la tarjeta roja directa es obligatorio.');

    const alineaciones = await db.alineaciones.where('partidoId').equals(input.partidoId).toArray();
    const alineacionJugador = jugador ? alineaciones.find((item) => item.jugadorId === jugador.id) : undefined;
    if (jugador && EVENTOS_DEPORTIVOS.includes(input.tipoEvento) && alineacionJugador?.estadoActual === 'EXPULSADO') throw new Error('El jugador esta expulsado.');

    if (input.tipoEvento === 'CAMBIO') {
      const sale = await validarJugadorDelPartido(partido, input.jugadorSaleId);
      const entra = await validarJugadorDelPartido(partido, input.jugadorEntraId);
      if (!sale || !entra || sale.id === entra.id || sale.equipoId !== entra.equipoId) throw new Error('El cambio debe usar dos jugadores distintos del mismo equipo.');
      const alineacionSale = alineaciones.find((item) => item.jugadorId === sale.id && item.enCancha && item.estadoActual === 'EN_CANCHA');
      const alineacionEntra = alineaciones.find((item) => item.jugadorId === entra.id && item.rol === 'SUPLENTE' && item.estadoActual === 'SUPLENTE_DISPONIBLE');
      if (!alineacionSale || !alineacionEntra) throw new Error('Debe salir un jugador en cancha y entrar un suplente disponible.');
      if (!REGLAS_PARTIDO.permiteReingreso && alineacionEntra.estadoActual === 'SUSTITUIDO') throw new Error('La regla actual no permite reingresos.');
      input.equipoId = sale.equipoId;
    }

    const ahora = Date.now();
    const posibleDuplicado = await db.eventos.where('partidoId').equals(input.partidoId).and((evento) => evento.activo && evento.tipoEvento === input.tipoEvento && evento.minuto === input.minuto && ahora - evento.timestampOriginal < 1500).first();
    if (posibleDuplicado) throw new Error('Este evento ya fue registrado hace un momento.');

    const eventosAGuardar: EventoPartido[] = [{
      id: crypto.randomUUID(),
      partidoId: input.partidoId,
      tipoEvento: input.tipoEvento,
      equipoId: input.equipoId,
      jugadorId: input.jugadorId,
      jugadorEntraId: input.jugadorEntraId,
      jugadorSaleId: input.jugadorSaleId,
      minuto: input.minuto,
      periodo: input.periodo,
      descripcion: input.descripcion,
      registradoEn: ahoraIso(),
      registradoPorUsuarioId: input.registradoPorUsuarioId,
      activo: true,
      timestampOriginal: ahora,
    }];

    const amarillasPrevias = input.jugadorId
      ? await db.eventos.where('partidoId').equals(input.partidoId).and((evento) => evento.activo && evento.jugadorId === input.jugadorId && evento.tipoEvento === 'TARJETA_AMARILLA').count()
      : 0;
    if (input.tipoEvento === 'TARJETA_AMARILLA' && amarillasPrevias >= 1) {
      eventosAGuardar.push({ ...eventosAGuardar[0], id: crypto.randomUUID(), tipoEvento: 'DOBLE_AMARILLA', timestampOriginal: ahora + 1, descripcion: 'Expulsion por doble amonestacion.' });
    }

    await db.transaction('rw', db.eventos, db.alineaciones, db.partidos, async () => {
      await db.eventos.bulkAdd(eventosAGuardar);
      if (input.tipoEvento === 'CAMBIO' && input.jugadorSaleId && input.jugadorEntraId) {
        await db.alineaciones.where('[partidoId+jugadorId]').equals([input.partidoId, input.jugadorSaleId]).modify({ enCancha: false, estadoActual: 'SUSTITUIDO', esCapitan: false });
        await db.alineaciones.where('[partidoId+jugadorId]').equals([input.partidoId, input.jugadorEntraId]).modify({ enCancha: true, estadoActual: 'EN_CANCHA' });
      }
      if ((input.tipoEvento === 'TARJETA_ROJA' || input.tipoEvento === 'DOBLE_AMARILLA' || eventosAGuardar.some((evento) => evento.tipoEvento === 'DOBLE_AMARILLA')) && input.jugadorId) {
        await db.alineaciones.where('[partidoId+jugadorId]').equals([input.partidoId, input.jugadorId]).modify({ enCancha: false, estadoActual: 'EXPULSADO' });
      }
      const eventos = await db.eventos.where('partidoId').equals(input.partidoId).toArray();
      const marcador = calcularMarcadorDesdeEventos(partido, eventos);
      await db.partidos.update(input.partidoId, { resultadoLocal: marcador.local, resultadoVisitante: marcador.visitante });
    });

    return eventosAGuardar;
  },

  anularEvento: async (partidoId: string, eventoId: string, usuarioId: string): Promise<void> => {
    const partido = await obtenerPartidoConAcceso(partidoId, usuarioId);
    if (partido.estado === 'ACTA_CERRADA' || partido.estado === 'CANCELADO') throw new Error('El partido esta en solo lectura.');
    const evento = await db.eventos.get(eventoId);
    if (!evento || evento.partidoId !== partidoId) throw new Error('No se encontro el evento.');

    await db.transaction('rw', db.eventos, db.alineaciones, db.partidos, async () => {
      await db.eventos.update(eventoId, { activo: false });
      if (evento.tipoEvento === 'CAMBIO' && evento.jugadorSaleId && evento.jugadorEntraId) {
        await db.alineaciones.where('[partidoId+jugadorId]').equals([partidoId, evento.jugadorSaleId]).modify({ enCancha: true, estadoActual: 'EN_CANCHA' });
        await db.alineaciones.where('[partidoId+jugadorId]').equals([partidoId, evento.jugadorEntraId]).modify({ enCancha: false, estadoActual: 'SUPLENTE_DISPONIBLE' });
      }
      const eventos = await db.eventos.where('partidoId').equals(partidoId).toArray();
      const marcador = calcularMarcadorDesdeEventos(partido, eventos.map((item) => (item.id === eventoId ? { ...item, activo: false } : item)));
      await db.partidos.update(partidoId, { resultadoLocal: marcador.local, resultadoVisitante: marcador.visitante });
    });
  },

  crearNovedad: async (input: CrearNovedadInput): Promise<NovedadPartido> => {
    const partido = await obtenerPartidoConAcceso(input.partidoId, input.creadaPor);
    if (!puedeAgregarNovedad(partido.estado)) throw new Error('No se pueden agregar novedades en el estado actual.');
    if (!input.descripcion.trim()) throw new Error('La descripcion de la novedad es obligatoria.');
    const novedad: NovedadPartido = { id: crypto.randomUUID(), ...input, descripcion: input.descripcion.trim(), creadaEn: ahoraIso(), activa: true };
    await db.novedades.add(novedad);
    return novedad;
  },

  anularNovedad: async (partidoId: string, novedadId: string, usuarioId: string): Promise<void> => {
    const partido = await obtenerPartidoConAcceso(partidoId, usuarioId);
    if (partido.estado === 'ACTA_CERRADA') throw new Error('El acta cerrada esta en solo lectura.');
    await db.novedades.update(novedadId, { activa: false });
  },

  suspenderPartido: async (partidoId: string, usuarioId: string, motivo: string): Promise<void> => {
    const partido = await obtenerPartidoConAcceso(partidoId, usuarioId);
    if (!motivo.trim()) throw new Error('El motivo de suspension es obligatorio.');
    if (partido.estado === 'ACTA_CERRADA' || partido.estado === 'CANCELADO') throw new Error('No se puede suspender este partido.');
    const periodo = periodoDesdeEstado(partido.estado);
    const control = periodo ? await db.controlesTiempo.get(controlId(partidoId, periodo)) : undefined;
    await db.transaction('rw', db.partidos, db.eventos, db.controlesTiempo, db.novedades, async () => {
      if (control) await db.controlesTiempo.update(control.id, { activo: false, segundosAcumulados: calcularSegundosControl(control), actualizadoEn: ahoraIso() });
      await db.partidos.update(partidoId, { estado: 'SUSPENDIDO', estadoAnteriorSuspension: partido.estado });
      await crearEventoSistema(partidoId, usuarioId, 'SUSPENSION', periodo === 'SEGUNDO_TIEMPO' ? 2 : 1, motivo);
      await db.novedades.add({ id: crypto.randomUUID(), partidoId, tipo: 'SUSPENSION', descripcion: motivo.trim(), periodo, creadaPor: usuarioId, creadaEn: ahoraIso(), activa: true });
    });
  },

  reanudarPartido: async (partidoId: string, usuarioId: string): Promise<void> => {
    const partido = await obtenerPartidoConAcceso(partidoId, usuarioId);
    if (partido.estado !== 'SUSPENDIDO' || !partido.estadoAnteriorSuspension) throw new Error('El partido no esta suspendido.');
    if (partido.estadoAnteriorSuspension === 'CANCELADO' || partido.estadoAnteriorSuspension === 'ACTA_CERRADA') throw new Error('No se puede reanudar este partido.');
    const periodo = periodoDesdeEstado(partido.estadoAnteriorSuspension);
    await db.transaction('rw', db.partidos, db.eventos, db.controlesTiempo, async () => {
      await db.partidos.update(partidoId, { estado: partido.estadoAnteriorSuspension, estadoAnteriorSuspension: undefined });
      if (periodo && periodo !== 'DESCANSO') {
        const control = await db.controlesTiempo.get(controlId(partidoId, periodo));
        if (control) await db.controlesTiempo.update(control.id, { activo: true, iniciadoEn: ahoraIso(), pausadoEn: undefined, actualizadoEn: ahoraIso() });
      }
      await crearEventoSistema(partidoId, usuarioId, 'REANUDACION', periodo === 'SEGUNDO_TIEMPO' ? 2 : 1, 'Reanudacion del partido');
    });
  },

  cerrarActa: async (partidoId: string, vocal: Usuario, confirmado: boolean): Promise<ActaPartido> => {
    if (!confirmado) throw new Error('Debes confirmar que la informacion registrada es correcta.');
    const partido = await obtenerPartidoConAcceso(partidoId, vocal.id);
    if (!puedeCerrarActa(partido.estado)) throw new Error('El partido debe estar en revision del acta.');
    const revision = await vocaliaService.validarRevisionActa(partidoId, vocal);
    if (!revision.valido) throw new Error(revision.errores.join(' '));
    const previas = await db.actas.where('partidoId').equals(partidoId).toArray();
    const cerradaEn = ahoraIso();
    const contenido = await snapshot(partidoId, vocal);
    contenido.partido = { ...contenido.partido, estado: 'PENDIENTE_ACTA', cerradaEn, cerradaPor: vocal.id };
    const acta: ActaPartido = {
      id: `${partidoId}-v${previas.length + 1}`,
      partidoId,
      version: previas.length + 1,
      contenido,
      cerradaPor: vocal.id,
      cerradaEn,
      activa: true,
    };
    await db.transaction('rw', db.actas, db.partidos, async () => {
      for (const previa of previas) await db.actas.update(previa.id, { activa: false });
      await db.actas.add(acta);
      await db.partidos.update(partidoId, { estado: 'PENDIENTE_ACTA', cerradaEn, cerradaPor: vocal.id });
    });
    return acta;
  },
};

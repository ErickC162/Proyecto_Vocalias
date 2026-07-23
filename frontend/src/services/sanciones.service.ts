import type { DisponibilidadJugador, EstadoJugadorCompetitivo, EventoPartido, Jugador, Sancion, SancionFecha, TipoSancion } from '@saas/shared';
import { db } from '../db/dexie';
import { crearId } from '../lib/ids';

export interface SancionResumen {
  sancion: Sancion;
  jugador?: Jugador;
  equipo?: string;
  fechas: SancionFecha[];
  fechasTexto: string;
}

export interface CrearSancionInput {
  jugadorId: string;
  tipo: TipoSancion;
  motivo: string;
  partidosSuspension: number;
  fechaCampeonatoIds?: string[];
  creadaPor: string;
}

function nombreFecha(fechaId: string, numero?: number) {
  return numero ? `Fecha ${numero}` : fechaId;
}

export const sancionesService = {
  obtenerTodas: async (): Promise<SancionResumen[]> => {
    const [sanciones, sancionesFechas, fechasCampeonato, jugadores, equipos] = await Promise.all([
      db.sanciones.toArray(),
      db.sancionesFechas.toArray(),
      db.fechasCampeonato.toArray(),
      db.jugadores.toArray(),
      db.equipos.toArray(),
    ]);
    return sanciones
      .sort((a, b) => (b.creadaEn ?? '').localeCompare(a.creadaEn ?? ''))
      .map((sancion) => {
        const jugador = jugadores.find((item) => item.id === sancion.jugadorId);
        const fechas = sancionesFechas.filter((item) => item.sancionId === sancion.id);
        const fechasTexto = fechas
          .map((item) => {
            const fecha = fechasCampeonato.find((fechaCampeonato) => fechaCampeonato.id === item.fechaCampeonatoId);
            return nombreFecha(item.fechaCampeonatoId, fecha?.numero);
          })
          .join(', ');
        return { sancion, jugador, equipo: equipos.find((equipo) => equipo.id === jugador?.equipoId)?.nombre, fechas, fechasTexto };
      });
  },

  sugerirFechasSuspension: async (campeonatoId: string, jornadaActualId: string | undefined, cantidad: number): Promise<string[]> => {
    const fechas = await db.fechasCampeonato.where('campeonatoId').equals(campeonatoId).sortBy('numero');
    const actual = jornadaActualId ? fechas.find((fecha) => fecha.id === jornadaActualId)?.numero ?? 0 : 0;
    return fechas.filter((fecha) => fecha.numero > actual).slice(0, cantidad).map((fecha) => fecha.id);
  },

  crearManual: async (input: CrearSancionInput): Promise<Sancion> => {
    if (!input.motivo.trim()) throw new Error('El motivo de la sancion es obligatorio.');
    if (!Number.isInteger(input.partidosSuspension) || input.partidosSuspension <= 0) throw new Error('La suspension debe ser de al menos un partido.');
    if (!input.fechaCampeonatoIds || input.fechaCampeonatoIds.length !== input.partidosSuspension) throw new Error('Selecciona las fechas concretas de suspension.');
    const jugador = await db.jugadores.get(input.jugadorId);
    if (!jugador) throw new Error('El jugador no existe.');
    const sancion: Sancion = {
      id: crearId(),
      campeonatoId: 'camp-1',
      equipoId: jugador.equipoId,
      jugadorId: jugador.id,
      partidoOrigenId: 'manual',
      tipo: input.tipo,
      motivo: input.motivo.trim(),
      fechasDeCastigo: input.partidosSuspension,
      fechasCumplidas: 0,
      partidosSuspension: input.partidosSuspension,
      partidosCumplidos: 0,
      estado: 'ACTIVA',
      creadaEn: new Date().toISOString(),
      creadaPor: input.creadaPor,
    };
    const sancionesFechas: SancionFecha[] = input.fechaCampeonatoIds.map((fechaCampeonatoId) => ({
      id: `${sancion.id}-${fechaCampeonatoId}`,
      sancionId: sancion.id,
      fechaCampeonatoId,
      cumplida: false,
    }));
    await db.transaction('rw', db.sanciones, db.sancionesFechas, async () => {
      await db.sanciones.add(sancion);
      await db.sancionesFechas.bulkAdd(sancionesFechas);
    });
    return sancion;
  },

  cambiarEstado: async (id: string, estado: Sancion['estado']): Promise<void> => {
    const sancion = await db.sanciones.get(id);
    if (!sancion) throw new Error('La sancion no existe.');
    await db.transaction('rw', db.sanciones, db.jugadores, async () => {
      await db.sanciones.update(id, { estado });
      if (estado === 'CUMPLIDA' || estado === 'ANULADA') {
        await db.jugadores.update(sancion.jugadorId, { estadoHabilitacion: 'HABILITADO', habilitado: true, motivoInhabilitacion: undefined });
      }
    });
  },

  calcularAmarillasAcumuladas: async (jugadorId: string, campeonatoId = 'camp-1'): Promise<number> => {
    const partidos = await db.partidos.where('campeonatoId').equals(campeonatoId).and((partido) => partido.estado === 'ACTA_CERRADA').toArray();
    const cerrados = new Set(partidos.map((partido) => partido.id));
    return await db.eventos
      .where('jugadorId')
      .equals(jugadorId)
      .and((evento) => evento.activo && evento.tipoEvento === 'TARJETA_AMARILLA' && cerrados.has(evento.partidoId))
      .count();
  },

  obtenerEstadoJugador: async (jugadorId: string, campeonatoId = 'camp-1'): Promise<EstadoJugadorCompetitivo> => {
    const jugador = await db.jugadores.get(jugadorId);
    const sancionesActivas = await db.sanciones
      .where('jugadorId')
      .equals(jugadorId)
      .and((sancion) => sancion.campeonatoId === campeonatoId && sancion.estado === 'ACTIVA')
      .toArray();
    const amarillasAcumuladas = await sancionesService.calcularAmarillasAcumuladas(jugadorId, campeonatoId);
    const partidosPendientesSuspension = sancionesActivas.reduce((total, sancion) => total + Math.max((sancion.partidosSuspension ?? sancion.fechasDeCastigo) - (sancion.partidosCumplidos ?? sancion.fechasCumplidas), 0), 0);

    if (!jugador) return { habilitado: false, motivo: 'Jugador no encontrado.', sancionesActivas, amarillasAcumuladas, partidosPendientesSuspension };
    if (jugador.activo === false) return { habilitado: false, motivo: 'Jugador desactivado.', sancionesActivas, amarillasAcumuladas, partidosPendientesSuspension };
    if (partidosPendientesSuspension > 0) {
      const motivo = sancionesActivas[0]?.motivo ?? `Le falta cumplir ${partidosPendientesSuspension} partido de suspension.`;
      return { habilitado: false, motivo, sancionesActivas, amarillasAcumuladas, partidosPendientesSuspension };
    }
    if (jugador.habilitado === false || jugador.estadoHabilitacion !== 'HABILITADO') {
      return { habilitado: false, motivo: jugador.motivoInhabilitacion ?? 'Jugador no habilitado.', sancionesActivas, amarillasAcumuladas, partidosPendientesSuspension };
    }
    return { habilitado: true, sancionesActivas, amarillasAcumuladas, partidosPendientesSuspension };
  },

  obtenerDisponibilidadJugador: async (jugadorId: string): Promise<DisponibilidadJugador> => {
    const estado = await sancionesService.obtenerEstadoJugador(jugadorId);
    return { jugadorId, habilitado: estado.habilitado, motivo: estado.motivo, sancionActiva: estado.sancionesActivas[0] };
  },

  obtenerEstadoJugadorParaPartido: async (jugadorId: string, partidoId: string): Promise<DisponibilidadJugador> => {
    const [jugador, partido] = await Promise.all([db.jugadores.get(jugadorId), db.partidos.get(partidoId)]);
    if (!jugador) return { jugadorId, habilitado: false, motivo: 'Jugador no encontrado.' };
    if (!partido) return { jugadorId, habilitado: false, motivo: 'Partido no encontrado.' };
    if (jugador.activo === false) return { jugadorId, habilitado: false, motivo: 'Jugador desactivado.' };

    const campeonatoId = partido.campeonatoId ?? 'camp-1';
    const sancionesActivas = await db.sanciones
      .where('jugadorId')
      .equals(jugadorId)
      .and((sancion) => sancion.campeonatoId === campeonatoId && sancion.estado === 'ACTIVA')
      .toArray();
    if (sancionesActivas.length === 0) {
      if (jugador.habilitado === false || jugador.estadoHabilitacion !== 'HABILITADO') {
        return { jugadorId, habilitado: false, motivo: jugador.motivoInhabilitacion ?? 'Jugador no habilitado.' };
      }
      return { jugadorId, habilitado: true };
    }

    const sancionIds = new Set(sancionesActivas.map((sancion) => sancion.id));
    const fechas = await db.sancionesFechas.toArray();
    const fechasDeSancion = fechas.filter((fecha) => sancionIds.has(fecha.sancionId));
    const fechaPartido = partido.jornadaId;
    const fechaBloqueante = fechasDeSancion.find((fecha) => !fecha.cumplida && fecha.fechaCampeonatoId === fechaPartido);
    if (fechaBloqueante) {
      const sancion = sancionesActivas.find((item) => item.id === fechaBloqueante.sancionId);
      const jornada = fechaPartido ? await db.fechasCampeonato.get(fechaPartido) : undefined;
      return {
        jugadorId,
        habilitado: false,
        motivo: `Suspendido para la ${nombreFecha(fechaPartido ?? '', jornada?.numero)}. Motivo: ${sancion?.motivo ?? 'Sancion activa'}.`,
        sancionActiva: sancion,
      };
    }

    const tieneModeloPorFechas = fechasDeSancion.length > 0;
    if (!tieneModeloPorFechas) {
      const sancion = sancionesActivas[0];
      const pendientes = Math.max((sancion.partidosSuspension ?? sancion.fechasDeCastigo) - (sancion.partidosCumplidos ?? sancion.fechasCumplidas), 0);
      if (pendientes > 0) return { jugadorId, habilitado: false, motivo: sancion.motivo, sancionActiva: sancion };
    }

    return { jugadorId, habilitado: true };
  },

  obtenerJugadoresDisponiblesParaPartido: async (partidoId: string, equipoId: string) => {
    const jugadores = await db.jugadores.where('equipoId').equals(equipoId).sortBy('numeroDorsal');
    return await Promise.all(jugadores.map(async (jugador) => ({ jugador, ...(await sancionesService.obtenerEstadoJugadorParaPartido(jugador.id, partidoId)) })));
  },

  procesarCumplimientoSanciones: async (partidoId: string): Promise<void> => {
    const partido = await db.partidos.get(partidoId);
    if (!partido || partido.estado !== 'ACTA_CERRADA' || !partido.jornadaId) return;
    const equipos = new Set([partido.equipoLocalId, partido.equipoVisitanteId]);
    const [sanciones, sancionesFechas, alineaciones] = await Promise.all([
      db.sanciones.where('campeonatoId').equals(partido.campeonatoId ?? 'camp-1').and((sancion) => sancion.estado === 'ACTIVA' && Boolean(sancion.equipoId && equipos.has(sancion.equipoId))).toArray(),
      db.sancionesFechas.where('fechaCampeonatoId').equals(partido.jornadaId).and((fecha) => !fecha.cumplida).toArray(),
      db.alineaciones.where('partidoId').equals(partidoId).toArray(),
    ]);
    const alineados = new Set(alineaciones.map((alineacion) => alineacion.jugadorId));

    await db.transaction('rw', db.sanciones, db.sancionesFechas, async () => {
      for (const sancion of sanciones) {
        const fecha = sancionesFechas.find((item) => item.sancionId === sancion.id);
        if (!fecha || alineados.has(sancion.jugadorId)) continue;
        await db.sancionesFechas.update(fecha.id, { cumplida: true, partidoCumplimientoId: partidoId });
        const todas = await db.sancionesFechas.where('sancionId').equals(sancion.id).toArray();
        const cumplidas = todas.filter((item) => item.id === fecha.id || item.cumplida).length;
        const cambios: Partial<Sancion> = { fechasCumplidas: cumplidas, partidosCumplidos: cumplidas };
        if (todas.length > 0 && cumplidas === todas.length) cambios.estado = 'CUMPLIDA';
        await db.sanciones.update(sancion.id, cambios);
      }
    });
  },

  procesarActaCerrada: async (partidoId: string, versionActa: number, usuarioId: string): Promise<void> => {
    const partido = await db.partidos.get(partidoId);
    if (!partido || partido.estado !== 'ACTA_CERRADA') throw new Error('Solo se procesan actas cerradas.');
    const previo = await db.procesamientosActa.get(partidoId);
    if (previo?.versionActa === versionActa) return;

    const [eventos, campeonato] = await Promise.all([
      db.eventos.where('partidoId').equals(partidoId).and((evento) => evento.activo).toArray(),
      db.campeonatos.get(partido.campeonatoId ?? 'camp-1'),
    ]);
    const sanciones: Sancion[] = [];

    const crearPorEvento = (evento: EventoPartido, tipo: TipoSancion, motivo: string) => {
      if (!evento.jugadorId) return;
      sanciones.push({
        id: crearId(),
        campeonatoId: partido.campeonatoId ?? 'camp-1',
        equipoId: evento.equipoId,
        jugadorId: evento.jugadorId,
        partidoOrigenId: partido.id,
        eventoOrigenId: evento.id,
        tipo,
        motivo,
        fechasDeCastigo: 1,
        fechasCumplidas: 0,
        partidosSuspension: 1,
        partidosCumplidos: 0,
        estado: 'PENDIENTE',
        creadaEn: new Date().toISOString(),
        creadaPor: usuarioId,
      });
    };

    for (const evento of eventos) {
      const duplicada = evento.jugadorId
        ? await db.sanciones.where('jugadorId').equals(evento.jugadorId).and((sancion) => sancion.eventoOrigenId === evento.id).first()
        : undefined;
      if (duplicada) continue;
      if (evento.tipoEvento === 'TARJETA_ROJA') crearPorEvento(evento, 'TARJETA_ROJA', 'Suspension por tarjeta roja.');
      if (evento.tipoEvento === 'DOBLE_AMARILLA') crearPorEvento(evento, 'DOBLE_AMARILLA', 'Suspension por doble amarilla.');
    }

    const jugadoresConAmarilla = [...new Set(eventos.filter((evento) => evento.tipoEvento === 'TARJETA_AMARILLA' && evento.jugadorId).map((evento) => evento.jugadorId!))];
    for (const jugadorId of jugadoresConAmarilla) {
      const amarillas = await sancionesService.calcularAmarillasAcumuladas(jugadorId, partido.campeonatoId ?? 'camp-1');
      const limite = campeonato?.amarillasParaSuspension ?? 3;
      const yaGenerada = await db.sanciones.where('jugadorId').equals(jugadorId).and((sancion) => sancion.tipo === 'ACUMULACION_AMARILLAS' && sancion.partidoOrigenId === partido.id).first();
      if (amarillas >= limite && !yaGenerada) {
        const jugador = await db.jugadores.get(jugadorId);
        sanciones.push({
          id: crearId(),
          campeonatoId: partido.campeonatoId ?? 'camp-1',
          equipoId: jugador?.equipoId,
          jugadorId,
          partidoOrigenId: partido.id,
          tipo: 'ACUMULACION_AMARILLAS',
          motivo: `Suspendido por acumulacion de ${limite} amarillas.`,
          fechasDeCastigo: 1,
          fechasCumplidas: 0,
          partidosSuspension: 1,
          partidosCumplidos: 0,
          estado: 'PENDIENTE',
          creadaEn: new Date().toISOString(),
          creadaPor: usuarioId,
        });
      }
    }

    await db.transaction('rw', db.sanciones, db.partidos, db.procesamientosActa, async () => {
      if (sanciones.length > 0) await db.sanciones.bulkAdd(sanciones);
      await db.partidos.update(partido.id, { contabilizado: true });
      await db.procesamientosActa.put({
        partidoId: partido.id,
        versionActa,
        procesadaEn: new Date().toISOString(),
        golesProcesados: eventos.filter((evento) => evento.tipoEvento === 'GOL').length,
        tarjetasProcesadas: eventos.filter((evento) => ['TARJETA_AMARILLA', 'TARJETA_ROJA', 'DOBLE_AMARILLA'].includes(evento.tipoEvento)).length,
        sancionesGeneradas: sanciones.length,
      });
    });
    await sancionesService.procesarCumplimientoSanciones(partidoId);
  },

  obtenerSuspendidos: async (): Promise<SancionResumen[]> => {
    return (await sancionesService.obtenerTodas()).filter((item) => item.sancion.estado === 'ACTIVA');
  },
};

import type { EstadisticaGoleador, EstadisticaTarjeta, EventoPartido, Partido, PosicionEquipo } from '@saas/shared';
import { db } from '../db/dexie';
import { calcularMarcadorDesdeEventos } from './vocalia.service';

function partidoCerrado(partido: Partido) {
  return partido.estado === 'ACTA_CERRADA' && !partido.eliminado;
}

export const estadisticasService = {
  calcularTabla: async (): Promise<PosicionEquipo[]> => {
    const [equipos, partidos, eventos, campeonato] = await Promise.all([
      db.equipos.toArray(),
      db.partidos.toArray(),
      db.eventos.toArray(),
      db.campeonatos.get('camp-1'),
    ]);
    const porEquipo = new Map<string, PosicionEquipo>();
    for (const equipo of equipos.filter((item) => item.activo !== false)) {
      porEquipo.set(equipo.id, {
        equipoId: equipo.id,
        equipo: equipo.nombre,
        categoria: equipo.categoria,
        jugados: 0,
        ganados: 0,
        empatados: 0,
        perdidos: 0,
        golesFavor: 0,
        golesContra: 0,
        diferencia: 0,
        puntos: 0,
      });
    }

    for (const partido of partidos.filter(partidoCerrado)) {
      const marcador = calcularMarcadorDesdeEventos(partido, eventos.filter((evento) => evento.partidoId === partido.id));
      const local = porEquipo.get(partido.equipoLocalId);
      const visita = porEquipo.get(partido.equipoVisitanteId);
      if (!local || !visita) continue;
      local.jugados += 1;
      visita.jugados += 1;
      local.golesFavor += marcador.local;
      local.golesContra += marcador.visitante;
      visita.golesFavor += marcador.visitante;
      visita.golesContra += marcador.local;

      if (marcador.local > marcador.visitante) {
        local.ganados += 1;
        visita.perdidos += 1;
        local.puntos += campeonato?.puntosVictoria ?? 3;
        visita.puntos += campeonato?.puntosDerrota ?? 0;
      } else if (marcador.local < marcador.visitante) {
        visita.ganados += 1;
        local.perdidos += 1;
        visita.puntos += campeonato?.puntosVictoria ?? 3;
        local.puntos += campeonato?.puntosDerrota ?? 0;
      } else {
        local.empatados += 1;
        visita.empatados += 1;
        local.puntos += campeonato?.puntosEmpate ?? 1;
        visita.puntos += campeonato?.puntosEmpate ?? 1;
      }
      local.diferencia = local.golesFavor - local.golesContra;
      visita.diferencia = visita.golesFavor - visita.golesContra;
    }

    return [...porEquipo.values()].sort((a, b) => b.puntos - a.puntos || b.diferencia - a.diferencia || b.golesFavor - a.golesFavor || a.equipo.localeCompare(b.equipo));
  },

  calcularGoleadores: async (): Promise<EstadisticaGoleador[]> => {
    const [eventos, partidos, jugadores, equipos] = await Promise.all([db.eventos.toArray(), db.partidos.toArray(), db.jugadores.toArray(), db.equipos.toArray()]);
    const cerrados = new Set(partidos.filter(partidoCerrado).map((partido) => partido.id));
    const goles = new Map<string, EstadisticaGoleador>();
    for (const evento of eventos.filter((item): item is EventoPartido & { jugadorId: string; equipoId: string } => item.activo && item.tipoEvento === 'GOL' && Boolean(item.jugadorId && item.equipoId) && cerrados.has(item.partidoId))) {
      const jugador = jugadores.find((item) => item.id === evento.jugadorId);
      const equipo = equipos.find((item) => item.id === evento.equipoId);
      if (!jugador || !equipo) continue;
      const actual = goles.get(jugador.id) ?? { jugadorId: jugador.id, jugador: `${jugador.nombres} ${jugador.apellidos}`, equipoId: equipo.id, equipo: equipo.nombre, goles: 0 };
      actual.goles += 1;
      goles.set(jugador.id, actual);
    }
    return [...goles.values()].sort((a, b) => b.goles - a.goles || a.jugador.localeCompare(b.jugador));
  },

  calcularTarjetas: async (): Promise<EstadisticaTarjeta[]> => {
    const [eventos, partidos, jugadores, equipos] = await Promise.all([db.eventos.toArray(), db.partidos.toArray(), db.jugadores.toArray(), db.equipos.toArray()]);
    const cerrados = new Set(partidos.filter(partidoCerrado).map((partido) => partido.id));
    const tarjetas = new Map<string, EstadisticaTarjeta>();
    for (const evento of eventos.filter((item): item is EventoPartido & { jugadorId: string; equipoId: string } => item.activo && Boolean(item.jugadorId && item.equipoId) && cerrados.has(item.partidoId) && ['TARJETA_AMARILLA', 'TARJETA_ROJA', 'DOBLE_AMARILLA'].includes(item.tipoEvento))) {
      const jugador = jugadores.find((item) => item.id === evento.jugadorId);
      const equipo = equipos.find((item) => item.id === evento.equipoId);
      if (!jugador || !equipo) continue;
      const actual = tarjetas.get(jugador.id) ?? { jugadorId: jugador.id, jugador: `${jugador.nombres} ${jugador.apellidos}`, equipoId: equipo.id, equipo: equipo.nombre, amarillas: 0, rojas: 0 };
      if (evento.tipoEvento === 'TARJETA_AMARILLA') actual.amarillas += 1;
      if (evento.tipoEvento === 'TARJETA_ROJA' || evento.tipoEvento === 'DOBLE_AMARILLA') actual.rojas += 1;
      tarjetas.set(jugador.id, actual);
    }
    return [...tarjetas.values()].sort((a, b) => b.rojas - a.rojas || b.amarillas - a.amarillas || a.jugador.localeCompare(b.jugador));
  },

  resumenDashboard: async () => {
    const [partidos, equipos, jugadores, sanciones] = await Promise.all([db.partidos.toArray(), db.equipos.toArray(), db.jugadores.toArray(), db.sanciones.toArray()]);
    const activos = partidos.filter((partido) => !partido.eliminado);
    return {
      equipos: equipos.filter((equipo) => equipo.activo !== false).length,
      jugadores: jugadores.filter((jugador) => jugador.activo !== false).length,
      proximos: activos.filter((partido) => partido.estado === 'PROGRAMADO' || partido.estado === 'ASIGNADO').length,
      sinVocal: activos.filter((partido) => !partido.vocalId && !partido.idVocalAsignado).length,
      sinArbitro: activos.filter((partido) => !partido.arbitroId).length,
      pendientesActa: activos.filter((partido) => partido.estado === 'PENDIENTE_ACTA').length,
      cerrados: activos.filter((partido) => partido.estado === 'ACTA_CERRADA').length,
      sancionesActivas: sanciones.filter((sancion) => sancion.estado === 'ACTIVA').length,
    };
  },
};

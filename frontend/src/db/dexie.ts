import Dexie, { type Table } from 'dexie';
import type {
  ActaPartido,
  AlineacionPartido,
  AsignacionArbitro,
  AsignacionVocal,
  Campeonato,
  Cancha,
  Categoria,
  ControlTiempoPartido,
  Equipo,
  EventoPartido,
  FechaCampeonato,
  InscripcionEquipo,
  Jornada,
  Jugador,
  Liga,
  NovedadPartido,
  Partido,
  ProcesamientoActa,
  Sancion,
  SancionFecha,
  Torneo,
  Usuario,
} from '@saas/shared';

export class SaasDatabase extends Dexie {
  usuarios!: Table<Usuario, string>;
  ligas!: Table<Liga, string>;
  torneos!: Table<Torneo, string>;
  campeonatos!: Table<Campeonato, string>;
  categorias!: Table<Categoria, string>;
  canchas!: Table<Cancha, string>;
  jornadas!: Table<Jornada, string>;
  fechasCampeonato!: Table<FechaCampeonato, string>;
  inscripcionesEquipo!: Table<InscripcionEquipo, string>;
  equipos!: Table<Equipo, string>;
  jugadores!: Table<Jugador, string>;
  partidos!: Table<Partido, string>;
  asignacionesVocal!: Table<AsignacionVocal, string>;
  asignacionesArbitro!: Table<AsignacionArbitro, string>;
  alineaciones!: Table<AlineacionPartido, string>;
  eventos!: Table<EventoPartido, string>;
  controlesTiempo!: Table<ControlTiempoPartido, string>;
  novedades!: Table<NovedadPartido, string>;
  actas!: Table<ActaPartido, string>;
  procesamientosActa!: Table<ProcesamientoActa, string>;
  sanciones!: Table<Sancion, string>;
  sancionesFechas!: Table<SancionFecha, string>;

  constructor() {
    super('SaasLigasBarrialesDB');

    this.version(1).stores({
      usuarios: 'id, rol, ligaId',
      ligas: 'id',
      torneos: 'id, ligaId, estado',
      equipos: 'id, torneoId',
      jugadores: 'id, equipoId, cedula, estadoHabilitacion',
      partidos: 'id, torneoId, equipoLocalId, equipoVisitanteId, idVocalAsignado, estado',
      eventos: 'id, partidoId, equipoId, jugadorId, tipoEvento',
      sanciones: 'id, jugadorId, estado',
    });

    this.version(2)
      .stores({
        usuarios: 'id, role, ligaId, activo',
        ligas: 'id',
        torneos: 'id, ligaId, estado',
        equipos: 'id, torneoId',
        jugadores: 'id, equipoId, cedula, estadoHabilitacion, [equipoId+numeroDorsal]',
        partidos: 'id, torneoId, equipoLocalId, equipoVisitanteId, idVocalAsignado, estado, eliminado',
        asignacionesVocal: 'id, partidoId, vocalId, activa, [partidoId+vocalId]',
        alineaciones: 'id, partidoId, equipoId, jugadorId, rol, [partidoId+equipoId], [partidoId+jugadorId]',
        eventos: 'id, partidoId, equipoId, jugadorId, tipoEvento, activo, registradoPorUsuarioId',
        sanciones: 'id, jugadorId, estado',
      })
      .upgrade(async (tx) => {
        await tx
          .table<Usuario>('usuarios')
          .toCollection()
          .modify((usuario) => {
            if (!usuario.role && usuario.rol) usuario.role = usuario.rol;
            if (!usuario.nombre && usuario.nombreCompleto) {
              const [nombre, ...resto] = usuario.nombreCompleto.split(' ');
              usuario.nombre = nombre;
              usuario.apellido = resto.join(' ') || undefined;
            }
          });

        await tx
          .table<Partido>('partidos')
          .toCollection()
          .modify((partido) => {
            if (!partido.torneoId) partido.torneoId = 'torneo-1';
            if (!partido.hora) partido.hora = partido.fecha?.slice(11, 16) || '15:00';
            if (!partido.escenario) partido.escenario = 'Escenario por confirmar';
            if ((partido.estado as string) === 'VALIDADO') partido.estado = 'PENDIENTE_ACTA';
          });
      });

    this.version(3)
      .stores({
        usuarios: 'id, role, ligaId, activo',
        ligas: 'id',
        torneos: 'id, ligaId, estado',
        equipos: 'id, torneoId',
        jugadores: 'id, equipoId, cedula, estadoHabilitacion, [equipoId+numeroDorsal]',
        partidos: 'id, torneoId, equipoLocalId, equipoVisitanteId, idVocalAsignado, estado, eliminado',
        asignacionesVocal: 'id, partidoId, vocalId, activa, [partidoId+vocalId]',
        alineaciones: 'id, partidoId, equipoId, jugadorId, rol, estadoActual, [partidoId+equipoId], [partidoId+jugadorId]',
        eventos: 'id, partidoId, equipoId, jugadorId, tipoEvento, activo, registradoPorUsuarioId',
        controlesTiempo: 'id, partidoId, periodo, activo, [partidoId+periodo]',
        novedades: 'id, partidoId, tipo, activa, creadaPor',
        actas: 'id, partidoId, version, activa, cerradaPor',
        sanciones: 'id, jugadorId, estado',
      })
      .upgrade(async (tx) => {
        await tx
          .table<Partido>('partidos')
          .toCollection()
          .modify((partido) => {
            if ((partido.estado as string) === 'EN_CURSO') partido.estado = 'PRIMER_TIEMPO';
            if ((partido.estado as string) === 'FINALIZADO') partido.estado = 'PENDIENTE_ACTA';
          });

        await tx
          .table<AlineacionPartido>('alineaciones')
          .toCollection()
          .modify((alineacion) => {
            if (alineacion.esInicial === undefined) alineacion.esInicial = true;
            if (!alineacion.estadoActual) {
              alineacion.estadoActual = alineacion.enCancha ? 'EN_CANCHA' : 'SUPLENTE_DISPONIBLE';
            }
          });
      });

    this.version(4)
      .stores({
        usuarios: 'id, role, rol, ligaId, cedula, email, activo',
        ligas: 'id',
        torneos: 'id, ligaId, estado',
        campeonatos: 'id, ligaId, estado',
        categorias: 'id, campeonatoId, nombre, activa',
        canchas: 'id, activa',
        jornadas: 'id, campeonatoId, numero, estado',
        equipos: 'id, torneoId, campeonatoId, categoriaId, activo, [campeonatoId+categoriaId]',
        jugadores: 'id, equipoId, cedula, estadoHabilitacion, activo, habilitado, [equipoId+numeroDorsal]',
        partidos: 'id, torneoId, campeonatoId, categoriaId, jornadaId, canchaId, equipoLocalId, equipoVisitanteId, idVocalAsignado, vocalId, arbitroId, estado, eliminado',
        asignacionesVocal: 'id, partidoId, vocalId, activa, [partidoId+vocalId]',
        asignacionesArbitro: 'id, partidoId, arbitroId, activa, [partidoId+arbitroId]',
        alineaciones: 'id, partidoId, equipoId, jugadorId, rol, estadoActual, [partidoId+equipoId], [partidoId+jugadorId]',
        eventos: 'id, partidoId, equipoId, jugadorId, tipoEvento, activo, registradoPorUsuarioId',
        controlesTiempo: 'id, partidoId, periodo, activo, [partidoId+periodo]',
        novedades: 'id, partidoId, tipo, activa, creadaPor',
        actas: 'id, partidoId, version, activa, cerradaPor',
        procesamientosActa: 'partidoId, versionActa',
        sanciones: 'id, campeonatoId, equipoId, jugadorId, partidoOrigenId, estado, tipo',
      })
      .upgrade(async (tx) => {
        await tx
          .table<Usuario>('usuarios')
          .toCollection()
          .modify((usuario) => {
            usuario.nombres = usuario.nombres ?? usuario.nombre;
            usuario.apellidos = usuario.apellidos ?? usuario.apellido;
            usuario.nombreCompleto = usuario.nombreCompleto ?? [usuario.nombre, usuario.apellido].filter(Boolean).join(' ');
            usuario.rol = usuario.rol ?? usuario.role;
            usuario.activo = usuario.activo ?? true;
            usuario.creadoEn = usuario.creadoEn ?? new Date().toISOString();
            usuario.actualizadoEn = usuario.actualizadoEn ?? usuario.creadoEn;
          });

        await tx
          .table<Equipo>('equipos')
          .toCollection()
          .modify((equipo) => {
            equipo.campeonatoId = equipo.campeonatoId ?? 'camp-1';
            equipo.categoriaId = equipo.categoriaId ?? 'cat-maxima';
            equipo.nombreCorto = equipo.nombreCorto ?? equipo.nombre.slice(0, 18);
            equipo.delegadoId = equipo.delegadoId ?? equipo.representanteId;
            equipo.activo = equipo.activo ?? true;
            equipo.creadoEn = equipo.creadoEn ?? new Date().toISOString();
          });

        await tx
          .table<Jugador>('jugadores')
          .toCollection()
          .modify((jugador) => {
            jugador.activo = jugador.activo ?? jugador.estadoHabilitacion !== 'INACTIVO';
            jugador.habilitado = jugador.habilitado ?? jugador.estadoHabilitacion === 'HABILITADO';
            jugador.esArquero = jugador.esArquero ?? jugador.posicion?.toLowerCase().includes('arquero') ?? false;
          });

        await tx
          .table<Partido>('partidos')
          .toCollection()
          .modify((partido) => {
            partido.campeonatoId = partido.campeonatoId ?? 'camp-1';
            partido.categoriaId = partido.categoriaId ?? 'cat-maxima';
            partido.jornadaId = partido.jornadaId ?? 'jor-1';
            partido.canchaId = partido.canchaId ?? 'cancha-central';
            partido.vocalId = partido.vocalId ?? partido.idVocalAsignado;
            partido.contabilizado = partido.contabilizado ?? partido.estado === 'ACTA_CERRADA';
          });

        await tx
          .table<Sancion>('sanciones')
          .toCollection()
          .modify((sancion) => {
            sancion.campeonatoId = sancion.campeonatoId ?? 'camp-1';
            sancion.tipo = sancion.tipo ?? 'DISCIPLINARIA';
            sancion.partidosSuspension = sancion.partidosSuspension ?? sancion.fechasDeCastigo;
            sancion.partidosCumplidos = sancion.partidosCumplidos ?? sancion.fechasCumplidas;
            sancion.creadaEn = sancion.creadaEn ?? new Date().toISOString();
          });
      });

    this.version(5)
      .stores({
        usuarios: 'id, role, rol, ligaId, cedula, email, activo',
        ligas: 'id',
        torneos: 'id, ligaId, estado',
        campeonatos: 'id, ligaId, estado',
        categorias: 'id, campeonatoId, nombre, activa',
        canchas: 'id, activa',
        jornadas: 'id, campeonatoId, numero, estado',
        fechasCampeonato: 'id, campeonatoId, numero, estado, [campeonatoId+numero]',
        inscripcionesEquipo: 'id, campeonatoId, equipoId, categoriaId, activa, [campeonatoId+equipoId]',
        equipos: 'id, torneoId, campeonatoId, categoriaId, activo, [campeonatoId+categoriaId]',
        jugadores: 'id, equipoId, cedula, estadoHabilitacion, activo, habilitado, [equipoId+numeroDorsal]',
        partidos: 'id, torneoId, campeonatoId, categoriaId, jornadaId, canchaId, equipoLocalId, equipoVisitanteId, idVocalAsignado, vocalId, arbitroId, estado, eliminado',
        asignacionesVocal: 'id, partidoId, vocalId, activa, [partidoId+vocalId]',
        asignacionesArbitro: 'id, partidoId, arbitroId, activa, [partidoId+arbitroId]',
        alineaciones: 'id, partidoId, equipoId, jugadorId, rol, estadoActual, [partidoId+equipoId], [partidoId+jugadorId], [partidoId+equipoId+jugadorId]',
        eventos: 'id, partidoId, equipoId, jugadorId, tipoEvento, activo, registradoPorUsuarioId',
        controlesTiempo: 'id, partidoId, periodo, activo, [partidoId+periodo]',
        novedades: 'id, partidoId, tipo, activa, creadaPor',
        actas: 'id, partidoId, version, activa, cerradaPor',
        procesamientosActa: 'partidoId, versionActa',
        sanciones: 'id, campeonatoId, equipoId, jugadorId, partidoOrigenId, estado, tipo',
        sancionesFechas: 'id, sancionId, fechaCampeonatoId, cumplida, partidoCumplimientoId, [sancionId+fechaCampeonatoId]',
      })
      .upgrade(async (tx) => {
        const ahora = new Date().toISOString();

        await tx
          .table<Campeonato>('campeonatos')
          .toCollection()
          .modify((campeonato) => {
            campeonato.estado = campeonato.estado === 'EN_CURSO' ? 'ACTIVO' : campeonato.estado;
            campeonato.fechaInicio = campeonato.fechaInicio ?? '2026-07-18';
            campeonato.fechaFin = campeonato.fechaFin ?? '2026-12-27';
            campeonato.cantidadFechas = campeonato.cantidadFechas ?? 24;
            campeonato.amarillasParaSuspension = campeonato.amarillasParaSuspension ?? 3;
          });

        const jugadoresTable = tx.table<Jugador>('jugadores');
        const alineacionesTable = tx.table<AlineacionPartido>('alineaciones');
        const eventosTable = tx.table<EventoPartido>('eventos');
        const sancionesTable = tx.table<Sancion>('sanciones');
        const jugadores = await jugadoresTable.toArray();
        const porDorsal = new Map<string, Jugador[]>();

        for (const jugador of jugadores) {
          const clave = `${jugador.equipoId}|${jugador.numeroDorsal}`;
          porDorsal.set(clave, [...(porDorsal.get(clave) ?? []), jugador]);
        }

        for (const duplicados of porDorsal.values()) {
          if (duplicados.length <= 1) continue;
          const canonico =
            duplicados.find((jugador) => jugador.id === `${jugador.equipoId}-${String(jugador.numeroDorsal).padStart(2, '0')}`) ??
            duplicados.find((jugador) => jugador.habilitado !== false && jugador.activo !== false) ??
            duplicados[0];

          for (const duplicado of duplicados) {
            if (duplicado.id === canonico.id) continue;

            const alineaciones = await alineacionesTable.where('jugadorId').equals(duplicado.id).toArray();
            for (const alineacion of alineaciones) {
              const nuevoId = `${alineacion.partidoId}-${alineacion.equipoId}-${canonico.id}`;
              const existente = await alineacionesTable.get(nuevoId);
              if (!existente) await alineacionesTable.add({ ...alineacion, id: nuevoId, jugadorId: canonico.id, actualizadoEn: ahora });
              await alineacionesTable.delete(alineacion.id);
            }

            await eventosTable.where('jugadorId').equals(duplicado.id).modify({ jugadorId: canonico.id });
            await sancionesTable.where('jugadorId').equals(duplicado.id).modify({ jugadorId: canonico.id, equipoId: canonico.equipoId });
            await jugadoresTable.delete(duplicado.id);
          }
        }

        const alineaciones = await alineacionesTable.toArray();
        const gruposAlineacion = new Map<string, AlineacionPartido[]>();
        for (const alineacion of alineaciones) {
          const clave = `${alineacion.partidoId}|${alineacion.equipoId}|${alineacion.jugadorId}`;
          gruposAlineacion.set(clave, [...(gruposAlineacion.get(clave) ?? []), alineacion]);
        }
        for (const grupo of gruposAlineacion.values()) {
          if (grupo.length <= 1) continue;
          const ordenado = [...grupo].sort((a, b) => new Date(b.actualizadoEn).getTime() - new Date(a.actualizadoEn).getTime());
          for (const duplicado of ordenado.slice(1)) await alineacionesTable.delete(duplicado.id);
        }

        const jornadas = await tx.table<Jornada>('jornadas').toArray();
        const fechasTable = tx.table<FechaCampeonato>('fechasCampeonato');
        for (const jornada of jornadas) {
          if (!(await fechasTable.get(jornada.id))) await fechasTable.add({ ...jornada, estado: jornada.estado === 'CERRADA' ? 'FINALIZADA' : jornada.estado });
        }

        const equipos = await tx.table<Equipo>('equipos').toArray();
        const inscripcionesTable = tx.table<InscripcionEquipo>('inscripcionesEquipo');
        for (const equipo of equipos) {
          const campeonatoId = equipo.campeonatoId ?? 'camp-1';
          const id = `${campeonatoId}-${equipo.id}`;
          if (!(await inscripcionesTable.get(id))) {
            await inscripcionesTable.add({ id, campeonatoId, equipoId: equipo.id, categoriaId: equipo.categoriaId, activa: equipo.activo !== false, inscritaEn: equipo.creadoEn ?? ahora });
          }
        }
      });

    this.version(6)
      .stores({
        usuarios: 'id, role, rol, ligaId, cedula, email, activo',
        ligas: 'id',
        torneos: 'id, ligaId, estado',
        campeonatos: 'id, ligaId, estado',
        categorias: 'id, campeonatoId, nombre, activa',
        canchas: 'id, activa',
        jornadas: 'id, campeonatoId, numero, estado',
        fechasCampeonato: 'id, campeonatoId, numero, estado, [campeonatoId+numero]',
        inscripcionesEquipo: 'id, campeonatoId, equipoId, categoriaId, activa, [campeonatoId+equipoId]',
        equipos: 'id, torneoId, campeonatoId, categoriaId, activo, [campeonatoId+categoriaId]',
        jugadores: 'id, equipoId, cedula, estadoHabilitacion, activo, habilitado, [equipoId+numeroDorsal]',
        partidos: 'id, torneoId, campeonatoId, categoriaId, jornadaId, canchaId, equipoLocalId, equipoVisitanteId, idVocalAsignado, vocalId, arbitroId, estado, eliminado',
        asignacionesVocal: 'id, partidoId, vocalId, activa, [partidoId+vocalId]',
        asignacionesArbitro: 'id, partidoId, arbitroId, activa, [partidoId+arbitroId]',
        alineaciones: 'id, partidoId, equipoId, jugadorId, rol, estadoActual, [partidoId+equipoId], [partidoId+jugadorId], [partidoId+equipoId+jugadorId]',
        eventos: 'id, partidoId, equipoId, jugadorId, tipoEvento, activo, registradoPorUsuarioId',
        controlesTiempo: 'id, partidoId, periodo, activo, [partidoId+periodo]',
        novedades: 'id, partidoId, tipo, activa, creadaPor',
        actas: 'id, partidoId, version, activa, cerradaPor',
        procesamientosActa: 'partidoId, versionActa',
        sanciones: 'id, campeonatoId, equipoId, jugadorId, partidoOrigenId, estado, tipo',
        sancionesFechas: 'id, sancionId, fechaCampeonatoId, cumplida, partidoCumplimientoId, [sancionId+fechaCampeonatoId]',
      })
      .upgrade(async (tx) => {
        const partidosTable = tx.table<Partido>('partidos');
        const partidosSeed = await partidosTable
          .filter((partido) => partido.id === 'partido-seed-1' || partido.id.startsWith('fixture-ida-'))
          .toArray();
        const partidosSeedIds = partidosSeed.map((partido) => partido.id);
        if (partidosSeedIds.length === 0) return;

        await partidosTable.bulkDelete(partidosSeedIds);
        await tx.table<AsignacionVocal>('asignacionesVocal').where('partidoId').anyOf(partidosSeedIds).delete();
        await tx.table<AsignacionArbitro>('asignacionesArbitro').where('partidoId').anyOf(partidosSeedIds).delete();
        await tx.table<AlineacionPartido>('alineaciones').where('partidoId').anyOf(partidosSeedIds).delete();
        await tx.table<EventoPartido>('eventos').where('partidoId').anyOf(partidosSeedIds).delete();
        await tx.table<ControlTiempoPartido>('controlesTiempo').where('partidoId').anyOf(partidosSeedIds).delete();
        await tx.table<NovedadPartido>('novedades').where('partidoId').anyOf(partidosSeedIds).delete();
        await tx.table<ActaPartido>('actas').where('partidoId').anyOf(partidosSeedIds).delete();
        await tx.table<ProcesamientoActa>('procesamientosActa').where('partidoId').anyOf(partidosSeedIds).delete();
        await tx.table<Sancion>('sanciones').where('partidoOrigenId').anyOf(partidosSeedIds).delete();
        await tx
          .table<SancionFecha>('sancionesFechas')
          .filter((fecha) => fecha.sancionId.startsWith('sancion-fechas-eq-local-11'))
          .delete();
      });
  }
}

export const db = new SaasDatabase();

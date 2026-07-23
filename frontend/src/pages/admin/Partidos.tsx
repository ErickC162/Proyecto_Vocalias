import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, ClipboardList, FilterX, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { Cancha, Categoria, Equipo, Jornada, Usuario } from '@saas/shared';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { adminPartidosService, type CrearPartidoInput, type PartidoAdminResumen, type RevisionActaAdmin } from '../../services/adminPartidos.service';
import { competicionService } from '../../services/competicion.service';
import { equiposService } from '../../services/equipos.service';
import { usuariosService } from '../../services/usuarios.service';

const inicial: CrearPartidoInput = {
  campeonatoId: 'camp-1',
  categoriaId: 'cat-maxima',
  jornadaId: 'jor-1',
  canchaId: 'cancha-central',
  fecha: '',
  hora: '',
  equipoLocalId: '',
  equipoVisitanteId: '',
  vocalId: '',
  arbitroId: '',
};

const filtrosIniciales = {
  jornadaId: '',
  fecha: '',
  equipoId: '',
  categoriaId: '',
};

const nombreUsuario = (usuario?: Usuario) => usuario ? `${usuario.nombre} ${usuario.apellido ?? ''}`.trim() : 'Pendiente';

export const PartidosAdmin = () => {
  const [partidos, setPartidos] = useState<PartidoAdminResumen[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [vocales, setVocales] = useState<Usuario[]>([]);
  const [arbitros, setArbitros] = useState<Usuario[]>([]);
  const [form, setForm] = useState<CrearPartidoInput>(inicial);
  const [partidoParaCerrar, setPartidoParaCerrar] = useState<PartidoAdminResumen | null>(null);
  const [revisionActa, setRevisionActa] = useState<RevisionActaAdmin | null>(null);
  const [cargandoRevision, setCargandoRevision] = useState(false);
  const [filtros, setFiltros] = useState(filtrosIniciales);

  const cargar = async () => {
    const [resumen, equiposData, categoriasData, canchasData, jornadasData, vocalesData, arbitrosData] = await Promise.all([
      adminPartidosService.obtenerResumen(),
      equiposService.obtenerTodos(),
      competicionService.obtenerCategorias(),
      competicionService.obtenerCanchas(),
      competicionService.obtenerJornadas(),
      usuariosService.obtenerActivosPorRol('VOCAL'),
      usuariosService.obtenerActivosPorRol('ARBITRO'),
    ]);
    setPartidos(resumen);
    setEquipos(equiposData.filter((equipo) => equipo.activo !== false));
    setCategorias(categoriasData);
    setCanchas(canchasData.filter((cancha) => cancha.activa));
    setJornadas(jornadasData);
    setVocales(vocalesData);
    setArbitros(arbitrosData);
    setForm((prev) => ({ ...prev, equipoLocalId: prev.equipoLocalId || equiposData[0]?.id || '', equipoVisitanteId: prev.equipoVisitanteId || equiposData[1]?.id || '' }));
  };

  useEffect(() => {
    void Promise.resolve().then(cargar);
  }, []);

  const crear = async () => {
    try {
      await adminPartidosService.crear({ ...form, vocalId: form.vocalId || undefined, arbitroId: form.arbitroId || undefined });
      toast.success('Partido creado y asignaciones registradas.');
      setForm(inicial);
      await cargar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el partido.');
    }
  };

  const cerrarRevision = async (partidoId: string) => {
    try {
      await adminPartidosService.cerrarRevisionAdministrativa(partidoId);
      toast.success('Acta cerrada desde administracion.');
      await cargar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cerrar el acta.');
    }
  };

  const abrirRevisionActa = async (partidoId: string) => {
    try {
      setCargandoRevision(true);
      setRevisionActa(await adminPartidosService.obtenerRevisionActa(partidoId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar la revision del acta.');
    } finally {
      setCargandoRevision(false);
    }
  };

  const nombreJugador = (jugadorId?: string) => {
    if (!jugadorId || !revisionActa) return 'Sin jugador';
    const jugador = [...revisionActa.jugadoresLocal, ...revisionActa.jugadoresVisitante].find((item) => item.id === jugadorId);
    return jugador ? `#${jugador.numeroDorsal} ${jugador.nombres} ${jugador.apellidos}` : jugadorId;
  };

  const partidosFiltrados = useMemo(() => {
    return partidos.filter(({ partido, local, visitante }) => {
      const coincideJornada = !filtros.jornadaId || partido.jornadaId === filtros.jornadaId;
      const coincideFecha = !filtros.fecha || partido.fecha === filtros.fecha;
      const coincideEquipo = !filtros.equipoId || partido.equipoLocalId === filtros.equipoId || partido.equipoVisitanteId === filtros.equipoId;
      const coincideCategoria = !filtros.categoriaId || partido.categoriaId === filtros.categoriaId || local?.categoriaId === filtros.categoriaId || visitante?.categoriaId === filtros.categoriaId;
      return coincideJornada && coincideFecha && coincideEquipo && coincideCategoria;
    });
  }, [filtros, partidos]);

  const filtrosActivos = Object.values(filtros).some(Boolean);

  return (
    <div className="space-y-5">
      <section className="surface-strong p-5">
        <p className="text-sm font-black uppercase text-emerald-600">Fixture</p>
        <h1 className="text-2xl font-black text-slate-950">Partidos y asignaciones</h1>
      </section>

      <section className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="surface p-5">
          <h2 className="flex items-center gap-2 text-lg font-black"><CalendarPlus size={20} /> Nuevo partido</h2>
          <div className="mt-4 grid gap-3">
            <select className="field" value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}>{categorias.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
            <select className="field" value={form.jornadaId} onChange={(e) => setForm({ ...form, jornadaId: e.target.value })}>{jornadas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
            <select className="field" value={form.canchaId} onChange={(e) => setForm({ ...form, canchaId: e.target.value })}>{canchas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
            <input className="field" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            <input className="field" type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
            <select className="field" value={form.equipoLocalId} onChange={(e) => setForm({ ...form, equipoLocalId: e.target.value })}>{equipos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
            <select className="field" value={form.equipoVisitanteId} onChange={(e) => setForm({ ...form, equipoVisitanteId: e.target.value })}>{equipos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
            <select className="field" value={form.vocalId} onChange={(e) => setForm({ ...form, vocalId: e.target.value })}><option value="">Sin vocal</option>{vocales.map((item) => <option key={item.id} value={item.id}>{item.nombre} {item.apellido}</option>)}</select>
            <select className="field" value={form.arbitroId} onChange={(e) => setForm({ ...form, arbitroId: e.target.value })}><option value="">Sin arbitro</option>{arbitros.map((item) => <option key={item.id} value={item.id}>{item.nombre} {item.apellido}</option>)}</select>
            <button className="btn-primary" onClick={crear}>Crear partido</button>
          </div>
        </div>

        <div className="surface p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-black"><ClipboardList size={20} /> Calendario competitivo</h2>
              <p className="mt-1 text-sm font-bold text-slate-500">{partidosFiltrados.length} de {partidos.length} partidos visibles</p>
            </div>
            {filtrosActivos && (
              <button type="button" onClick={() => setFiltros(filtrosIniciales)} className="btn-secondary">
                <FilterX size={18} /> Limpiar filtros
              </button>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-700">
              <Search size={16} /> Filtros del calendario
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-slate-500">
                Fecha deportiva
                <select className="field" value={filtros.jornadaId} onChange={(e) => setFiltros((prev) => ({ ...prev, jornadaId: e.target.value }))}>
                  <option value="">Todas</option>
                  {jornadas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-slate-500">
                Fecha normal
                <input className="field" type="date" value={filtros.fecha} onChange={(e) => setFiltros((prev) => ({ ...prev, fecha: e.target.value }))} />
              </label>
              <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-slate-500">
                Equipo
                <select className="field" value={filtros.equipoId} onChange={(e) => setFiltros((prev) => ({ ...prev, equipoId: e.target.value }))}>
                  <option value="">Todos</option>
                  {equipos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-slate-500">
                Categoria
                <select className="field" value={filtros.categoriaId} onChange={(e) => setFiltros((prev) => ({ ...prev, categoriaId: e.target.value }))}>
                  <option value="">Todas</option>
                  {categorias.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                </select>
              </label>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {partidosFiltrados.map(({ partido, local, visitante, cancha, vocal, arbitro, jornada, suspendidosLocal, suspendidosVisitante }) => (
              <div key={partido.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-black text-slate-950">{local?.nombre ?? partido.equipoLocalId} vs {visitante?.nombre ?? partido.equipoVisitanteId}</p>
                    <p className="text-sm text-slate-500">{partido.fecha} {partido.hora} · {cancha?.nombre ?? partido.escenario} · {jornada?.nombre ?? partido.jornada}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <span className="badge bg-emerald-100 text-emerald-700">{partido.estado}</span>
                    <span className="badge bg-slate-100 text-slate-600">{local?.categoria ?? visitante?.categoria ?? 'Categoria'}</span>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                  <p><b>Vocal:</b> {vocal ? `${vocal.nombre} ${vocal.apellido ?? ''}` : 'Pendiente'}</p>
                  <p><b>Arbitro:</b> {arbitro ? `${arbitro.nombre} ${arbitro.apellido ?? ''}` : 'Pendiente'}</p>
                  <p><b>{local?.nombreCorto ?? 'Local'}:</b> {suspendidosLocal > 0 ? `${suspendidosLocal} suspendidos` : 'Plantilla completa'}</p>
                  <p><b>{visitante?.nombreCorto ?? 'Visitante'}:</b> {suspendidosVisitante > 0 ? `${suspendidosVisitante} suspendidos` : 'Plantilla completa'}</p>
                </div>
                {partido.estado === 'PENDIENTE_ACTA' && (
                  <button className="btn-primary mt-3" disabled={cargandoRevision} onClick={() => abrirRevisionActa(partido.id)}>
                    Revisar acta
                  </button>
                )}
              </div>
            ))}
            {partidosFiltrados.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <p className="text-lg font-black text-slate-800">No hay partidos con esos filtros</p>
                <p className="mt-1 text-sm font-bold text-slate-500">Cambia la fecha deportiva, fecha normal, equipo o categoria.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {revisionActa && (
        <div className="modal-overlay">
          <div className="modal-card max-w-5xl">
            <div className="modal-header">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-wide text-emerald-600">Revision administrativa</p>
                  <h2 className="text-2xl font-black text-slate-950">{revisionActa.equipoLocal.nombre} vs {revisionActa.equipoVisitante.nombre}</h2>
                  <p className="mt-1 text-sm font-bold text-slate-500">{revisionActa.jornada?.nombre ?? revisionActa.partido.jornada} · {revisionActa.partido.fecha} · {revisionActa.partido.hora} · {revisionActa.cancha?.nombre ?? revisionActa.partido.escenario}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setRevisionActa(null)} className="btn-secondary">Cerrar</button>
                  <button
                    type="button"
                    disabled={!revisionActa.validacion.valido}
                    onClick={() => setPartidoParaCerrar({
                      partido: revisionActa.partido,
                      local: revisionActa.equipoLocal,
                      visitante: revisionActa.equipoVisitante,
                      cancha: revisionActa.cancha,
                      vocal: revisionActa.vocal,
                      arbitro: revisionActa.arbitro,
                      jornada: revisionActa.jornada,
                      suspendidosLocal: 0,
                      suspendidosVisitante: 0,
                    })}
                    className="btn-primary disabled:opacity-50"
                  >
                    Cerrar acta revisada
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-body grid gap-4">
              <section className="grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl bg-slate-950 p-4 text-white md:col-span-2">
                  <p className="text-sm font-bold text-emerald-200">Marcador final</p>
                  <p className="mt-1 text-4xl font-black">{revisionActa.marcador.local} - {revisionActa.marcador.visitante}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-black uppercase text-slate-500">Vocal</p>
                  <p className="mt-1 font-black text-slate-900">{nombreUsuario(revisionActa.vocal)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-black uppercase text-slate-500">Arbitro</p>
                  <p className="mt-1 font-black text-slate-900">{nombreUsuario(revisionActa.arbitro)}</p>
                </div>
              </section>

              {(revisionActa.validacion.errores.length > 0 || revisionActa.validacion.advertencias.length > 0) && (
                <section className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                    <h3 className="font-black text-red-700">Errores</h3>
                    {revisionActa.validacion.errores.length ? revisionActa.validacion.errores.map((error) => <p key={error} className="mt-1 text-sm font-bold text-red-700">{error}</p>) : <p className="mt-1 text-sm text-slate-500">Sin errores.</p>}
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                    <h3 className="font-black text-amber-700">Advertencias</h3>
                    {revisionActa.validacion.advertencias.length ? revisionActa.validacion.advertencias.map((advertencia) => <p key={advertencia} className="mt-1 text-sm font-bold text-amber-700">{advertencia}</p>) : <p className="mt-1 text-sm text-slate-500">Sin advertencias.</p>}
                  </div>
                </section>
              )}

              <section className="grid gap-4 lg:grid-cols-2">
                {[
                  { equipo: revisionActa.equipoLocal, jugadores: revisionActa.jugadoresLocal },
                  { equipo: revisionActa.equipoVisitante, jugadores: revisionActa.jugadoresVisitante },
                ].map(({ equipo, jugadores }) => {
                  const alineados = revisionActa.alineaciones.filter((alineacion) => alineacion.equipoId === equipo.id);
                  return (
                    <div key={equipo.id} className="rounded-2xl border border-slate-200 p-4">
                      <h3 className="font-black text-slate-950">{equipo.nombre}</h3>
                      <div className="mt-3 grid gap-2">
                        {alineados.map((alineacion) => {
                          const jugador = jugadores.find((item) => item.id === alineacion.jugadorId);
                          return (
                            <div key={alineacion.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                              <span className="font-bold text-slate-700">{jugador ? `#${jugador.numeroDorsal} ${jugador.nombres} ${jugador.apellidos}` : alineacion.jugadorId}</span>
                              <span className="badge bg-white text-slate-600">{alineacion.rol}{alineacion.esCapitan ? ' · CAP' : ''}{alineacion.esArquero ? ' · ARQ' : ''}</span>
                            </div>
                          );
                        })}
                        {alineados.length === 0 && <p className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-500">Sin alineacion registrada.</p>}
                      </div>
                    </div>
                  );
                })}
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="font-black text-slate-950">Eventos</h3>
                  <div className="mt-3 grid gap-2">
                    {revisionActa.eventos.map((evento) => (
                      <div key={evento.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                        <p className="font-black text-slate-800">{evento.minuto}' · {evento.tipoEvento} · Periodo {evento.periodo}</p>
                        <p className="mt-1 text-slate-600">{evento.tipoEvento === 'CAMBIO' ? `Sale ${nombreJugador(evento.jugadorSaleId)} / Entra ${nombreJugador(evento.jugadorEntraId)}` : evento.descripcion || nombreJugador(evento.jugadorId)}</p>
                      </div>
                    ))}
                    {revisionActa.eventos.length === 0 && <p className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-500">Sin eventos registrados.</p>}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="font-black text-slate-950">Novedades</h3>
                  <div className="mt-3 grid gap-2">
                    {revisionActa.novedades.map((novedad) => (
                      <div key={novedad.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                        <p className="font-black text-slate-800">{novedad.tipo}{novedad.minuto !== undefined ? ` · ${novedad.minuto}'` : ''}</p>
                        <p className="mt-1 text-slate-600">{novedad.descripcion}</p>
                      </div>
                    ))}
                    {revisionActa.novedades.length === 0 && <p className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-500">Sin novedades registradas.</p>}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={Boolean(partidoParaCerrar)}
        title="Esta seguro de cerrar el acta revisada?"
        description={`Se cerrara el acta de ${partidoParaCerrar?.local?.nombre ?? 'equipo local'} vs ${partidoParaCerrar?.visitante?.nombre ?? 'equipo visitante'} desde administracion.`}
        confirmLabel="Cerrar acta"
        irreversible
        onCancel={() => setPartidoParaCerrar(null)}
        onConfirm={async () => {
          if (!partidoParaCerrar) return;
          await cerrarRevision(partidoParaCerrar.partido.id);
          setRevisionActa(null);
          setPartidoParaCerrar(null);
        }}
      />
    </div>
  );
};

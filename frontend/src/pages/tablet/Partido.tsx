import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleOff, Clock, FileCheck2, Flag, Pause, Play, Save, Square, X } from 'lucide-react';
import { toast } from 'sonner';
import type {
  AlineacionPartido,
  Equipo,
  EstadoPartido,
  Jugador,
  ResultadoValidacion,
  TipoEventoPartido,
  TipoNovedad,
  Usuario,
  VocaliaPartido,
} from '@saas/shared';
import { puedePrepararAlineacion, puedeRegistrarEventoDeportivo, periodoDesdeEstado } from '../../domain/partidos/reglasPartido';
import { sesionService } from '../../services/sesion.service';
import { calcularMarcadorDesdeEventos, calcularSegundosControl, vocaliaService } from '../../services/vocalia.service';

type EquipoClave = 'LOCAL' | 'VISITANTE';
type SeleccionEquipo = Record<string, { rol: 'TITULAR' | 'SUPLENTE'; esArquero: boolean; esCapitan: boolean; enCancha: boolean }>;

const tiposEvento: { value: TipoEventoPartido; label: string }[] = [
  { value: 'GOL', label: 'Gol' },
  { value: 'AUTOGOL', label: 'Autogol' },
  { value: 'TARJETA_AMARILLA', label: 'Amarilla' },
  { value: 'TARJETA_ROJA', label: 'Roja' },
  { value: 'DOBLE_AMARILLA', label: 'Doble amarilla' },
  { value: 'CAMBIO', label: 'Cambio' },
];

const tiposNovedad: { value: TipoNovedad; label: string }[] = [
  { value: 'GENERAL', label: 'General' },
  { value: 'EQUIPO_LOCAL', label: 'Equipo local' },
  { value: 'EQUIPO_VISITANTE', label: 'Equipo visitante' },
  { value: 'ARBITRAL', label: 'Arbitral' },
  { value: 'ESCENARIO', label: 'Escenario' },
  { value: 'INCIDENTE', label: 'Incidente' },
  { value: 'SUSPENSION', label: 'Suspension' },
];

function nombreJugador(jugador?: Jugador) {
  return jugador ? `${jugador.nombres} ${jugador.apellidos}` : 'Sin jugador';
}

function construirSeleccion(alineaciones: AlineacionPartido[], equipoId: string): SeleccionEquipo {
  return alineaciones
    .filter((alineacion) => alineacion.equipoId === equipoId)
    .reduce<SeleccionEquipo>((mapa, alineacion) => {
      mapa[alineacion.jugadorId] = {
        rol: alineacion.rol,
        esArquero: alineacion.esArquero,
        esCapitan: alineacion.esCapitan,
        enCancha: alineacion.enCancha,
      };
      return mapa;
    }, {});
}

function formatoTiempo(segundos: number) {
  const min = Math.floor(segundos / 60).toString().padStart(2, '0');
  const seg = (segundos % 60).toString().padStart(2, '0');
  return `${min}:${seg}`;
}

function periodoNumero(estado: EstadoPartido): 1 | 2 {
  return estado === 'SEGUNDO_TIEMPO' ? 2 : 1;
}

function iconoEvento(tipo: TipoEventoPartido) {
  if (tipo === 'GOL') return '⚽';
  if (tipo === 'AUTOGOL') return '↩';
  if (tipo === 'TARJETA_AMARILLA') return '🟨';
  if (tipo === 'TARJETA_ROJA' || tipo === 'DOBLE_AMARILLA') return '🟥';
  if (tipo === 'CAMBIO') return '↔';
  if (tipo.includes('TIEMPO')) return '⏱';
  if (tipo === 'SUSPENSION') return '!';
  return '•';
}

export const PartidoTablet = () => {
  const { partidoId } = useParams();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [datos, setDatos] = useState<VocaliaPartido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [tick, setTick] = useState(0);

  const [seleccionLocal, setSeleccionLocal] = useState<SeleccionEquipo>({});
  const [seleccionVisitante, setSeleccionVisitante] = useState<SeleccionEquipo>({});
  const [modalInicio, setModalInicio] = useState(false);
  const [validacionPreparacion, setValidacionPreparacion] = useState<ResultadoValidacion | null>(null);
  const [validacionActa, setValidacionActa] = useState<ResultadoValidacion | null>(null);

  const [modalEvento, setModalEvento] = useState(false);
  const [tipoEvento, setTipoEvento] = useState<TipoEventoPartido>('GOL');
  const [equipoEvento, setEquipoEvento] = useState<EquipoClave>('LOCAL');
  const [jugadorEventoId, setJugadorEventoId] = useState('');
  const [jugadorSaleId, setJugadorSaleId] = useState('');
  const [jugadorEntraId, setJugadorEntraId] = useState('');
  const [minuto, setMinuto] = useState('0');
  const [descripcion, setDescripcion] = useState('');

  const [tipoNovedad, setTipoNovedad] = useState<TipoNovedad>('GENERAL');
  const [descripcionNovedad, setDescripcionNovedad] = useState('');
  const [motivoSuspension, setMotivoSuspension] = useState('');
  const [confirmarCierre, setConfirmarCierre] = useState(false);

  const cargar = async () => {
    if (!partidoId) {
      setError('No se recibio el partido solicitado.');
      setCargando(false);
      return;
    }
    try {
      setCargando(true);
      const activo = await sesionService.obtenerUsuarioActivo();
      setUsuario(activo);
      if (!activo || activo.role !== 'VOCAL') throw new Error('Debes entrar como vocal para abrir esta pagina.');
      const vocalia = await vocaliaService.cargarPartidoParaVocal(partidoId, activo);
      setDatos(vocalia);
      setSeleccionLocal(construirSeleccion(vocalia.alineaciones, vocalia.equipoLocal.id));
      setSeleccionVisitante(construirSeleccion(vocalia.alineaciones, vocalia.equipoVisitante.id));
      if (vocalia.partido.estado === 'PENDIENTE_ACTA') {
        setValidacionActa(await vocaliaService.validarRevisionActa(partidoId, activo));
      } else {
        setValidacionActa(null);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la vocalia.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    // Carga inicial desde sesion local e IndexedDB.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidoId]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((valor) => valor + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const marcador = useMemo(() => (datos ? calcularMarcadorDesdeEventos(datos.partido, datos.eventos) : { local: 0, visitante: 0 }), [datos]);
  const jugadoresPorId = useMemo(() => {
    const mapa = new Map<string, Jugador>();
    datos?.jugadoresLocal.concat(datos.jugadoresVisitante).forEach((jugador) => mapa.set(jugador.id, jugador));
    return mapa;
  }, [datos]);

  if (cargando) return <div className="p-8 text-slate-300">Cargando vocalia...</div>;

  if (error || !datos || !usuario) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <CircleOff className="mx-auto text-red-400 mb-4" size={48} />
          <h1 className="text-2xl font-bold text-white">Acceso no disponible</h1>
          <p className="text-slate-400 mt-2">{error ?? 'No se pudo abrir este partido.'}</p>
          <Link to="/vocal" className="mt-6 inline-flex rounded-lg bg-green-600 px-4 py-3 font-bold text-white hover:bg-green-700">
            Volver a mis partidos
          </Link>
        </div>
      </div>
    );
  }

  const soloLectura = datos.partido.estado === 'ACTA_CERRADA' || datos.partido.estado === 'CANCELADO';
  const periodoActual = periodoDesdeEstado(datos.partido.estado);
  const controlActual = periodoActual ? datos.controlesTiempo.find((control) => control.periodo === periodoActual) : undefined;
  const segundosVisibles = calcularSegundosControl(controlActual) + tick * 0;

  const obtenerEquipo = (clave: EquipoClave): Equipo => (clave === 'LOCAL' ? datos.equipoLocal : datos.equipoVisitante);
  const obtenerJugadores = (clave: EquipoClave): Jugador[] => (clave === 'LOCAL' ? datos.jugadoresLocal : datos.jugadoresVisitante);
  const obtenerSeleccion = (clave: EquipoClave): SeleccionEquipo => (clave === 'LOCAL' ? seleccionLocal : seleccionVisitante);
  const setSeleccion = (clave: EquipoClave, seleccion: SeleccionEquipo) => (clave === 'LOCAL' ? setSeleccionLocal(seleccion) : setSeleccionVisitante(seleccion));

  const ejecutar = async (accion: () => Promise<void>, mensaje: string) => {
    try {
      await accion();
      toast.success(mensaje);
      await cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo completar la accion.');
    }
  };

  const abrirConfirmacionInicio = async () => {
    const validacion = await vocaliaService.validarPreparacionPartido(datos.partido.id);
    setValidacionPreparacion(validacion);
    setModalInicio(true);
  };

  const cambiarRol = (clave: EquipoClave, jugador: Jugador, rol: 'TITULAR' | 'SUPLENTE') => {
    if (soloLectura || !puedePrepararAlineacion(datos.partido.estado)) return;
    if (jugador.estadoHabilitacion !== 'HABILITADO' || jugador.habilitado === false || jugador.activo === false) {
      toast.error(jugador.motivoInhabilitacion ?? 'No puedes incluir un jugador no habilitado.');
      return;
    }
    const actual = obtenerSeleccion(clave);
    const previo = actual[jugador.id];
    const siguiente = { ...actual };
    if (previo?.rol === rol) delete siguiente[jugador.id];
    else siguiente[jugador.id] = { rol, esArquero: previo?.esArquero ?? false, esCapitan: previo?.esCapitan ?? false, enCancha: rol === 'TITULAR' };
    setSeleccion(clave, siguiente);
  };

  const marcarRolEspecial = (clave: EquipoClave, jugadorId: string, campo: 'esArquero' | 'esCapitan') => {
    if (soloLectura || !puedePrepararAlineacion(datos.partido.estado)) return;
    const actual = obtenerSeleccion(clave);
    if (!actual[jugadorId]) {
      toast.warning('Primero marca al jugador como titular o suplente.');
      return;
    }
    const siguiente = Object.fromEntries(Object.entries(actual).map(([id, valor]) => [id, { ...valor, [campo]: id === jugadorId ? !valor[campo] : false }])) as SeleccionEquipo;
    setSeleccion(clave, siguiente);
  };

  const guardarAlineacion = async (clave: EquipoClave) => {
    const equipo = obtenerEquipo(clave);
    const registros = Object.entries(obtenerSeleccion(clave)).map(([jugadorId, valor], index) => ({ jugadorId, ...valor, orden: index }));
    await ejecutar(() => vocaliaService.guardarAlineacionEquipo(datos.partido.id, equipo.id, registros), `Alineacion de ${equipo.nombre} guardada.`);
  };

  const abrirEvento = (clave: EquipoClave, tipo: TipoEventoPartido) => {
    const jugadores = obtenerJugadores(clave);
    setEquipoEvento(clave);
    setTipoEvento(tipo);
    setJugadorEventoId(jugadores[0]?.id ?? '');
    setJugadorSaleId('');
    setJugadorEntraId('');
    setMinuto(String(Math.floor(segundosVisibles / 60)));
    setDescripcion('');
    setModalEvento(true);
  };

  const registrarEvento = async (e: React.FormEvent) => {
    e.preventDefault();
    const equipo = obtenerEquipo(equipoEvento);
    await ejecutar(
      async () => {
        await vocaliaService.crearEvento({
          partidoId: datos.partido.id,
          tipoEvento,
          equipoId: tipoEvento === 'CAMBIO' ? undefined : equipo.id,
          jugadorId: tipoEvento === 'CAMBIO' ? undefined : jugadorEventoId,
          jugadorSaleId: tipoEvento === 'CAMBIO' ? jugadorSaleId : undefined,
          jugadorEntraId: tipoEvento === 'CAMBIO' ? jugadorEntraId : undefined,
          minuto: Number(minuto),
          periodo: periodoNumero(datos.partido.estado),
          descripcion,
          registradoPorUsuarioId: usuario.id,
        });
        setModalEvento(false);
      },
      'Evento registrado.',
    );
  };

  const guardarNovedad = async (e: React.FormEvent) => {
    e.preventDefault();
    await ejecutar(
      async () => {
        await vocaliaService.crearNovedad({
          partidoId: datos.partido.id,
          tipo: tipoNovedad,
          descripcion: descripcionNovedad,
          minuto: periodoActual ? Math.floor(segundosVisibles / 60) : undefined,
          periodo: periodoActual,
          creadaPor: usuario.id,
        });
        setDescripcionNovedad('');
      },
      'Novedad registrada.',
    );
  };

  const renderAlineacion = (clave: EquipoClave) => {
    const equipo = obtenerEquipo(clave);
    const jugadores = [...obtenerJugadores(clave)].sort((a, b) => a.numeroDorsal - b.numeroDorsal);
    const seleccion = obtenerSeleccion(clave);
    const titulares = jugadores.filter((jugador) => seleccion[jugador.id]?.rol === 'TITULAR');
    const suplentes = jugadores.filter((jugador) => seleccion[jugador.id]?.rol === 'SUPLENTE');
    const inhabilitados = jugadores.filter((jugador) => jugador.estadoHabilitacion !== 'HABILITADO' || jugador.habilitado === false || jugador.activo === false);
    const disponibles = jugadores.filter((jugador) => !seleccion[jugador.id] && !inhabilitados.some((item) => item.id === jugador.id));

    const renderJugador = (jugador: Jugador) => {
      const estado = seleccion[jugador.id];
      const persistido = datos.alineaciones.find((item) => item.jugadorId === jugador.id);
      const inhabilitado = jugador.estadoHabilitacion !== 'HABILITADO' || jugador.habilitado === false || jugador.activo === false;
      return (
        <div key={jugador.id} className={`rounded-2xl border p-3 shadow-sm ${inhabilitado ? 'border-red-100 bg-red-50' : 'border-slate-200 bg-white'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 font-black text-white">{jugador.numeroDorsal}</span>
              <div className="min-w-0">
                <p className="truncate font-black text-slate-950">{nombreJugador(jugador)}</p>
                <p className="text-xs font-bold text-slate-500">{jugador.posicion ?? 'Sin posicion'} · {jugador.estadoHabilitacion}</p>
                {inhabilitado && <p className="mt-1 text-xs font-bold text-red-700">{jugador.motivoInhabilitacion ?? 'No disponible para este partido'}</p>}
                <span className="badge mt-1 bg-slate-100 text-slate-600">{persistido?.estadoActual ?? 'SIN_ALINEAR'}</span>
              </div>
            </div>
            {!soloLectura && puedePrepararAlineacion(datos.partido.estado) && !inhabilitado && (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => cambiarRol(clave, jugador, 'TITULAR')} className={`rounded-full px-3 py-2 text-xs font-black ${estado?.rol === 'TITULAR' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Titular</button>
                <button onClick={() => cambiarRol(clave, jugador, 'SUPLENTE')} className={`rounded-full px-3 py-2 text-xs font-black ${estado?.rol === 'SUPLENTE' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Suplente</button>
                <button onClick={() => marcarRolEspecial(clave, jugador.id, 'esArquero')} className={`rounded-full px-3 py-2 text-xs font-black ${estado?.esArquero ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}>ARQ</button>
                <button onClick={() => marcarRolEspecial(clave, jugador.id, 'esCapitan')} className={`rounded-full px-3 py-2 text-xs font-black ${estado?.esCapitan ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}`}>CAP</button>
              </div>
            )}
          </div>
        </div>
      );
    };

    return (
      <section className="surface-strong p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-black text-slate-950">{equipo.nombre}</h2>
            <p className="text-sm text-slate-500">{equipo.categoria}</p>
          </div>
          {!soloLectura && puedePrepararAlineacion(datos.partido.estado) && (
            <button onClick={() => guardarAlineacion(clave)} className="btn-primary">
              <Save size={18} /> Guardar alineacion
            </button>
          )}
        </div>
        <div className="grid gap-4">
          <div><h3 className="mb-2 flex items-center gap-2 font-black text-emerald-700"><Flag size={16} /> Titulares ({titulares.length})</h3><div className="space-y-2">{titulares.length ? titulares.map(renderJugador) : <p className="text-sm text-slate-500">Sin titulares.</p>}</div></div>
          <div><h3 className="mb-2 flex items-center gap-2 font-black text-sky-700"><Square size={15} /> Suplentes ({suplentes.length})</h3><div className="space-y-2">{suplentes.length ? suplentes.map(renderJugador) : <p className="text-sm text-slate-500">Sin suplentes.</p>}</div></div>
          {!soloLectura && puedePrepararAlineacion(datos.partido.estado) && <div><h3 className="font-bold text-slate-400 mb-2">Disponibles</h3><div className="space-y-2">{disponibles.map(renderJugador)}</div></div>}
          {inhabilitados.length > 0 && <details className="rounded-2xl border border-red-100 bg-red-50 p-3"><summary className="cursor-pointer font-black text-red-700">No disponibles ({inhabilitados.length})</summary><div className="mt-3 space-y-2">{inhabilitados.map(renderJugador)}</div></details>}
        </div>
      </section>
    );
  };

  const alineacionesEquipo = datos.alineaciones.filter((alineacion) => alineacion.equipoId === obtenerEquipo(equipoEvento).id);
  const jugadoresEvento = obtenerJugadores(equipoEvento).filter((jugador) => jugador.estadoHabilitacion === 'HABILITADO' && jugador.habilitado !== false && jugador.activo !== false && datos.alineaciones.find((a) => a.jugadorId === jugador.id)?.estadoActual !== 'EXPULSADO');
  const jugadoresEnCancha = alineacionesEquipo.filter((a) => a.estadoActual === 'EN_CANCHA').map((a) => jugadoresPorId.get(a.jugadorId)).filter((j): j is Jugador => Boolean(j));
  const suplentesDisponibles = alineacionesEquipo.filter((a) => a.estadoActual === 'SUPLENTE_DISPONIBLE').map((a) => jugadoresPorId.get(a.jugadorId)).filter((j): j is Jugador => Boolean(j));
  const eventosDeportivosHabilitados = tiposEvento.filter((tipo) => puedeRegistrarEventoDeportivo(datos.partido.estado, tipo.value));
  const revisionRapida = datos.partido.estado === 'PENDIENTE_ACTA';

  return (
    <div className="min-h-screen px-3 py-4 md:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <Link to="/vocal" className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-black text-slate-600 shadow-sm">
          <ArrowLeft size={16} /> Mis partidos
        </Link>

        <header className="sticky top-[65px] z-30 overflow-hidden rounded-3xl border border-white/80 bg-white/95 shadow-xl shadow-emerald-900/10 backdrop-blur">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3 md:px-5">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-950 md:text-xl">{datos.equipoLocal.nombre}</p>
              <p className="truncate text-[11px] font-bold text-slate-500">Local</p>
            </div>
            <div className="rounded-2xl bg-slate-950 px-4 py-2 text-center text-white shadow-lg">
              <p className="text-3xl font-black leading-none md:text-5xl">{marcador.local} - {marcador.visitante}</p>
              <p className="mt-1 text-[11px] font-black uppercase tracking-wide text-emerald-300">{periodoActual ?? datos.partido.estado} · {formatoTiempo(segundosVisibles)}</p>
            </div>
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-black text-slate-950 md:text-xl">{datos.equipoVisitante.nombre}</p>
              <p className="truncate text-[11px] font-bold text-slate-500">Visitante</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-emerald-50 px-4 py-2 text-xs font-bold text-slate-600">
            <span>{datos.partido.jornada} · {datos.torneo.nombre}</span>
            <span>{datos.partido.fecha} · {datos.partido.hora} · {datos.partido.escenario}</span>
            {datos.acta && <span className="text-emerald-700">Acta v{datos.acta.version} cerrada</span>}
          </div>
        </header>

        {!soloLectura && (
          <section className="surface-strong p-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-950">Accion principal</h2>
                <p className="text-slate-500">Solo mostramos lo que puedes hacer ahora.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(datos.partido.estado === 'ASIGNADO' || datos.partido.estado === 'EN_PREPARACION') && <button onClick={abrirConfirmacionInicio} className="btn-primary"><Play size={18} /> Iniciar primer tiempo</button>}
                {periodoActual && periodoActual !== 'DESCANSO' && controlActual?.activo && <button onClick={() => ejecutar(() => vocaliaService.pausarTiempo(datos.partido.id, usuario.id), 'Tiempo pausado.')} className="btn-secondary"><Pause size={18} /> Pausar</button>}
                {periodoActual && periodoActual !== 'DESCANSO' && controlActual && !controlActual.activo && <button onClick={() => ejecutar(() => vocaliaService.reanudarTiempo(datos.partido.id, usuario.id), 'Tiempo reanudado.')} className="btn-secondary"><Clock size={18} /> Reanudar</button>}
                {datos.partido.estado === 'PRIMER_TIEMPO' && <button onClick={() => window.confirm('Finalizar primer tiempo?') && ejecutar(() => vocaliaService.finalizarPrimerTiempo(datos.partido.id, usuario.id), 'Primer tiempo finalizado.')} className="btn-secondary">Finalizar primer tiempo</button>}
                {datos.partido.estado === 'DESCANSO' && <button onClick={() => ejecutar(() => vocaliaService.iniciarSegundoTiempo(datos.partido.id, usuario.id), 'Segundo tiempo iniciado.')} className="btn-primary">Iniciar segundo tiempo</button>}
                {datos.partido.estado === 'SEGUNDO_TIEMPO' && <button onClick={() => window.confirm('Finalizar partido?') && ejecutar(() => vocaliaService.finalizarPartido(datos.partido.id, usuario.id), 'Partido finalizado.')} className="btn-danger">Finalizar partido</button>}
                {datos.partido.estado === 'SUSPENDIDO' && <button onClick={() => ejecutar(() => vocaliaService.reanudarPartido(datos.partido.id, usuario.id), 'Partido reanudado.')} className="btn-primary">Reanudar</button>}
              </div>
            </div>
            {datos.partido.estado !== 'SUSPENDIDO' && datos.partido.estado !== 'PENDIENTE_ACTA' && (
              <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
                <input value={motivoSuspension} onChange={(e) => setMotivoSuspension(e.target.value)} placeholder="Motivo si necesitas suspender" className="field" />
                <button onClick={() => motivoSuspension.trim() ? ejecutar(() => vocaliaService.suspenderPartido(datos.partido.id, usuario.id, motivoSuspension), 'Partido suspendido.') : toast.error('Escribe el motivo de la suspension.')} className="btn-secondary text-orange-700"><AlertTriangle size={18} /> Suspender</button>
              </div>
            )}
          </section>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">{renderAlineacion('LOCAL')}{renderAlineacion('VISITANTE')}</div>

        <section className="surface-strong p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div><h2 className="text-2xl font-black text-slate-950">Acciones rapidas</h2><p className="text-sm text-slate-500">Gol, tarjetas y cambios con el minuto actual precargado.</p></div>
            {!soloLectura && eventosDeportivosHabilitados.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:flex">
                {eventosDeportivosHabilitados.map((tipo) => (
                  <button key={tipo.value} onClick={() => abrirEvento('LOCAL', tipo.value)} className="min-h-14 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99]">
                    <span className="mr-2">{iconoEvento(tipo.value)}</span>{tipo.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            {datos.eventos.length === 0 ? <p className="rounded-2xl bg-emerald-50 py-10 text-center font-bold text-slate-500">Todavia no hay eventos. Cuando pase algo en cancha, registralo aqui.</p> : [...datos.eventos].reverse().map((evento) => {
              const jugador = jugadoresPorId.get(evento.jugadorId ?? '');
              const sale = jugadoresPorId.get(evento.jugadorSaleId ?? '');
              const entra = jugadoresPorId.get(evento.jugadorEntraId ?? '');
              return (
                <div key={evento.id} className={`flex gap-3 rounded-2xl border p-3 ${evento.activo ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-lg font-black text-emerald-700">{iconoEvento(evento.tipoEvento)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-slate-950">{evento.minuto}' · {evento.tipoEvento}{!evento.activo && <span className="ml-2 text-xs text-red-500">(anulado)</span>}</p>
                    <p className="text-sm text-slate-500">{evento.tipoEvento === 'CAMBIO' ? `Sale ${nombreJugador(sale)} · Entra ${nombreJugador(entra)}` : evento.descripcion || nombreJugador(jugador)}</p>
                  </div>
                  {!soloLectura && evento.activo && <button aria-label="Anular evento" onClick={() => window.confirm('Anular este evento? El marcador se recalculara si era un gol.') && ejecutar(() => vocaliaService.anularEvento(datos.partido.id, evento.id, usuario.id), 'Evento anulado.')} className="self-start rounded-full px-3 py-1 text-xs font-black text-red-600 hover:bg-red-50">Anular</button>}
                </div>
              );
            })}
          </div>
        </section>

        <section className="surface-strong p-4">
          <h2 className="mb-1 text-2xl font-black text-slate-950">Novedades</h2>
          <p className="mb-4 text-sm text-slate-500">Escribe como hablarías en cancha. El teclado del telefono puede usar dictado.</p>
          {!soloLectura && (
            <form onSubmit={guardarNovedad} className="grid gap-3 mb-5">
              <select value={tipoNovedad} onChange={(e) => setTipoNovedad(e.target.value as TipoNovedad)} className="field">{tiposNovedad.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}</select>
              <textarea value={descripcionNovedad} onChange={(e) => setDescripcionNovedad(e.target.value)} rows={3} placeholder="Ej: La cancha tiene poca luz en el arco norte" className="field" />
              <button className="btn-primary">Guardar novedad</button>
            </form>
          )}
          <div className="space-y-2">{datos.novedades.length === 0 ? <p className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">No hay novedades. Todo tranquilo por ahora.</p> : [...datos.novedades].reverse().map((n) => <div key={n.id} className={`rounded-2xl border p-3 ${n.activa ? 'border-slate-200 bg-white' : 'opacity-60 border-slate-100 bg-slate-50'}`}><p className="font-black text-slate-950">{n.tipo}</p><p className="text-slate-500">{n.descripcion}</p>{!soloLectura && n.activa && <button onClick={() => ejecutar(() => vocaliaService.anularNovedad(datos.partido.id, n.id, usuario.id), 'Novedad anulada.')} className="mt-2 text-sm font-black text-red-600">Anular</button>}</div>)}</div>
        </section>

        {(revisionRapida || soloLectura) && (
          <section className="surface-strong p-4">
            <h2 className="text-2xl font-black text-slate-950 mb-2">{soloLectura ? 'Acta cerrada' : 'Revision previa al cierre'}</h2>
            <p className="text-slate-400">Marcador final: {datos.equipoLocal.nombre} {marcador.local} - {marcador.visitante} {datos.equipoVisitante.nombre}</p>
            <p className="text-slate-400">Eventos activos: {datos.eventos.filter((e) => e.activo).length} · Novedades activas: {datos.novedades.filter((n) => n.activa).length}</p>
            {validacionActa && (
              <div className="grid md:grid-cols-2 gap-3 mt-4">
                <div className="rounded-lg bg-red-950/40 border border-red-900 p-3">
                  <h3 className="font-bold text-red-300">Errores que debes corregir</h3>
                  {validacionActa.errores.length ? validacionActa.errores.map((e) => <p key={e} className="text-sm text-red-100">{e}</p>) : <p className="text-sm text-slate-400">Sin errores.</p>}
                </div>
                <div className="rounded-lg bg-amber-950/40 border border-amber-900 p-3">
                  <h3 className="font-bold text-amber-300">Advertencias</h3>
                  {validacionActa.advertencias.length ? validacionActa.advertencias.map((a) => <p key={a} className="text-sm text-amber-100">{a}</p>) : <p className="text-sm text-slate-400">Sin advertencias.</p>}
                </div>
              </div>
            )}
            {datos.acta && <p className="text-emerald-400 mt-2">Snapshot local version {datos.acta.version}. Cerrada por {datos.acta.cerradaPor}.</p>}
            {!soloLectura && (
              <div className="mt-4 space-y-3">
                <label className="flex gap-2 text-slate-300"><input type="checkbox" checked={confirmarCierre} onChange={(e) => setConfirmarCierre(e.target.checked)} /> Confirmo que la informacion registrada es correcta.</label>
                <button onClick={() => window.confirm('Cerrar acta? Despues del cierre quedara en solo lectura.') && ejecutar(() => vocaliaService.cerrarActa(datos.partido.id, usuario, confirmarCierre).then(() => undefined), 'Acta cerrada.')} className="btn-primary"><FileCheck2 size={18} /> Cerrar acta</button>
              </div>
            )}
          </section>
        )}
      </div>

      {modalInicio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4"><h2 className="text-2xl font-black">Confirmar inicio</h2><button onClick={() => setModalInicio(false)}><X /></button></div>
            <p className="text-slate-600">{datos.equipoLocal.nombre} vs {datos.equipoVisitante.nombre} · {datos.partido.hora} · {datos.partido.escenario}</p>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="rounded-2xl bg-emerald-50 p-3"><h3 className="font-bold text-emerald-700">Local</h3><p>Titulares: {Object.values(seleccionLocal).filter((s) => s.rol === 'TITULAR').length}</p><p>Suplentes: {Object.values(seleccionLocal).filter((s) => s.rol === 'SUPLENTE').length}</p></div>
              <div className="rounded-2xl bg-sky-50 p-3"><h3 className="font-bold text-sky-700">Visitante</h3><p>Titulares: {Object.values(seleccionVisitante).filter((s) => s.rol === 'TITULAR').length}</p><p>Suplentes: {Object.values(seleccionVisitante).filter((s) => s.rol === 'SUPLENTE').length}</p></div>
            </div>
            {validacionPreparacion && (
              <div className="grid md:grid-cols-2 gap-3 mt-4">
                <div className="rounded-lg bg-red-950/40 border border-red-900 p-3">
                  <h3 className="font-bold text-red-300">Errores</h3>
                  {validacionPreparacion.errores.length ? validacionPreparacion.errores.map((e) => <p key={e} className="text-sm text-red-100">{e}</p>) : <p className="text-sm text-slate-400">Sin errores.</p>}
                </div>
                <div className="rounded-lg bg-amber-950/40 border border-amber-900 p-3">
                  <h3 className="font-bold text-amber-300">Advertencias</h3>
                  {validacionPreparacion.advertencias.length ? validacionPreparacion.advertencias.map((a) => <p key={a} className="text-sm text-amber-100">{a}</p>) : <p className="text-sm text-slate-400">Sin advertencias.</p>}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3 mt-5"><button onClick={() => setModalInicio(false)} className="btn-secondary">Volver a revisar</button><button onClick={() => ejecutar(() => vocaliaService.iniciarPrimerTiempo(datos.partido.id, usuario.id).then(() => setModalInicio(false)), 'Primer tiempo iniciado.')} className="btn-primary">Iniciar primer tiempo</button></div>
          </div>
        </div>
      )}

      {modalEvento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <form onSubmit={registrarEvento} className="w-full max-w-xl rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-100"><h2 className="text-xl font-black text-slate-950">Registrar {tipoEvento.toLowerCase()}</h2><button type="button" onClick={() => setModalEvento(false)} className="rounded-full bg-slate-100 p-2 hover:bg-slate-200"><X size={18} /></button></div>
            <div className="p-4 grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <select value={tipoEvento} onChange={(e) => setTipoEvento(e.target.value as TipoEventoPartido)} className="field">{tiposEvento.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}</select>
                <select value={equipoEvento} onChange={(e) => setEquipoEvento(e.target.value as EquipoClave)} className="field"><option value="LOCAL">{datos.equipoLocal.nombre}</option><option value="VISITANTE">{datos.equipoVisitante.nombre}</option></select>
                <input aria-label="Minuto" type="number" min={0} step={1} value={minuto} onChange={(e) => setMinuto(e.target.value)} className="field" />
              </div>
              {tipoEvento === 'CAMBIO' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><select value={jugadorSaleId} onChange={(e) => setJugadorSaleId(e.target.value)} className="field"><option value="">Sale</option>{jugadoresEnCancha.map((j) => <option key={j.id} value={j.id}>{j.numeroDorsal} · {nombreJugador(j)}</option>)}</select><select value={jugadorEntraId} onChange={(e) => setJugadorEntraId(e.target.value)} className="field"><option value="">Entra</option>{suplentesDisponibles.map((j) => <option key={j.id} value={j.id}>{j.numeroDorsal} · {nombreJugador(j)}</option>)}</select></div>
              ) : (
                <select value={jugadorEventoId} onChange={(e) => setJugadorEventoId(e.target.value)} className="field">{jugadoresEvento.map((j) => <option key={j.id} value={j.id}>{j.numeroDorsal} · {nombreJugador(j)}</option>)}</select>
              )}
              <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} placeholder="Detalle opcional" className="field" />
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-slate-100"><button type="button" onClick={() => setModalEvento(false)} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary"><CheckCircle2 size={18} /> Guardar evento</button></div>
          </form>
        </div>
      )}
    </div>
  );
};

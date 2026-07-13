import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleOff, Clock, Flag, Palette, Pause, Play, Save, Square, X } from 'lucide-react';
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
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { puedePrepararAlineacion, puedeRegistrarEventoDeportivo, periodoDesdeEstado, REGLAS_PARTIDO } from '../../domain/partidos/reglasPartido';
import { sesionService } from '../../services/sesion.service';
import { calcularMarcadorDesdeEventos, calcularSegundosControl, vocaliaService } from '../../services/vocalia.service';

type EquipoClave = 'LOCAL' | 'VISITANTE';
type SeleccionEquipo = Record<string, { rol: 'TITULAR' | 'SUPLENTE'; esArquero: boolean; esCapitan: boolean; enCancha: boolean }>;
type JugadorPanel = { clave: EquipoClave; jugador: Jugador };
type ConfirmacionCritica = {
  title: string;
  description: string;
  confirmLabel: string;
  variant?: 'primary' | 'danger';
  irreversible?: boolean;
  onConfirm: () => Promise<void>;
};

const tiposEvento: { value: TipoEventoPartido; label: string }[] = [
  { value: 'GOL', label: 'Gol' },
  { value: 'AUTOGOL', label: 'Autogol' },
  { value: 'TARJETA_AMARILLA', label: 'Amarilla' },
  { value: 'TARJETA_ROJA', label: 'Roja' },
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
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [datos, setDatos] = useState<VocaliaPartido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [tick, setTick] = useState(0);

  const [seleccionLocal, setSeleccionLocal] = useState<SeleccionEquipo>({});
  const [seleccionVisitante, setSeleccionVisitante] = useState<SeleccionEquipo>({});
  const [colorCamisetaLocal, setColorCamisetaLocal] = useState('');
  const [colorCamisetaVisitante, setColorCamisetaVisitante] = useState('');
  const [modalInicio, setModalInicio] = useState(false);
  const [confirmacionCritica, setConfirmacionCritica] = useState<ConfirmacionCritica | null>(null);
  const [jugadorPanel, setJugadorPanel] = useState<JugadorPanel | null>(null);
  const [modalJugadoresHabilitados, setModalJugadoresHabilitados] = useState(false);
  const [equipoJugadoresHabilitados, setEquipoJugadoresHabilitados] = useState<EquipoClave>('LOCAL');
  const [validacionPreparacion, setValidacionPreparacion] = useState<ResultadoValidacion | null>(null);
  const [validacionRevision, setValidacionRevision] = useState<ResultadoValidacion | null>(null);

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
      setColorCamisetaLocal(vocalia.partido.colorCamisetaLocal ?? '');
      setColorCamisetaVisitante(vocalia.partido.colorCamisetaVisitante ?? '');
      setValidacionRevision(vocalia.partido.estado === 'REVISION_ACTA' ? await vocaliaService.validarRevisionActa(partidoId, activo) : null);
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
  const eventosActivos = useMemo(() => datos?.eventos.filter((evento) => evento.activo) ?? [], [datos]);
  const estadoDisciplinario = (jugadorId: string) => {
    const eventosJugador = eventosActivos.filter((evento) => evento.jugadorId === jugadorId);
    if (eventosJugador.some((evento) => evento.tipoEvento === 'DOBLE_AMARILLA')) return { label: 'Expulsado doble amarilla', className: 'bg-red-100 text-red-700' };
    if (eventosJugador.some((evento) => evento.tipoEvento === 'TARJETA_ROJA')) return { label: 'Roja directa', className: 'bg-red-600 text-white' };
    const amarillas = eventosJugador.filter((evento) => evento.tipoEvento === 'TARJETA_AMARILLA').length;
    if (amarillas > 0) return { label: `${amarillas} amarilla${amarillas === 1 ? '' : 's'}`, className: 'bg-amber-100 text-amber-700' };
    return { label: 'Sin tarjetas', className: 'bg-slate-100 text-slate-600' };
  };

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

  const soloLectura = datos.partido.estado === 'ACTA_CERRADA' || datos.partido.estado === 'CANCELADO' || datos.partido.estado === 'PENDIENTE_ACTA';
  const enRevisionVocal = datos.partido.estado === 'REVISION_ACTA';
  const partidoIniciado = !puedePrepararAlineacion(datos.partido.estado);
  const coloresGuardados = Boolean(datos.partido.colorCamisetaLocal && datos.partido.colorCamisetaVisitante);
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
    try {
      await vocaliaService.guardarColoresCamiseta(datos.partido.id, colorCamisetaLocal, colorCamisetaVisitante);
      const validacion = await vocaliaService.validarPreparacionPartido(datos.partido.id);
      setValidacionPreparacion(validacion);
      setModalInicio(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo validar el inicio.');
    }
  };

  const enviarActaAdministracion = async () => {
    await vocaliaService.cerrarActa(datos.partido.id, usuario, true);
    toast.success('Acta enviada a administracion.');
    navigate('/vocal');
  };

  const confirmarAccionCritica = (confirmacion: ConfirmacionCritica) => {
    setConfirmacionCritica(confirmacion);
  };

  const ejecutarConfirmacionCritica = async () => {
    if (!confirmacionCritica) return;
    await confirmacionCritica.onConfirm();
    setConfirmacionCritica(null);
  };

  const marcarCapitan = async (clave: EquipoClave, jugadorId: string) => {
    if (soloLectura || enRevisionVocal || datos.partido.estado === 'SUSPENDIDO') return;
    const actual = obtenerSeleccion(clave);
    if (!actual[jugadorId]) {
      toast.warning('Primero marca al jugador como titular o suplente.');
      return;
    }
    const jugador = jugadoresPorId.get(jugadorId);
    if (jugador && !estadoJugadorPartido(clave, jugador).esTitular) {
      toast.warning('Solo un jugador titular puede ser capitan.');
      return;
    }
    const capitanActual = Object.entries(actual).find(([id, valor]) => valor.esCapitan && id !== jugadorId);
    if (capitanActual) {
      toast.warning('Primero retira el rol de capitan actual antes de asignar otro.');
      return;
    }
    const equipo = obtenerEquipo(clave);
    const seraCapitan = !actual[jugadorId].esCapitan;
    const siguiente = Object.fromEntries(Object.entries(actual).map(([id, valor]) => [id, { ...valor, esCapitan: id === jugadorId ? seraCapitan : false }])) as SeleccionEquipo;
    setSeleccion(clave, siguiente);
    await ejecutar(() => vocaliaService.actualizarCapitanEquipo(datos.partido.id, equipo.id, jugadorId, seraCapitan), seraCapitan ? 'Capitan actualizado.' : 'Capitan retirado.');
  };

  const persistirSeleccionEquipo = async (clave: EquipoClave, seleccion: SeleccionEquipo, mensaje: string) => {
    const equipo = obtenerEquipo(clave);
    const registros = Object.entries(seleccion).map(([jugadorId, valor], index) => ({ jugadorId, ...valor, orden: index }));
    await ejecutar(() => vocaliaService.guardarAlineacionEquipo(datos.partido.id, equipo.id, registros), mensaje);
  };

  const aplicarRolJugador = async (clave: EquipoClave, jugador: Jugador, rol: 'TITULAR' | 'SUPLENTE') => {
    if (jugador.estadoHabilitacion !== 'HABILITADO' || jugador.habilitado === false || jugador.activo === false) {
      toast.error(jugador.motivoInhabilitacion ?? 'No puedes incluir un jugador no habilitado.');
      return;
    }
    if (puedePrepararAlineacion(datos.partido.estado)) {
      const actual = obtenerSeleccion(clave);
      const previo = actual[jugador.id];
      if (rol === 'TITULAR' && previo?.rol !== 'TITULAR' && Object.values(actual).filter((item) => item.rol === 'TITULAR').length >= REGLAS_PARTIDO.maxTitulares) {
        toast.error(`No se pueden seleccionar mas de ${REGLAS_PARTIDO.maxTitulares} titulares.`);
        return;
      }
      const siguiente = {
        ...actual,
        [jugador.id]: {
          rol,
          esArquero: false,
          esCapitan: previo?.esCapitan ?? false,
          enCancha: rol === 'TITULAR',
        },
      };
      setSeleccion(clave, siguiente);
      setJugadorPanel(null);
      await persistirSeleccionEquipo(clave, siguiente, `${nombreJugador(jugador)} agregado como ${rol.toLowerCase()}.`);
      return;
    }
    if (!soloLectura && !enRevisionVocal) {
      const equipo = obtenerEquipo(clave);
      const registrado = datos.alineaciones.some((alineacion) => alineacion.jugadorId === jugador.id);
      if (registrado) {
        toast.warning('El jugador ya esta registrado en este partido.');
        return;
      }
      if (rol === 'TITULAR') {
        const titulares = datos.alineaciones.filter((alineacion) => alineacion.equipoId === equipo.id && alineacion.estadoActual === 'EN_CANCHA').length;
        if (titulares >= REGLAS_PARTIDO.maxTitulares) {
          toast.error(`No se pueden registrar mas de ${REGLAS_PARTIDO.maxTitulares} titulares.`);
          return;
        }
      }
      setJugadorPanel(null);
      await ejecutar(() => vocaliaService.agregarJugadorTarde(datos.partido.id, equipo.id, jugador.id, rol), `${nombreJugador(jugador)} incorporado como ${rol.toLowerCase()}.`);
      return;
    }
    toast.error('No puedes modificar jugadores en el estado actual del partido.');
  };

  const limpiarAlineacion = async (clave: EquipoClave) => {
    const equipo = obtenerEquipo(clave);
    await ejecutar(
      async () => {
        await vocaliaService.limpiarAlineacionEquipo(datos.partido.id, equipo.id);
        setSeleccion(clave, {});
      },
      `Alineacion de ${equipo.nombre} limpia.`,
    );
  };

  const guardarColores = async () => {
    await ejecutar(() => vocaliaService.guardarColoresCamiseta(datos.partido.id, colorCamisetaLocal, colorCamisetaVisitante), 'Colores de camiseta guardados.');
  };

  const estadoJugadorPartido = (clave: EquipoClave, jugador: Jugador) => {
    const seleccion = obtenerSeleccion(clave)[jugador.id];
    const persistido = datos.alineaciones.find((item) => item.jugadorId === jugador.id && item.equipoId === obtenerEquipo(clave).id);
    const estadoActual = persistido?.estadoActual;
    const rol = seleccion?.rol ?? persistido?.rol;
    const etiqueta = estadoActual === 'SUSTITUIDO'
      ? 'Sustituido'
      : estadoActual === 'EXPULSADO'
        ? 'Expulsado'
        : rol === 'TITULAR'
          ? 'Titular'
          : rol === 'SUPLENTE'
            ? 'Suplente'
            : 'No agregado';
    return {
      etiqueta,
      registrado: Boolean(seleccion || persistido),
      bloqueado: estadoActual === 'SUSTITUIDO' || estadoActual === 'EXPULSADO',
      esCapitan: Boolean(seleccion?.esCapitan ?? persistido?.esCapitan),
      esTitular: estadoActual === 'EN_CANCHA' || (!estadoActual && rol === 'TITULAR'),
    };
  };

  const jugadoresEnCanchaPorEquipo = (clave: EquipoClave) => {
    const equipo = obtenerEquipo(clave);
    return datos.alineaciones
      .filter((alineacion) => alineacion.equipoId === equipo.id && alineacion.estadoActual === 'EN_CANCHA')
      .map((alineacion) => jugadoresPorId.get(alineacion.jugadorId))
      .filter((jugador): jugador is Jugador => Boolean(jugador));
  };

  const jugadoresRegistradosPorEquipo = (clave: EquipoClave) => {
    const equipo = obtenerEquipo(clave);
    return datos.alineaciones
      .filter((alineacion) => alineacion.equipoId === equipo.id && alineacion.estadoActual !== 'EXPULSADO')
      .map((alineacion) => jugadoresPorId.get(alineacion.jugadorId))
      .filter((jugador): jugador is Jugador => Boolean(jugador));
  };

  const candidatosEvento = (clave: EquipoClave, tipo: TipoEventoPartido) => {
    if (tipo === 'TARJETA_AMARILLA' || tipo === 'TARJETA_ROJA') return jugadoresRegistradosPorEquipo(clave);
    return jugadoresEnCanchaPorEquipo(clave);
  };

  const cambiarTipoEvento = (tipo: TipoEventoPartido) => {
    const jugadores = candidatosEvento(equipoEvento, tipo);
    setTipoEvento(tipo);
    setJugadorEventoId(jugadores[0]?.id ?? '');
  };

  const abrirEvento = (clave: EquipoClave, tipo: TipoEventoPartido) => {
    const jugadores = candidatosEvento(clave, tipo);
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
    const enPreparacion = puedePrepararAlineacion(datos.partido.estado);
    const alineacionesEquipoActual = datos.alineaciones.filter((alineacion) => alineacion.equipoId === equipo.id);
    const alineacionDe = (jugadorId: string) => alineacionesEquipoActual.find((alineacion) => alineacion.jugadorId === jugadorId);
    const titulares = enPreparacion ? jugadores.filter((jugador) => seleccion[jugador.id]?.rol === 'TITULAR') : jugadores.filter((jugador) => alineacionDe(jugador.id)?.estadoActual === 'EN_CANCHA');
    const suplentes = enPreparacion ? jugadores.filter((jugador) => seleccion[jugador.id]?.rol === 'SUPLENTE') : jugadores.filter((jugador) => alineacionDe(jugador.id)?.estadoActual === 'SUPLENTE_DISPONIBLE');
    const sustituidos = enPreparacion ? [] : jugadores.filter((jugador) => alineacionDe(jugador.id)?.estadoActual === 'SUSTITUIDO');
    const inhabilitados = jugadores.filter((jugador) => jugador.estadoHabilitacion !== 'HABILITADO' || jugador.habilitado === false || jugador.activo === false);
    const puedeAdministrar = !soloLectura && !enRevisionVocal && datos.partido.estado !== 'SUSPENDIDO';

    const renderJugador = (jugador: Jugador) => {
      const estadoPartido = estadoJugadorPartido(clave, jugador);
      const inhabilitado = jugador.estadoHabilitacion !== 'HABILITADO' || jugador.habilitado === false || jugador.activo === false;
      const disciplina = estadoDisciplinario(jugador.id);
      return (
        <div key={jugador.id} onClick={() => setJugadorPanel({ clave, jugador })} className={`cursor-pointer rounded-2xl border p-3 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/40 ${inhabilitado ? 'border-red-100 bg-red-50' : 'border-slate-200 bg-white'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 font-black text-white">{jugador.numeroDorsal}</span>
              <div className="min-w-0">
                <p className="truncate font-black text-slate-950">{nombreJugador(jugador)}</p>
                <p className="text-xs font-bold text-slate-500">{jugador.posicion ?? 'Sin posicion'} · {jugador.estadoHabilitacion}</p>
                {inhabilitado && <p className="mt-1 text-xs font-bold text-red-700">{jugador.motivoInhabilitacion ?? 'No disponible para este partido'}</p>}
                <span className="badge mt-1 bg-slate-100 text-slate-600">{estadoPartido.etiqueta}</span>
                {estadoPartido.esCapitan && <span className="badge ml-1 mt-1 bg-emerald-100 text-emerald-700">Capitan</span>}
                <span className={`badge ml-1 mt-1 ${disciplina.className}`}>{disciplina.label}</span>
              </div>
            </div>
            {!soloLectura && !enRevisionVocal && !inhabilitado && (
              <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                {estadoPartido.esTitular && (
                  <button type="button" onClick={() => marcarCapitan(clave, jugador.id)} className={`rounded-full px-3 py-2 text-xs font-black ${estadoPartido.esCapitan ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {estadoPartido.esCapitan ? 'Quitar capitan' : 'Hacer capitan'}
                  </button>
                )}
                <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">Abrir ficha</span>
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
          {puedeAdministrar && enPreparacion && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => limpiarAlineacion(clave)} className="btn-secondary">Limpiar</button>
              <button onClick={() => { setEquipoJugadoresHabilitados(clave); setModalJugadoresHabilitados(true); }} className="btn-secondary">Jugadores habilitados</button>
            </div>
          )}
        </div>
        <div className="grid gap-4">
          <div><h3 className="mb-2 flex items-center gap-2 font-black text-emerald-700"><Flag size={16} /> Titulares ({titulares.length})</h3><div className="space-y-2">{titulares.length ? titulares.map(renderJugador) : <p className="text-sm text-slate-500">Sin titulares.</p>}</div></div>
          <div><h3 className="mb-2 flex items-center gap-2 font-black text-sky-700"><Square size={15} /> Suplentes ({suplentes.length})</h3><div className="space-y-2">{suplentes.length ? suplentes.map(renderJugador) : <p className="text-sm text-slate-500">Sin suplentes.</p>}</div></div>
          {!enPreparacion && <div><h3 className="mb-2 font-black text-slate-500">Sustituidos ({sustituidos.length})</h3><div className="space-y-2">{sustituidos.length ? sustituidos.map(renderJugador) : <p className="text-sm text-slate-500">Sin sustituidos.</p>}</div></div>}
          {inhabilitados.length > 0 && <details className="rounded-2xl border border-red-100 bg-red-50 p-3"><summary className="cursor-pointer font-black text-red-700">No disponibles ({inhabilitados.length})</summary><div className="mt-3 space-y-2">{inhabilitados.map(renderJugador)}</div></details>}
        </div>
      </section>
    );
  };

  const alineacionesEquipo = datos.alineaciones.filter((alineacion) => alineacion.equipoId === obtenerEquipo(equipoEvento).id);
  const jugadoresEvento = candidatosEvento(equipoEvento, tipoEvento).filter((jugador) => jugador.estadoHabilitacion === 'HABILITADO' && jugador.habilitado !== false && jugador.activo !== false);
  const jugadoresEnCancha = alineacionesEquipo.filter((a) => a.estadoActual === 'EN_CANCHA').map((a) => jugadoresPorId.get(a.jugadorId)).filter((j): j is Jugador => Boolean(j));
  const suplentesDisponibles = alineacionesEquipo.filter((a) => a.estadoActual === 'SUPLENTE_DISPONIBLE').map((a) => jugadoresPorId.get(a.jugadorId)).filter((j): j is Jugador => Boolean(j));
  const eventosDeportivosHabilitados = tiposEvento.filter((tipo) => puedeRegistrarEventoDeportivo(datos.partido.estado, tipo.value));
  const enviadoAAdministracion = datos.partido.estado === 'PENDIENTE_ACTA';
  const goles = eventosActivos.filter((evento) => evento.tipoEvento === 'GOL');
  const autogoles = eventosActivos.filter((evento) => evento.tipoEvento === 'AUTOGOL');
  const amarillas = eventosActivos.filter((evento) => evento.tipoEvento === 'TARJETA_AMARILLA');
  const expulsiones = eventosActivos.filter((evento) => evento.tipoEvento === 'DOBLE_AMARILLA' || evento.tipoEvento === 'TARJETA_ROJA');
  const cambios = eventosActivos.filter((evento) => evento.tipoEvento === 'CAMBIO');
  const renderAccionPrincipal = () => (
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
          {datos.partido.estado === 'PRIMER_TIEMPO' && (
            <button
              onClick={() => confirmarAccionCritica({
                title: 'Esta seguro de finalizar el primer tiempo?',
                description: 'Una vez confirmado, el primer tiempo terminara y no podras seguir registrando eventos en este periodo.',
                confirmLabel: 'Finalizar primer tiempo',
                irreversible: true,
                onConfirm: () => ejecutar(() => vocaliaService.finalizarPrimerTiempo(datos.partido.id, usuario.id), 'Primer tiempo finalizado.'),
              })}
              className="btn-secondary"
            >
              Finalizar primer tiempo
            </button>
          )}
          {datos.partido.estado === 'PRIMER_TIEMPO' && <button disabled className="btn-secondary opacity-50">Iniciar segundo tiempo</button>}
          {datos.partido.estado === 'DESCANSO' && (
            <button
              onClick={() => confirmarAccionCritica({
                title: 'Esta seguro de iniciar el segundo tiempo?',
                description: 'Una vez confirmado, el descanso terminara y los nuevos eventos quedaran registrados en el segundo tiempo.',
                confirmLabel: 'Iniciar segundo tiempo',
                irreversible: true,
                onConfirm: () => ejecutar(() => vocaliaService.iniciarSegundoTiempo(datos.partido.id, usuario.id), 'Segundo tiempo iniciado.'),
              })}
              className="btn-primary"
            >
              Iniciar segundo tiempo
            </button>
          )}
          {datos.partido.estado === 'SEGUNDO_TIEMPO' && (
            <button
              onClick={() => confirmarAccionCritica({
                title: 'Esta seguro de finalizar el segundo tiempo?',
                description: 'Una vez confirmado, el segundo tiempo terminara y pasaras a revisar el acta antes de enviarla a administracion.',
                confirmLabel: 'Finalizar segundo tiempo',
                variant: 'danger',
                irreversible: true,
                onConfirm: () => ejecutar(() => vocaliaService.finalizarPartido(datos.partido.id, usuario.id), 'Segundo tiempo finalizado. Revisa el acta antes de enviarla.'),
              })}
              className="btn-danger"
            >
              Finalizar segundo tiempo
            </button>
          )}
          {datos.partido.estado === 'SUSPENDIDO' && <button onClick={() => ejecutar(() => vocaliaService.reanudarPartido(datos.partido.id, usuario.id), 'Partido reanudado.')} className="btn-primary">Reanudar</button>}
        </div>
      </div>
      {datos.partido.estado !== 'SUSPENDIDO' && datos.partido.estado !== 'PENDIENTE_ACTA' && (
        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
          <input value={motivoSuspension} onChange={(e) => setMotivoSuspension(e.target.value)} placeholder="Motivo si necesitas suspender" className="field" />
          <button
            onClick={() => motivoSuspension.trim()
              ? confirmarAccionCritica({
                title: 'Esta seguro de suspender el partido?',
                description: 'La suspension quedara registrada en la vocalia con el motivo indicado y detendra el flujo del partido hasta que sea reanudado.',
                confirmLabel: 'Suspender partido',
                variant: 'danger',
                onConfirm: () => ejecutar(() => vocaliaService.suspenderPartido(datos.partido.id, usuario.id, motivoSuspension), 'Partido suspendido.'),
              })
              : toast.error('Escribe el motivo de la suspension.')}
            className="btn-secondary text-orange-700"
          >
            <AlertTriangle size={18} /> Suspender
          </button>
        </div>
      )}
    </section>
  );

  const renderAccionesRapidas = () => (
    <section className="surface-strong p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-950">Acciones rapidas</h2>
          <p className="text-sm text-slate-500">Gol, tarjetas y cambios con el minuto actual precargado.</p>
        </div>
      </div>
      {!soloLectura && eventosDeportivosHabilitados.length > 0 && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {(['LOCAL', 'VISITANTE'] as EquipoClave[]).map((clave) => (
            <div key={clave} className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="mb-2 text-sm font-black text-slate-700">{obtenerEquipo(clave).nombre}</p>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {eventosDeportivosHabilitados.map((tipo) => (
                  <button key={`${clave}-${tipo.value}`} onClick={() => abrirEvento(clave, tipo.value)} className="min-h-12 rounded-2xl bg-slate-950 px-3 py-2 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99]">
                    <span className="mr-2">{iconoEvento(tipo.value)}</span>{tipo.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 space-y-2">
        {datos.eventos.length === 0 ? <p className="rounded-2xl bg-emerald-50 py-8 text-center font-bold text-slate-500">Todavia no hay eventos. Cuando pase algo en cancha, registralo aqui.</p> : [...datos.eventos].reverse().map((evento) => {
          const jugador = jugadoresPorId.get(evento.jugadorId ?? '');
          const sale = jugadoresPorId.get(evento.jugadorSaleId ?? '');
          const entra = jugadoresPorId.get(evento.jugadorEntraId ?? '');
          return (
            <div key={evento.id} className={`flex gap-3 rounded-2xl border p-3 ${evento.activo ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-lg font-black text-emerald-700">{iconoEvento(evento.tipoEvento)}</div>
              <div className="min-w-0 flex-1">
                <p className="font-black text-slate-950">{evento.minuto}' - {evento.tipoEvento}{!evento.activo && <span className="ml-2 text-xs text-red-500">(anulado)</span>}</p>
                <p className="text-sm text-slate-500">{evento.tipoEvento === 'CAMBIO' ? `Sale ${nombreJugador(sale)} - Entra ${nombreJugador(entra)}` : evento.descripcion || nombreJugador(jugador)}</p>
              </div>
              {!soloLectura && evento.activo && (
                <button
                  aria-label="Anular evento"
                  onClick={() => confirmarAccionCritica({
                    title: 'Esta seguro de anular este evento?',
                    description: 'El evento quedara anulado y el marcador se recalculara si corresponde a un gol.',
                    confirmLabel: 'Anular evento',
                    variant: 'danger',
                    irreversible: true,
                    onConfirm: () => ejecutar(() => vocaliaService.anularEvento(datos.partido.id, evento.id, usuario.id), 'Evento anulado.'),
                  })}
                  className="self-start rounded-full px-3 py-1 text-xs font-black text-red-600 hover:bg-red-50"
                >
                  Anular
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );

  const renderJugadoresHabilitados = () => {
    const jugadores = [...obtenerJugadores(equipoJugadoresHabilitados)]
      .filter((jugador) => !estadoJugadorPartido(equipoJugadoresHabilitados, jugador).registrado)
      .sort((a, b) => a.numeroDorsal - b.numeroDorsal);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
        <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
            <div>
              <p className="text-sm font-black uppercase text-emerald-600">Vocalia del partido</p>
              <h2 className="text-2xl font-black text-slate-950">Jugadores habilitados</h2>
            </div>
            <button type="button" onClick={() => setModalJugadoresHabilitados(false)} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"><X size={18} /></button>
          </div>
          <div className="border-b border-slate-100 p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {(['LOCAL', 'VISITANTE'] as EquipoClave[]).map((clave) => (
                <button
                  key={clave}
                  type="button"
                  onClick={() => setEquipoJugadoresHabilitados(clave)}
                  className={`rounded-2xl border px-4 py-3 text-left font-black ${equipoJugadoresHabilitados === clave ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700'}`}
                >
                  {obtenerEquipo(clave).nombre}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 overflow-y-auto p-4">
            {jugadores.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
                <p className="font-black text-slate-800">No quedan jugadores por agregar.</p>
                <p className="mt-1 text-sm font-bold text-slate-500">Los jugadores ya escogidos se muestran en Titulares, Suplentes o Sustituidos.</p>
              </div>
            )}
            {jugadores.map((jugador) => {
              const estado = estadoJugadorPartido(equipoJugadoresHabilitados, jugador);
              const inhabilitado = jugador.estadoHabilitacion !== 'HABILITADO' || jugador.habilitado === false || jugador.activo === false;
              return (
                <button
                  key={jugador.id}
                  type="button"
                  onClick={() => setJugadorPanel({ clave: equipoJugadoresHabilitados, jugador })}
                  className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50 ${inhabilitado ? 'border-red-100 bg-red-50' : 'border-slate-200 bg-white'}`}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-950 font-black text-white">
                    {jugador.fotoUrl ? <img src={jugador.fotoUrl} alt={nombreJugador(jugador)} className="h-full w-full object-cover" /> : jugador.numeroDorsal}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-black text-slate-950">{nombreJugador(jugador)}</span>
                    <span className="block text-xs font-bold text-slate-500">Dorsal {jugador.numeroDorsal}</span>
                  </span>
                  <span className="flex flex-wrap justify-end gap-1">
                    <span className="badge bg-slate-100 text-slate-600">{inhabilitado ? 'No habilitado' : estado.etiqueta}</span>
                    {estado.esCapitan && <span className="badge bg-emerald-100 text-emerald-700">Capitan</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderResumenValidacion = (validacion: ResultadoValidacion) => {
    const sinErrores = validacion.errores.length === 0;
    const sinAdvertencias = validacion.advertencias.length === 0;
    if (sinErrores && sinAdvertencias) {
      return (
        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={22} />
            <div>
              <h3 className="font-black text-emerald-800">Todo listo</h3>
              <p className="mt-1 text-sm font-bold text-emerald-700">La vocalia no tiene correcciones ni alertas pendientes.</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {validacion.errores.length > 0 && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="text-red-600" size={18} />
              <h3 className="font-black text-red-700">Por corregir</h3>
            </div>
            <div className="space-y-2">
              {validacion.errores.map((error) => <p key={error} className="rounded-xl bg-white/80 p-3 text-sm font-bold text-red-700">{error}</p>)}
            </div>
          </div>
        )}
        {validacion.advertencias.length > 0 && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="text-amber-600" size={18} />
              <h3 className="font-black text-amber-700">Revisar</h3>
            </div>
            <div className="space-y-2">
              {validacion.advertencias.map((advertencia) => <p key={advertencia} className="rounded-xl bg-white/80 p-3 text-sm font-bold text-amber-700">{advertencia}</p>)}
            </div>
          </div>
        )}
      </div>
    );
  };

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

        {!soloLectura && !enRevisionVocal && partidoIniciado && renderAccionPrincipal()}

        {partidoIniciado && renderAccionesRapidas()}

        {!soloLectura && !enRevisionVocal && partidoIniciado && (
          <section className="surface-strong p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">Jugadores habilitados</h2>
                <p className="text-sm text-slate-500">Administra titulares, suplentes y capitanes por equipo.</p>
              </div>
              <button type="button" onClick={() => setModalJugadoresHabilitados(true)} className="btn-primary">Jugadores habilitados</button>
            </div>
          </section>
        )}

        {!soloLectura && puedePrepararAlineacion(datos.partido.estado) && !coloresGuardados && (
          <section className="surface-strong p-4">
            <div className="mb-3 flex items-center gap-2">
              <Palette className="text-emerald-600" size={20} />
              <h2 className="text-xl font-black text-slate-950">Colores de camiseta</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input className="field" placeholder={`Color ${datos.equipoLocal.nombre}`} value={colorCamisetaLocal} onChange={(e) => setColorCamisetaLocal(e.target.value)} />
              <input className="field" placeholder={`Color ${datos.equipoVisitante.nombre}`} value={colorCamisetaVisitante} onChange={(e) => setColorCamisetaVisitante(e.target.value)} />
              <button onClick={guardarColores} className="btn-primary"><Save size={18} /> Guardar</button>
            </div>
          </section>
        )}

        {!soloLectura && !enRevisionVocal && !partidoIniciado && (
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
                {datos.partido.estado === 'PRIMER_TIEMPO' && (
                  <button
                    onClick={() => confirmarAccionCritica({
                      title: 'Esta seguro de finalizar el primer tiempo?',
                      description: 'Una vez confirmado, el primer tiempo terminara y no podras seguir registrando eventos en este periodo.',
                      confirmLabel: 'Finalizar primer tiempo',
                      irreversible: true,
                      onConfirm: () => ejecutar(() => vocaliaService.finalizarPrimerTiempo(datos.partido.id, usuario.id), 'Primer tiempo finalizado.'),
                    })}
                    className="btn-secondary"
                  >
                    Finalizar primer tiempo
                  </button>
                )}
                {datos.partido.estado === 'PRIMER_TIEMPO' && <button disabled className="btn-secondary opacity-50">Iniciar segundo tiempo</button>}
                {datos.partido.estado === 'DESCANSO' && (
                  <button
                    onClick={() => confirmarAccionCritica({
                      title: 'Esta seguro de iniciar el segundo tiempo?',
                      description: 'Una vez confirmado, el descanso terminara y los nuevos eventos quedaran registrados en el segundo tiempo.',
                      confirmLabel: 'Iniciar segundo tiempo',
                      irreversible: true,
                      onConfirm: () => ejecutar(() => vocaliaService.iniciarSegundoTiempo(datos.partido.id, usuario.id), 'Segundo tiempo iniciado.'),
                    })}
                    className="btn-primary"
                  >
                    Iniciar segundo tiempo
                  </button>
                )}
                {datos.partido.estado === 'SEGUNDO_TIEMPO' && (
                  <button
                    onClick={() => confirmarAccionCritica({
                      title: 'Esta seguro de finalizar el segundo tiempo?',
                      description: 'Una vez confirmado, el segundo tiempo terminara y pasaras a revisar el acta antes de enviarla a administracion.',
                      confirmLabel: 'Finalizar segundo tiempo',
                      variant: 'danger',
                      irreversible: true,
                      onConfirm: () => ejecutar(() => vocaliaService.finalizarPartido(datos.partido.id, usuario.id), 'Segundo tiempo finalizado. Revisa el acta antes de enviarla.'),
                    })}
                    className="btn-danger"
                  >
                    Finalizar segundo tiempo
                  </button>
                )}
                {datos.partido.estado === 'SUSPENDIDO' && <button onClick={() => ejecutar(() => vocaliaService.reanudarPartido(datos.partido.id, usuario.id), 'Partido reanudado.')} className="btn-primary">Reanudar</button>}
              </div>
            </div>
            {datos.partido.estado !== 'SUSPENDIDO' && datos.partido.estado !== 'PENDIENTE_ACTA' && (
              <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
                <input value={motivoSuspension} onChange={(e) => setMotivoSuspension(e.target.value)} placeholder="Motivo si necesitas suspender" className="field" />
                <button
                  onClick={() => motivoSuspension.trim()
                    ? confirmarAccionCritica({
                      title: 'Esta seguro de suspender el partido?',
                      description: 'La suspension quedara registrada en la vocalia con el motivo indicado y detendra el flujo del partido hasta que sea reanudado.',
                      confirmLabel: 'Suspender partido',
                      variant: 'danger',
                      onConfirm: () => ejecutar(() => vocaliaService.suspenderPartido(datos.partido.id, usuario.id, motivoSuspension), 'Partido suspendido.'),
                    })
                    : toast.error('Escribe el motivo de la suspension.')}
                  className="btn-secondary text-orange-700"
                >
                  <AlertTriangle size={18} /> Suspender
                </button>
              </div>
            )}
          </section>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">{renderAlineacion('LOCAL')}{renderAlineacion('VISITANTE')}</div>


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
          <div className="space-y-2">{datos.novedades.length === 0 ? <p className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">No hay novedades. Todo tranquilo por ahora.</p> : [...datos.novedades].reverse().map((n) => <div key={n.id} className={`rounded-2xl border p-3 ${n.activa ? 'border-slate-200 bg-white' : 'opacity-60 border-slate-100 bg-slate-50'}`}><p className="font-black text-slate-950">{n.tipo}</p><p className="text-slate-500">{n.descripcion}</p>{!soloLectura && n.activa && <button onClick={() => confirmarAccionCritica({ title: 'Esta seguro de anular esta novedad?', description: 'La novedad quedara marcada como anulada dentro de la vocalia del partido.', confirmLabel: 'Anular novedad', variant: 'danger', irreversible: true, onConfirm: () => ejecutar(() => vocaliaService.anularNovedad(datos.partido.id, n.id, usuario.id), 'Novedad anulada.') })} className="mt-2 text-sm font-black text-red-600">Anular</button>}</div>)}</div>
        </section>

        {coloresGuardados && (
          <section className="surface p-4">
            <div className="mb-3 flex items-center gap-2">
              <Palette className="text-emerald-600" size={18} />
              <h2 className="text-lg font-black text-slate-950">Colores de camiseta</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase text-slate-500">{datos.equipoLocal.nombre}</p>
                <p className="mt-1 font-black text-slate-900">{datos.partido.colorCamisetaLocal}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase text-slate-500">{datos.equipoVisitante.nombre}</p>
                <p className="mt-1 font-black text-slate-900">{datos.partido.colorCamisetaVisitante}</p>
              </div>
            </div>
          </section>
        )}

        {enRevisionVocal && (
          <section className="surface-strong p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-black uppercase text-emerald-600">Revision previa al envio</p>
                <h2 className="text-2xl font-black text-slate-950">Acta del encuentro</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">{datos.partido.jornada} - {datos.partido.fecha} - {datos.partido.hora} - {datos.partido.escenario}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="btn-secondary">Corregir datos</button>
                <button
                  type="button"
                  disabled={!validacionRevision?.valido}
                  onClick={() => confirmarAccionCritica({
                    title: 'Enviar acta a Administracion?',
                    description: 'Despues del envio ya no podras editar esta vocalia. Administracion recibira el acta para su revision.',
                    confirmLabel: 'Enviar a Administracion',
                    variant: 'danger',
                    irreversible: true,
                    onConfirm: enviarActaAdministracion,
                  })}
                  className="btn-primary disabled:opacity-50"
                >
                  Enviar a Administracion
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-slate-950 p-4 text-white md:col-span-2">
                <p className="text-sm font-bold text-emerald-200">Marcador final</p>
                <p className="mt-1 text-4xl font-black">{datos.equipoLocal.nombre} {marcador.local} - {marcador.visitante} {datos.equipoVisitante.nombre}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-black uppercase text-slate-500">Vocal</p>
                <p className="mt-1 font-black text-slate-900">{usuario.nombre} {usuario.apellido ?? ''}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-black uppercase text-slate-500">Estado final</p>
                <p className="mt-1 font-black text-slate-900">Revision del vocal</p>
              </div>
            </div>

            {validacionRevision && renderResumenValidacion(validacionRevision)}

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="font-black text-slate-950">Goles y autogoles</h3>
                <div className="mt-3 space-y-2">
                  {[...goles, ...autogoles].map((evento) => <p key={evento.id} className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-700">{evento.minuto}' - {evento.tipoEvento}: {nombreJugador(jugadoresPorId.get(evento.jugadorId ?? ''))}</p>)}
                  {goles.length + autogoles.length === 0 && <p className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-500">Sin goles registrados.</p>}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="font-black text-slate-950">Disciplina y cambios</h3>
                <div className="mt-3 space-y-2">
                  {[...amarillas, ...expulsiones].map((evento) => <p key={evento.id} className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-700">{evento.minuto}' - {evento.tipoEvento}: {nombreJugador(jugadoresPorId.get(evento.jugadorId ?? ''))}{evento.descripcion ? ` - ${evento.descripcion}` : ''}</p>)}
                  {cambios.map((evento) => <p key={evento.id} className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-700">{evento.minuto}' - Cambio: sale {nombreJugador(jugadoresPorId.get(evento.jugadorSaleId ?? ''))}, entra {nombreJugador(jugadoresPorId.get(evento.jugadorEntraId ?? ''))}</p>)}
                  {amarillas.length + expulsiones.length + cambios.length === 0 && <p className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-500">Sin tarjetas ni cambios.</p>}
                </div>
              </div>
            </div>
          </section>
        )}

        {(enviadoAAdministracion || datos.partido.estado === 'ACTA_CERRADA') && (
          <section className="surface-strong p-4">
            <h2 className="text-2xl font-black text-slate-950 mb-2">{datos.partido.estado === 'ACTA_CERRADA' ? 'Acta cerrada' : 'Vocalia enviada a administracion'}</h2>
            <p className="text-slate-400">Marcador final: {datos.equipoLocal.nombre} {marcador.local} - {marcador.visitante} {datos.equipoVisitante.nombre}</p>
            <p className="text-slate-400">Eventos activos: {datos.eventos.filter((e) => e.activo).length} - Novedades activas: {datos.novedades.filter((n) => n.activa).length}</p>
            {enviadoAAdministracion && <p className="mt-2 font-bold text-amber-600">Ya no puedes editar este partido. Administracion revisa y cierra el acta.</p>}
            {datos.acta && <p className="text-emerald-400 mt-2">Snapshot local version {datos.acta.version}. Cerrada por {datos.acta.cerradaPor}.</p>}
          </section>
        )}
      </div>

      {modalInicio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-5 shadow-2xl">
            <div className="mb-4">
              <h2 className="text-2xl font-black text-slate-950">Esta seguro de iniciar el primer tiempo?</h2>
              <p className="mt-2 text-slate-600">Una vez confirmado, el partido entrara en juego y los eventos quedaran registrados en el primer tiempo.</p>
              <p className="mt-1 text-sm font-bold text-slate-500">{datos.equipoLocal.nombre} vs {datos.equipoVisitante.nombre} · {datos.partido.hora} · {datos.partido.escenario}</p>
            </div>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="rounded-2xl bg-emerald-50 p-3"><h3 className="font-bold text-emerald-700">Local</h3><p>Titulares: {Object.values(seleccionLocal).filter((s) => s.rol === 'TITULAR').length}</p><p>Suplentes: {Object.values(seleccionLocal).filter((s) => s.rol === 'SUPLENTE').length}</p></div>
              <div className="rounded-2xl bg-sky-50 p-3"><h3 className="font-bold text-sky-700">Visitante</h3><p>Titulares: {Object.values(seleccionVisitante).filter((s) => s.rol === 'TITULAR').length}</p><p>Suplentes: {Object.values(seleccionVisitante).filter((s) => s.rol === 'SUPLENTE').length}</p></div>
            </div>
            {validacionPreparacion && renderResumenValidacion(validacionPreparacion)}
            <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">Esta accion es irreversible. Revisa alineaciones, colores y validaciones antes de confirmar.</div>
            <div className="flex justify-end gap-3 mt-5"><button onClick={() => setModalInicio(false)} className="btn-secondary">Cancelar</button><button disabled={!validacionPreparacion?.valido} onClick={() => ejecutar(() => vocaliaService.iniciarPrimerTiempo(datos.partido.id, usuario.id).then(() => setModalInicio(false)), 'Primer tiempo iniciado.')} className="btn-primary disabled:opacity-50">Iniciar primer tiempo</button></div>
          </div>
        </div>
      )}

      {modalJugadoresHabilitados && renderJugadoresHabilitados()}

      {jugadorPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
              <div>
                <p className="text-sm font-black uppercase text-emerald-600">{obtenerEquipo(jugadorPanel.clave).nombre}</p>
                <h2 className="text-2xl font-black text-slate-950">{nombreJugador(jugadorPanel.jugador)}</h2>
              </div>
              <button type="button" onClick={() => setJugadorPanel(null)} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"><X size={18} /></button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-[120px_1fr]">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl bg-slate-950 text-4xl font-black text-white">
                {jugadorPanel.jugador.fotoUrl ? <img src={jugadorPanel.jugador.fotoUrl} alt={nombreJugador(jugadorPanel.jugador)} className="h-full w-full object-cover" /> : jugadorPanel.jugador.numeroDorsal}
              </div>
              <div className="grid gap-2 text-sm">
                <p><b className="text-slate-800">Dorsal:</b> {jugadorPanel.jugador.numeroDorsal}</p>
                <p><b className="text-slate-800">Cedula:</b> {jugadorPanel.jugador.cedula}</p>
                <p><b className="text-slate-800">Nacimiento:</b> {new Date(jugadorPanel.jugador.fechaNacimiento).toLocaleDateString()}</p>
                <p><b className="text-slate-800">Posicion:</b> {jugadorPanel.jugador.posicion ?? 'Sin posicion'}</p>
                <p><b className="text-slate-800">Estado:</b> {estadoJugadorPartido(jugadorPanel.clave, jugadorPanel.jugador).etiqueta}</p>
                {estadoJugadorPartido(jugadorPanel.clave, jugadorPanel.jugador).esCapitan && <span className="badge w-fit bg-emerald-100 text-emerald-700">Capitan del equipo</span>}
                <span className={`badge w-fit ${estadoDisciplinario(jugadorPanel.jugador.id).className}`}>{estadoDisciplinario(jugadorPanel.jugador.id).label}</span>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 p-5 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setJugadorPanel(null)} className="btn-secondary">Cancelar</button>
              {estadoJugadorPartido(jugadorPanel.clave, jugadorPanel.jugador).esTitular && !estadoJugadorPartido(jugadorPanel.clave, jugadorPanel.jugador).bloqueado && !soloLectura && !enRevisionVocal && (
                <button type="button" onClick={() => marcarCapitan(jugadorPanel.clave, jugadorPanel.jugador.id)} className="btn-secondary">
                  {estadoJugadorPartido(jugadorPanel.clave, jugadorPanel.jugador).esCapitan ? 'Retirar capitan' : 'Marcar capitan'}
                </button>
              )}
              {!estadoJugadorPartido(jugadorPanel.clave, jugadorPanel.jugador).bloqueado && (puedePrepararAlineacion(datos.partido.estado) || !estadoJugadorPartido(jugadorPanel.clave, jugadorPanel.jugador).registrado) && (
                <button type="button" onClick={() => aplicarRolJugador(jugadorPanel.clave, jugadorPanel.jugador, 'TITULAR')} className="btn-primary">Marcar titular</button>
              )}
              {!estadoJugadorPartido(jugadorPanel.clave, jugadorPanel.jugador).bloqueado && (puedePrepararAlineacion(datos.partido.estado) || !estadoJugadorPartido(jugadorPanel.clave, jugadorPanel.jugador).registrado) && (
                <button type="button" onClick={() => aplicarRolJugador(jugadorPanel.clave, jugadorPanel.jugador, 'SUPLENTE')} className="btn-primary">Marcar suplente</button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={Boolean(confirmacionCritica)}
        title={confirmacionCritica?.title ?? ''}
        description={confirmacionCritica?.description ?? ''}
        confirmLabel={confirmacionCritica?.confirmLabel ?? 'Confirmar'}
        variant={confirmacionCritica?.variant}
        irreversible={confirmacionCritica?.irreversible}
        onCancel={() => setConfirmacionCritica(null)}
        onConfirm={ejecutarConfirmacionCritica}
      />

      {modalEvento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <form onSubmit={registrarEvento} className="w-full max-w-xl rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-100"><h2 className="text-xl font-black text-slate-950">Registrar {tipoEvento.toLowerCase()}</h2><button type="button" onClick={() => setModalEvento(false)} className="rounded-full bg-slate-100 p-2 hover:bg-slate-200"><X size={18} /></button></div>
            <div className="p-4 grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <select value={tipoEvento} onChange={(e) => cambiarTipoEvento(e.target.value as TipoEventoPartido)} className="field">{tiposEvento.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}</select>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">{obtenerEquipo(equipoEvento).nombre}</div>
                <input aria-label="Minuto" type="number" min={0} step={1} value={minuto} onChange={(e) => setMinuto(e.target.value)} className="field" />
              </div>
              {tipoEvento === 'CAMBIO' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><select value={jugadorSaleId} onChange={(e) => setJugadorSaleId(e.target.value)} className="field"><option value="">Sale</option>{jugadoresEnCancha.map((j) => <option key={j.id} value={j.id}>{j.numeroDorsal} · {nombreJugador(j)}</option>)}</select><select value={jugadorEntraId} onChange={(e) => setJugadorEntraId(e.target.value)} className="field"><option value="">Entra</option>{suplentesDisponibles.map((j) => <option key={j.id} value={j.id}>{j.numeroDorsal} · {nombreJugador(j)}</option>)}</select></div>
              ) : (
                <select value={jugadorEventoId} onChange={(e) => setJugadorEventoId(e.target.value)} className="field">{jugadoresEvento.length ? jugadoresEvento.map((j) => <option key={j.id} value={j.id}>{j.numeroDorsal} - {nombreJugador(j)}</option>) : <option value="">Sin jugadores en cancha</option>}</select>
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

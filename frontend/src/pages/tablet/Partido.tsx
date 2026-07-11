import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, SkipForward, X, AlertTriangle, Shield, User, CheckCircle2 } from 'lucide-react';
import { equiposService } from '../../services/equipos.service';
import { jugadoresService } from '../../services/jugadores.service';
import type { Equipo, Jugador } from '@saas/shared';
import { toast } from 'sonner';

type TipoEvento = 'GOL' | 'AMARILLA' | 'ROJA' | 'CAMBIO';

interface EventoPartido {
  id: string;
  minuto: number;
  tipo: TipoEvento;
  equipo: 'LOCAL' | 'VISITANTE';
  jugadorId: string;
  nombreJugador: string;
}

export const PartidoTablet = () => {
  // === ESTADOS DE CONFIGURACIÓN PREVIA ===
  const [partidoConfigurado, setPartidoConfigurado] = useState(false);
  const [titularesLocal, setTitularesLocal] = useState<string[]>([]);
  const [titularesVisitante, setTitularesVisitante] = useState<string[]>([]);
  const [arqueroLocal, setArqueroLocal] = useState<string | null>(null);
  const [arqueroVisitante, setArqueroVisitante] = useState<string | null>(null);
  const [capitanLocal, setCapitanLocal] = useState<string | null>(null);
  const [capitanVisitante, setCapitanVisitante] = useState<string | null>(null);

  // === ESTADOS DEL PARTIDO ===
  const [segundos, setSegundos] = useState(0);
  const [cronometroActivo, setCronometroActivo] = useState(false);
  const [periodo, setPeriodo] = useState<1 | 2>(1);
  const [golesLocal, setGolesLocal] = useState(0);
  const [golesVisitante, setGolesVisitante] = useState(0);
  const [eventos, setEventos] = useState<EventoPartido[]>([]);
  const [tabActiva, setTabActiva] = useState<'RESUMEN' | 'ALINEACIONES'>('RESUMEN');

  // === ESTADOS DE DATOS ===
  const [equipoLocal, setEquipoLocal] = useState<Equipo | null>(null);
  const [equipoVisitante, setEquipoVisitante] = useState<Equipo | null>(null);
  const [jugadoresLocal, setJugadoresLocal] = useState<Jugador[]>([]);
  const [jugadoresVisitante, setJugadoresVisitante] = useState<Jugador[]>([]);

  // === ESTADOS PARA EL MODAL DE EVENTOS ===
  const [modalAbierto, setModalAbierto] = useState(false);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState<'LOCAL' | 'VISITANTE' | null>(null);
  const [tipoEventoSeleccionado, setTipoEventoSeleccionado] = useState<TipoEvento | null>(null);

  useEffect(() => {
    const cargarDatos = async () => {
      const equipos = await equiposService.obtenerTodos();
      if (equipos.length >= 2) {
        setEquipoLocal(equipos[0]);
        setEquipoVisitante(equipos[1]);
        const jLocal = await jugadoresService.obtenerPorEquipo(equipos[0].id);
        const jVisitante = await jugadoresService.obtenerPorEquipo(equipos[1].id);
        
        // Ordenamos por dorsal para que sea fácil encontrarlos en el vestuario
        setJugadoresLocal(jLocal.sort((a, b) => a.numeroDorsal - b.numeroDorsal));
        setJugadoresVisitante(jVisitante.sort((a, b) => a.numeroDorsal - b.numeroDorsal));
      }
    };
    cargarDatos();
  }, []);

  useEffect(() => {
    let intervalo: ReturnType<typeof setInterval>;
    if (cronometroActivo) {
      intervalo = setInterval(() => setSegundos((s) => s + 1), 1000);
    }
    return () => clearInterval(intervalo);
  }, [cronometroActivo]);

  const formatoTiempo = (totalSegundos: number) => {
    const minutos = Math.floor(totalSegundos / 60).toString().padStart(2, '0');
    const segs = (totalSegundos % 60).toString().padStart(2, '0');
    return `${minutos}:${segs}`;
  };

  const manejarCambioPeriodo = () => {
    if (periodo === 1 && window.confirm('¿Iniciar el Segundo Tiempo (Min 45)?')) {
      setPeriodo(2);
      setSegundos(45 * 60);
      setCronometroActivo(false);
    }
  };

  const reiniciarPartido = () => {
    if (window.confirm('¿Reiniciar el partido? Se borrará el marcador y TODO el historial.')) {
      setPeriodo(1);
      setSegundos(0);
      setGolesLocal(0);
      setGolesVisitante(0);
      setEventos([]);
      setCronometroActivo(false);
      setPartidoConfigurado(false); // Volvemos al vestuario
    }
  };

  // === LÓGICA DE CONFIGURACIÓN DEL VESTUARIO ===
  const manejarTitular = (equipo: 'LOCAL' | 'VISITANTE', id: string) => {
    const setTitulares = equipo === 'LOCAL' ? setTitularesLocal : setTitularesVisitante;
    const titulares = equipo === 'LOCAL' ? titularesLocal : titularesVisitante;

    if (titulares.includes(id)) {
      setTitulares(titulares.filter(t => t !== id));
      // Si desmarcamos al titular, le quitamos la capitanía/arco si la tenía
      if (equipo === 'LOCAL' && arqueroLocal === id) setArqueroLocal(null);
      if (equipo === 'LOCAL' && capitanLocal === id) setCapitanLocal(null);
      if (equipo === 'VISITANTE' && arqueroVisitante === id) setArqueroVisitante(null);
      if (equipo === 'VISITANTE' && capitanVisitante === id) setCapitanVisitante(null);
    } else {
      if (titulares.length >= 11) {
        toast.error('No puedes seleccionar más de 11 titulares.');
        return;
      }
      setTitulares([...titulares, id]);
    }
  };

  const manejarRol = (equipo: 'LOCAL' | 'VISITANTE', id: string, rol: 'ARQ' | 'CAP') => {
    const titulares = equipo === 'LOCAL' ? titularesLocal : titularesVisitante;
    
    // Un jugador debe ser titular para tener un rol
    if (!titulares.includes(id)) {
      toast.warning('El jugador debe estar marcado como titular primero.');
      return;
    }

    if (equipo === 'LOCAL') {
      if (rol === 'ARQ') setArqueroLocal(arqueroLocal === id ? null : id);
      if (rol === 'CAP') setCapitanLocal(capitanLocal === id ? null : id);
    } else {
      if (rol === 'ARQ') setArqueroVisitante(arqueroVisitante === id ? null : id);
      if (rol === 'CAP') setCapitanVisitante(capitanVisitante === id ? null : id);
    }
  };

  // Validaciones para habilitar el botón de inicio
  const esEquipoValido = (titulares: string[], arquero: string | null, capitan: string | null) => {
    return titulares.length >= 7 && titulares.length <= 11 && arquero !== null && capitan !== null;
  };

  const puedeIniciarPartido = esEquipoValido(titularesLocal, arqueroLocal, capitanLocal) && 
                              esEquipoValido(titularesVisitante, arqueroVisitante, capitanVisitante);

  // === LÓGICA DE EVENTOS (Ya implementada previamente) ===
  const iniciarRegistroEvento = (equipo: 'LOCAL' | 'VISITANTE', tipo: TipoEvento) => {
    if (!cronometroActivo && !window.confirm('El cronómetro está detenido. ¿Registrar evento?')) return;
    setEquipoSeleccionado(equipo);
    setTipoEventoSeleccionado(tipo);
    setModalAbierto(true);
  };

  const registrarEventoDefinitivo = (jugador: Jugador) => {
    const minuto = Math.floor(segundos / 60);
    const nuevoEvento: EventoPartido = {
      id: crypto.randomUUID(), minuto, tipo: tipoEventoSeleccionado!, equipo: equipoSeleccionado!,
      jugadorId: jugador.id, nombreJugador: `${jugador.nombres} ${jugador.apellidos}`
    };

    let eventosAGuardar = [nuevoEvento];

    if (tipoEventoSeleccionado === 'GOL') {
      if (equipoSeleccionado === 'LOCAL') setGolesLocal((prev) => prev + 1);
      else setGolesVisitante((prev) => prev + 1);
      toast.success(`¡GOL de ${jugador.nombres}! (Min ${minuto})`);
    } else if (tipoEventoSeleccionado === 'AMARILLA') {
      const amarillasPrevias = eventos.filter(e => e.jugadorId === jugador.id && e.tipo === 'AMARILLA').length;
      if (amarillasPrevias === 1) {
        toast.error(`¡Segunda amarilla para ${jugador.nombres}! Expulsado (Min ${minuto})`);
        const eventoRoja: EventoPartido = { ...nuevoEvento, id: crypto.randomUUID(), tipo: 'ROJA' };
        eventosAGuardar = [eventoRoja, nuevoEvento];
      } else {
        toast.warning(`Tarjeta Amarilla: ${jugador.nombres} (Min ${minuto})`);
      }
    } else if (tipoEventoSeleccionado === 'ROJA') {
      toast.error(`Tarjeta Roja Directa: ${jugador.nombres} (Min ${minuto})`);
    } else if (tipoEventoSeleccionado === 'CAMBIO') {
      toast.info(`Cambio registrado: Sale/Entra ${jugador.nombres} (Min ${minuto})`);
    }

    setEventos(prev => [...eventosAGuardar, ...prev]);
    setModalAbierto(false);
  };

  const jugadoresExpulsadosIds = eventos.filter(e => e.tipo === 'ROJA').map(e => e.jugadorId);

  // =========================================================================
  // VISTA 1: CONFIGURACIÓN PREVIA AL PARTIDO (VESTUARIOS)
  // =========================================================================
  if (!partidoConfigurado) {
    const renderListaVestuario = (equipo: 'LOCAL' | 'VISITANTE', jugadores: Jugador[], titulares: string[], arquero: string | null, capitan: string | null) => (
      <div className="flex-1 bg-slate-900 rounded-xl border border-slate-800 p-4 flex flex-col h-[calc(100vh-180px)]">
        <div className="mb-4 pb-3 border-b border-slate-800">
          <h3 className="text-xl font-bold text-slate-200">
            {equipo === 'LOCAL' ? equipoLocal?.nombre : equipoVisitante?.nombre}
          </h3>
          <div className="flex gap-4 mt-2 text-sm font-medium">
            <span className={`${titulares.length >= 7 ? 'text-emerald-400' : 'text-amber-500'}`}>Titulares: {titulares.length}/11</span>
            <span className={`${arquero ? 'text-emerald-400' : 'text-amber-500'}`}>Arquero: {arquero ? '1' : '0'}</span>
            <span className={`${capitan ? 'text-emerald-400' : 'text-amber-500'}`}>Capitán: {capitan ? '1' : '0'}</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {jugadores.map(jugador => {
            const esTitular = titulares.includes(jugador.id);
            const esARQ = arquero === jugador.id;
            const esCAP = capitan === jugador.id;
            
            return (
              <div key={jugador.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${esTitular ? 'bg-slate-800 border-blue-500/50' : 'bg-slate-950 border-slate-800'}`}>
                <div 
                  className="flex items-center gap-3 cursor-pointer flex-1"
                  onClick={() => manejarTitular(equipo, jugador.id)}
                >
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center border ${esTitular ? 'bg-blue-600 border-blue-500' : 'border-slate-600'}`}>
                    {esTitular && <CheckCircle2 size={16} className="text-white" />}
                  </div>
                  <span className="w-8 text-center font-mono font-bold text-slate-400">{jugador.numeroDorsal}</span>
                  <span className={`font-medium ${esTitular ? 'text-slate-100' : 'text-slate-500'}`}>
                    {jugador.nombres} {jugador.apellidos}
                  </span>
                </div>

                <div className="flex gap-2 ml-4">
                  <button 
                    onClick={() => manejarRol(equipo, jugador.id, 'ARQ')}
                    className={`px-3 py-1 text-xs font-bold rounded transition ${esARQ ? 'bg-amber-600 text-white' : esTitular ? 'bg-slate-700 text-slate-400 hover:bg-slate-600' : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'}`}
                    disabled={!esTitular}
                    title="Asignar Arquero"
                  >
                    ARQ
                  </button>
                  <button 
                    onClick={() => manejarRol(equipo, jugador.id, 'CAP')}
                    className={`px-3 py-1 text-xs font-bold rounded transition ${esCAP ? 'bg-emerald-600 text-white' : esTitular ? 'bg-slate-700 text-slate-400 hover:bg-slate-600' : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'}`}
                    disabled={!esTitular}
                    title="Asignar Capitán"
                  >
                    CAP
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );

    return (
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 p-6 font-sans select-none">
        <div className="mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
              <Shield className="text-blue-500" size={32} />
              Preparación de Partido
            </h1>
            <p className="text-slate-400 mt-2">Selecciona los titulares, capitanes y arqueros antes de iniciar el cronómetro.</p>
          </div>
          <button 
            onClick={() => setPartidoConfigurado(true)}
            disabled={!puedeIniciarPartido}
            className={`px-8 py-3 rounded-xl font-bold text-lg transition shadow-lg flex items-center gap-2 ${puedeIniciarPartido ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
          >
            Ir a la Cancha <Play size={20} className={puedeIniciarPartido ? "fill-white" : ""} />
          </button>
        </div>

        <div className="flex gap-6">
          {renderListaVestuario('LOCAL', jugadoresLocal, titularesLocal, arqueroLocal, capitanLocal)}
          {renderListaVestuario('VISITANTE', jugadoresVisitante, titularesVisitante, arqueroVisitante, capitanVisitante)}
        </div>
      </div>
    );
  }

  // =========================================================================
  // VISTA 2: EL PARTIDO (CANCHA, CRONÓMETRO Y EVENTOS)
  // =========================================================================
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 p-4 font-sans select-none overflow-x-hidden">
      
      {/* MARCADOR Y CRONÓMETRO */}
      <div className="bg-slate-900 rounded-2xl p-4 md:pt-8 mb-4 shadow-xl border border-slate-800 flex flex-col md:flex-row justify-between items-center relative flex-shrink-0 gap-6 md:gap-0">
        <div className="hidden md:block absolute top-2 left-1/2 -translate-x-1/2 bg-slate-950 px-6 py-1.5 rounded-full border border-slate-700 text-xs font-bold tracking-widest text-slate-400 z-10 shadow-sm">
          {periodo === 1 ? '1ER TIEMPO' : '2DO TIEMPO'}
        </div>
        
        {/* Equipo Local */}
        <div className="w-full md:w-1/3 text-center px-2">
          <h2 className="text-xl md:text-2xl font-bold text-slate-300 truncate">
            {equipoLocal ? equipoLocal.nombre : 'Local'}
          </h2>
          <span className="text-5xl md:text-6xl font-black mt-1 block tracking-tighter text-red-500">{golesLocal}</span>
        </div>

        {/* Reloj */}
        <div className="w-full md:w-1/3 flex flex-col items-center md:border-x border-slate-800 px-2 md:px-6 z-10">
          <div className="text-4xl md:text-5xl font-bold text-slate-300 mb-4 tracking-wider">
            {formatoTiempo(segundos)}
          </div>
          <div className="flex gap-2 sm:gap-4">
            <button onClick={() => setCronometroActivo(!cronometroActivo)} className={`p-3 md:p-4 rounded-full ${cronometroActivo ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'} transition shadow-lg`}>
              {cronometroActivo ? <Pause size={24} className="fill-white" /> : <Play size={24} className="fill-white" />}
            </button>
            {periodo === 1 && (
              <button onClick={manejarCambioPeriodo} className="p-3 md:p-4 rounded-full bg-slate-800 hover:bg-slate-700 transition shadow-lg text-slate-400 border border-slate-700">
                <SkipForward size={24} />
              </button>
            )}
            <button onClick={reiniciarPartido} className="p-3 md:p-4 rounded-full bg-slate-800 hover:bg-slate-700 transition shadow-lg text-slate-400 border border-slate-700">
              <RotateCcw size={24} />
            </button>
          </div>
        </div>

        {/* Equipo Visitante */}
        <div className="w-full md:w-1/3 text-center px-2">
          <h2 className="text-xl md:text-2xl font-bold text-slate-300 truncate">
            {equipoVisitante ? equipoVisitante.nombre : 'Visitante'}
          </h2>
          <span className="text-5xl md:text-6xl font-black mt-1 block tracking-tighter text-red-500">{golesVisitante}</span>
        </div>
      </div>

      {/* ZONA DE JUEGO */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
        
        {/* Panel Local */}
        <div className="w-full lg:w-48 bg-slate-900 rounded-xl border border-slate-800 p-2 md:p-3 flex flex-row lg:flex-col flex-wrap lg:flex-nowrap gap-2 flex-shrink-0 justify-center">
          <button onClick={() => iniciarRegistroEvento('LOCAL', 'GOL')} className="flex-1 lg:flex-none py-3 bg-slate-800 rounded-lg font-bold hover:bg-slate-700 transition shadow-sm text-sm border border-slate-700">⚽ Gol</button>
          <button onClick={() => iniciarRegistroEvento('LOCAL', 'AMARILLA')} className="flex-1 lg:flex-none py-3 bg-slate-800 rounded-lg font-bold hover:bg-slate-700 transition shadow-sm text-sm border border-slate-700">🟨 Amarilla</button>
          <button onClick={() => iniciarRegistroEvento('LOCAL', 'ROJA')} className="flex-1 lg:flex-none py-3 bg-slate-800 rounded-lg font-bold hover:bg-slate-700 transition shadow-sm text-sm border border-slate-700">🟥 Roja</button>
          <div className="hidden lg:block h-px bg-slate-800 my-1"></div>
          <button onClick={() => iniciarRegistroEvento('LOCAL', 'CAMBIO')} className="flex-1 lg:flex-none py-3 bg-slate-800 rounded-lg font-bold hover:bg-slate-700 transition shadow-sm text-sm border border-slate-700 text-slate-400">🔄 Cambio</button>
        </div>

        {/* LÍNEA DE TIEMPO / ALINEACIONES */}
        <div className="flex-1 min-h-[400px] lg:min-h-0 bg-[#0a111a] rounded-xl border border-slate-800 relative overflow-hidden flex flex-col shadow-inner">
          <div className="bg-slate-900/80 p-3 text-xs font-bold border-b border-slate-800 flex gap-4 backdrop-blur-sm sticky top-0 z-10">
            <button onClick={() => setTabActiva('RESUMEN')} className={`flex-1 text-center pb-2 transition-colors ${tabActiva === 'RESUMEN' ? 'border-b-2 border-red-500 text-slate-100 font-bold' : 'text-slate-500 hover:text-slate-350'}`}>RESUMEN DEL PARTIDO</button>
            <button onClick={() => setTabActiva('ALINEACIONES')} className={`flex-1 text-center pb-2 transition-colors ${tabActiva === 'ALINEACIONES' ? 'border-b-2 border-red-500 text-slate-100 font-bold' : 'text-slate-500 hover:text-slate-350'}`}>ALINEACIONES</button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {tabActiva === 'RESUMEN' && (
              <div className="flex flex-col gap-1">
                {eventos.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-slate-600 font-medium text-sm">No hay eventos registrados en este partido.</div>
                ) : (
                  eventos.map((evento) => (
                    <div key={evento.id} className={`flex items-center gap-4 py-3 px-2 hover:bg-slate-800/50 rounded-lg transition ${evento.equipo === 'LOCAL' ? 'flex-row' : 'flex-row-reverse'}`}>
                      <div className="w-12 text-center font-bold text-slate-400">{evento.minuto}'</div>
                      <div className={`flex items-center gap-3 flex-1 ${evento.equipo === 'LOCAL' ? 'justify-start' : 'justify-end'}`}>
                        <div className="text-lg">
                          {evento.tipo === 'GOL' && '⚽'}
                          {evento.tipo === 'AMARILLA' && '🟨'}
                          {evento.tipo === 'ROJA' && '🟥'}
                          {evento.tipo === 'CAMBIO' && '🔄'}
                        </div>
                        <span className="font-semibold text-slate-200 text-sm md:text-base">{evento.nombreJugador}</span>
                        {evento.tipo === 'ROJA' && <span className="text-[10px] bg-red-900/50 text-red-400 px-2 py-0.5 rounded uppercase font-bold border border-red-800/50">Expulsado</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {tabActiva === 'ALINEACIONES' && (
              <div className="grid grid-cols-2 gap-6 h-full text-sm">
                <div className="border-r border-slate-800/50 pr-3">
                  <h4 className="font-bold text-slate-400 mb-3 uppercase tracking-wider text-xs border-b border-slate-800 pb-1">{equipoLocal?.nombre || 'Local'}</h4>
                  <ul className="space-y-2">
                    {jugadoresLocal.filter(j => titularesLocal.includes(j.id)).map(j => {
                      const esExpulsado = jugadoresExpulsadosIds.includes(j.id);
                      return (
                        <li key={j.id} className={`flex items-center gap-3 p-2 rounded ${esExpulsado ? 'opacity-40 bg-red-950/10' : 'bg-slate-900/40'}`}>
                          <span className="w-6 text-center font-mono font-bold text-slate-400">{j.numeroDorsal}</span>
                          <span className={`truncate ${esExpulsado ? 'line-through text-slate-500' : 'text-slate-200'}`}>{j.nombres} {j.apellidos}</span>
                          <div className="ml-auto flex gap-1">
                            {capitanLocal === j.id && <span className="text-[10px] bg-emerald-900/50 text-emerald-400 px-1.5 py-0.5 rounded font-bold border border-emerald-800/50">C</span>}
                            {arqueroLocal === j.id && <span className="text-[10px] bg-amber-900/50 text-amber-400 px-1.5 py-0.5 rounded font-bold border border-amber-800/50">ARQ</span>}
                            {esExpulsado && <span className="text-xs ml-1">🟥</span>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-slate-400 mb-3 uppercase tracking-wider text-xs border-b border-slate-800 pb-1">{equipoVisitante?.nombre || 'Visitante'}</h4>
                  <ul className="space-y-2">
                    {jugadoresVisitante.filter(j => titularesVisitante.includes(j.id)).map(j => {
                      const esExpulsado = jugadoresExpulsadosIds.includes(j.id);
                      return (
                        <li key={j.id} className={`flex items-center gap-3 p-2 rounded ${esExpulsado ? 'opacity-40 bg-red-950/10' : 'bg-slate-900/40'}`}>
                          <span className="w-6 text-center font-mono font-bold text-slate-400">{j.numeroDorsal}</span>
                          <span className={`truncate ${esExpulsado ? 'line-through text-slate-500' : 'text-slate-200'}`}>{j.nombres} {j.apellidos}</span>
                          <div className="ml-auto flex gap-1">
                            {capitanVisitante === j.id && <span className="text-[10px] bg-emerald-900/50 text-emerald-400 px-1.5 py-0.5 rounded font-bold border border-emerald-800/50">C</span>}
                            {arqueroVisitante === j.id && <span className="text-[10px] bg-amber-900/50 text-amber-400 px-1.5 py-0.5 rounded font-bold border border-amber-800/50">ARQ</span>}
                            {esExpulsado && <span className="text-xs ml-1">🟥</span>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panel Visitante */}
        <div className="w-full lg:w-48 bg-slate-900 rounded-xl border border-slate-800 p-2 md:p-3 flex flex-row lg:flex-col flex-wrap lg:flex-nowrap gap-2 flex-shrink-0 justify-center">
          <button onClick={() => iniciarRegistroEvento('VISITANTE', 'GOL')} className="flex-1 lg:flex-none py-3 bg-slate-800 rounded-lg font-bold hover:bg-slate-700 transition shadow-sm text-sm border border-slate-700">⚽ Gol</button>
          <button onClick={() => iniciarRegistroEvento('VISITANTE', 'AMARILLA')} className="flex-1 lg:flex-none py-3 bg-slate-800 rounded-lg font-bold hover:bg-slate-700 transition shadow-sm text-sm border border-slate-700">🟨 Amarilla</button>
          <button onClick={() => iniciarRegistroEvento('VISITANTE', 'ROJA')} className="flex-1 lg:flex-none py-3 bg-slate-800 rounded-lg font-bold hover:bg-slate-700 transition shadow-sm text-sm border border-slate-700">🟥 Roja</button>
          <div className="hidden lg:block h-px bg-slate-800 my-1"></div>
          <button onClick={() => iniciarRegistroEvento('VISITANTE', 'CAMBIO')} className="flex-1 lg:flex-none py-3 bg-slate-800 rounded-lg font-bold hover:bg-slate-700 transition shadow-sm text-sm border border-slate-700 text-slate-400">🔄 Cambio</button>
        </div>
      </div>

      {/* === MODAL DE REGISTRO === */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-700 flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-950">
              <h2 className="text-lg md:text-xl font-bold text-slate-100 flex items-center gap-2">
                {tipoEventoSeleccionado === 'GOL' && '⚽ Registrar Gol'}
                {tipoEventoSeleccionado === 'AMARILLA' && '🟨 Tarjeta Amarilla'}
                {tipoEventoSeleccionado === 'ROJA' && '🟥 Tarjeta Roja'}
                {tipoEventoSeleccionado === 'CAMBIO' && '🔄 Registrar Cambio'}
                <span className="text-slate-400 text-sm font-normal ml-2">(Min {Math.floor(segundos / 60)})</span>
              </h2>
              <button onClick={() => setModalAbierto(false)} className="text-slate-400 hover:text-slate-200 bg-slate-800 p-2 rounded-full transition"><X size={20} /></button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              <p className="text-slate-400 mb-4 font-medium text-sm">Selecciona al jugador implicado:</p>
              <div className="grid gap-2">
                {(equipoSeleccionado === 'LOCAL' ? jugadoresLocal : jugadoresVisitante)
                  .filter(jugador => !jugadoresExpulsadosIds.includes(jugador.id))
                  .map(jugador => {
                    const esTitular = (equipoSeleccionado === 'LOCAL' ? titularesLocal : titularesVisitante).includes(jugador.id);
                    return (
                      <button key={jugador.id} onClick={() => registrarEventoDefinitivo(jugador)} className={`flex items-center gap-4 p-3 rounded-xl transition text-left w-full border ${esTitular ? 'bg-slate-800 hover:bg-slate-700 border-slate-700' : 'bg-slate-900 hover:bg-slate-800 border-slate-800'}`}>
                        <span className="bg-slate-950 text-slate-300 w-10 h-10 rounded-full flex items-center justify-center font-bold font-mono border border-slate-800">{jugador.numeroDorsal}</span>
                        <span className="font-semibold text-slate-200 text-base md:text-lg">{jugador.nombres} {jugador.apellidos}</span>
                        {!esTitular && <span className="ml-auto text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded">Banca</span>}
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
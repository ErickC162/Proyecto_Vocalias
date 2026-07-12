import { useEffect, useState } from 'react';
import { Gavel, Save } from 'lucide-react';
import { toast } from 'sonner';
import type { Jornada, Jugador, TipoSancion } from '@saas/shared';
import { competicionService } from '../../services/competicion.service';
import { jugadoresService } from '../../services/jugadores.service';
import { sancionesService, type SancionResumen } from '../../services/sanciones.service';

const tipos: TipoSancion[] = ['ROJA_DIRECTA', 'DOBLE_AMARILLA', 'ACUMULACION_AMARILLAS', 'DISCIPLINARIA', 'ADMINISTRATIVA'];

export const SancionesAdmin = () => {
  const [sanciones, setSanciones] = useState<SancionResumen[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [jugadorId, setJugadorId] = useState('');
  const [tipo, setTipo] = useState<TipoSancion>('DISCIPLINARIA');
  const [motivo, setMotivo] = useState('');
  const [partidos, setPartidos] = useState(1);
  const [fechasSeleccionadas, setFechasSeleccionadas] = useState<string[]>([]);

  const cargar = async () => {
    const [sancionesData, jugadoresData, jornadasData] = await Promise.all([
      sancionesService.obtenerTodas(),
      jugadoresService.obtenerTodos(),
      competicionService.obtenerJornadas(),
    ]);
    setSanciones(sancionesData);
    setJugadores(jugadoresData);
    setJornadas(jornadasData);
    setJugadorId((prev) => prev || jugadoresData[0]?.id || '');
    setFechasSeleccionadas((prev) => (prev.length ? prev : jornadasData.slice(0, partidos).map((jornada) => jornada.id)));
  };

  useEffect(() => {
    void Promise.resolve().then(cargar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cambiarCantidad = (cantidad: number) => {
    const normalizada = Math.max(1, Math.min(24, Number.isInteger(cantidad) ? cantidad : 1));
    setPartidos(normalizada);
    setFechasSeleccionadas(jornadas.slice(0, normalizada).map((jornada) => jornada.id));
  };

  const alternarFecha = (jornadaId: string) => {
    setFechasSeleccionadas((actuales) => {
      if (actuales.includes(jornadaId)) return actuales.filter((id) => id !== jornadaId);
      if (actuales.length >= partidos) return [...actuales.slice(1), jornadaId];
      return [...actuales, jornadaId];
    });
  };

  const crear = async () => {
    try {
      await sancionesService.crearManual({
        jugadorId,
        tipo,
        motivo,
        partidosSuspension: partidos,
        fechaCampeonatoIds: fechasSeleccionadas,
        creadaPor: 'usr-admin-1',
      });
      setMotivo('');
      setPartidos(1);
      setFechasSeleccionadas(jornadas.slice(0, 1).map((jornada) => jornada.id));
      await cargar();
      toast.success('Sancion activa en fechas concretas.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la sancion.');
    }
  };

  return (
    <div className="space-y-5">
      <section className="surface-strong p-5">
        <p className="text-sm font-black uppercase text-emerald-600">Tribunal</p>
        <h1 className="text-2xl font-black text-slate-950">Sanciones y habilitaciones</h1>
      </section>

      <section className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="surface p-5">
          <h2 className="flex items-center gap-2 text-lg font-black"><Gavel size={20} /> Nueva sancion</h2>
          <div className="mt-4 grid gap-3">
            <select className="field" value={jugadorId} onChange={(e) => setJugadorId(e.target.value)}>
              {jugadores.map((jugador) => <option key={jugador.id} value={jugador.id}>#{jugador.numeroDorsal} {jugador.nombres} {jugador.apellidos}</option>)}
            </select>
            <select className="field" value={tipo} onChange={(e) => setTipo(e.target.value as TipoSancion)}>{tipos.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <input className="field" type="number" min={1} max={24} value={partidos} onChange={(e) => cambiarCantidad(Number(e.target.value))} />
            <div className="grid grid-cols-3 gap-2">
              {jornadas.map((jornada) => (
                <button
                  key={jornada.id}
                  type="button"
                  onClick={() => alternarFecha(jornada.id)}
                  className={`rounded-xl border px-3 py-2 text-xs font-black ${fechasSeleccionadas.includes(jornada.id) ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-600'}`}
                >
                  {jornada.nombre}
                </button>
              ))}
            </div>
            <p className="text-xs font-bold text-slate-500">Seleccionadas: {fechasSeleccionadas.length} de {partidos}</p>
            <textarea className="field min-h-24" placeholder="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            <button className="btn-primary inline-flex items-center justify-center gap-2" onClick={crear}><Save size={18} /> Guardar sancion</button>
          </div>
        </div>

        <div className="surface p-5">
          <h2 className="text-lg font-black">Historial disciplinario</h2>
          <div className="mt-4 grid gap-3">
            {sanciones.map(({ sancion, jugador, equipo, fechas, fechasTexto }) => (
              <div key={sancion.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-black">{jugador ? `${jugador.nombres} ${jugador.apellidos}` : sancion.jugadorId}</p>
                    <p className="text-sm text-slate-500">{equipo ?? 'Equipo no encontrado'} - {sancion.motivo}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">Fechas: {fechasTexto || 'Pendientes de definir'}</p>
                    {fechas.length > 0 && <p className="text-xs font-bold text-emerald-700">Cumplidas: {fechas.filter((fecha) => fecha.cumplida).length} de {fechas.length}</p>}
                  </div>
                  <span className={`badge ${sancion.estado === 'ACTIVA' ? 'bg-red-100 text-red-700' : sancion.estado === 'PENDIENTE' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>{sancion.estado}</span>
                </div>
                {sancion.estado === 'ACTIVA' && (
                  <button className="btn-secondary mt-3" onClick={async () => { await sancionesService.cambiarEstado(sancion.id, 'CUMPLIDA'); await cargar(); }}>
                    Marcar cumplida
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

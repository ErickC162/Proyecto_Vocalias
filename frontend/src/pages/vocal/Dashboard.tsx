import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { CalendarDays, ChevronRight, ClipboardCheck, MapPin, ShieldAlert } from 'lucide-react';
import type { Usuario } from '@saas/shared';
import { accionDashboard } from '../../domain/partidos/reglasPartido';
import { sesionService } from '../../services/sesion.service';
import { type PartidoAsignadoResumen, vocaliaService } from '../../services/vocalia.service';

const estadoClase = (estado: string) => {
  if (estado === 'ACTA_CERRADA') return 'bg-emerald-100 text-emerald-700';
  if (estado === 'SUSPENDIDO') return 'bg-orange-100 text-orange-700';
  if (estado === 'REVISION_ACTA') return 'bg-amber-100 text-amber-700';
  if (estado.includes('TIEMPO') || estado === 'DESCANSO') return 'bg-sky-100 text-sky-700';
  return 'bg-slate-100 text-slate-700';
};

const claveFecha = (item: PartidoAsignadoResumen) => item.partido.jornadaId ?? item.partido.fecha;

export const DashboardVocal = () => {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [partidos, setPartidos] = useState<PartidoAsignadoResumen[]>([]);
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      const usuarioActivo = await sesionService.obtenerUsuarioActivo();
      setUsuario(usuarioActivo);
      if (usuarioActivo?.role === 'VOCAL') {
        const asignados = await vocaliaService.obtenerPartidosAsignados(usuarioActivo.id);
        setPartidos(asignados);
        setJornadaSeleccionada(asignados[0] ? claveFecha(asignados[0]) : '');
      }
      setCargando(false);
    };
    cargar();
  }, []);

  const jornadas = useMemo(() => {
    const porFecha = new Map<string, PartidoAsignadoResumen>();
    partidos.forEach((item) => porFecha.set(claveFecha(item), item));
    return [...porFecha.values()].sort((a, b) => `${a.partido.fecha} ${a.partido.hora}`.localeCompare(`${b.partido.fecha} ${b.partido.hora}`));
  }, [partidos]);

  const partidosDeFecha = partidos.filter((item) => claveFecha(item) === jornadaSeleccionada);

  if (cargando) return <div className="mx-auto max-w-5xl p-4"><div className="surface p-5 font-black text-emerald-700">Buscando tus partidos...</div></div>;
  if (!usuario || usuario.role !== 'VOCAL') return <Navigate to="/" replace />;

  const renderCard = ({ partido, equipoLocal, equipoVisitante, campeonato }: PartidoAsignadoResumen) => (
    <Link key={partido.id} to={`/vocal/partidos/${partido.id}`} className="tap-card flex items-center justify-between gap-3 hover:border-emerald-300 hover:shadow-md">
      <div className="min-w-0">
        <span className={`badge ${estadoClase(partido.estado)}`}>{partido.estado}</span>
        <p className="mt-2 truncate text-lg font-black">{equipoLocal.nombre} vs {equipoVisitante.nombre}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
          <span className="inline-flex items-center gap-1"><CalendarDays size={15} /> {partido.fecha} {partido.hora}</span>
          <span className="inline-flex items-center gap-1"><MapPin size={15} /> {partido.escenario}</span>
          <span>{campeonato}</span>
        </p>
        <p className="mt-3 inline-flex items-center gap-2 text-sm font-black text-emerald-700"><ClipboardCheck size={16} /> {accionDashboard(partido.estado)}</p>
      </div>
      <ChevronRight className="shrink-0 text-emerald-600" />
    </Link>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-5 md:py-8">
      <section>
        <p className="text-sm font-black uppercase tracking-wide text-emerald-700">Hola, {usuario.nombre}</p>
        <h1 className="mt-1 text-3xl font-black text-slate-950 md:text-5xl">Tu jornada de vocalia</h1>
        <p className="mt-2 text-slate-600">Escoge la fecha, abre el partido asignado y registra solo lo que pasa en cancha.</p>
      </section>

      {jornadas.length > 0 && (
        <section className="surface p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-600">
            <CalendarDays size={18} /> Fecha a jugarse
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {jornadas.map(({ partido }) => {
              const id = partido.jornadaId ?? partido.fecha;
              const cantidad = partidos.filter((item) => claveFecha(item) === id).length;
              return (
                <button
                  key={id}
                  onClick={() => setJornadaSeleccionada(id)}
                  className={`shrink-0 rounded-2xl border px-4 py-3 text-left font-black transition ${jornadaSeleccionada === id ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600'}`}
                >
                  <span className="block">{partido.jornada}</span>
                  <span className="text-xs font-bold text-slate-500">{partido.fecha} - {cantidad} partido{cantidad === 1 ? '' : 's'}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {partidosDeFecha.length === 0 ? (
        <div className="surface-strong flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
          <ShieldAlert size={46} className="text-emerald-600" />
          <h2 className="mt-4 text-2xl font-black">No hay partidos para esta fecha</h2>
          <p className="mt-2 max-w-md text-slate-500">Cuando administracion te asigne un encuentro para la fecha seleccionada, aparecera aqui.</p>
        </div>
      ) : (
        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-black">Partidos de la fecha</h2>
            <p className="text-sm text-slate-500">Solo se muestran los encuentros de la fecha seleccionada.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">{partidosDeFecha.map(renderCard)}</div>
        </section>
      )}
    </div>
  );
};

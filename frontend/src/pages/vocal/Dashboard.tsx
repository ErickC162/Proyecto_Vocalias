import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { CalendarDays, ChevronRight, ClipboardCheck, MapPin, ShieldAlert, Trophy } from 'lucide-react';
import type { Usuario } from '@saas/shared';
import { accionDashboard } from '../../domain/partidos/reglasPartido';
import { sesionService } from '../../services/sesion.service';
import { type PartidoAsignadoResumen, vocaliaService } from '../../services/vocalia.service';

const estadoClase = (estado: string) => {
  if (estado === 'ACTA_CERRADA') return 'bg-emerald-100 text-emerald-700';
  if (estado === 'SUSPENDIDO') return 'bg-orange-100 text-orange-700';
  if (estado === 'PENDIENTE_ACTA') return 'bg-amber-100 text-amber-700';
  if (estado.includes('TIEMPO') || estado === 'DESCANSO') return 'bg-sky-100 text-sky-700';
  return 'bg-slate-100 text-slate-700';
};

export const DashboardVocal = () => {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [partidos, setPartidos] = useState<PartidoAsignadoResumen[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      const usuarioActivo = await sesionService.obtenerUsuarioActivo();
      setUsuario(usuarioActivo);
      if (usuarioActivo?.role === 'VOCAL') setPartidos(await vocaliaService.obtenerPartidosAsignados(usuarioActivo.id));
      setCargando(false);
    };
    cargar();
  }, []);

  const partidoPrincipal = useMemo(() => partidos.find((item) => item.partido.estado !== 'ACTA_CERRADA') ?? partidos[0], [partidos]);
  const otros = partidos.filter((item) => item.partido.id !== partidoPrincipal?.partido.id);

  if (cargando) return <div className="mx-auto max-w-5xl p-4"><div className="surface p-5 font-black text-emerald-700">Buscando tus partidos...</div></div>;
  if (!usuario || usuario.role !== 'VOCAL') return <Navigate to="/" replace />;

  const renderCard = ({ partido, equipoLocal, equipoVisitante, campeonato }: PartidoAsignadoResumen) => (
    <Link key={partido.id} to={`/vocal/partidos/${partido.id}`} className="tap-card flex items-center justify-between gap-3 hover:border-emerald-300 hover:shadow-md">
      <div className="min-w-0">
        <span className={`badge ${estadoClase(partido.estado)}`}>{partido.estado}</span>
        <p className="mt-2 truncate text-lg font-black">{equipoLocal.nombre} vs {equipoVisitante.nombre}</p>
        <p className="mt-1 text-sm text-slate-500">{partido.fecha} · {partido.hora} · {campeonato}</p>
      </div>
      <ChevronRight className="shrink-0 text-emerald-600" />
    </Link>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-5 md:py-8">
      <section>
        <p className="text-sm font-black uppercase tracking-wide text-emerald-700">Hola, {usuario.nombre}</p>
        <h1 className="mt-1 text-3xl font-black text-slate-950 md:text-5xl">Tu jornada de vocalia</h1>
        <p className="mt-2 text-slate-600">Todo lo importante aparece primero. Entra al partido y registra sin vueltas.</p>
      </section>

      {!partidoPrincipal ? (
        <div className="surface-strong flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
          <ShieldAlert size={46} className="text-emerald-600" />
          <h2 className="mt-4 text-2xl font-black">No tienes partidos asignados</h2>
          <p className="mt-2 max-w-md text-slate-500">Cuando la organizacion te asigne un encuentro, aparecera aqui listo para abrir.</p>
        </div>
      ) : (
        <>
          <Link to={`/vocal/partidos/${partidoPrincipal.partido.id}`} className="surface-strong block overflow-hidden transition hover:-translate-y-0.5 hover:shadow-2xl">
            <div className="bg-emerald-600 px-5 py-3 text-white">
              <p className="text-sm font-black uppercase tracking-wide">Partido principal</p>
            </div>
            <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <span className={`badge ${estadoClase(partidoPrincipal.partido.estado)}`}>{partidoPrincipal.partido.estado}</span>
                <h2 className="mt-3 text-3xl font-black text-slate-950 md:text-5xl">
                  {partidoPrincipal.equipoLocal.nombre}
                  <span className="mx-2 text-emerald-600">vs</span>
                  {partidoPrincipal.equipoVisitante.nombre}
                </h2>
                <div className="mt-4 grid gap-2 text-sm font-bold text-slate-600 sm:grid-cols-3">
                  <span className="flex items-center gap-2"><CalendarDays size={17} /> {partidoPrincipal.partido.fecha} · {partidoPrincipal.partido.hora}</span>
                  <span className="flex items-center gap-2"><MapPin size={17} /> {partidoPrincipal.partido.escenario}</span>
                  <span className="flex items-center gap-2"><Trophy size={17} /> {partidoPrincipal.equipoLocal.categoria}</span>
                </div>
              </div>
              <div className="btn-primary text-base">
                <ClipboardCheck size={20} /> {accionDashboard(partidoPrincipal.partido.estado)}
              </div>
            </div>
          </Link>

          <section className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-xl font-black">Otros partidos</h2>
                <p className="text-sm text-slate-500">Actas cerradas, suspendidos o siguientes encuentros.</p>
              </div>
            </div>
            {otros.length ? <div className="grid gap-3 md:grid-cols-2">{otros.map(renderCard)}</div> : <div className="surface p-5 text-sm font-bold text-slate-500">No hay otros partidos por revisar.</div>}
          </section>
        </>
      )}
    </div>
  );
};

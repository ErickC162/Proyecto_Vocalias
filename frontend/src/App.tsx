import { useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { CalendarDays, ClipboardCheck, Gavel, ShieldCheck, Trophy, Users } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { poblarBaseDeDatosInicial } from './db/seed';
import { AdminLayout } from './layouts/AdminLayout';
import { TabletLayout } from './layouts/TabletLayout';
import { CampeonatoAdmin } from './pages/admin/Campeonato';
import { EquiposAdmin } from './pages/admin/Equipos';
import { EstadisticasAdmin } from './pages/admin/Estadisticas';
import { JugadoresAdmin } from './pages/admin/Jugadores';
import { PartidosAdmin } from './pages/admin/Partidos';
import { SancionesAdmin } from './pages/admin/Sanciones';
import { UsuariosAdmin } from './pages/admin/Usuarios';
import { PartidoTablet } from './pages/tablet/Partido';
import { DashboardVocal } from './pages/vocal/Dashboard';
import { estadisticasService } from './services/estadisticas.service';
import { sesionService } from './services/sesion.service';

const DashboardAdmin = () => {
  const [resumen, setResumen] = useState({
    equipos: 0,
    jugadores: 0,
    proximos: 0,
    sinVocal: 0,
    sinArbitro: 0,
    pendientesActa: 0,
    cerrados: 0,
    sancionesActivas: 0,
  });

  useEffect(() => {
    const cargar = async () => setResumen(await estadisticasService.resumenDashboard());
    cargar();
  }, []);

  const indicadores = [
    { label: 'Equipos', value: resumen.equipos, icon: Trophy, to: '/admin/equipos', action: 'Gestionar' },
    { label: 'Jugadores', value: resumen.jugadores, icon: Users, to: '/admin/jugadores', action: 'Plantillas' },
    { label: 'Proximos', value: resumen.proximos, icon: CalendarDays, to: '/admin/partidos', action: 'Fixture' },
    { label: 'Actas pendientes', value: resumen.pendientesActa, icon: ClipboardCheck, to: '/admin/partidos', action: 'Revisar' },
    { label: 'Sanciones activas', value: resumen.sancionesActivas, icon: Gavel, to: '/admin/sanciones', action: 'Tribunal' },
  ];

  return (
    <div className="space-y-6">
      <div className="surface-strong p-6">
        <p className="text-sm font-black uppercase tracking-wide text-emerald-600">Panel de liga</p>
        <h1 className="mt-1 text-3xl font-black text-slate-950">Centro operativo del campeonato</h1>
        <p className="mt-2 max-w-2xl text-slate-600">Fixture, asignaciones, actas, sanciones y estadisticas calculadas desde la base local.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {indicadores.map((item) => (
          <Link key={item.label} to={item.to} className="tap-card hover:-translate-y-0.5 hover:shadow-md">
            <item.icon className="text-emerald-600" size={26} />
            <p className="mt-4 text-3xl font-black text-slate-950">{item.value}</p>
            <p className="font-bold text-slate-700">{item.label}</p>
            <p className="mt-3 text-sm font-black text-emerald-700">{item.action}</p>
          </Link>
        ))}
      </div>

      <section className="surface p-5">
        <h2 className="text-xl font-black">Pendientes de administracion</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Link to="/admin/partidos" className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white">
            <p className="text-3xl font-black text-slate-950">{resumen.sinVocal}</p>
            <p className="font-bold text-slate-600">Partidos sin vocal</p>
          </Link>
          <Link to="/admin/partidos" className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white">
            <p className="text-3xl font-black text-slate-950">{resumen.sinArbitro}</p>
            <p className="font-bold text-slate-600">Partidos sin arbitro</p>
          </Link>
          <Link to="/admin/estadisticas" className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white">
            <p className="text-3xl font-black text-slate-950">{resumen.cerrados}</p>
            <p className="font-bold text-slate-600">Actas cerradas para tabla</p>
          </Link>
        </div>
      </section>
    </div>
  );
};

const Inicio = () => {
  const navigate = useNavigate();

  const entrarComoVocal = async () => {
    try {
      await sesionService.iniciarComoVocalSeed();
      navigate('/vocal');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No pudimos abrir el modo vocal.');
    }
  };

  return (
    <div className="app-shell flex min-h-screen items-center justify-center px-4 py-10">
      <main className="grid w-full max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section>
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-emerald-700 shadow-sm">
            <ShieldCheck size={18} /> Vocalias barriales
          </div>
          <h1 className="mt-5 text-5xl font-black leading-tight text-slate-950 md:text-7xl">La fecha bajo control, desde la cancha.</h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-600">
            Gestiona equipos, plantillas y actas de partido con una experiencia simple para administradores y vocales.
          </p>
        </section>

        <section className="surface-strong p-5 md:p-6">
          <h2 className="text-2xl font-black text-slate-950">Entrar al sistema</h2>
          <p className="mt-1 text-sm text-slate-500">Un clic y empiezas. Sin pasos de prueba innecesarios.</p>
          <div className="mt-5 grid gap-3">
            <Link to="/admin" className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:border-emerald-300 hover:bg-white">
              <div className="flex items-center gap-4">
                <div className="rounded-2xl bg-emerald-600 p-3 text-white"><Users size={26} /></div>
                <div>
                  <p className="text-xl font-black">Administrador</p>
                  <p className="text-sm text-slate-500">Equipos, jugadores y seguimiento de la fecha.</p>
                </div>
              </div>
            </Link>
            <button onClick={entrarComoVocal} className="group rounded-2xl border border-emerald-200 bg-emerald-600 p-5 text-left text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-700">
              <div className="flex items-center gap-4">
                <div className="rounded-2xl bg-white/15 p-3"><ClipboardCheck size={26} /></div>
                <div>
                  <p className="text-xl font-black">Vocal de partido</p>
                  <p className="text-sm text-emerald-50">Abrir mi partido asignado y registrar el acta.</p>
                </div>
              </div>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

function App() {
  const [dbLista, setDbLista] = useState(false);

  useEffect(() => {
    poblarBaseDeDatosInicial().then(() => setDbLista(true)).catch((error) => {
      console.error('Error al cargar la base de datos:', error);
    });
  }, []);

  if (!dbLista) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <div className="surface px-6 py-4 font-black text-emerald-700">Preparando datos locales...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster richColors position="top-right" />
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<DashboardAdmin />} />
          <Route path="/admin/campeonato" element={<CampeonatoAdmin />} />
          <Route path="/admin/partidos" element={<PartidosAdmin />} />
          <Route path="/admin/estadisticas" element={<EstadisticasAdmin />} />
          <Route path="/admin/equipos" element={<EquiposAdmin />} />
          <Route path="/admin/jugadores" element={<JugadoresAdmin />} />
          <Route path="/admin/usuarios" element={<UsuariosAdmin />} />
          <Route path="/admin/sanciones" element={<SancionesAdmin />} />
        </Route>
        <Route element={<TabletLayout />}>
          <Route path="/vocal" element={<DashboardVocal />} />
          <Route path="/vocal/partidos/:partidoId" element={<PartidoTablet />} />
          <Route path="/tablet" element={<Navigate to="/vocal" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

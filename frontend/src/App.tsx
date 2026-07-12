import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { CalendarDays, ClipboardCheck, Gavel, LogIn, ShieldCheck, Trophy, Users } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import type { UserRole } from '@saas/shared';
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

const rolesAdmin: UserRole[] = ['SUPERADMIN', 'ADMIN_LIGA', 'ORGANIZADOR'];

const RutaProtegida = ({ roles, children }: { roles: UserRole[]; children: ReactNode }) => {
  const [permitido, setPermitido] = useState<boolean | null>(null);

  useEffect(() => {
    let activo = true;
    void Promise.resolve().then(async () => {
      const usuario = await sesionService.obtenerUsuarioActivo();
      if (activo) setPermitido(Boolean(usuario && roles.includes(usuario.role)));
    });
    return () => {
      activo = false;
    };
  }, [roles]);

  if (permitido === null) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <div className="surface px-6 py-4 font-black text-emerald-700">Validando sesion...</div>
      </div>
    );
  }

  return permitido ? children : <Navigate to="/" replace />;
};

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
  const [email, setEmail] = useState('admin@kimeotech.com');
  const [password, setPassword] = useState('Kimeotech1');
  const [tipoAcceso, setTipoAcceso] = useState<'ADMIN' | 'VOCAL'>('ADMIN');
  const [cargando, setCargando] = useState(false);

  const seleccionarAcceso = (tipo: 'ADMIN' | 'VOCAL') => {
    setTipoAcceso(tipo);
    setEmail(tipo === 'ADMIN' ? 'admin@kimeotech.com' : 'vocal@kimeotech.com');
    setPassword(tipo === 'ADMIN' ? 'Kimeotech1' : 'Kimeotech2');
  };

  const iniciarSesion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCargando(true);
    try {
      const roles = tipoAcceso === 'ADMIN' ? rolesAdmin : (['VOCAL'] satisfies UserRole[]);
      const usuario = await sesionService.iniciarConCredenciales(email, password, roles);
      navigate(usuario.role === 'VOCAL' ? '/vocal' : '/admin');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No pudimos iniciar sesion.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="app-shell flex min-h-screen items-center justify-center px-4 py-10">
      <Link to="/" className="absolute left-4 top-4 flex items-center gap-2 rounded-2xl bg-white/75 px-3 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-white/80 backdrop-blur">
        <img src="/logo.jpg" alt="Liga Barrial" className="h-9 w-9 rounded-xl object-cover opacity-85 ring-1 ring-emerald-100" />
        <span className="hidden sm:inline">Liga Barrial</span>
      </Link>
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
          <p className="mt-1 text-sm text-slate-500">Ingresa con el correo y contrasena asignados para tu rol.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <button type="button" onClick={() => seleccionarAcceso('ADMIN')} className={`group rounded-2xl border p-5 text-left transition ${tipoAcceso === 'ADMIN' ? 'border-emerald-400 bg-white shadow-sm' : 'border-slate-200 bg-slate-50 hover:border-emerald-300 hover:bg-white'}`}>
              <div className="flex items-center gap-4">
                <div className="rounded-2xl bg-emerald-600 p-3 text-white"><Users size={26} /></div>
                <div>
                  <p className="text-xl font-black">Administrador</p>
                  <p className="text-sm text-slate-500">Equipos, jugadores y seguimiento de la fecha.</p>
                </div>
              </div>
            </button>
            <button type="button" onClick={() => seleccionarAcceso('VOCAL')} className={`group rounded-2xl border p-5 text-left transition ${tipoAcceso === 'VOCAL' ? 'border-emerald-500 bg-emerald-600 text-white shadow-lg shadow-emerald-900/15' : 'border-emerald-200 bg-emerald-600 text-white shadow-lg shadow-emerald-900/15 hover:bg-emerald-700'}`}>
              <div className="flex items-center gap-4">
                <div className="rounded-2xl bg-white/15 p-3"><ClipboardCheck size={26} /></div>
                <div>
                  <p className="text-xl font-black">Vocal de partido</p>
                  <p className="text-sm text-emerald-50">Abrir mi partido asignado y registrar el acta.</p>
                </div>
              </div>
            </button>
          </div>
          <form onSubmit={iniciarSesion} className="mt-5 grid gap-3">
            <label className="grid gap-1 text-sm font-black text-slate-700">
              Correo
              <input className="field" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm font-black text-slate-700">
              Contrasena
              <input className="field" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <button type="submit" disabled={cargando} className="btn-primary justify-center disabled:opacity-60">
              <LogIn size={18} /> {cargando ? 'Validando...' : 'Ingresar'}
            </button>
          </form>
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
        <Route element={<RutaProtegida roles={rolesAdmin}><AdminLayout /></RutaProtegida>}>
          <Route path="/admin" element={<DashboardAdmin />} />
          <Route path="/admin/campeonato" element={<CampeonatoAdmin />} />
          <Route path="/admin/partidos" element={<PartidosAdmin />} />
          <Route path="/admin/estadisticas" element={<EstadisticasAdmin />} />
          <Route path="/admin/equipos" element={<EquiposAdmin />} />
          <Route path="/admin/jugadores" element={<JugadoresAdmin />} />
          <Route path="/admin/usuarios" element={<UsuariosAdmin />} />
          <Route path="/admin/sanciones" element={<SancionesAdmin />} />
        </Route>
        <Route element={<RutaProtegida roles={['VOCAL']}><TabletLayout /></RutaProtegida>}>
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

import { Link, Outlet, useLocation } from 'react-router-dom';
import { CalendarDays, ChartNoAxesColumn, Gavel, Home, Settings2, ShieldCheck, Trophy, UserCog, Users } from 'lucide-react';

export const AdminLayout = () => {
  const location = useLocation();
  const menuItems = [
    { name: 'Inicio', path: '/admin', icon: Home },
    { name: 'Campeonato', path: '/admin/campeonato', icon: Settings2 },
    { name: 'Partidos', path: '/admin/partidos', icon: CalendarDays },
    { name: 'Estadisticas', path: '/admin/estadisticas', icon: ChartNoAxesColumn },
    { name: 'Equipos', path: '/admin/equipos', icon: Trophy },
    { name: 'Jugadores', path: '/admin/jugadores', icon: Users },
    { name: 'Usuarios', path: '/admin/usuarios', icon: UserCog },
    { name: 'Sanciones', path: '/admin/sanciones', icon: Gavel },
  ];

  return (
    <div className="app-shell min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <Link to="/admin" className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-600 p-2 text-white"><ShieldCheck size={22} /></div>
            <div>
              <p className="font-black text-slate-950">Liga Barrial</p>
              <p className="text-xs font-bold text-slate-500">Administracion</p>
            </div>
          </Link>
          <nav className="flex gap-2 overflow-x-auto">
            {menuItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path} className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition ${active ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-emerald-50'}`}>
                  <item.icon size={16} /> {item.name}
                </Link>
              );
            })}
          </nav>
          <Link to="/" className="btn-secondary">Salir</Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
};

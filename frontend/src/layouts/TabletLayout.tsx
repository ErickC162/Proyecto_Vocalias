import { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { ClipboardList, History, Home, LogOut } from 'lucide-react';
import type { Usuario } from '@saas/shared';
import { sesionService } from '../services/sesion.service';

export const TabletLayout = () => {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  useEffect(() => {
    sesionService.obtenerUsuarioActivo().then(setUsuario);
  }, []);

  const cerrarSesion = () => {
    sesionService.cerrarSesion();
    navigate('/');
  };

  return (
    <div className="app-shell min-h-screen pb-20 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-white/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/vocal" className="flex min-w-0 items-center gap-3">
            <img src="/logo.jpg" alt="Liga Barrial" className="h-10 w-10 rounded-xl object-cover opacity-85 ring-1 ring-emerald-100" />
            <div className="min-w-0">
              <p className="truncate text-base font-black text-slate-950">Modo vocal</p>
              {usuario && <p className="truncate text-xs font-bold text-slate-500">{usuario.nombre} {usuario.apellido}</p>}
            </div>
          </Link>
          <button onClick={cerrarSesion} className="btn-secondary !min-h-10 !px-3">
            <LogOut size={16} /> <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-slate-200 bg-white/95 px-3 py-2 text-xs font-black text-slate-600 backdrop-blur md:hidden">
        <Link to="/" className="flex flex-col items-center gap-1"><Home size={20} /> Inicio</Link>
        <Link to="/vocal" className="flex flex-col items-center gap-1 text-emerald-700"><ClipboardList size={20} /> Partido</Link>
        <Link to="/vocal" className="flex flex-col items-center gap-1"><History size={20} /> Historial</Link>
      </nav>
    </div>
  );
};

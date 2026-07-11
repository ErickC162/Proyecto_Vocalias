import { Link, Outlet } from 'react-router-dom';

export const TabletLayout = () => {
  return (
    // Cambiamos h-screen por min-h-screen para que pueda crecer hacia abajo
    <div className="flex flex-col min-h-screen bg-slate-900 text-slate-100">
      {/* Barra superior */}
      <header className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex justify-between items-center shrink-0">
        <h1 className="text-lg font-semibold text-slate-300">Modo Vocalía (Offline)</h1>
        <Link to="/" className="text-sm px-3 py-1 bg-slate-800 rounded hover:bg-slate-700 transition">
          Cerrar Sesión
        </Link>
      </header>

      {/* El área de juego */}
      {/* Cambiamos overflow-hidden por overflow-auto para permitir el scroll si es necesario */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};
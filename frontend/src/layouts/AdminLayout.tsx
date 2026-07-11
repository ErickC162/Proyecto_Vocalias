import { Link, Outlet, useLocation } from 'react-router-dom';

export const AdminLayout = () => {
  const location = useLocation();

  const menuItems = [
    { name: 'Dashboard', path: '/admin' },
    { name: 'Equipos', path: '/admin/equipos' },
    { name: 'Jugadores', path: '/admin/jugadores' },
  ];

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Menú Lateral (Sidebar) */}
      <aside className="w-64 bg-white border-r border-slate-200 shadow-sm flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">Panel Admin</h2>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className={`block px-4 py-3 rounded-lg transition-colors font-medium ${
                location.pathname === item.path
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <Link to="/" className="block w-full text-center px-4 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors">
            ← Salir al inicio
          </Link>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main className="flex-1 overflow-auto p-8">
        <Outlet /> {/* Aquí se inyectarán las páginas como Dashboard o Equipos */}
      </main>
    </div>
  );
};
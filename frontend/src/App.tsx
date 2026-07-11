import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { poblarBaseDeDatosInicial } from './db/seed';
import { equiposService } from './services/equipos.service';
import type { Equipo } from '@saas/shared';
import { AdminLayout } from './layouts/AdminLayout';
import { TabletLayout } from './layouts/TabletLayout';
import { EquiposAdmin } from './pages/admin/Equipos';
import { JugadoresAdmin } from './pages/admin/Jugadores';
import { PartidoTablet } from './pages/tablet/Partido';
import { Toaster } from 'sonner';

// ==========================================
// COMPONENTES TEMPORALES (Páginas)
// ==========================================

const DashboardAdmin = () => {
  const [equipos, setEquipos] = useState<Equipo[]>([]);

  useEffect(() => {
    const cargarEquipos = async () => {
      const datos = await equiposService.obtenerTodos();
      setEquipos(datos);
    };
    cargarEquipos();
  }, []);

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold text-slate-800 mb-4">🛡️ Panel de Administración</h1>

      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Equipos Registrados (Prueba Local)</h2>
        <ul className="space-y-2">
          {equipos.map((equipo) => (
            <li key={equipo.id} className="p-3 bg-slate-50 border border-slate-200 rounded flex justify-between items-center">
              <span className="font-semibold">{equipo.nombre}</span>
              <span className="text-sm text-slate-500 bg-slate-200 px-2 py-1 rounded">
                Cat: {equipo.categoria}
              </span>
            </li>
          ))}
        </ul>
        {equipos.length === 0 && <p className="text-slate-500 text-sm">No hay equipos registrados.</p>}
      </div>
    </div>
  );
};

const Inicio = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white gap-6">
    <h1 className="text-4xl font-bold">SaaS Ligas Barriales ⚽</h1>
    <p>Selecciona el módulo al que deseas ingresar:</p>
    <div className="flex gap-4">
      <Link to="/admin" className="px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-700 font-semibold transition">
        Entrar como Administrador
      </Link>
      <Link to="/tablet" className="px-6 py-3 bg-green-600 rounded-lg hover:bg-green-700 font-semibold transition">
        Entrar como Vocal (Tablet)
      </Link>
    </div>
  </div>
);

// ==========================================
// ENRUTADOR PRINCIPAL
// ==========================================

function App() {
  const [dbLista, setDbLista] = useState(false);

  useEffect(() => {
    poblarBaseDeDatosInicial()
      .then(() => {
        setDbLista(true);
      })
      .catch((error) => {
        console.error("Error al cargar la base de datos:", error);
      });
  }, []);

  if (!dbLista) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        <h2 className="text-2xl font-bold animate-pulse">Cargando base de datos local...</h2>
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
          <Route path="/admin/equipos" element={<EquiposAdmin />} />
          <Route path="/admin/jugadores" element={<JugadoresAdmin />} />
        </Route>

        <Route element={<TabletLayout />}>
          <Route path="/tablet" element={<PartidoTablet />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
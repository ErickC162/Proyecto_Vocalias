import { useState, useEffect } from 'react';
import { equiposService } from '../../services/equipos.service';
import type { Equipo } from '@saas/shared';
import { Plus, Edit, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

export const EquiposAdmin = () => {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [mostrarModal, setMostrarModal] = useState(false);
  
  // Estado para el formulario
  const [equipoSeleccionadoId, setEquipoSeleccionadoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('Máxima');

  useEffect(() => {
    cargarEquipos();
  }, []);

  const cargarEquipos = async () => {
    const datos = await equiposService.obtenerTodos();
    setEquipos(datos);
  };

  const abrirModalParaCrear = () => {
    setEquipoSeleccionadoId(null);
    setNombre('');
    setCategoria('Máxima');
    setMostrarModal(true);
  };

  const abrirModalParaEditar = (equipo: Equipo) => {
    setEquipoSeleccionadoId(equipo.id);
    setNombre(equipo.nombre);
    setCategoria(equipo.categoria);
    setMostrarModal(true);
  };

  const guardarEquipo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (equipoSeleccionadoId) {
        // Modo Edición
        await equiposService.actualizar(equipoSeleccionadoId, { nombre, categoria });
        toast.success('Equipo actualizado con éxito');
      } else {
        // Modo Creación
        await equiposService.crear({
          nombre,
          categoria,
          torneoId: 'torneo-1',
          representanteId: 'rep-1',
        });
        toast.success('Equipo registrado con éxito');
      }
      
      setMostrarModal(false);
      cargarEquipos();
    } catch (error) {
      toast.error('Ocurrió un error al guardar el equipo');
      console.error(error);
    }
  };

  const borrarEquipo = async (id: string, nombreEquipo: string) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar al equipo "${nombreEquipo}"?`)) {
      try {
        await equiposService.eliminar(id);
        toast.success('Equipo eliminado correctamente');
        cargarEquipos();
      } catch (error) {
        toast.error('No se pudo eliminar el equipo');
        console.error(error);
      }
    }
  };

  return (
    <div className="max-w-5xl relative">
      {/* Cabecera */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">⚽ Gestión de Equipos</h1>
          <p className="text-slate-600">Administra los equipos de la liga y sus categorías.</p>
        </div>
        <button 
          onClick={abrirModalParaCrear}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition shadow-sm"
        >
          <Plus size={20} /> Nuevo Equipo
        </button>
      </div>

      {/* Tabla de datos */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <th className="p-4 font-semibold">Nombre del Equipo</th>
              <th className="p-4 font-semibold">Categoría</th>
              <th className="p-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {equipos.map((equipo) => (
              <tr key={equipo.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                <td className="p-4 font-medium text-slate-800">{equipo.nombre}</td>
                <td className="p-4">
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm font-medium">
                    {equipo.categoria}
                  </span>
                </td>
                <td className="p-4 flex justify-end gap-2">
                  <button 
                    onClick={() => abrirModalParaEditar(equipo)}
                    className="p-2 text-slate-400 hover:text-blue-600 transition rounded hover:bg-blue-50" 
                    title="Editar"
                  >
                    <Edit size={18} />
                  </button>
                  <button 
                    onClick={() => borrarEquipo(equipo.id, equipo.nombre)}
                    className="p-2 text-slate-400 hover:text-red-600 transition rounded hover:bg-red-50" 
                    title="Eliminar"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL MÁGICO (CREAR / EDITAR) */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">
                {equipoSeleccionadoId ? 'Modificar Equipo' : 'Registrar Nuevo Equipo'}
              </h2>
              <button onClick={() => setMostrarModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={guardarEquipo} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Equipo</label>
                <input 
                  type="text" 
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Ej: Manchester City"
                />
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
                <select 
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Máxima">Máxima</option>
                  <option value="Primera">Primera</option>
                  <option value="Segunda">Segunda</option>
                  <option value="Femenino">Femenino</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button 
                  type="button" 
                  onClick={() => setMostrarModal(false)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-lg transition shadow-sm"
                >
                  {equipoSeleccionadoId ? 'Guardar Cambios' : 'Registrar Equipo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
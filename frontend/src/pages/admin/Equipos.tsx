import { useEffect, useState } from 'react';
import { Edit, Plus, Search, Trash2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Equipo } from '@saas/shared';
import { equiposService } from '../../services/equipos.service';

export const EquiposAdmin = () => {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [equipoSeleccionadoId, setEquipoSeleccionadoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('Maxima');
  const [busqueda, setBusqueda] = useState('');

  async function cargarEquipos() {
    setEquipos(await equiposService.obtenerTodos());
  }

  useEffect(() => {
    // Carga inicial desde IndexedDB para mantener el CRUD local existente.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarEquipos();
  }, []);

  const abrirModalParaCrear = () => {
    setEquipoSeleccionadoId(null);
    setNombre('');
    setCategoria('Maxima');
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
        await equiposService.actualizar(equipoSeleccionadoId, { nombre, categoria });
        toast.success('El equipo fue actualizado.');
      } else {
        await equiposService.crear({ nombre, categoria, torneoId: 'torneo-1', representanteId: 'rep-1' });
        toast.success('El equipo fue creado.');
      }
      setMostrarModal(false);
      cargarEquipos();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No pudimos guardar el equipo.');
    }
  };

  const borrarEquipo = async (id: string, nombreEquipo: string) => {
    if (!window.confirm(`Eliminar ${nombreEquipo}?`)) return;
    try {
      await equiposService.eliminar(id);
      toast.success('El equipo fue eliminado.');
      cargarEquipos();
    } catch {
      toast.error('No pudimos eliminar el equipo.');
    }
  };

  const equiposFiltrados = equipos.filter((equipo) => `${equipo.nombre} ${equipo.categoria}`.toLowerCase().includes(busqueda.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="surface-strong flex flex-col justify-between gap-4 p-5 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-emerald-700">Campeonato</p>
          <h1 className="text-3xl font-black text-slate-950">Equipos</h1>
          <p className="text-slate-600">Crea, edita y revisa clubes sin salir de esta pantalla.</p>
        </div>
        <button onClick={abrirModalParaCrear} className="btn-primary"><Plus size={20} /> Crear equipo</button>
      </div>

      <div className="surface p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input className="field pl-10" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar equipo o categoria" />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {equiposFiltrados.map((equipo) => (
          <article key={equipo.id} className="tap-card">
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700"><Users size={22} /></div>
              <span className="badge bg-slate-100 text-slate-600">{equipo.categoria}</span>
            </div>
            <h2 className="mt-4 text-xl font-black text-slate-950">{equipo.nombre}</h2>
            <p className="mt-1 text-sm text-slate-500">Plantilla y datos listos para la fecha.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => abrirModalParaEditar(equipo)} className="btn-secondary flex-1"><Edit size={16} /> Editar</button>
              <button aria-label={`Eliminar ${equipo.nombre}`} onClick={() => borrarEquipo(equipo.id, equipo.nombre)} className="btn-secondary text-red-600"><Trash2 size={16} /></button>
            </div>
          </article>
        ))}
        {equiposFiltrados.length === 0 && (
          <div className="surface col-span-full p-8 text-center">
            <p className="text-xl font-black">Todavia no hay equipos para mostrar</p>
            <p className="mt-1 text-slate-500">Crea el primer equipo para comenzar el campeonato.</p>
          </div>
        )}
      </div>

      {mostrarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h2 className="text-xl font-black text-slate-950">{equipoSeleccionadoId ? 'Editar equipo' : 'Crear equipo'}</h2>
              <button aria-label="Cerrar" onClick={() => setMostrarModal(false)} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"><X size={20} /></button>
            </div>
            <form onSubmit={guardarEquipo} className="space-y-4 p-5">
              <label className="block text-sm font-black text-slate-700">
                Nombre del equipo
                <input className="field mt-1" required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Union Central" />
              </label>
              <label className="block text-sm font-black text-slate-700">
                Categoria
                <select className="field mt-1" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                  <option value="Maxima">Maxima</option>
                  <option value="Primera">Primera</option>
                  <option value="Segunda">Segunda</option>
                  <option value="Femenino">Femenino</option>
                </select>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setMostrarModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

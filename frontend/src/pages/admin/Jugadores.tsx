import { useState, useEffect } from 'react';
import { jugadoresService } from '../../services/jugadores.service';
import { equiposService } from '../../services/equipos.service';
import type { Jugador, Equipo } from '@saas/shared';
import { Plus, Edit, Trash2, X, ArrowLeft, Users, Search } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';

export const JugadoresAdmin = () => {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [equipoViendo, setEquipoViendo] = useState<Equipo | null>(null);

  // === NUEVO: ESTADO PARA EL BUSCADOR ===
  const [busqueda, setBusqueda] = useState('');

  const [mostrarModal, setMostrarModal] = useState(false);
  const [jugadorSeleccionadoId, setJugadorSeleccionadoId] = useState<string | null>(null);
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [cedula, setCedula] = useState('');
  const [numeroDorsal, setNumeroDorsal] = useState<number | ''>('');
  const [jugadorParaEliminar, setJugadorParaEliminar] = useState<{ id: string; nombreCompleto: string } | null>(null);

  async function cargarEquipos() {
    const datosEquipos = await equiposService.obtenerTodos();
    setEquipos(datosEquipos);
  }

  useEffect(() => {
    // Carga inicial desde IndexedDB para mantener el CRUD local existente.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarEquipos();
  }, []);

  const seleccionarEquipo = async (equipo: Equipo) => {
    const datosJugadores = await jugadoresService.obtenerPorEquipo(equipo.id);
    setJugadores(datosJugadores);
    setEquipoViendo(equipo);
    setBusqueda(''); // Limpiamos el buscador al cambiar de equipo
  };

  const abrirModalParaCrear = () => {
    setJugadorSeleccionadoId(null);
    setNombres('');
    setApellidos('');
    setCedula('');
    setNumeroDorsal('');
    setMostrarModal(true);
  };

  const abrirModalParaEditar = (jugador: Jugador) => {
    setJugadorSeleccionadoId(jugador.id);
    setNombres(jugador.nombres);
    setApellidos(jugador.apellidos);
    setCedula(jugador.cedula);
    setNumeroDorsal(jugador.numeroDorsal);
    setMostrarModal(true);
  };

  const guardarJugador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipoViendo) return;

    try {
      const datosBase = {
        nombres,
        apellidos,
        cedula,
        numeroDorsal: Number(numeroDorsal),
        equipoId: equipoViendo.id,
        estadoHabilitacion: 'HABILITADO' as const,
        fechaNacimiento: Date.now(),
        fotoUrl: ''
      };

      if (jugadorSeleccionadoId) {
        await jugadoresService.actualizar(jugadorSeleccionadoId, datosBase);
        toast.success('Jugador actualizado con éxito');
      } else {
        await jugadoresService.crear(datosBase);
        toast.success('Jugador registrado con éxito');
      }
      
      setMostrarModal(false);
      const datosActualizados = await jugadoresService.obtenerPorEquipo(equipoViendo.id);
      setJugadores(datosActualizados);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el jugador');
      console.error(error);
    }
  };

  const borrarJugador = async (id: string) => {
    if (!equipoViendo) return;

    try {
      await jugadoresService.eliminar(id);
      toast.success('Jugador eliminado');
      setJugadorParaEliminar(null);
      const datosActualizados = await jugadoresService.obtenerPorEquipo(equipoViendo.id);
      setJugadores(datosActualizados);
    } catch (error) {
      toast.error('No se pudo eliminar el jugador');
      console.error(error);
    }
  };

  // === NUEVO: LÓGICA DE FILTRADO Y ORDENAMIENTO ===
  // Filtramos por nombre, apellido, cédula o dorsal, y luego ordenamos de menor a mayor por dorsal
  const jugadoresFiltradosYOrdenados = jugadores
    .filter(jugador => {
      const termino = busqueda.toLowerCase();
      return (
        jugador.nombres.toLowerCase().includes(termino) ||
        jugador.apellidos.toLowerCase().includes(termino) ||
        jugador.cedula.includes(termino) ||
        jugador.numeroDorsal.toString().includes(termino)
      );
    })
    .sort((a, b) => a.numeroDorsal - b.numeroDorsal);

  const dorsalOcupado = numeroDorsal !== '' && jugadores.some((jugador) => jugador.numeroDorsal === Number(numeroDorsal) && jugador.id !== jugadorSeleccionadoId);

  return (
    <div className="max-w-6xl relative">
      
      {!equipoViendo && (
        <>
          <div className="mb-8">
            <h1 className="text-3xl font-black text-slate-950">Plantillas por club</h1>
            <p className="text-slate-600 mt-1">Selecciona un equipo para gestionar a sus jugadores.</p>
          </div>

          {equipos.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 shadow-sm">
              No hay equipos registrados. Ve al módulo de Equipos primero.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {equipos.map(equipo => (
                <div 
                  key={equipo.id} 
                  onClick={() => seleccionarEquipo(equipo)}
                  className="tap-card cursor-pointer group hover:border-emerald-300 hover:shadow-md"
                >
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition">
                    <Users size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-1">{equipo.nombre}</h3>
                  <p className="text-sm font-medium text-slate-500 mb-4 bg-slate-100 inline-block px-2 py-1 rounded">
                    {equipo.categoria}
                  </p>
                  <div className="text-blue-600 font-medium text-sm flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Gestionar plantilla →
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {equipoViendo && (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
              <button 
                onClick={() => setEquipoViendo(null)}
                className="text-slate-500 hover:text-blue-600 font-medium flex items-center gap-2 mb-2 transition"
              >
                <ArrowLeft size={18} /> Volver a los clubes
              </button>
              <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                {equipoViendo.nombre}
              </h1>
              <p className="text-slate-600 mt-1">Categoría: {equipoViendo.categoria} • {jugadores.length} jugadores registrados</p>
            </div>
            
            <button 
              onClick={abrirModalParaCrear}
              className="btn-primary whitespace-nowrap"
            >
              <Plus size={20} /> Nuevo Jugador
            </button>
          </div>

          {/* === NUEVO: BARRA DE BÚSQUEDA === */}
          <div className="mb-4 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="text-slate-400" size={20} />
            </div>
            <input
              type="text"
              placeholder="Buscar por nombre, apellido, cédula o dorsal..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="field pl-10"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-[640px] w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="p-4 font-semibold w-24">Dorsal</th>
                  <th className="p-4 font-semibold">Jugador</th>
                  <th className="p-4 font-semibold hidden sm:table-cell">Cédula</th>
                  <th className="p-4 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {jugadoresFiltradosYOrdenados.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      {jugadores.length === 0 
                        ? 'Este equipo aún no tiene jugadores registrados.' 
                        : 'No se encontraron jugadores que coincidan con la búsqueda.'}
                    </td>
                  </tr>
                ) : (
                  jugadoresFiltradosYOrdenados.map((jugador) => (
                    <tr key={jugador.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="p-4">
                        <span className="bg-slate-800 text-white w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold font-mono">
                          {jugador.numeroDorsal}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-slate-800">
                        {jugador.nombres} {jugador.apellidos}
                      </td>
                      <td className="p-4 text-slate-600 hidden sm:table-cell">{jugador.cedula}</td>
                      <td className="p-4 flex justify-end gap-2">
                        <button onClick={() => abrirModalParaEditar(jugador)} className="p-2 text-slate-400 hover:text-blue-600 transition rounded hover:bg-blue-50" title="Editar">
                          <Edit size={18} />
                        </button>
                        <button onClick={() => setJugadorParaEliminar({ id: jugador.id, nombreCompleto: `${jugador.nombres} ${jugador.apellidos}` })} className="p-2 text-slate-400 hover:text-red-600 transition rounded hover:bg-red-50" title="Eliminar">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* MODAL DE FORMULARIO */}
      {mostrarModal && equipoViendo && (
        <div className="modal-overlay bg-slate-900/50">
          <div className="modal-card max-w-lg">
            <div className="modal-header flex items-start justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-800">
                {jugadorSeleccionadoId ? 'Modificar Jugador' : `Nuevo Jugador para ${equipoViendo.nombre}`}
              </h2>
              <button onClick={() => setMostrarModal(false)} className="text-slate-400 hover:text-slate-600 transition bg-slate-100 hover:bg-slate-200 p-2 rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={guardarJugador} className="flex min-h-0 flex-1 flex-col">
              <div className="modal-body">
              <div className="grid gap-4 mb-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombres</label>
                  <input type="text" required value={nombres} onChange={(e) => setNombres(e.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Apellidos</label>
                  <input type="text" required value={apellidos} onChange={(e) => setApellidos(e.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition" />
                </div>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cédula</label>
                  <input type="text" required value={cedula} onChange={(e) => setCedula(e.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Número Dorsal</label>
                  <input type="number" required value={numeroDorsal} onChange={(e) => setNumeroDorsal(e.target.value !== '' ? Number(e.target.value) : '')} className={`w-full border rounded-lg px-4 py-2 font-mono font-bold focus:outline-none focus:ring-1 transition ${dorsalOcupado ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500'}`} />
                  {dorsalOcupado && <p className="mt-1 text-xs font-bold text-red-600">Ese dorsal ya está ocupado en este equipo.</p>}
                </div>
              </div>

              </div>

              <div className="modal-footer flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setMostrarModal(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition">Cancelar</button>
                <button type="submit" disabled={dorsalOcupado} className="btn-primary disabled:opacity-50">
                  {jugadorSeleccionadoId ? 'Guardar Cambios' : 'Registrar Jugador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={Boolean(jugadorParaEliminar)}
        title="Esta seguro de eliminar este jugador?"
        description={`Se eliminara a ${jugadorParaEliminar?.nombreCompleto ?? 'este jugador'} de la plantilla local.`}
        confirmLabel="Eliminar jugador"
        variant="danger"
        irreversible
        onCancel={() => setJugadorParaEliminar(null)}
        onConfirm={() => jugadorParaEliminar ? borrarJugador(jugadorParaEliminar.id) : undefined}
      />
    </div>
  );
};

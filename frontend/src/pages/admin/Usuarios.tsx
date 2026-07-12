import { useEffect, useMemo, useState } from 'react';
import { Save, ToggleLeft, ToggleRight, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import type { Usuario, UserRole } from '@saas/shared';
import { usuariosService, type UsuarioInput } from '../../services/usuarios.service';

const roles: UserRole[] = ['ADMIN_LIGA', 'ORGANIZADOR', 'VOCAL', 'ARBITRO', 'DELEGADO', 'CONSULTA'];

const inicial: UsuarioInput = { nombre: '', apellido: '', email: '', role: 'VOCAL', activo: true, cedula: '', telefono: '' };

export const UsuariosAdmin = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [form, setForm] = useState<UsuarioInput>(inicial);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');

  const cargar = async () => setUsuarios(await usuariosService.obtenerTodos());

  useEffect(() => {
    void Promise.resolve().then(cargar);
  }, []);

  const usuariosFiltrados = useMemo(() => {
    const texto = filtro.toLowerCase();
    return usuarios.filter((usuario) => `${usuario.nombre} ${usuario.apellido ?? ''} ${usuario.email} ${usuario.role}`.toLowerCase().includes(texto));
  }, [filtro, usuarios]);

  const guardar = async () => {
    try {
      if (editandoId) await usuariosService.actualizar(editandoId, form);
      else await usuariosService.crear(form);
      toast.success(editandoId ? 'Usuario actualizado.' : 'Usuario creado.');
      setForm(inicial);
      setEditandoId(null);
      await cargar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el usuario.');
    }
  };

  const editar = (usuario: Usuario) => {
    setEditandoId(usuario.id);
    setForm({
      nombre: usuario.nombre,
      apellido: usuario.apellido ?? '',
      email: usuario.email,
      role: usuario.role,
      activo: usuario.activo,
      cedula: usuario.cedula ?? '',
      telefono: usuario.telefono ?? '',
    });
  };

  return (
    <div className="space-y-5">
      <section className="surface-strong p-5">
        <p className="text-sm font-black uppercase text-emerald-600">Administracion</p>
        <h1 className="text-2xl font-black text-slate-950">Usuarios, vocales y arbitros</h1>
      </section>

      <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="surface p-5">
          <h2 className="flex items-center gap-2 text-lg font-black"><UserPlus size={20} /> {editandoId ? 'Editar usuario' : 'Nuevo usuario'}</h2>
          <div className="mt-4 grid gap-3">
            <input className="field" placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            <input className="field" placeholder="Apellido" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} />
            <input className="field" placeholder="Correo" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="field" placeholder="Cedula" value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} />
            <input className="field" placeholder="Telefono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            <select className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
              {roles.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
            <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold">
              Usuario activo
              <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
            </label>
            <button className="btn-primary inline-flex items-center justify-center gap-2" onClick={guardar}><Save size={18} /> Guardar</button>
          </div>
        </div>

        <div className="surface p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-black">Directorio operativo</h2>
            <input className="field md:w-72" placeholder="Buscar..." value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          </div>
          <div className="mt-4 grid gap-3">
            {usuariosFiltrados.map((usuario) => (
              <div key={usuario.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
                <div>
                  <p className="font-black">{usuario.nombre} {usuario.apellido}</p>
                  <p className="text-sm text-slate-500">{usuario.email}</p>
                  <span className="badge mt-2 bg-emerald-100 text-emerald-700">{usuario.role}</span>
                </div>
                <button className="btn-secondary" onClick={() => editar(usuario)}>Editar</button>
                <button className="btn-secondary inline-flex items-center justify-center gap-2" onClick={async () => { await usuariosService.cambiarActivo(usuario.id, !usuario.activo); await cargar(); }}>
                  {usuario.activo ? <ToggleRight size={18} /> : <ToggleLeft size={18} />} {usuario.activo ? 'Activo' : 'Inactivo'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

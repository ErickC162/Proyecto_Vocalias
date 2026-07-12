import type { Usuario, UserRole } from '@saas/shared';
import { db } from '../db/dexie';

export type UsuarioInput = Pick<Usuario, 'nombre' | 'apellido' | 'email' | 'role' | 'activo'> & {
  cedula?: string;
  telefono?: string;
};

function normalizar(input: UsuarioInput): Usuario {
  const ahora = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    nombre: input.nombre.trim(),
    apellido: input.apellido?.trim(),
    nombres: input.nombre.trim(),
    apellidos: input.apellido?.trim(),
    nombreCompleto: [input.nombre.trim(), input.apellido?.trim()].filter(Boolean).join(' '),
    email: input.email.trim().toLowerCase(),
    cedula: input.cedula?.trim(),
    telefono: input.telefono?.trim(),
    role: input.role,
    rol: input.role,
    ligaId: 'liga-1',
    activo: input.activo,
    creadoEn: ahora,
    actualizadoEn: ahora,
  };
}

async function validarUnicidad(input: UsuarioInput, usuarioId?: string) {
  const email = input.email.trim().toLowerCase();
  const existenteEmail = await db.usuarios.where('email').equals(email).first();
  if (existenteEmail && existenteEmail.id !== usuarioId) throw new Error('Ya existe un usuario con ese correo.');

  if (input.cedula?.trim()) {
    const existenteCedula = await db.usuarios.where('cedula').equals(input.cedula.trim()).first();
    if (existenteCedula && existenteCedula.id !== usuarioId) throw new Error('Ya existe un usuario con esa cedula.');
  }
}

export const usuariosService = {
  obtenerTodos: async (): Promise<Usuario[]> => {
    return (await db.usuarios.toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  },

  obtenerPorId: async (id: string): Promise<Usuario | undefined> => {
    return await db.usuarios.get(id);
  },

  obtenerPorEmail: async (email: string): Promise<Usuario | undefined> => {
    return await db.usuarios.where('email').equals(email.trim().toLowerCase()).first();
  },

  obtenerActivosPorRol: async (role: UserRole): Promise<Usuario[]> => {
    return await db.usuarios.where('role').equals(role).and((usuario) => usuario.activo).toArray();
  },

  obtenerVocalSeed: async (): Promise<Usuario | undefined> => {
    return await db.usuarios.get('usr-vocal-1');
  },

  crear: async (input: UsuarioInput): Promise<Usuario> => {
    await validarUnicidad(input);
    const usuario = normalizar(input);
    await db.usuarios.add(usuario);
    return usuario;
  },

  actualizar: async (id: string, input: UsuarioInput): Promise<void> => {
    await validarUnicidad(input, id);
    await db.usuarios.update(id, {
      nombre: input.nombre.trim(),
      apellido: input.apellido?.trim(),
      nombres: input.nombre.trim(),
      apellidos: input.apellido?.trim(),
      nombreCompleto: [input.nombre.trim(), input.apellido?.trim()].filter(Boolean).join(' '),
      email: input.email.trim().toLowerCase(),
      cedula: input.cedula?.trim(),
      telefono: input.telefono?.trim(),
      role: input.role,
      rol: input.role,
      activo: input.activo,
      actualizadoEn: new Date().toISOString(),
    });
  },

  cambiarActivo: async (id: string, activo: boolean): Promise<void> => {
    await db.usuarios.update(id, { activo, actualizadoEn: new Date().toISOString() });
  },
};

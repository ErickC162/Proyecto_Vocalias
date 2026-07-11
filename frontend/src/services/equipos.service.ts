import { db } from '../db/dexie';
import type { Equipo } from '@saas/shared';

export const equiposService = {
  obtenerTodos: async (): Promise<Equipo[]> => {
    return await db.equipos.toArray();
  },
  
  obtenerPorId: async (id: string): Promise<Equipo | undefined> => {
    return await db.equipos.get(id);
  },

  crear: async (equipo: Omit<Equipo, 'id'>): Promise<string> => {
    const id = crypto.randomUUID(); 
    await db.equipos.add({ ...equipo, id });
    return id;
  },

  actualizar: async (id: string, cambios: Partial<Equipo>): Promise<void> => {
    await db.equipos.update(id, cambios);
  },

  eliminar: async (id: string): Promise<void> => {
    await db.equipos.delete(id);
  }
};
import type { Partido } from '@saas/shared';
import { db } from '../db/dexie';

export const partidosService = {
  obtenerTodos: async (): Promise<Partido[]> => {
    return await db.partidos.toArray();
  },

  obtenerPorId: async (id: string): Promise<Partido | undefined> => {
    return await db.partidos.get(id);
  },

  actualizar: async (id: string, cambios: Partial<Partido>): Promise<void> => {
    await db.partidos.update(id, cambios);
  },
};

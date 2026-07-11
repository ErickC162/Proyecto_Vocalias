import { db } from '../db/dexie';
import type { Partido } from '@saas/shared';

export const partidosService = {
  obtenerTodos: async (): Promise<Partido[]> => {
    return await db.partidos.toArray();
  },

  // Ajustado a 'vocalId' como está en tu dexie.ts
  obtenerPorVocal: async (vocalId: string): Promise<Partido[]> => {
    return await db.partidos.where('idVocalAsignado').equals(vocalId).toArray();
  },

  obtenerPorId: async (id: string): Promise<Partido | undefined> => {
    return await db.partidos.get(id);
  }
};
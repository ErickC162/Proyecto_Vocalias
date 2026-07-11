import { db } from '../db/dexie';
import type { Jugador } from '@saas/shared';

export const jugadoresService = {
  // === LEER ===
  obtenerTodos: async (): Promise<Jugador[]> => {
    return await db.jugadores.toArray();
  },
  
  obtenerPorEquipo: async (equipoId: string): Promise<Jugador[]> => {
    // Busca específicamente usando el índice 'equipoId' que configuramos en Dexie
    return await db.jugadores.where('equipoId').equals(equipoId).toArray();
  },

  obtenerPorId: async (id: string): Promise<Jugador | undefined> => {
    return await db.jugadores.get(id);
  },

  // === CREAR ===
  crear: async (jugador: Omit<Jugador, 'id'>): Promise<string> => {
    const id = crypto.randomUUID(); 
    await db.jugadores.add({ ...jugador, id });
    return id;
  },

  // === ACTUALIZAR ===
  actualizar: async (id: string, cambios: Partial<Jugador>): Promise<void> => {
    await db.jugadores.update(id, cambios);
  },

  // === ELIMINAR ===
  eliminar: async (id: string): Promise<void> => {
    await db.jugadores.delete(id);
  }
};
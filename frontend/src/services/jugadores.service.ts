import type { Jugador } from '@saas/shared';
import { db } from '../db/dexie';

export class DorsalDuplicadoError extends Error {
  constructor(numeroDorsal: number) {
    super(`El numero ${numeroDorsal} ya esta asignado a otro jugador de este equipo.`);
    this.name = 'DorsalDuplicadoError';
  }
}

async function validarDorsalDisponible(equipoId: string, numeroDorsal: number, jugadorIdActual?: string) {
  if (!Number.isInteger(numeroDorsal) || numeroDorsal <= 0) {
    throw new Error('El numero de camiseta debe ser un entero positivo.');
  }

  const existente = await db.jugadores
    .where('[equipoId+numeroDorsal]')
    .equals([equipoId, numeroDorsal])
    .first();

  if (existente && existente.id !== jugadorIdActual) {
    throw new DorsalDuplicadoError(numeroDorsal);
  }
}

export const jugadoresService = {
  obtenerTodos: async (): Promise<Jugador[]> => {
    return await db.jugadores.toArray();
  },

  obtenerPorEquipo: async (equipoId: string): Promise<Jugador[]> => {
    return await db.jugadores.where('equipoId').equals(equipoId).sortBy('numeroDorsal');
  },

  obtenerPorId: async (id: string): Promise<Jugador | undefined> => {
    return await db.jugadores.get(id);
  },

  validarDorsalDisponible,

  crear: async (jugador: Omit<Jugador, 'id'>): Promise<string> => {
    await validarDorsalDisponible(jugador.equipoId, jugador.numeroDorsal);
    const id = crypto.randomUUID();
    await db.jugadores.add({ ...jugador, id });
    return id;
  },

  actualizar: async (id: string, cambios: Partial<Jugador>): Promise<void> => {
    const actual = await db.jugadores.get(id);
    if (!actual) throw new Error('No se encontro el jugador.');

    const equipoId = cambios.equipoId ?? actual.equipoId;
    const numeroDorsal = cambios.numeroDorsal ?? actual.numeroDorsal;
    await validarDorsalDisponible(equipoId, numeroDorsal, id);
    await db.jugadores.update(id, cambios);
  },

  eliminar: async (id: string): Promise<void> => {
    await db.jugadores.delete(id);
  },
};

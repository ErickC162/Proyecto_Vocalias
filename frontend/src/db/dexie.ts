import Dexie, { type Table } from 'dexie';
import type { 
  Usuario, Liga, Torneo, Equipo, 
  Jugador, Partido, EventoPartido, Sancion 
} from '@saas/shared';

export class SaasDatabase extends Dexie {
  // Declaramos las "tablas" y el tipo de dato de su llave primaria (string UUID)
  usuarios!: Table<Usuario, string>;
  ligas!: Table<Liga, string>;
  torneos!: Table<Torneo, string>;
  equipos!: Table<Equipo, string>;
  jugadores!: Table<Jugador, string>;
  partidos!: Table<Partido, string>;
  eventos!: Table<EventoPartido, string>;
  sanciones!: Table<Sancion, string>;

  constructor() {
    super('SaasLigasBarrialesDB');
    
    // Definimos el esquema. 
    // NOTA: En Dexie solo se declaran las columnas por las que vas a filtrar o buscar.
    this.version(1).stores({
      usuarios: 'id, rol, ligaId',
      ligas: 'id',
      torneos: 'id, ligaId, estado',
      equipos: 'id, torneoId',
      jugadores: 'id, equipoId, cedula, estadoHabilitacion',
      partidos: 'id, torneoId, equipoLocalId, equipoVisitanteId, idVocalAsignado, estado',
      eventos: 'id, partidoId, equipoId, jugadorId, tipoEvento',
      sanciones: 'id, jugadorId, estado'
    });
  }
}

// Exportamos una única instancia para usarla en toda la app
export const db = new SaasDatabase();


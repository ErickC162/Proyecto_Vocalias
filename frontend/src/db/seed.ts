import { db } from './dexie';

export async function poblarBaseDeDatosInicial() {
  // Verificamos si ya hay ligas. Si hay, no hacemos nada.
  const conteoLigas = await db.ligas.count();
  if (conteoLigas > 0) return;

  console.log('Inyectando datos de prueba en la base local...');

  const ligaId = 'liga-1';
  const torneoId = 'torneo-1';
  const equipoLocalId = 'eq-local';
  const equipoVisitaId = 'eq-visita';

  await db.transaction('rw', db.ligas, db.torneos, db.equipos, db.jugadores, async () => {
    // 1. Crear Liga y Torneo
    await db.ligas.add({ id: ligaId, nombre: 'Liga de Prueba' });
    await db.torneos.add({ id: torneoId, ligaId, nombre: 'Apertura 2026', estado: 'PLANIFICACION' });

    // 2. Crear Equipos
    await db.equipos.bulkAdd([
      { id: equipoLocalId, torneoId, nombre: 'Boca Juniors Amateur', representanteId: 'rep-1', categoria: 'Máxima' },
      { id: equipoVisitaId, torneoId, nombre: 'Real Madrid de Los Andes', representanteId: 'rep-2', categoria: 'Máxima' }
    ]);

    // 3. Crear Jugadores de prueba (Mínimo 1 por equipo para probar)
    await db.jugadores.bulkAdd([
      {
        id: 'jug-1', equipoId: equipoLocalId, nombres: 'Juan', apellidos: 'Pérez', cedula: '1700000001',
        fotoUrl: '', numeroDorsal: 10, estadoHabilitacion: 'HABILITADO', fechaNacimiento: Date.now()
      },
      {
        id: 'jug-2', equipoId: equipoVisitaId, nombres: 'Carlos', apellidos: 'Mena', cedula: '1700000002',
        fotoUrl: '', numeroDorsal: 9, estadoHabilitacion: 'HABILITADO', fechaNacimiento: Date.now()
      }
    ]);
  });

  console.log('¡Datos iniciales cargados con éxito!');
}
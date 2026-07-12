import type {
  Campeonato,
  Cancha,
  Categoria,
  Equipo,
  FechaCampeonato,
  InscripcionEquipo,
  Jornada,
  Jugador,
  Liga,
  Torneo,
  Usuario,
} from '@saas/shared';
import { db } from './dexie';

const ahoraIso = () => new Date().toISOString();
const ligaId = 'liga-1';
const torneoId = 'torneo-1';
const campeonatoId = 'camp-1';
const categoriaId = 'cat-maxima';

const equiposBase = [
  ['eq-local', 'Boca Juniors Amateur', 'Boca Amateur'],
  ['eq-visita', 'Real Madrid de Los Andes', 'Real Andes'],
  ['eq-barcelona', 'Barcelona del Barrio', 'Barcelona B.'],
  ['eq-central', 'Atletico Central', 'Central'],
  ['eq-quito-sur', 'Deportivo Quito Sur', 'Quito Sur'],
  ['eq-san-jose', 'San Jose FC', 'San Jose'],
  ['eq-halcones', 'Los Halcones', 'Halcones'],
  ['eq-union-familiar', 'Union Familiar', 'Union Fam.'],
  ['eq-estrella-roja', 'Estrella Roja', 'E. Roja'],
  ['eq-juventud', 'Juventud Deportiva', 'Juventud'],
  ['eq-independiente', 'Independiente Barrial', 'Ind. Barrial'],
  ['eq-sporting-norte', 'Sporting Norte', 'Sporting'],
] as const;

function usuarioSeed(usuario: Usuario): Usuario {
  return {
    ...usuario,
    nombres: usuario.nombres ?? usuario.nombre,
    apellidos: usuario.apellidos ?? usuario.apellido,
    nombreCompleto: usuario.nombreCompleto ?? [usuario.nombre, usuario.apellido].filter(Boolean).join(' '),
    rol: usuario.rol ?? usuario.role,
    creadoEn: usuario.creadoEn ?? ahoraIso(),
    actualizadoEn: usuario.actualizadoEn ?? ahoraIso(),
  };
}

function jugadorSeed(equipoId: string, indiceEquipo: number, dorsal: number): Jugador {
  const nombres = ['Juan', 'Mario', 'Luis', 'Pedro', 'Diego', 'Fabian', 'Marco', 'Santiago', 'Kevin', 'Andres', 'Nicolas', 'Jose', 'Cristian', 'Raul', 'Ivan'];
  const apellidos = ['Perez', 'Lema', 'Castro', 'Vera', 'Nunez', 'Mora', 'Ruiz', 'Arias', 'Soto', 'Paz', 'Mina', 'Lopez', 'Vega', 'Rios', 'Molina'];
  const posicion = dorsal === 1 || dorsal === 12 ? 'Arquero' : dorsal <= 5 ? 'Defensa' : dorsal <= 9 ? 'Medio' : 'Delantero';
  return {
    id: `${equipoId}-${String(dorsal).padStart(2, '0')}`,
    equipoId,
    nombres: nombres[(dorsal + indiceEquipo) % nombres.length],
    apellidos: apellidos[(dorsal + indiceEquipo * 2) % apellidos.length],
    cedula: `${17 + indiceEquipo}${String(indiceEquipo).padStart(2, '0')}${String(dorsal).padStart(6, '0')}`,
    fechaNacimiento: 820454400000,
    fotoUrl: '',
    numeroDorsal: dorsal,
    posicion,
    esArquero: posicion === 'Arquero',
    activo: true,
    habilitado: true,
    estadoHabilitacion: 'HABILITADO',
  };
}

function validarDorsalesUnicos(jugadores: Jugador[]) {
  const porEquipo = new Map<string, Map<number, string>>();
  for (const jugador of jugadores) {
    const dorsales = porEquipo.get(jugador.equipoId) ?? new Map<number, string>();
    const existente = dorsales.get(jugador.numeroDorsal);
    if (existente && existente !== jugador.id) throw new Error(`El numero ${jugador.numeroDorsal} esta duplicado en el equipo ${jugador.equipoId}.`);
    dorsales.set(jugador.numeroDorsal, jugador.id);
    porEquipo.set(jugador.equipoId, dorsales);
  }
}

export async function poblarBaseDeDatosInicial() {
  const usuarios: Usuario[] = [
    usuarioSeed({ id: 'usr-admin-1', nombre: 'Andrea', apellido: 'Administrador', email: 'admin@liga.local', role: 'ADMIN_LIGA', ligaId, activo: true, cedula: '0100000001' }),
    usuarioSeed({ id: 'usr-organizador-1', nombre: 'Oscar', apellido: 'Organizador', email: 'organizador@liga.local', role: 'ORGANIZADOR', ligaId, activo: true, cedula: '0100000002' }),
    usuarioSeed({ id: 'usr-vocal-1', nombre: 'Valeria', apellido: 'Vocal', email: 'vocal@liga.local', role: 'VOCAL', ligaId, activo: true, cedula: '0100000003' }),
    usuarioSeed({ id: 'usr-vocal-2', nombre: 'Vicente', apellido: 'Mesa', email: 'vocal2@liga.local', role: 'VOCAL', ligaId, activo: true, cedula: '0100000004' }),
    usuarioSeed({ id: 'usr-arbitro-1', nombre: 'Arturo', apellido: 'Arbitro', email: 'arbitro@liga.local', role: 'ARBITRO', ligaId, activo: true, cedula: '0100000005' }),
    usuarioSeed({ id: 'usr-arbitro-2', nombre: 'Rene', apellido: 'Central', email: 'arbitro2@liga.local', role: 'ARBITRO', ligaId, activo: true, cedula: '0100000006' }),
    usuarioSeed({ id: 'usr-delegado-1', nombre: 'Daniela', apellido: 'Delegada', email: 'delegado@liga.local', role: 'DELEGADO', ligaId, activo: true, cedula: '0100000007' }),
    usuarioSeed({ id: 'usr-delegado-2', nombre: 'Mauro', apellido: 'Delegado', email: 'delegado2@liga.local', role: 'DELEGADO', ligaId, activo: true, cedula: '0100000008' }),
  ];

  const ligas: Liga[] = [{ id: ligaId, nombre: 'Liga Barrial de Prueba' }];
  const torneos: Torneo[] = [{ id: torneoId, ligaId, nombre: 'Apertura 2026', estado: 'EN_CURSO' }];
  const campeonatos: Campeonato[] = [{
    id: campeonatoId,
    ligaId,
    nombre: 'Campeonato Barrial Apertura 2026',
    temporada: '2026',
    fechaInicio: '2026-07-18',
    fechaFin: '2026-12-27',
    cantidadFechas: 24,
    estado: 'ACTIVO',
    puntosVictoria: 3,
    puntosEmpate: 1,
    puntosDerrota: 0,
    amarillasParaSuspension: 3,
    creadoEn: ahoraIso(),
  }];
  const categorias: Categoria[] = [
    { id: categoriaId, campeonatoId, nombre: 'Maxima', activa: true },
    { id: 'cat-senior', campeonatoId, nombre: 'Senior', edadMinima: 35, activa: true },
  ];
  const canchas: Cancha[] = [
    { id: 'cancha-central', nombre: 'Cancha Central de la Liga', direccion: 'Sede principal', activa: true },
    { id: 'cancha-norte', nombre: 'Cancha Norte', direccion: 'Barrio Norte', activa: true },
    { id: 'cancha-sur', nombre: 'Cancha Sur', direccion: 'Barrio Sur', activa: true },
  ];
  const jornadas: Jornada[] = Array.from({ length: 24 }, (_, index) => {
    const numero = index + 1;
    const inicio = new Date(Date.UTC(2026, 6, 18 + index * 7));
    const fin = new Date(Date.UTC(2026, 6, 19 + index * 7));
    return {
      id: `jor-${numero}`,
      campeonatoId,
      numero,
      nombre: `Fecha ${numero}`,
      fechaInicio: inicio.toISOString().slice(0, 10),
      fechaFin: fin.toISOString().slice(0, 10),
      estado: numero === 1 ? 'EN_CURSO' : 'PROGRAMADA',
    };
  });
  const fechasCampeonato: FechaCampeonato[] = jornadas;

  const equipos: Equipo[] = equiposBase.map(([id, nombre, nombreCorto], index) => ({
    id,
    torneoId,
    campeonatoId,
    categoriaId,
    nombre,
    nombreCorto,
    representanteId: index % 2 === 0 ? 'usr-delegado-1' : 'usr-delegado-2',
    delegadoId: index % 2 === 0 ? 'usr-delegado-1' : 'usr-delegado-2',
    categoria: 'Maxima',
    activo: true,
    creadoEn: ahoraIso(),
  }));
  const inscripciones: InscripcionEquipo[] = equipos.map((equipo) => ({
    id: `${campeonatoId}-${equipo.id}`,
    campeonatoId,
    equipoId: equipo.id,
    categoriaId: equipo.categoriaId,
    activa: true,
    inscritaEn: equipo.creadoEn ?? ahoraIso(),
  }));

  const jugadores = equipos.flatMap((equipo, equipoIndex) => Array.from({ length: 15 }, (_, index) => jugadorSeed(equipo.id, equipoIndex, index + 1)));
  validarDorsalesUnicos(jugadores);

  await db.transaction(
    'rw',
    [
      db.usuarios,
      db.ligas,
      db.torneos,
      db.campeonatos,
      db.categorias,
      db.canchas,
      db.jornadas,
      db.fechasCampeonato,
      db.equipos,
      db.inscripcionesEquipo,
      db.jugadores,
    ],
    async () => {
      for (const usuario of usuarios) if (!(await db.usuarios.get(usuario.id))) await db.usuarios.add(usuario);
      for (const liga of ligas) if (!(await db.ligas.get(liga.id))) await db.ligas.add(liga);
      for (const torneo of torneos) if (!(await db.torneos.get(torneo.id))) await db.torneos.add(torneo);
      for (const campeonato of campeonatos) if (!(await db.campeonatos.get(campeonato.id))) await db.campeonatos.add(campeonato);
      for (const categoria of categorias) if (!(await db.categorias.get(categoria.id))) await db.categorias.add(categoria);
      for (const cancha of canchas) if (!(await db.canchas.get(cancha.id))) await db.canchas.add(cancha);
      for (const jornada of jornadas) if (!(await db.jornadas.get(jornada.id))) await db.jornadas.add(jornada);
      for (const fecha of fechasCampeonato) if (!(await db.fechasCampeonato.get(fecha.id))) await db.fechasCampeonato.add(fecha);
      for (const equipo of equipos) if (!(await db.equipos.get(equipo.id))) await db.equipos.add(equipo);
      for (const inscripcion of inscripciones) if (!(await db.inscripcionesEquipo.get(inscripcion.id))) await db.inscripcionesEquipo.add(inscripcion);
      for (const jugador of jugadores) if (!(await db.jugadores.get(jugador.id))) await db.jugadores.add(jugador);
    },
  );
}

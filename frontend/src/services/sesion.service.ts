import type { SesionLocal, Usuario } from '@saas/shared';
import { usuariosService } from './usuarios.service';

const CLAVE_SESION = 'vocalias.sesionLocal';

function leerSesion(): SesionLocal | null {
  const valor = window.localStorage.getItem(CLAVE_SESION);
  if (!valor) return null;

  try {
    const sesion = JSON.parse(valor) as SesionLocal;
    return sesion.usuarioId && sesion.iniciadaEn ? sesion : null;
  } catch {
    window.localStorage.removeItem(CLAVE_SESION);
    return null;
  }
}

export const sesionService = {
  iniciarComoUsuario: (usuarioId: string): SesionLocal => {
    const sesion: SesionLocal = {
      usuarioId,
      iniciadaEn: new Date().toISOString(),
    };
    window.localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    return sesion;
  },

  iniciarComoVocalSeed: async (): Promise<Usuario> => {
    const vocal = await usuariosService.obtenerVocalSeed();
    if (!vocal || !vocal.activo || vocal.role !== 'VOCAL') {
      throw new Error('No se encontro un vocal activo en los datos iniciales.');
    }
    sesionService.iniciarComoUsuario(vocal.id);
    return vocal;
  },

  obtenerSesion: (): SesionLocal | null => {
    return leerSesion();
  },

  obtenerUsuarioActivo: async (): Promise<Usuario | null> => {
    const sesion = leerSesion();
    if (!sesion) return null;
    const usuario = await usuariosService.obtenerPorId(sesion.usuarioId);
    return usuario && usuario.activo ? usuario : null;
  },

  cerrarSesion: () => {
    window.localStorage.removeItem(CLAVE_SESION);
  },
};

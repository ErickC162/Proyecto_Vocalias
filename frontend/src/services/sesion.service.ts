import type { SesionLocal, UserRole, Usuario } from '@saas/shared';
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
  iniciarConCredenciales: async (email: string, password: string, rolesPermitidos?: UserRole[]): Promise<Usuario> => {
    const usuario = await usuariosService.obtenerPorEmail(email);
    if (!usuario || !usuario.activo) throw new Error('Correo o contrasena incorrectos.');
    if (usuario.password !== password) throw new Error('Correo o contrasena incorrectos.');
    if (rolesPermitidos?.length && !rolesPermitidos.includes(usuario.role)) {
      throw new Error('El usuario no tiene permisos para este acceso.');
    }
    sesionService.iniciarComoUsuario(usuario.id);
    return usuario;
  },

  iniciarComoUsuario: (usuarioId: string): SesionLocal => {
    const sesion: SesionLocal = {
      usuarioId,
      iniciadaEn: new Date().toISOString(),
    };
    window.localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    return sesion;
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

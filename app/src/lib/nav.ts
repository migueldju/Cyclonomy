import { router } from 'expo-router';

/** Navega a una pantalla raíz cerrando antes todo lo apilado (al cambiar de liga, entrar o salir) */
export function resetTo(path: string) {
  if (router.canDismiss()) router.dismissAll();
  router.replace(path);
}

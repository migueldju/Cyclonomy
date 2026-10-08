import { t } from '../i18n';

/** Qué se corre ese día: «Prólogo», «Etapa 2/21», «Carrera de un día» o, en una vuelta sin etapa ese día, descanso. */
export function stageLabel(isStageRace: boolean, number: number | null | undefined, lastStage: number): string {
  if (!isStageRace) return t('race.oneDayRace');
  if (number == null) return t('race.restDay');
  if (number === 0) return t('race.prologue');
  return t('race.stageOf', { n: number, total: lastStage });
}

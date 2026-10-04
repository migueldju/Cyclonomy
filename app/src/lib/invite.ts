export function inviteMessage(league: string, code: string) {
  return `Únete a mi liga «${league}» en Cyclonomy.\nCódigo: ${code}\nEnlace: cyclonomy://unirse/${code}`;
}

export function inviteMessage(league: string, code: string) {
  return `Únete a mi liga «${league}» en Fantasy Ciclismo.\nCódigo: ${code}\nEnlace: fantasyciclismo://unirse/${code}`;
}

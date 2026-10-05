import { supabase } from './supabase';
import type {
  CalendarRow, Category, EntryData, League, LeagueSettings, MarketRow, Me, MyLeague, OfferRow, RaceDetail,
  RaceEntries, RankingRow, RiderDetail, RosterRow, ScoringRule, StageScores, StandingRow, TodayRow,
} from './types';

// Todas las escrituras pasan por funciones de Postgres que validan las reglas del juego.
// Si una regla no se cumple, la función lanza un error con un mensaje para el jugador.
async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

async function select<T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as T;
}

export const api = {
  // ligas
  myLeagues: () => rpc<MyLeague[]>('my_leagues'),
  createLeague: (name: string, teamName: string, settings: LeagueSettings, country: string) =>
    rpc<string>('create_league', { p_name: name, p_team_name: teamName, p_settings: settings, p_country: country }),
  joinLeague: (code: string, teamName: string, country: string) =>
    rpc<string>('join_league', { p_code: code, p_team_name: teamName, p_country: country }),
  league: (leagueId: string) => select<League>(supabase.from('league').select('*').eq('id', leagueId).single()),
  updateLeague: (leagueId: string, settings: LeagueSettings) =>
    rpc<void>('update_league_settings', { p_league: leagueId, p_settings: settings }),
  regenerateCode: (leagueId: string) => rpc<string>('regenerate_invite_code', { p_league: leagueId }),
  renameTeam: (leagueId: string, name: string) => rpc<void>('rename_team', { p_league: leagueId, p_team_name: name }),
  updateProfile: (displayName: string | null, avatarUrl: string | null) =>
    rpc<void>('update_profile', { p_display_name: displayName, p_avatar_url: avatarUrl }),

  // lecturas
  me: (leagueId: string) => rpc<Me>('get_me', { p_league: leagueId }),
  standings: (leagueId: string) => rpc<StandingRow[]>('get_standings', { p_league: leagueId }),
  roster: (leagueId: string, memberId?: string) =>
    rpc<RosterRow[]>('get_roster', memberId ? { p_league: leagueId, p_member: memberId } : { p_league: leagueId }),
  market: (leagueId: string) => rpc<MarketRow[]>('get_market', { p_league: leagueId }),
  offers: (leagueId: string) => rpc<OfferRow[]>('get_offers', { p_league: leagueId }),
  calendar: (leagueId: string) => rpc<CalendarRow[]>('get_calendar', { p_league: leagueId }),
  today: (leagueId: string) => rpc<TodayRow[]>('get_today', { p_league: leagueId }),
  stageScores: (leagueId: string, stageId: number) =>
    rpc<StageScores>('get_stage_scores', { p_league: leagueId, p_stage: stageId }),
  raceEntries: (leagueId: string, stageId: number) =>
    rpc<RaceEntries>('get_race_entries', { p_league: leagueId, p_stage: stageId }),
  raceDetail: (leagueId: string, raceId: number) =>
    rpc<RaceDetail>('get_race_detail', { p_league: leagueId, p_race: raceId }),
  ranking: (leagueId: string, limit?: number) =>
    rpc<RankingRow[]>('get_ranking', limit ? { p_league: leagueId, p_limit: limit } : { p_league: leagueId }),
  rider: (leagueId: string, riderId: number) => rpc<RiderDetail>('get_rider', { p_league: leagueId, p_rider: riderId }),
  entry: (leagueId: string, raceId: number) => rpc<EntryData>('get_entry', { p_league: leagueId, p_race: raceId }),
  categories: () => select<Category[]>(supabase.from('race_category').select('*').order('depth_level')),
  scoring: () => select<ScoringRule[]>(supabase.from('scoring_rule').select('*').order('position')),

  // mercado y plantilla
  placeBid: (listingId: number, amount: number) => rpc<void>('place_bid', { p_listing: listingId, p_amount: amount }),
  cancelBid: (listingId: number) => rpc<void>('cancel_bid', { p_listing: listingId }),
  setClause: (ownershipId: number, level: number) =>
    rpc<number>('set_clause', { p_ownership: ownershipId, p_level: level }),
  payClause: (ownershipId: number) => rpc<void>('pay_clause', { p_ownership: ownershipId }),
  setForSale: (ownershipId: number, forSale: boolean) =>
    rpc<void>('set_for_sale', { p_ownership: ownershipId, p_for_sale: forSale }),
  acceptGameOffer: (offerId: number) => rpc<void>('accept_game_offer', { p_offer: offerId }),
  makeOffer: (ownershipId: number, amount: number) => rpc<number>('make_offer', { p_ownership: ownershipId, p_amount: amount }),
  respondOffer: (offerId: number, accept: boolean) => rpc<void>('respond_offer', { p_offer: offerId, p_accept: accept }),
  cancelOffer: (offerId: number) => rpc<void>('cancel_offer', { p_offer: offerId }),
  saveEntry: (leagueId: string, raceId: number, riderIds: number[]) =>
    rpc<void>('save_entry', { p_league: leagueId, p_race: raceId, p_riders: riderIds }),

  // administración de la app (carga manual de datos)
  isAppAdmin: () => rpc<boolean>('is_app_admin'),
  adminLoadStartlist: (raceId: number, slugs: string[]) =>
    rpc<number>('admin_load_startlist', { p_race: raceId, p_slugs: slugs }),
  adminLoadResults: (stageId: number, kind: string, slugs: string[]) =>
    rpc<number>('admin_load_results', { p_stage: stageId, p_kind: kind, p_slugs: slugs }),
};

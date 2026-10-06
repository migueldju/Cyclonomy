// Tipos de lo que devuelven las funciones de Supabase (ver supabase/migrations/0004_rpc.sql)

export type RiderStatus = 'ok' | 'incoming' | 'leaving';
export type PayoutMode = 'per_point' | 'by_position' | 'mixed';

export interface MyLeague {
  league_id: string;
  name: string;
  team_name: string;
  member_id: string;
  is_admin: boolean;
  members: number;
}

export interface Me {
  member_id: string;
  league_id: string;
  league_name: string;
  invite_code: string;
  is_admin: boolean;
  team_name: string;
  display_name: string | null;
  avatar_url: string | null;
  position: number;
  members: number;
  points_total: number;
  points_week: number;
  balance: number;
  team_value: number;
  committed_bids: number;
  debt_limit: number;
  available: number;
  roster_count: number;
  max_riders: number;
  sanctioned_this_week: boolean;
  next_market_at: string;
}

export interface League {
  id: string;
  name: string;
  admin_id: string;
  invite_code: string;
  max_riders: number;
  calendar_depth: number;
  market_size: number;
  market_hour: number;
  clauses_enabled: boolean;
  payout_mode: PayoutMode;
  payout_per_point: number;
  payout_by_position: number[];
  next_market_at: string;
}

export type LeagueSettings = Partial<Omit<League, 'id' | 'admin_id' | 'invite_code' | 'next_market_at'>>;

export interface StandingRow {
  pos: number;
  member_id: string;
  user_id: string;
  team_name: string;
  display_name: string | null;
  avatar_url: string | null;
  points_total: number;
  points_week: number;
  team_value: number;
  country: string | null;
}

export interface RosterRow {
  ownership_id: number;
  rider_id: number;
  rider_name: string;
  pro_team: string | null;
  nationality: string | null;
  age: number | null;
  market_value: number;
  price_paid: number;
  clause: number;
  next_clause: number;
  next_clause_cost: number;
  season_points: number;
  league_points: number;
  status: RiderStatus;
  available_from: string | null;
  for_sale: boolean;
  game_offer_id: number | null;
  game_offer_amount: number | null;
  game_offer_expires: string | null;
  transferable: boolean;
  photo_url: string | null;
}

export interface MarketRow {
  listing_id: number;
  rider_id: number;
  rider_name: string;
  pro_team: string | null;
  nationality: string | null;
  age: number | null;
  base_value: number;
  market_value: number;
  season_points: number;
  closes_at: string;
  bid_count: number;
  my_bid: number | null;
  photo_url: string | null;
  seller_member_id: string | null;      // null: ciclista libre (mercado diario); si no, la venta de un jugador
  seller_team: string | null;
  is_mine: boolean;
  seller_ownership_id: number | null;   // solo en mis ventas: para quitarlas de la venta
  game_offer_id: number | null;         // oferta del juego por mi venta (12 h antes del cierre)
  game_offer_amount: number | null;
  game_offer_expires: string | null;
}

export interface OfferRow {
  offer_id: number;
  direction: 'received' | 'sent';
  ownership_id: number;
  rider_id: number;
  rider_name: string;
  other_team: string;
  amount: number;
  expires_at: string;
}

export interface CalendarRow {
  race_id: number;
  name: string;
  category: string;
  category_name: string;
  country: string | null;
  start_date: string;
  end_date: string;
  is_stage_race: boolean;
  n_stages: number;
  entries_close_at: string;
  entries_open: boolean;
  max_entries: number;
  my_entry_count: number;
  status: 'upcoming' | 'live' | 'finished';
}

export interface TodayRow {
  stage_id: number;
  race_id: number;
  race_name: string;
  category: string;
  number: number;
  start_at: string | null;
  est_finish_at: string | null;
  distance_km: number | null;
  status: 'scheduled' | 'finished' | 'scored';
  my_points: number;
  country: string | null;
}

export interface StageScores {
  stage: {
    id: number; number: number; date: string; status: string; race_id: number; race_name: string; is_stage_race: boolean;
    country: string | null;
  };
  members: {
    member_id: string; team_name: string; points: number; is_mine: boolean; country: string | null;
    riders: { rider_id: number; name: string; points: number }[];      // sus inscritos y lo que puntuó cada uno
  }[];
  riders: {
    rider_id: number; name: string; points: number; owner: string | null; entered_by_me: boolean;
    pro_team: string | null; nationality: string | null; photo_url: string | null; entered_by: string[];
  }[];
}

export interface EntryRider {
  rider_id: number;
  name: string;
  pro_team: string | null;
  nationality: string | null;
  photo_url: string | null;
}

/** Inscripciones de la carrera de una etapa (las de los demás, solo cuando cierra la inscripción) */
export interface RaceEntries {
  race_id: number;
  visible: boolean;
  entries_close_at: string;
  max_entries: number;
  teams: {
    member_id: string; team_name: string; is_mine: boolean; hidden: boolean; entered: boolean; auto: boolean;
    country: string | null;
    riders: EntryRider[];
  }[];
  // lista de salida completa por equipo real; teams = equipos de la liga que han inscrito al corredor
  startlist: {
    team_name: string;
    riders: { rider_id: number | null; name: string; nationality: string | null; bib: number | null;
              photo_url: string | null; teams: string[] }[];
  }[];
}

export interface RaceDetail {
  stages: {
    stage_id: number;
    number: number;
    date: string;
    status: string;
    my_points: number;
    top_member: { team_name: string; points: number } | null;
  }[];
  league_total: { member_id: string; team_name: string; points: number; country: string | null }[];
  gc: { position: number; rider_id: number | null; name: string; nationality: string | null; in_game?: boolean; scored_for: string[] }[];
}

export interface EntryData {
  race: {
    id: number; name: string; category: string; category_name: string; start_date: string; end_date: string;
    entries_close_at: string; country: string | null;
  };
  max_entries: number;
  open: boolean;
  auto: boolean;
  entered: number[];
  has_startlist: boolean;
  riders: {
    rider_id: number;
    name: string;
    pro_team: string | null;
    market_value: number;
    season_points: number;
    on_startlist: boolean;
    available: boolean;
    status: RiderStatus;
  }[];
}

export interface Category {
  code: string;
  name: string;
  depth_level: number;
  max_entries: number;
  is_itt: boolean;
}

export interface ScoringRule {
  category: string;
  kind: string;
  position: number;
  points: number;
}

export interface RankingRow {
  rider_id: number;
  name: string;
  pro_team: string | null;
  nationality: string | null;
  age: number | null;
  market_value: number;
  season_points: number;
  owner_member_id: string | null;
  owner_team: string | null;
  is_mine: boolean;
  photo_url: string | null;
}

export type ResultKind = 'stage' | 'gc' | 'points' | 'kom';

export interface RiderResult {
  stage_id: number | null;          // null: resultado del historial (temporada anterior al juego)
  race_key: string;                 // agrupa los resultados de una misma carrera
  race_start: string;
  race_end: string;
  race_name: string;
  country: string | null;
  category: string;
  is_stage_race: boolean;
  number: number;
  date: string;
  kind: ResultKind;
  position: number;
  points: number;
}

/** Foto de Wikimedia Commons: su licencia obliga a mostrar autor y licencia, con enlace */
export interface RiderPhoto {
  url: string;
  author: string;
  license: string;
  license_url: string | null;
  page_url: string | null;
}

export interface RiderDetail {
  rider: {
    id: number;
    name: string;
    pro_team: string | null;
    nationality: string | null;
    age: number | null;
    market_value: number;
    season_points: number;
    photo: RiderPhoto | null;
  };
  owner: { member_id: string; team_name: string; is_mine: boolean; clause: number } | null;
  values: { day: string; value: number }[];
  results: RiderResult[];
}

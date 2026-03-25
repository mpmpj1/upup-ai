export type ConfidenceLevel = 'low' | 'medium' | 'high';

export type ResearchTaskType =
  | 'initial_thesis'
  | 'follow_up'
  | 'event_update'
  | 'thesis_card'
  | 'out_of_scope';

export type JsonObject = Record<string, unknown>;

export interface CitationItem {
  id?: string;
  title: string;
  url: string;
  publisher?: string;
  snippet?: string;
  source_tier: 1 | 2 | 3;
  source_type: 'filing' | 'media' | 'community' | 'market-data' | 'other';
  source_index?: number;
  created_at?: string;
}

export interface ThesisBlock {
  title: string;
  summary: string;
  evidence?: string[];
}

export interface ScenarioItem {
  name: string;
  probability: ConfidenceLevel;
  description: string;
  signals?: string[];
}

export interface RiskItem {
  title: string;
  impact: ConfidenceLevel;
  description: string;
}

export interface ResearchStance {
  label: string;
  confidence: ConfidenceLevel;
  summary: string;
}

export interface ResearchStructuredOutput {
  task_type: ResearchTaskType;
  market_scope: string;
  subject: string;
  current_view: string;
  direct_answer: string;
  core_judgment: string;
  bull_case: string[];
  bear_case: string[];
  key_variables: string[];
  strongest_counterargument: string;
  mind_change_conditions: string[];
  one_line_takeaway: string;
  facts: string[];
  inference: string[];
  assumptions: string[];
  short_term_catalysts: string[];
  medium_term_drivers: string[];
  long_term_thesis: string[];
  thesis_change_vs_price_action: string;
  impact_on_current_thesis:
    | 'strengthens'
    | 'weakens'
    | 'unchanged'
    | 'new'
    | 'not_applicable';
  thesis_update: string;
  top_things_to_watch: string[];
  watch_list: string[];
  citations: CitationItem[];
  compliance_flags: string[];
  degraded: boolean;
}

export interface ThesisCardContent {
  subject: string;
  current_view: string;
  core_thesis: string;
  bull_case: string[];
  bear_case: string[];
  top_key_variables: string[];
  strongest_counterargument: string;
  mind_change_conditions: string[];
  watch_list: string[];
  last_updated: string;
}

export interface StructuredMessagePayload
  extends Partial<ResearchStructuredOutput> {
  structured_output?: ResearchStructuredOutput | null;
  stance?: ResearchStance | null;
  theses?: {
    bull?: ThesisBlock[];
    bear?: ThesisBlock[];
  } | null;
  scenarios?: ScenarioItem[] | null;
  risks?: RiskItem[] | null;
  citations?: CitationItem[] | null;
  compliance_flags?: string[] | null;
  thesis_card?: ThesisCardContent | null;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  structured_answer?: StructuredMessagePayload | null;
  market_scope?: string;
  entity_context?: JsonObject | null;
  research_run_id?: string | null;
  created_at: string;
}

export interface ResearchConversation {
  id: string;
  user_id: string;
  title: string;
  market_scope?: string;
  entity_context?: JsonObject | null;
  status?: string;
  last_message_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface ThesisCardRecord {
  id: string;
  user_id: string;
  research_run_id?: string | null;
  conversation_id?: string | null;
  source_message_id?: string | null;
  legacy_briefing_id?: string | null;
  card_kind?: 'chat' | 'briefing' | 'manual';
  title: string;
  summary?: string | null;
  query?: string | null;
  market_scope?: string | null;
  entity_context?: JsonObject | null;
  content: ThesisCardContent;
  stance?: ResearchStance | null;
  theses?: {
    bull: ThesisBlock[];
    bear: ThesisBlock[];
  } | null;
  scenarios?: ScenarioItem[] | null;
  risks?: RiskItem[] | null;
  citations?: CitationItem[] | null;
  compliance_flags?: string[] | null;
  provider_snapshot?: JsonObject | null;
  source_summary?: JsonObject | null;
  status?: string | null;
  pinned?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface BriefingCard {
  id: string;
  user_id: string;
  conversation_id?: string | null;
  briefing_type: string;
  market_scope?: string;
  watch_entities?: string[] | JsonObject;
  style_profile?: JsonObject;
  title: string;
  summary?: string;
  content: string;
  stance?: ResearchStance;
  theses?: {
    bull: ThesisBlock[];
    bear: ThesisBlock[];
  };
  scenarios?: ScenarioItem[];
  risks?: RiskItem[];
  citations?: CitationItem[];
  compliance_flags?: string[];
  provider_snapshot?: JsonObject;
  structured_output?: ResearchStructuredOutput | null;
  thesis_card?: ThesisCardContent | null;
  created_at: string;
  updated_at?: string;
}

export interface ProviderConfiguration {
  id: string;
  nickname: string;
  provider: string;
  api_key: string;
  model?: string | null;
  base_url?: string | null;
  provider_type?: string | null;
  extra_headers_json?: JsonObject | null;
  is_openai_compatible?: boolean;
  description?: string | null;
  enabled?: boolean;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProviderProfileSelection {
  configuration_id?: string;
}

export interface ChatResearchRequest {
  query: string;
  conversation_id?: string;
  market_scope?: string;
  entity_context?: JsonObject | null;
  output_mode?: string;
  provider_profile?: ProviderProfileSelection;
}

export interface GenerateBriefingRequest {
  briefing_type: 'market-morning' | 'company-one-pager' | 'event-flash';
  market_scope?: string;
  watch_entities?: string[];
  entity_context?: JsonObject | null;
  provider_profile?: ProviderProfileSelection;
  style_profile?: JsonObject | null;
  conversation_id?: string;
  language?: string;
  output_language?: string;
}

export interface ChatResearchResponse {
  success: boolean;
  conversation: ResearchConversation;
  message: ConversationMessage;
  answer: string;
  structured_output: ResearchStructuredOutput;
  thesis_card?: ThesisCardContent | null;
  stance: ResearchStance;
  theses: {
    bull: ThesisBlock[];
    bear: ThesisBlock[];
  };
  scenarios: ScenarioItem[];
  risks: RiskItem[];
  citations: CitationItem[];
  compliance_flags: string[];
  research_run_id: string;
}

export interface GenerateBriefingResponse {
  success: boolean;
  briefing: BriefingCard;
  answer: string;
  structured_output: ResearchStructuredOutput;
  thesis_card?: ThesisCardContent | null;
  stance: ResearchStance;
  theses: {
    bull: ThesisBlock[];
    bear: ThesisBlock[];
  };
  scenarios: ScenarioItem[];
  risks: RiskItem[];
  citations: CitationItem[];
  compliance_flags: string[];
}

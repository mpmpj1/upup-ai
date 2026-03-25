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
  probability: 'low' | 'medium' | 'high';
  description: string;
  signals?: string[];
}

export interface RiskItem {
  title: string;
  impact: 'low' | 'medium' | 'high';
  description: string;
}

export interface ResearchStance {
  label: string;
  confidence: 'low' | 'medium' | 'high';
  summary: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  structured_answer?: {
    stance?: ResearchStance;
    theses?: {
      bull: ThesisBlock[];
      bear: ThesisBlock[];
    };
    scenarios?: ScenarioItem[];
    risks?: RiskItem[];
    citations?: CitationItem[];
    compliance_flags?: string[];
  } | null;
  market_scope?: string;
  entity_context?: Record<string, any> | null;
  research_run_id?: string | null;
  created_at: string;
}

export interface ResearchConversation {
  id: string;
  user_id: string;
  title: string;
  market_scope?: string;
  entity_context?: Record<string, any> | null;
  status?: string;
  last_message_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface BriefingCard {
  id: string;
  user_id: string;
  conversation_id?: string | null;
  briefing_type: string;
  market_scope?: string;
  watch_entities?: string[] | Record<string, any>;
  style_profile?: Record<string, any>;
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
  provider_snapshot?: Record<string, any>;
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
  extra_headers_json?: Record<string, any> | null;
  is_openai_compatible?: boolean;
  description?: string | null;
  enabled?: boolean;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ChatResearchResponse {
  success: boolean;
  conversation: ResearchConversation;
  message: ConversationMessage;
  answer: string;
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

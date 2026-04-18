export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      badges: {
        Row: {
          code: string
          created_at: string
          criterio: Json
          descricao: string
          icone: string
          id: string
          nome: string
          tipo: string
        }
        Insert: {
          code: string
          created_at?: string
          criterio?: Json
          descricao: string
          icone?: string
          id?: string
          nome: string
          tipo?: string
        }
        Update: {
          code?: string
          created_at?: string
          criterio?: Json
          descricao?: string
          icone?: string
          id?: string
          nome?: string
          tipo?: string
        }
        Relationships: []
      }
      bill_reminders: {
        Row: {
          ativo: boolean
          created_at: string
          dia_vencimento: number
          id: string
          nome: string
          profile_id: string | null
          user_id: string
          valor: number | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dia_vencimento: number
          id?: string
          nome: string
          profile_id?: string | null
          user_id: string
          valor?: number | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dia_vencimento?: number
          id?: string
          nome?: string
          profile_id?: string | null
          user_id?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_reminders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "financial_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          cor_hex: string
          created_at: string
          grupo: Database["public"]["Enums"]["category_group"]
          id: string
          is_default: boolean
          nome: string
          profile_id: string | null
          user_id: string
        }
        Insert: {
          cor_hex?: string
          created_at?: string
          grupo?: Database["public"]["Enums"]["category_group"]
          id?: string
          is_default?: boolean
          nome: string
          profile_id?: string | null
          user_id: string
        }
        Update: {
          cor_hex?: string
          created_at?: string
          grupo?: Database["public"]["Enums"]["category_group"]
          id?: string
          is_default?: boolean
          nome?: string
          profile_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "financial_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      extra_income: {
        Row: {
          created_at: string
          data: string
          hora: string
          id: string
          observacao: string | null
          origem: string
          profile_id: string | null
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string
          hora?: string
          id?: string
          observacao?: string | null
          origem: string
          profile_id?: string | null
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string
          data?: string
          hora?: string
          id?: string
          observacao?: string | null
          origem?: string
          profile_id?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "extra_income_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "financial_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_profiles: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          is_default: boolean
          name: string
          orcamento_mensal: number | null
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_default?: boolean
          name?: string
          orcamento_mensal?: number | null
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_default?: boolean
          name?: string
          orcamento_mensal?: number | null
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          category_id: string | null
          created_at: string
          data_fim_opcional: string | null
          data_inicio: string
          id: string
          nome_meta: string
          periodo_tipo: string
          profile_id: string | null
          tipo_meta: Database["public"]["Enums"]["goal_type"]
          user_id: string
          valor_alvo: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          data_fim_opcional?: string | null
          data_inicio?: string
          id?: string
          nome_meta: string
          periodo_tipo?: string
          profile_id?: string | null
          tipo_meta: Database["public"]["Enums"]["goal_type"]
          user_id: string
          valor_alvo: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          data_fim_opcional?: string | null
          data_inicio?: string
          id?: string
          nome_meta?: string
          periodo_tipo?: string
          profile_id?: string | null
          tipo_meta?: Database["public"]["Enums"]["goal_type"]
          user_id?: string
          valor_alvo?: number
        }
        Relationships: [
          {
            foreignKeyName: "goals_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "financial_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          body: string
          created_at: string
          id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          fuso_horario: string
          id: string
          last_push_sent_at: string | null
          mes_referencia_inicio: number
          name: string
          notif_interval_hours: number
          notifications_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string
          fuso_horario?: string
          id?: string
          last_push_sent_at?: string | null
          mes_referencia_inicio?: number
          name?: string
          notif_interval_hours?: number
          notifications_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          fuso_horario?: string
          id?: string
          last_push_sent_at?: string | null
          mes_referencia_inicio?: number
          name?: string
          notif_interval_hours?: number
          notifications_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_expenses: {
        Row: {
          ativo: boolean
          category_id: string | null
          created_at: string
          dia_vencimento: number
          id: string
          motivo: string
          nome: string
          profile_id: string | null
          tipo_despesa: string
          ultima_geracao_ano_mes: string | null
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          category_id?: string | null
          created_at?: string
          dia_vencimento: number
          id?: string
          motivo?: string
          nome: string
          profile_id?: string | null
          tipo_despesa?: string
          ultima_geracao_ano_mes?: string | null
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          ativo?: boolean
          category_id?: string | null
          created_at?: string
          dia_vencimento?: number
          id?: string
          motivo?: string
          nome?: string
          profile_id?: string | null
          tipo_despesa?: string
          ultima_geracao_ano_mes?: string | null
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "financial_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          category_id: string | null
          created_at: string
          data: string
          descricao: string
          hora: string
          id: string
          motivo: string
          parcela_atual: number | null
          parcela_grupo_id: string | null
          profile_id: string | null
          recorrente: boolean
          recurring_id: string | null
          status: string
          tipo_despesa: string
          total_parcelas: number | null
          user_id: string
          valor: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          data?: string
          descricao?: string
          hora?: string
          id?: string
          motivo?: string
          parcela_atual?: number | null
          parcela_grupo_id?: string | null
          profile_id?: string | null
          recorrente?: boolean
          recurring_id?: string | null
          status?: string
          tipo_despesa?: string
          total_parcelas?: number | null
          user_id: string
          valor: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          data?: string
          descricao?: string
          hora?: string
          id?: string
          motivo?: string
          parcela_atual?: number | null
          parcela_grupo_id?: string | null
          profile_id?: string | null
          recorrente?: boolean
          recurring_id?: string | null
          status?: string
          tipo_despesa?: string
          total_parcelas?: number | null
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "financial_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          badge_id: string
          id: string
          metadata: Json | null
          unlocked_at: string
          user_id: string
        }
        Insert: {
          badge_id: string
          id?: string
          metadata?: Json | null
          unlocked_at?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          id?: string
          metadata?: Json | null
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_streaks: {
        Row: {
          best_streak: number
          current_streak: number
          id: string
          last_check_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          best_streak?: number
          current_streak?: number
          id?: string
          last_check_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          best_streak?: number
          current_streak?: number
          id?: string
          last_check_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      category_group: "essenciais" | "lazer" | "imprevistos" | "besteiras"
      goal_type: "limite_despesas" | "meta_renda_extra" | "limite_categoria"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      category_group: ["essenciais", "lazer", "imprevistos", "besteiras"],
      goal_type: ["limite_despesas", "meta_renda_extra", "limite_categoria"],
    },
  },
} as const

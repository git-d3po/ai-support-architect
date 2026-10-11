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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      assessment_snapshots: {
        Row: {
          created_at: string
          id: string
          inputs: Json
          owner_user_id: string
          provenance: Json
          results: Json
          revision: number
          scoring_version: string
          workflow_attributes: Json
          workflow_attributes_version: number
          workflow_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inputs: Json
          owner_user_id: string
          provenance?: Json
          results: Json
          revision: number
          scoring_version: string
          workflow_attributes: Json
          workflow_attributes_version: number
          workflow_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inputs?: Json
          owner_user_id?: string
          provenance?: Json
          results?: Json
          revision?: number
          scoring_version?: string
          workflow_attributes?: Json
          workflow_attributes_version?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_snapshots_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          industry: string
          monthly_ticket_volume: number
          name: string
          owner_user_id: string
          support_agent_count: number
          support_channels: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          industry?: string
          monthly_ticket_volume?: number
          name: string
          owner_user_id: string
          support_agent_count?: number
          support_channels?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          industry?: string
          monthly_ticket_volume?: number
          name?: string
          owner_user_id?: string
          support_agent_count?: number
          support_channels?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      workflows: {
        Row: {
          accesses_sensitive_data: boolean
          action_type: Database["public"]["Enums"]["action_type"]
          aht_minutes: number
          attributes_version: number
          category: Database["public"]["Enums"]["workflow_category"]
          created_at: string
          current_process: string
          description: string
          handles_account_access: boolean
          id: string
          monthly_volume: number
          name: string
          organization_id: string
          owner_user_id: string
          required_systems: string[]
          updated_at: string
        }
        Insert: {
          accesses_sensitive_data?: boolean
          action_type: Database["public"]["Enums"]["action_type"]
          aht_minutes: number
          attributes_version?: number
          category: Database["public"]["Enums"]["workflow_category"]
          created_at?: string
          current_process?: string
          description?: string
          handles_account_access?: boolean
          id?: string
          monthly_volume: number
          name: string
          organization_id: string
          owner_user_id: string
          required_systems?: string[]
          updated_at?: string
        }
        Update: {
          accesses_sensitive_data?: boolean
          action_type?: Database["public"]["Enums"]["action_type"]
          aht_minutes?: number
          attributes_version?: number
          category?: Database["public"]["Enums"]["workflow_category"]
          created_at?: string
          current_process?: string
          description?: string
          handles_account_access?: boolean
          id?: string
          monthly_volume?: number
          name?: string
          organization_id?: string
          owner_user_id?: string
          required_systems?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      action_type:
        | "read_only"
        | "reversible_write"
        | "irreversible_write"
        | "financial_transaction"
      workflow_category:
        | "billing"
        | "accounts"
        | "product"
        | "technical"
        | "security"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      action_type: [
        "read_only",
        "reversible_write",
        "irreversible_write",
        "financial_transaction",
      ],
      workflow_category: [
        "billing",
        "accounts",
        "product",
        "technical",
        "security",
      ],
    },
  },
} as const

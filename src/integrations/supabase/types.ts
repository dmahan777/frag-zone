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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      clips: {
        Row: {
          caption: string | null
          created_at: string
          game_id: string | null
          id: string
          likes: number
          thumbnail_url: string | null
          user_id: string
          video_url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          game_id?: string | null
          id?: string
          likes?: number
          thumbnail_url?: string | null
          user_id: string
          video_url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          game_id?: string | null
          id?: string
          likes?: number
          thumbnail_url?: string | null
          user_id?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "clips_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      eliminations: {
        Row: {
          created_at: string
          eliminated_id: string
          eliminator_id: string
          game_id: string
          id: string
          points_awarded: number
          proof_url: string | null
          status: string
        }
        Insert: {
          created_at?: string
          eliminated_id: string
          eliminator_id: string
          game_id: string
          id?: string
          points_awarded?: number
          proof_url?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          eliminated_id?: string
          eliminator_id?: string
          game_id?: string
          id?: string
          points_awarded?: number
          proof_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "eliminations_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          game_id: string
          id: string
          message: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          game_id: string
          id?: string
          message: string
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          game_id?: string
          id?: string
          message?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          code: string
          created_at: string
          current_round: number
          host_id: string
          id: string
          mode: string
          name: string
          revive_enabled: boolean
          round_ends_at: string | null
          safe_zones: Json
          status: string
          total_rounds: number
        }
        Insert: {
          code: string
          created_at?: string
          current_round?: number
          host_id: string
          id?: string
          mode?: string
          name: string
          revive_enabled?: boolean
          round_ends_at?: string | null
          safe_zones?: Json
          status?: string
          total_rounds?: number
        }
        Update: {
          code?: string
          created_at?: string
          current_round?: number
          host_id?: string
          id?: string
          mode?: string
          name?: string
          revive_enabled?: boolean
          round_ends_at?: string | null
          safe_zones?: Json
          status?: string
          total_rounds?: number
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string
          game_id: string
          id: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          text?: string
          user_id?: string
        }
        Relationships: []
      }
      player_locations: {
        Row: {
          accuracy: number | null
          battery: number | null
          game_id: string
          lat: number
          lng: number
          speed: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          battery?: number | null
          game_id: string
          lat: number
          lng: number
          speed?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy?: number | null
          battery?: number | null
          game_id?: string
          lat?: number
          lng?: number
          speed?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          game_id: string
          id: string
          joined_at: string
          kills: number
          power_ups: Json
          rank: number | null
          status: string
          survival_days: number
          target_id: string | null
          team_id: string | null
          user_id: string
        }
        Insert: {
          game_id: string
          id?: string
          joined_at?: string
          kills?: number
          power_ups?: Json
          rank?: number | null
          status?: string
          survival_days?: number
          target_id?: string | null
          team_id?: string | null
          user_id: string
        }
        Update: {
          game_id?: string
          id?: string
          joined_at?: string
          kills?: number
          power_ups?: Json
          rank?: number | null
          status?: string
          survival_days?: number
          target_id?: string | null
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          badges: string[]
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          is_premium: boolean
          onboarded: boolean
          phone: string | null
          photo_url: string | null
          school: string | null
          stats: Json
          username: string | null
        }
        Insert: {
          badges?: string[]
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_premium?: boolean
          onboarded?: boolean
          phone?: string | null
          photo_url?: string | null
          school?: string | null
          stats?: Json
          username?: string | null
        }
        Update: {
          badges?: string[]
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_premium?: boolean
          onboarded?: boolean
          phone?: string | null
          photo_url?: string | null
          school?: string | null
          stats?: Json
          username?: string | null
        }
        Relationships: []
      }
      teams: {
        Row: {
          color: string
          created_at: string
          created_by: string
          game_id: string
          id: string
          max_members: number
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by: string
          game_id: string
          id?: string
          max_members?: number
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          game_id?: string
          id?: string
          max_members?: number
          name?: string
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
      [_ in never]: never
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
    Enums: {},
  },
} as const

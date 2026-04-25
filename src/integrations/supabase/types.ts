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
      discipline_years: {
        Row: {
          course_year: Database["public"]["Enums"]["course_year"]
          discipline_id: string
          id: string
        }
        Insert: {
          course_year: Database["public"]["Enums"]["course_year"]
          discipline_id: string
          id?: string
        }
        Update: {
          course_year?: Database["public"]["Enums"]["course_year"]
          discipline_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discipline_years_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "disciplines"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplines: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          course_period: string | null
          created_at: string
          crm: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          course_period?: string | null
          created_at?: string
          crm?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          course_period?: string | null
          created_at?: string
          crm?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_attempts: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          question_id: string
          selected_alternative: string
          simulado_id: string | null
          time_spent_seconds: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct: boolean
          question_id: string
          selected_alternative: string
          simulado_id?: string | null
          time_spent_seconds?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_alternative?: string
          simulado_id?: string | null
          time_spent_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_attempts_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      question_marks: {
        Row: {
          created_at: string
          id: string
          mark: string
          question_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mark: string
          question_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mark?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_marks_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          ai_confidence: number | null
          ai_generated: boolean
          alternatives: Json
          correct_alternative: string
          course_year: Database["public"]["Enums"]["course_year"]
          created_at: string
          created_by: string | null
          difficulty: Database["public"]["Enums"]["difficulty"]
          discipline: string
          exam_board: Database["public"]["Enums"]["exam_board"]
          expected_answer: string | null
          explanation: string
          id: string
          is_ai_unofficial: boolean
          media_caption: string | null
          media_url: string | null
          origin: Database["public"]["Enums"]["question_origin"]
          question_format: Database["public"]["Enums"]["question_format"]
          reference_year: number | null
          review_status: Database["public"]["Enums"]["review_status"]
          reviewed_by: string | null
          reviewer_notes: string | null
          statement: string
          subtopic: string | null
          tags: string[] | null
          type: Database["public"]["Enums"]["question_type"]
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_generated?: boolean
          alternatives: Json
          correct_alternative: string
          course_year?: Database["public"]["Enums"]["course_year"]
          created_at?: string
          created_by?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty"]
          discipline: string
          exam_board?: Database["public"]["Enums"]["exam_board"]
          expected_answer?: string | null
          explanation: string
          id?: string
          is_ai_unofficial?: boolean
          media_caption?: string | null
          media_url?: string | null
          origin?: Database["public"]["Enums"]["question_origin"]
          question_format?: Database["public"]["Enums"]["question_format"]
          reference_year?: number | null
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewed_by?: string | null
          reviewer_notes?: string | null
          statement: string
          subtopic?: string | null
          tags?: string[] | null
          type?: Database["public"]["Enums"]["question_type"]
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          ai_generated?: boolean
          alternatives?: Json
          correct_alternative?: string
          course_year?: Database["public"]["Enums"]["course_year"]
          created_at?: string
          created_by?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty"]
          discipline?: string
          exam_board?: Database["public"]["Enums"]["exam_board"]
          expected_answer?: string | null
          explanation?: string
          id?: string
          is_ai_unofficial?: boolean
          media_caption?: string | null
          media_url?: string | null
          origin?: Database["public"]["Enums"]["question_origin"]
          question_format?: Database["public"]["Enums"]["question_format"]
          reference_year?: number | null
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewed_by?: string | null
          reviewer_notes?: string | null
          statement?: string
          subtopic?: string | null
          tags?: string[] | null
          type?: Database["public"]["Enums"]["question_type"]
          updated_at?: string
        }
        Relationships: []
      }
      simulados: {
        Row: {
          config: Json
          correct_count: number | null
          finished_at: string | null
          id: string
          question_ids: string[]
          score: number | null
          started_at: string
          title: string
          total_questions: number
          user_id: string
        }
        Insert: {
          config?: Json
          correct_count?: number | null
          finished_at?: string | null
          id?: string
          question_ids: string[]
          score?: number | null
          started_at?: string
          title: string
          total_questions: number
          user_id: string
        }
        Update: {
          config?: Json
          correct_count?: number | null
          finished_at?: string | null
          id?: string
          question_ids?: string[]
          score?: number | null
          started_at?: string
          title?: string
          total_questions?: number
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "professor" | "student"
      course_year:
        | "ano_1"
        | "ano_2"
        | "ano_3"
        | "ano_4"
        | "ano_5"
        | "ano_6"
        | "residencia"
        | "geral"
      difficulty: "easy" | "medium" | "hard"
      exam_board:
        | "none"
        | "sp_usp"
        | "sp_unifesp"
        | "sp_santa_casa"
        | "sp_outros"
        | "mg_itajuba"
        | "mg_alfenas"
        | "mg_pouso_alegre"
        | "mg_lavras"
        | "enamed"
      question_format: "multiple_choice" | "open_ended"
      question_origin:
        | "internal"
        | "enamed"
        | "residencia_itajuba"
        | "residencia_alfenas"
        | "residencia_pouso_alegre"
        | "residencia_lavras"
        | "residencia_sp_usp"
        | "residencia_sp_santa_casa"
        | "residencia_sp_outros"
      question_type: "multiple_choice" | "clinical_case" | "true_false"
      review_status: "approved" | "pending_review" | "rejected"
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
      app_role: ["admin", "professor", "student"],
      course_year: [
        "ano_1",
        "ano_2",
        "ano_3",
        "ano_4",
        "ano_5",
        "ano_6",
        "residencia",
        "geral",
      ],
      difficulty: ["easy", "medium", "hard"],
      exam_board: [
        "none",
        "sp_usp",
        "sp_unifesp",
        "sp_santa_casa",
        "sp_outros",
        "mg_itajuba",
        "mg_alfenas",
        "mg_pouso_alegre",
        "mg_lavras",
        "enamed",
      ],
      question_format: ["multiple_choice", "open_ended"],
      question_origin: [
        "internal",
        "enamed",
        "residencia_itajuba",
        "residencia_alfenas",
        "residencia_pouso_alegre",
        "residencia_lavras",
        "residencia_sp_usp",
        "residencia_sp_santa_casa",
        "residencia_sp_outros",
      ],
      question_type: ["multiple_choice", "clinical_case", "true_false"],
      review_status: ["approved", "pending_review", "rejected"],
    },
  },
} as const

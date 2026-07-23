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
      api_keys: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          hashed_key: string
          id: string
          last_used_at: string | null
          name: string
          organization_id: string
          prefix: string
          revoked_at: string | null
          scopes: string[]
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          hashed_key: string
          id?: string
          last_used_at?: string | null
          name: string
          organization_id: string
          prefix: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          hashed_key?: string
          id?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          prefix?: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          organization_id: string
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id: string
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id?: string
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_storage_objects: {
        Row: {
          backup_id: string
          bucket: string
          checksum_sha256: string | null
          created_at: string
          id: string
          last_modified: string | null
          mime_type: string | null
          organization_id: string
          path: string
          size_bytes: number | null
        }
        Insert: {
          backup_id: string
          bucket: string
          checksum_sha256?: string | null
          created_at?: string
          id?: string
          last_modified?: string | null
          mime_type?: string | null
          organization_id: string
          path: string
          size_bytes?: number | null
        }
        Update: {
          backup_id?: string
          bucket?: string
          checksum_sha256?: string | null
          created_at?: string
          id?: string
          last_modified?: string | null
          mime_type?: string | null
          organization_id?: string
          path?: string
          size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "backup_storage_objects_backup_id_fkey"
            columns: ["backup_id"]
            isOneToOne: false
            referencedRelation: "backups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backup_storage_objects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      backups: {
        Row: {
          bytes_per_second: number | null
          bytes_total: number | null
          bytes_uploaded: number | null
          checksum_sha256: string | null
          compression: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          eta_seconds: number | null
          finished_at: string | null
          id: string
          manifest: Json | null
          organization_id: string
          progress_percent: number | null
          project_id: string
          schedule_id: string | null
          sql_object_key: string | null
          stage: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["backup_status"]
          storage_object_key: string | null
          triggered_by: string | null
          triggered_via: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          bytes_per_second?: number | null
          bytes_total?: number | null
          bytes_uploaded?: number | null
          checksum_sha256?: string | null
          compression?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          eta_seconds?: number | null
          finished_at?: string | null
          id?: string
          manifest?: Json | null
          organization_id: string
          progress_percent?: number | null
          project_id: string
          schedule_id?: string | null
          sql_object_key?: string | null
          stage?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["backup_status"]
          storage_object_key?: string | null
          triggered_by?: string | null
          triggered_via?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          bytes_per_second?: number | null
          bytes_total?: number | null
          bytes_uploaded?: number | null
          checksum_sha256?: string | null
          compression?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          eta_seconds?: number | null
          finished_at?: string | null
          id?: string
          manifest?: Json | null
          organization_id?: string
          progress_percent?: number | null
          project_id?: string
          schedule_id?: string | null
          sql_object_key?: string | null
          stage?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["backup_status"]
          storage_object_key?: string | null
          triggered_by?: string | null
          triggered_via?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "backups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          attempt: number
          backup_id: string | null
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          kind: Database["public"]["Enums"]["job_kind"]
          max_attempts: number
          organization_id: string
          payload: Json
          priority: Database["public"]["Enums"]["job_priority"]
          project_id: string | null
          restore_id: string | null
          result: Json | null
          scheduled_for: string
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          trace_id: string | null
          updated_at: string
        }
        Insert: {
          attempt?: number
          backup_id?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["job_kind"]
          max_attempts?: number
          organization_id: string
          payload?: Json
          priority?: Database["public"]["Enums"]["job_priority"]
          project_id?: string | null
          restore_id?: string | null
          result?: Json | null
          scheduled_for?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          trace_id?: string | null
          updated_at?: string
        }
        Update: {
          attempt?: number
          backup_id?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["job_kind"]
          max_attempts?: number
          organization_id?: string
          payload?: Json
          priority?: Database["public"]["Enums"]["job_priority"]
          project_id?: string | null
          restore_id?: string | null
          result?: Json | null
          scheduled_for?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          trace_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_backup_id_fkey"
            columns: ["backup_id"]
            isOneToOne: false
            referencedRelation: "backups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_restore_id_fkey"
            columns: ["restore_id"]
            isOneToOne: false
            referencedRelation: "restores"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link_url: string | null
          organization_id: string
          read_at: string | null
          resource_id: string | null
          resource_type: string | null
          severity: Database["public"]["Enums"]["notification_severity"]
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link_url?: string | null
          organization_id: string
          read_at?: string | null
          resource_id?: string | null
          resource_type?: string | null
          severity?: Database["public"]["Enums"]["notification_severity"]
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link_url?: string | null
          organization_id?: string
          read_at?: string | null
          resource_id?: string | null
          resource_type?: string | null
          severity?: Database["public"]["Enums"]["notification_severity"]
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          plan: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          plan?: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          plan?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_credentials: {
        Row: {
          created_at: string
          db_host: string | null
          db_name: string | null
          db_port: number | null
          db_user: string | null
          encrypted_payload: string
          encryption_key_id: string
          id: string
          last_validated_at: string | null
          last_validation_status: string | null
          organization_id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          db_host?: string | null
          db_name?: string | null
          db_port?: number | null
          db_user?: string | null
          encrypted_payload: string
          encryption_key_id: string
          id?: string
          last_validated_at?: string | null
          last_validation_status?: string | null
          organization_id: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          db_host?: string | null
          db_name?: string | null
          db_port?: number | null
          db_user?: string | null
          encrypted_payload?: string
          encryption_key_id?: string
          id?: string
          last_validated_at?: string | null
          last_validation_status?: string | null
          organization_id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_credentials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          created_by: string
          id: string
          inventory: Json | null
          last_inventory_at: string | null
          name: string
          organization_id: string
          postgres_version: string | null
          region: string | null
          status: string
          supabase_project_ref: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          inventory?: Json | null
          last_inventory_at?: string | null
          name: string
          organization_id: string
          postgres_version?: string | null
          region?: string | null
          status?: string
          supabase_project_ref?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          inventory?: Json | null
          last_inventory_at?: string | null
          name?: string
          organization_id?: string
          postgres_version?: string | null
          region?: string | null
          status?: string
          supabase_project_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      restores: {
        Row: {
          backup_id: string
          bytes_per_second: number | null
          created_at: string
          destination_project_id: string
          error_code: string | null
          error_message: string | null
          eta_seconds: number | null
          finished_at: string | null
          id: string
          organization_id: string
          progress_percent: number | null
          report: Json | null
          stage: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["restore_status"]
          triggered_by: string | null
          updated_at: string
        }
        Insert: {
          backup_id: string
          bytes_per_second?: number | null
          created_at?: string
          destination_project_id: string
          error_code?: string | null
          error_message?: string | null
          eta_seconds?: number | null
          finished_at?: string | null
          id?: string
          organization_id: string
          progress_percent?: number | null
          report?: Json | null
          stage?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["restore_status"]
          triggered_by?: string | null
          updated_at?: string
        }
        Update: {
          backup_id?: string
          bytes_per_second?: number | null
          created_at?: string
          destination_project_id?: string
          error_code?: string | null
          error_message?: string | null
          eta_seconds?: number | null
          finished_at?: string | null
          id?: string
          organization_id?: string
          progress_percent?: number | null
          report?: Json | null
          stage?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["restore_status"]
          triggered_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restores_backup_id_fkey"
            columns: ["backup_id"]
            isOneToOne: false
            referencedRelation: "backups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restores_destination_project_id_fkey"
            columns: ["destination_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          created_at: string
          created_by: string
          cron_expression: string
          enabled: boolean
          id: string
          last_run_at: string | null
          name: string
          next_run_at: string | null
          organization_id: string
          project_id: string
          retention_days: number
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          cron_expression: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          organization_id: string
          project_id: string
          retention_days?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          cron_expression?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          organization_id?: string
          project_id?: string
          retention_days?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_reports: {
        Row: {
          backup_id: string | null
          created_at: string
          diffs: Json | null
          id: string
          organization_id: string
          restore_id: string | null
          status: string
          summary: Json | null
          updated_at: string
        }
        Insert: {
          backup_id?: string | null
          created_at?: string
          diffs?: Json | null
          id?: string
          organization_id: string
          restore_id?: string | null
          status?: string
          summary?: Json | null
          updated_at?: string
        }
        Update: {
          backup_id?: string | null
          created_at?: string
          diffs?: Json | null
          id?: string
          organization_id?: string
          restore_id?: string | null
          status?: string
          summary?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_reports_backup_id_fkey"
            columns: ["backup_id"]
            isOneToOne: false
            referencedRelation: "backups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_reports_restore_id_fkey"
            columns: ["restore_id"]
            isOneToOne: false
            referencedRelation: "restores"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string
          created_by: string
          enabled: boolean
          events: string[]
          id: string
          last_delivery_at: string | null
          last_delivery_status: string | null
          organization_id: string
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by: string
          enabled?: boolean
          events?: string[]
          id?: string
          last_delivery_at?: string | null
          last_delivery_status?: string | null
          organization_id: string
          secret: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string
          enabled?: boolean
          events?: string[]
          id?: string
          last_delivery_at?: string | null
          last_delivery_status?: string | null
          organization_id?: string
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_heartbeats: {
        Row: {
          cpu_percent: number | null
          id: string
          last_seen_at: string
          queue: string | null
          ram_mb: number | null
          running_job_id: string | null
          version: string | null
        }
        Insert: {
          cpu_percent?: number | null
          id: string
          last_seen_at?: string
          queue?: string | null
          ram_mb?: number | null
          running_job_id?: string | null
          version?: string | null
        }
        Update: {
          cpu_percent?: number | null
          id?: string
          last_seen_at?: string
          queue?: string | null
          ram_mb?: number | null
          running_job_id?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_heartbeats_running_job_id_fkey"
            columns: ["running_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
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
      is_org_admin: { Args: { _org: string; _user: string }; Returns: boolean }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
      is_org_owner: { Args: { _org: string; _user: string }; Returns: boolean }
      org_role_of: {
        Args: { _org: string; _user: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      backup_status:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
        | "verified"
      job_kind:
        | "backup"
        | "restore"
        | "verify"
        | "storage"
        | "cleanup"
        | "notification"
        | "billing"
      job_priority: "critical" | "high" | "normal" | "low"
      job_status:
        | "queued"
        | "claimed"
        | "running"
        | "succeeded"
        | "failed"
        | "cancelled"
      notification_severity: "info" | "success" | "warning" | "error"
      org_role: "owner" | "admin" | "member" | "viewer"
      restore_status:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
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
      app_role: ["admin", "moderator", "user"],
      backup_status: [
        "pending",
        "running",
        "completed",
        "failed",
        "cancelled",
        "verified",
      ],
      job_kind: [
        "backup",
        "restore",
        "verify",
        "storage",
        "cleanup",
        "notification",
        "billing",
      ],
      job_priority: ["critical", "high", "normal", "low"],
      job_status: [
        "queued",
        "claimed",
        "running",
        "succeeded",
        "failed",
        "cancelled",
      ],
      notification_severity: ["info", "success", "warning", "error"],
      org_role: ["owner", "admin", "member", "viewer"],
      restore_status: [
        "pending",
        "running",
        "completed",
        "failed",
        "cancelled",
      ],
    },
  },
} as const

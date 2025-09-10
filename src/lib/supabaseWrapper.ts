"use client"
import { supabase } from './supabaseClient'

/**
 * Wrapper function that handles session refresh automatically for Supabase calls
 * If a call fails with an auth error, it attempts to refresh the session and retry once
 */
export async function withSessionRefresh<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation()
  } catch (error: any) {
    // Check if it's an authentication error
    if (error?.code === 'PGRST301' || error?.message?.includes('JWT') || error?.status === 401) {
      try {
        // Try to refresh the session
        const { data, error: refreshError } = await supabase.auth.refreshSession()
        
        if (refreshError) {
          // If refresh fails, the user needs to sign in again
          console.warn('Session refresh failed:', refreshError.message)
          throw error // Re-throw the original error
        }
        
        if (data.session) {
          // Session refreshed successfully, retry the operation
          return await operation()
        }
      } catch (refreshError) {
        console.warn('Failed to refresh session:', refreshError)
      }
    }
    
    // Re-throw the original error if not auth-related or retry failed
    throw error
  }
}

/**
 * Enhanced supabase client with automatic session refresh
 */
export const supabaseWithRefresh = {
  from: (table: string) => {
    const originalFrom = supabase.from(table)
    
    return {
      select: (columns?: string) => {
        const query = originalFrom.select(columns)
        return {
          ...query,
          then: (onFulfilled?: any, onRejected?: any) => {
            return withSessionRefresh(() => query).then(onFulfilled, onRejected)
          }
        }
      },
      insert: (values: any) => {
        const query = originalFrom.insert(values)
        return {
          ...query,
          then: (onFulfilled?: any, onRejected?: any) => {
            return withSessionRefresh(() => query).then(onFulfilled, onRejected)
          }
        }
      },
      update: (values: any) => {
        const query = originalFrom.update(values)
        return {
          ...query,
          then: (onFulfilled?: any, onRejected?: any) => {
            return withSessionRefresh(() => query).then(onFulfilled, onRejected)
          }
        }
      },
      delete: () => {
        const query = originalFrom.delete()
        return {
          ...query,
          then: (onFulfilled?: any, onRejected?: any) => {
            return withSessionRefresh(() => query).then(onFulfilled, onRejected)
          }
        }
      }
    }
  },
  
  rpc: (fnName: string, params?: any) => {
    const query = supabase.rpc(fnName, params)
    return {
      ...query,
      then: (onFulfilled?: any, onRejected?: any) => {
        return withSessionRefresh(() => query).then(onFulfilled, onRejected)
      }
    }
  }
}
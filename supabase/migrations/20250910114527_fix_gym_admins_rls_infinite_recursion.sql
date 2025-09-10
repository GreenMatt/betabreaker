-- Fix infinite recursion in gym_admins RLS policy
-- The issue was that the policy was calling is_gym_admin() which queries gym_admins,
-- creating a circular dependency that caused infinite recursion.

-- Drop the existing problematic policy
drop policy if exists "only admins can modify admin list" on public.gym_admins;

-- Recreate the policy without calling is_gym_admin() to avoid circular dependency
create policy "only admins can modify admin list" on public.gym_admins 
for all using (
  EXISTS (
    SELECT 1 FROM public.gym_admins existing 
    WHERE existing.gym_id = gym_admins.gym_id 
    AND existing.user_id = auth.uid()
  ) 
  OR NOT EXISTS (
    SELECT 1 FROM public.gym_admins existing 
    WHERE existing.gym_id = gym_admins.gym_id
  )
);
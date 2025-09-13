-- Disable the automatic badge trigger to use JavaScript badge logic instead
-- This prevents conflicts between trigger-awarded badges and JavaScript logic

-- Drop the trigger
DROP TRIGGER IF EXISTS trg_award_level_badge_on_log ON public.climb_logs;

-- Optionally drop the function (uncomment if you want to remove it completely)
-- DROP FUNCTION IF EXISTS public.award_level_badge_on_log();

-- Note: The badges table and user_badges table remain unchanged
-- JavaScript badge logic will handle all future badge awards
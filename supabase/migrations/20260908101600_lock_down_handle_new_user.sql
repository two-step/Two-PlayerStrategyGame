-- Security advisor flagged public.handle_new_user() as callable directly via
-- PostgREST RPC (/rest/v1/rpc/handle_new_user) by anon/authenticated roles.
-- It's meant to run ONLY as the auth.users insert trigger, never as a
-- client-invoked RPC -- revoke direct EXECUTE so it's trigger-only.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

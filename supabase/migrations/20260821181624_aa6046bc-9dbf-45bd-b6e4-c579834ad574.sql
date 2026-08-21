-- 1. Move large profile pictures out of the users row into their own rows
INSERT INTO app_state (id, data, updated_at)
SELECT 'file:userpic:' || (u->>'id'), to_jsonb(u->>'profilePicture'), now()
FROM (SELECT jsonb_array_elements(data) u FROM app_state WHERE id = 'users') s
WHERE length(u->>'profilePicture') > 20000
ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now();

UPDATE app_state SET data = (
  SELECT jsonb_agg(
    CASE WHEN length(u->>'profilePicture') > 20000
      THEN jsonb_set(u, '{profilePicture}', to_jsonb('ref:userpic:' || (u->>'id')))
      ELSE u END
  )
  FROM jsonb_array_elements(app_state.data) u
), updated_at = now()
WHERE id = 'users';

-- 2. Split the legacy single blob of uploaded files into one row per file
INSERT INTO app_state (id, data, updated_at)
SELECT 'file:' || key, value, now()
FROM app_state, jsonb_each(data)
WHERE id = 'files'
ON CONFLICT (id) DO NOTHING;

DELETE FROM app_state WHERE id = 'files';
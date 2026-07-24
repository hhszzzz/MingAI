-- Web records for Meihua Yishu and Xiaoliuren.
-- The calculation payloads remain canonical taibu-core output so history,
-- knowledge-base sources, and AI analysis all consume one representation.

CREATE TABLE public.meihua_divinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL CHECK (length(btrim(question)) > 0),
  method text NOT NULL CHECK (method IN ('time', 'text_split', 'number_pair', 'number_triplet')),
  cast_datetime timestamp without time zone NOT NULL,
  main_hexagram text NOT NULL,
  changed_hexagram text,
  input_data jsonb NOT NULL,
  result_data jsonb NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meihua_divinations_user_created_at
  ON public.meihua_divinations (user_id, created_at DESC);
CREATE INDEX idx_meihua_divinations_conversation_id
  ON public.meihua_divinations (conversation_id)
  WHERE conversation_id IS NOT NULL;

ALTER TABLE public.meihua_divinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meihua divinations"
  ON public.meihua_divinations FOR SELECT
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can insert own meihua divinations"
  ON public.meihua_divinations FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update own meihua divinations"
  ON public.meihua_divinations FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can delete own meihua divinations"
  ON public.meihua_divinations FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meihua_divinations TO authenticated;

CREATE TABLE public.xiaoliuren_divinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text,
  solar_datetime timestamp without time zone NOT NULL,
  lunar_month smallint NOT NULL CHECK (lunar_month BETWEEN 1 AND 12),
  lunar_day smallint NOT NULL CHECK (lunar_day BETWEEN 1 AND 30),
  is_leap_month boolean NOT NULL DEFAULT false,
  shichen text NOT NULL,
  final_status text NOT NULL CHECK (final_status IN ('大安', '留连', '速喜', '赤口', '小吉', '空亡')),
  input_data jsonb NOT NULL,
  result_data jsonb NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_xiaoliuren_divinations_user_created_at
  ON public.xiaoliuren_divinations (user_id, created_at DESC);
CREATE INDEX idx_xiaoliuren_divinations_conversation_id
  ON public.xiaoliuren_divinations (conversation_id)
  WHERE conversation_id IS NOT NULL;

ALTER TABLE public.xiaoliuren_divinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own xiaoliuren divinations"
  ON public.xiaoliuren_divinations FOR SELECT
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can insert own xiaoliuren divinations"
  ON public.xiaoliuren_divinations FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update own xiaoliuren divinations"
  ON public.xiaoliuren_divinations FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can delete own xiaoliuren divinations"
  ON public.xiaoliuren_divinations FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.xiaoliuren_divinations TO authenticated;

ALTER TABLE public.archived_sources
  DROP CONSTRAINT IF EXISTS archived_sources_source_type_check;
ALTER TABLE public.archived_sources
  ADD CONSTRAINT archived_sources_source_type_check
  CHECK (source_type = ANY (ARRAY[
    'conversation'::text, 'record'::text, 'chat_message'::text,
    'bazi_chart'::text, 'ziwei_chart'::text, 'tarot_reading'::text,
    'liuyao_divination'::text, 'hepan_chart'::text, 'face_reading'::text,
    'palm_reading'::text, 'mbti_reading'::text, 'ming_record'::text,
    'daily_fortune'::text, 'monthly_fortune'::text, 'qimen_chart'::text,
    'daliuren_divination'::text, 'meihua_divination'::text,
    'xiaoliuren_divination'::text
  ]));

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_source_type_check;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_source_type_check
  CHECK (source_type = ANY (ARRAY[
    'chat'::text, 'bazi_wuxing'::text, 'bazi_personality'::text,
    'tarot'::text, 'liuyao'::text, 'mbti'::text, 'hepan'::text,
    'palm'::text, 'face'::text, 'dream'::text, 'qimen'::text,
    'daliuren'::text, 'meihua'::text, 'xiaoliuren'::text, 'ziwei'::text
  ])) NOT VALID;

-- Extend authenticated history deletion with the two new owner-scoped tables.
CREATE OR REPLACE FUNCTION public.delete_history_item_and_conversation(
  p_history_type text,
  p_history_id text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid;
  v_table_name text;
  v_conversation_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  CASE p_history_type
    WHEN 'tarot' THEN v_table_name := 'tarot_readings';
    WHEN 'liuyao' THEN v_table_name := 'liuyao_divinations';
    WHEN 'mbti' THEN v_table_name := 'mbti_readings';
    WHEN 'hepan' THEN v_table_name := 'hepan_charts';
    WHEN 'palm' THEN v_table_name := 'palm_readings';
    WHEN 'face' THEN v_table_name := 'face_readings';
    WHEN 'qimen' THEN v_table_name := 'qimen_charts';
    WHEN 'daliuren' THEN v_table_name := 'daliuren_divinations';
    WHEN 'meihua' THEN v_table_name := 'meihua_divinations';
    WHEN 'xiaoliuren' THEN v_table_name := 'xiaoliuren_divinations';
    ELSE RAISE EXCEPTION 'invalid history type' USING ERRCODE = '22023';
  END CASE;

  EXECUTE format(
    'SELECT conversation_id FROM public.%I WHERE id::text = $1 AND user_id = $2 FOR UPDATE',
    v_table_name
  ) INTO v_conversation_id USING p_history_id, v_user_id;

  IF NOT FOUND THEN RETURN false; END IF;

  EXECUTE format(
    'DELETE FROM public.%I WHERE id::text = $1 AND user_id = $2',
    v_table_name
  ) USING p_history_id, v_user_id;

  IF v_conversation_id IS NOT NULL THEN
    PERFORM public.delete_conversation_graph(v_conversation_id::text);
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_history_item_and_conversation(text, text)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_history_item_and_conversation(text, text)
  TO authenticated;

-- Preserve all existing history creation behavior behind an implementation
-- function, then keep the public RPC signature stable while adding the two
-- owner-checked binding branches.
ALTER FUNCTION public.create_analysis_conversation_with_history_as_service(
  uuid, text, jsonb, text, text, jsonb, text, jsonb
) RENAME TO create_analysis_conversation_with_history_legacy_as_service;

CREATE FUNCTION public.create_analysis_conversation_with_history_as_service(
  p_user_id uuid,
  p_source_type text,
  p_source_data jsonb,
  p_title text,
  p_personality text,
  p_messages jsonb,
  p_history_type text,
  p_history_payload jsonb
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_conversation_id uuid;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_history_type NOT IN ('meihua', 'xiaoliuren') THEN
    RETURN public.create_analysis_conversation_with_history_legacy_as_service(
      p_user_id,
      p_source_type,
      p_source_data,
      p_title,
      p_personality,
      p_messages,
      p_history_type,
      p_history_payload
    );
  END IF;

  IF COALESCE(jsonb_typeof(p_messages), 'null') <> 'array' THEN
    RAISE EXCEPTION 'messages must be an array' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.conversations (
    user_id, source_type, source_data, title, personality, messages
  ) VALUES (
    p_user_id,
    p_source_type,
    COALESCE(p_source_data, '{}'::jsonb),
    p_title,
    COALESCE(NULLIF(p_personality, ''), 'general'),
    '[]'::jsonb
  ) RETURNING id INTO v_conversation_id;

  PERFORM public.replace_conversation_messages(v_conversation_id, p_messages);

  IF p_history_type = 'meihua' THEN
    UPDATE public.meihua_divinations
    SET conversation_id = v_conversation_id
    WHERE id::text = p_history_payload->>'divination_id'
      AND user_id = p_user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'meihua divination not found';
    END IF;
  ELSE
    UPDATE public.xiaoliuren_divinations
    SET conversation_id = v_conversation_id
    WHERE id::text = p_history_payload->>'divination_id'
      AND user_id = p_user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'xiaoliuren divination not found';
    END IF;
  END IF;

  RETURN v_conversation_id::text;
END;
$$;

REVOKE ALL ON FUNCTION public.create_analysis_conversation_with_history_legacy_as_service(
  uuid, text, jsonb, text, text, jsonb, text, jsonb
) FROM public, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_analysis_conversation_with_history_as_service(
  uuid, text, jsonb, text, text, jsonb, text, jsonb
) FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_analysis_conversation_with_history_as_service(
  uuid, text, jsonb, text, text, jsonb, text, jsonb
) TO authenticated;

-- ============================================================
-- MapaCripto Venezuela – Database Setup
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Tabla principal ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS negocios (
  id          UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      TEXT          NOT NULL,
  tipo        TEXT          NOT NULL,
  criptos     TEXT[]        NOT NULL DEFAULT '{}',
  descripcion TEXT,
  lat         DECIMAL(10,8) NOT NULL,
  lng         DECIMAL(11,8) NOT NULL,
  contacto    TEXT,
  logo_url    TEXT,
  ciudad      TEXT,
  estado      TEXT          NOT NULL DEFAULT 'pendiente'
                            CHECK (estado IN ('pendiente','activo','rechazado')),
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_negocios_estado  ON negocios(estado);
CREATE INDEX IF NOT EXISTS idx_negocios_ciudad  ON negocios(ciudad);
CREATE INDEX IF NOT EXISTS idx_negocios_tipo    ON negocios(tipo);
CREATE INDEX IF NOT EXISTS idx_negocios_criptos ON negocios USING GIN(criptos);

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE negocios ENABLE ROW LEVEL SECURITY;

-- Solo ver negocios activos públicamente
CREATE POLICY "read_activos" ON negocios
  FOR SELECT USING (estado = 'activo');

-- Cualquiera puede insertar (el backend modera antes)
CREATE POLICY "insert_negocios" ON negocios
  FOR INSERT WITH CHECK (true);

-- El service key del backend bypasea RLS automáticamente

-- ============================================================
-- STORAGE: Crear el bucket "logos" en el dashboard de Supabase:
--   Storage → New Bucket → nombre: "logos" → Public: ON
-- O ejecutar:
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Política de storage: cualquiera puede subir al bucket logos
CREATE POLICY "upload_logos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'logos');

-- Cualquiera puede leer logos públicos
CREATE POLICY "read_logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'logos');

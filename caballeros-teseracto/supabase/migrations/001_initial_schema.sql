-- ============================================================
-- ESQUEMA COMPLETO: Los Caballeros del Teseracto
-- ============================================================

-- 1. TABLA: usuarios
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  monedas INTEGER DEFAULT 1000,
  puntos_vida INTEGER DEFAULT 100,
  carta_defensiva_id UUID,
  pin_acceso TEXT NOT NULL DEFAULT '1519',
  fecha_registro TIMESTAMPTZ DEFAULT now()
);

-- 2. TABLA: cartas
CREATE TABLE cartas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  ataque INTEGER NOT NULL,
  defensa INTEGER NOT NULL,
  url_imagen TEXT,
  rareza TEXT CHECK (rareza IN ('comun', 'rara', 'epica', 'legendaria')) DEFAULT 'comun',
  creado_por TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TABLA: inventario_usuarios
CREATE TABLE inventario_usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) NOT NULL,
  carta_id UUID REFERENCES cartas(id) NOT NULL,
  durabilidad_carta INTEGER DEFAULT 100,
  acquired_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TABLA: mensajes (con Realtime habilitado)
CREATE TABLE mensajes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) NOT NULL,
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER PUBLICATION supabase_realtime ADD TABLE mensajes;

-- 5. TABLA: subastas
CREATE TABLE subastas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id UUID REFERENCES usuarios(id) NOT NULL,
  inventario_id UUID REFERENCES inventario_usuarios(id) NOT NULL,
  precio_salida INTEGER NOT NULL,
  puja_actual INTEGER,
  comprador_actual_id UUID REFERENCES usuarios(id),
  fecha_fin TIMESTAMPTZ NOT NULL,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. TABLA: inversiones
CREATE TABLE inversiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) NOT NULL,
  nombre_activo TEXT NOT NULL,
  cantidad_invertida INTEGER NOT NULL,
  valor_actual INTEGER NOT NULL,
  ultima_fluctuacion TIMESTAMPTZ DEFAULT now()
);

-- 7. TABLA: historial_combates
CREATE TABLE historial_combates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atacante_id UUID REFERENCES usuarios(id) NOT NULL,
  defensor_id UUID REFERENCES usuarios(id),
  carta_atacante_id UUID,
  carta_defensora_id UUID,
  ganador_id UUID,
  dano_infligido INTEGER DEFAULT 0,
  historia TEXT,
  tipo TEXT CHECK (tipo IN ('pvp', 'pve')) DEFAULT 'pvp',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Deshabilitar RLS en todas las tablas porque usamos auth custom (localStorage)
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE cartas DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes DISABLE ROW LEVEL SECURITY;
ALTER TABLE subastas DISABLE ROW LEVEL SECURITY;
ALTER TABLE inversiones DISABLE ROW LEVEL SECURITY;
ALTER TABLE historial_combates DISABLE ROW LEVEL SECURITY;

-- 8. FUNCIONES AUXILIARES
CREATE OR REPLACE FUNCTION get_user_monedas(uid UUID)
RETURNS INTEGER AS $$
  SELECT monedas FROM usuarios WHERE id = uid;
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION congelar_monedas(usuario_id UUID, cantidad INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE usuarios SET monedas = monedas - cantidad WHERE id = usuario_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION devolver_monedas(usuario_id UUID, cantidad INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE usuarios SET monedas = monedas + cantidad WHERE id = usuario_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reducir_durabilidad(inventario_id UUID, dano INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE inventario_usuarios SET durabilidad_carta = GREATEST(0, durabilidad_carta - dano) WHERE id = inventario_id;
END;
$$ LANGUAGE plpgsql;

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_inventario_usuario ON inventario_usuarios(usuario_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_created ON mensajes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subastas_activas ON subastas(activa, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_historial_combates_usuario ON historial_combates(atacante_id);
CREATE INDEX IF NOT EXISTS idx_historial_combates_fecha ON historial_combates(created_at DESC);
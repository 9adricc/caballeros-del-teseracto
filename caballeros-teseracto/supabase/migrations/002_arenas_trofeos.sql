-- ============================================================
-- ARENAS Y TROFEOS - Los Caballeros del Teseracto
-- ============================================================

-- 1. Añadir columna trofeos a usuarios (default 0)
ALTER TABLE usuarios ADD COLUMN trofeos INTEGER DEFAULT 0;

-- 2. Crear tabla de arenas (ligas)
CREATE TABLE arenas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  emoji TEXT,
  trofeos_min INTEGER NOT NULL DEFAULT 0,
  trofeos_max INTEGER NOT NULL DEFAULT 9999,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insertar arenas graciosas
INSERT INTO arenas (nombre, descripcion, emoji, trofeos_min, trofeos_max) VALUES
  ('El Sótano de la Vergüenza', 'Todos empiezan aquí, no te rayes', '🕳️', 0, 199),
  ('La Mina del Escándiva', 'Polvo, sudor y criptomineros', '⛏️', 200, 499),
  ('El Prostíbulo de Molero', 'Las reglas son confusas pero divertidas', '🍆', 500, 999),
  ('La Resaca del Dragón', 'Todo el mundo está de resaca. Incluso los árboles.', '🐉', 1000, 1499),
  ('El Hype que se Desvanece', 'Aquí los sueños vienen a morir... o a cobrar', '💨', 1500, 1999),
  ('La Bodega del Amigo Préstamo', 'Nadie sabe cómo llegaste aquí, pero todos te deben dinero', '💀', 2000, 2999),
  ('El Templo del Código Spaguetti', 'Los antiguos programadores lloran al entrar', '🍝', 3000, 3999),
  ('El Trono del Teseracto', 'Solo los legendarios sobreviven aquí. Y los bots.', '👑', 4000, 9999);

-- 3. Tabla para build de combate (3 cartas por jugador)
CREATE TABLE builds_combate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) NOT NULL,
  carta1_id UUID REFERENCES inventario_usuarios(id),
  carta2_id UUID REFERENCES inventario_usuarios(id),
  carta3_id UUID REFERENCES inventario_usuarios(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(usuario_id)
);
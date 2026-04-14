CREATE TABLE IF NOT EXISTS assets (
  id SERIAL PRIMARY KEY,
  ativo VARCHAR(10) NOT NULL,
  quantidade NUMERIC(15, 8) NOT NULL,
  preco_medio NUMERIC(10, 2) NOT NULL,
  preco_atual NUMERIC(15, 8),
  valor_investido NUMERIC(10, 2),
  saldo NUMERIC(10, 2),
  variacao NUMERIC(10, 2),
  dy_por_cota NUMERIC(10, 2),
  dy_atual_mensal NUMERIC(10, 2),
  dy_atual_anual NUMERIC(10, 2),
  dy_meu_mensal NUMERIC(10, 2),
  dy_meu_anual NUMERIC(10, 2),
  ticker_type VARCHAR(10) DEFAULT 'FII',
  market VARCHAR(20) DEFAULT 'brazil',
  platform VARCHAR(50) DEFAULT 'WealthSimple',
  UNIQUE(ativo, market)
);

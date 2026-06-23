# Especificação de Design: EpicDrop Informática

Esta especificação define a arquitetura, o modelo de banco de dados e os fluxos de trabalho do aplicativo **EpicDrop Informática**, um sistema de controle financeiro, de estoque e de pedidos integrado com catálogo de vendas público para dropshipping.

---

## 1. Arquitetura do Sistema

O aplicativo será construído seguindo o padrão de **Single Page Application (SPA)** estática, utilizando:
* **Interface:** HTML5, CSS customizado baseado no [epicdrop-style-guide](file:///C:/Users/evert/.gemini/config/skills/epicdrop-style-guide/SKILL.md) e Tailwind CSS (via CDN).
* **Lógica:** Vanilla JavaScript (módulos ES6).
* **Banco de Dados & Autenticação:** Supabase (PostgreSQL + Supabase Auth + Supabase Storage).
* **Instalação & Offline:** PWA (Progressive Web App) com Service Worker para cache e notificações locais no Android.
* **Hospedagem:** Vercel.

---

## 2. Modelo de Banco de Dados (Supabase)

### Tabelas do PostgreSQL

```sql
-- 1. Clientes
CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    nome TEXT NOT NULL,
    telefone TEXT,
    email TEXT,
    documento TEXT,
    endereco TEXT,
    criado_em TIMESTAMPTZ DEFAULT now()
);

-- 2. Fornecedores
CREATE TABLE fornecedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    nome TEXT NOT NULL,
    telefone TEXT,
    email TEXT,
    documento TEXT,
    endereco TEXT,
    criado_em TIMESTAMPTZ DEFAULT now()
);

-- 3. Produtos (Estoque & Catálogo)
CREATE TABLE produtos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    categoria TEXT NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT,
    foto_url TEXT,
    custo_unitario NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    valor_venda NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    estoque_atual INTEGER NOT NULL DEFAULT 0,
    estoque_reservado INTEGER NOT NULL DEFAULT 0,
    visivel_catalogo BOOLEAN NOT NULL DEFAULT true,
    em_promocao BOOLEAN NOT NULL DEFAULT false,
    preco_promocional NUMERIC(10, 2),
    criado_em TIMESTAMPTZ DEFAULT now()
);

-- 4. Transações Financeiras
CREATE TABLE transacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('Entrada', 'Saída')),
    subcategoria TEXT NOT NULL,
    descricao TEXT NOT NULL,
    valor_parcela NUMERIC(10, 2) NOT NULL,
    valor_realizado NUMERIC(10, 2),
    data_vencimento DATE NOT NULL,
    data_realizacao DATE,
    status TEXT NOT NULL CHECK (status IN ('Pendente', 'Realizado')),
    grupo_id UUID NOT NULL,
    total_parcelas INTEGER NOT NULL DEFAULT 1,
    parcela_atual INTEGER NOT NULL DEFAULT 1,
    frequencia TEXT NOT NULL DEFAULT 'Única',
    meio_pagamento TEXT,
    criado_em TIMESTAMPTZ DEFAULT now()
);

-- 5. Vendas / Pedidos
CREATE TABLE vendas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    cliente TEXT NOT NULL DEFAULT 'Genérico/Não Cadastrado',
    endereco TEXT,
    total NUMERIC(10, 2) NOT NULL,
    custo_total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    taxa_cartao NUMERIC(10, 2) DEFAULT 0.00,
    status_entrega TEXT NOT NULL CHECK (status_entrega IN ('Encomendado', 'Adquirido', 'Entregue', 'Cancelado')),
    status_pagamento TEXT NOT NULL CHECK (status_pagamento IN ('Pendente', 'Pago')),
    meio_pagamento TEXT,
    transacao_id UUID,
    taxa_transacao_id UUID,
    criado_em TIMESTAMPTZ DEFAULT now()
);

-- 6. Itens da Venda
CREATE TABLE vendas_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venda_id UUID REFERENCES vendas(id) ON DELETE CASCADE,
    produto_id UUID REFERENCES produtos(id) ON DELETE RESTRICT,
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    valor_venda NUMERIC(10, 2) NOT NULL,
    custo_unitario NUMERIC(10, 2) NOT NULL
);

-- 7. Compras
CREATE TABLE compras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    fornecedor TEXT NOT NULL DEFAULT 'Genérico/Não Cadastrado',
    total NUMERIC(10, 2) NOT NULL,
    transacao_id UUID,
    criado_em TIMESTAMPTZ DEFAULT now()
);

-- 8. Itens da Compra
CREATE TABLE compras_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compra_id UUID REFERENCES compras(id) ON DELETE CASCADE,
    produto_id UUID REFERENCES produtos(id) ON DELETE RESTRICT,
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    custo_unitario NUMERIC(10, 2) NOT NULL
);

-- 9. Links do BoaDica para monitoramento de concorrentes
CREATE TABLE produto_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id UUID REFERENCES produtos(id) ON DELETE CASCADE,
    plataforma TEXT NOT NULL DEFAULT 'BoaDica',
    url TEXT NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT now()
);

-- 10. Histórico de Preços Monitorados do BoaDica
CREATE TABLE produto_precos_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id UUID REFERENCES produto_links(id) ON DELETE CASCADE,
    loja_nome TEXT NOT NULL,
    preco NUMERIC(10, 2) NOT NULL,
    data_coleta TIMESTAMPTZ DEFAULT now()
);
```

---

## 3. Fluxos de Trabalho e Regras de Negócio

### A. Catálogo Público e WhatsApp Checkout
1. **Visualização:** Clientes acessam `index.html`. O sistema carrega os produtos onde `visivel_catalogo = true`.
2. **Ordenação:** Os itens em estoque (`estoque_atual > 0`) aparecem primeiro dentro de suas respectivas categorias.
3. **Tags & Promoção:**
   * Todos os itens possuem a tag fixada: *"Agende sua Entrega"*.
   * Itens com `em_promocao = true` mostram um badge de "Promoção" e o preço original riscado.
4. **Carrinho:** Clientes adicionam múltiplos itens, preenchem Nome e Endereço de Entrega, e clicam em *"Enviar Pedido no WhatsApp"*. O app abre o WhatsApp redirecionando para `(21) 97998-3223` com a lista formatada.

### B. Gestão de Pedidos & Dropshipping Automático
1. **Reserva de Estoque:** Ao salvar um pedido com status de entrega `Encomendado`, a quantidade vendida de cada produto é adicionada à coluna `estoque_reservado` do produto correspondente.
2. **Dropshipping Automático:** Quando Everton clica em *"Adquirido no Fornecedor"*, o sistema calcula as quantidades em falta (onde `estoque_atual < quantidade_vendida`). Para os itens faltantes, realiza automaticamente:
   * Uma inserção na tabela de `compras` e `compras_itens`.
   * Um lançamento de **Saída** na tabela `transacoes` (subcategoria: "Compras", valor correspondente ao custo).
   * Atualização de `estoque_atual` somando a quantidade comprada.
   * Modificação do status do pedido para `Adquirido` (ou *"Pronto para Entrega"* no painel).
3. **Fulfillment (Baixa do Estoque):** Ao marcar o pedido como `Entregue`, o sistema deduz a quantidade vendida tanto do `estoque_atual` quanto do `estoque_reservado`.

### C. Registro Retroativo de Taxas de Cartão
1. Everton marca o pagamento do pedido como `Pago` e define o meio de pagamento como `Cartão`. O sistema cria a transação de **Entrada** financeira do valor integral.
2. Posteriormente, no painel, ele insere o valor da taxa da maquininha no campo `taxa_cartao` da venda.
3. O sistema:
   * Atualiza `taxa_cartao` na venda.
   * Cria uma transação de **Saída** (subcategoria: "Taxas de Cartão", valor da taxa, status: `Realizado`) se `taxa_transacao_id` for nulo, e vincula seu ID a `vendas.taxa_transacao_id`.
   * Se já existir, atualiza o valor da transação de Saída existente.

### D. Autenticação Administrativa
* Apenas o e-mail `evertonmaxwel@gmail.com` é aceito no cadastro inicial e logins subsequentes.
* O fluxo de login é acessado via parâmetro na URL: `index.html?admin=true` ou clicando no ícone oculto de cadeado no rodapé da página.

### E. Backup & Restauração JSON
* O sistema permite exportar todas as tabelas de dados de transações, produtos, clientes e fornecedores do usuário logado em formato JSON.
* A restauração lê o JSON, valida os campos e recarrega os dados substituindo o estado do Supabase para o usuário.

---

## 4. Plano de Verificação

### Testes Manuais
1. **Acesso do Cliente:** Entrar na URL padrão e verificar se a grade exibe apenas produtos marcados como visíveis, se os em estoque vêm primeiro e se o botão do WhatsApp envia o carrinho consolidado com nome e endereço corretos.
2. **Upload de Imagens:** Cadastrar produto e verificar se o upload gera o arquivo público no bucket do Supabase Storage.
3. **Automação de Estoque:** Criar pedido de item sem estoque. Marcar como "Adquirido" e verificar a criação automática da Compra, da transação financeira de Saída correspondente e do abastecimento do estoque.
4. **Fluxo de Taxas:** Definir a taxa da venda do cartão e verificar se um lançamento de Saída ("Taxas de Cartão") é gerado e atualizado corretamente caso a taxa seja alterada posteriormente.
5. **Restrição de Acesso:** Tentar efetuar cadastro ou login com e-mail diferente de `evertonmaxwel@gmail.com` e garantir o bloqueio.

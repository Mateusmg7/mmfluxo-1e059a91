

O usuário pediu para testar o app completo. Isso envolve interação com o preview usando ferramentas de browser, então preciso apresentar um plano de teste end-to-end e aguardar aprovação para entrar em modo default e executar.

## Plano de teste end-to-end

Vou validar os principais fluxos do app no preview, com foco nas áreas tocadas pelos refactors recentes (services layer, ErrorBoundary, Sonner único, PushDebugPanel condicional).

### Escopo dos testes

**1. Autenticação e carregamento inicial**
- Confirmar que o app carrega sem erros no console
- Verificar redirecionamento correto (logado → Dashboard / deslogado → /login)

**2. Dashboard**
- Carrega cards de despesas, renda extra e saldo
- Gráficos (rosca, evolução mensal, comparativo) renderizam
- Troca de mês funciona

**3. Transações**
- Lista carrega via `transactionsService`
- Criar uma despesa simples (essencial)
- Criar uma despesa parcelada (3x) e validar geração dos registros futuros
- Editar e excluir uma transação (com confirmação)
- Criação inline de categoria essencial dentro do formulário

**4. Renda Extra**
- Lista carrega via `extraIncomeService`
- Criar, editar e excluir um registro

**5. Categorias**
- Lista carrega via `categoriesService`
- Criar e excluir uma categoria

**6. Metas**
- Lista carrega via `goalsService`
- Criar uma meta de limite de gasto e validar barra de progresso

**7. Alertas**
- Página carrega
- **Confirmar que `PushDebugPanel` aparece no preview (modo dev)**

**8. Configurações e Ranking**
- Páginas carregam sem erro
- Troca de perfil funciona

**9. Limpeza**
- Remover todos os dados de teste criados

### Como vou executar

- `browser--navigate_to_sandbox` para abrir o preview
- `observe` + `act` para interagir com formulários e botões
- `screenshot` ao final de cada fluxo importante
- `read_console_logs` para confirmar ausência de erros
- Vou pedir confirmação antes de qualquer ação destrutiva em dados que pareçam reais

### O que preciso de você

⚠️ **Importante**: O preview usa a sua sessão real do Supabase. Vou criar dados de teste com prefixo claro (ex.: "TESTE_E2E_") e remover tudo no final. Se preferir que eu **não** mexa nos seus dados, me avise para fazer só uma validação visual (carregamento + navegação) sem CRUD.

Você precisa estar **logado no preview** para que eu consiga testar as áreas autenticadas.


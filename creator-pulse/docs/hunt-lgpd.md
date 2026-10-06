# Hunt: avaliação de legítimo interesse (rascunho para revisão jurídica)

**Controlador:** 1043 Agência. **Tratamento:** leitura e guarda de dados públicos de perfis de creators que não são usuários do Pulse, para avaliar parcerias comerciais. **Status:** rascunho de 06/10/2026, segue a estrutura do guia da ANPD sobre legítimo interesse (finalidade, necessidade, balanceamento, salvaguardas). Para um advogado revisar antes de a área entrar em uso.

## 1. Finalidade

A 1043 representa creators e vende publis para marcas. Para fechar um contrato de representação ou escalar uma campanha, a equipe precisa avaliar creators que ainda não estão no roster: tamanho, engajamento, ritmo de publicação, histórico de publis e eventuais riscos (hoje, publicidade de apostas). Essa avaliação é a finalidade única e concreta do tratamento. É uma expectativa legítima de quem publica conteúdo profissional em perfil público: ser avaliado por agências e marcas é parte da atividade.

## 2. Necessidade

- **Dados tratados:** nome de usuário, nome de exibição, bio, link da bio, link da foto de perfil (CDN, expira, nunca baixada), contagens de seguidores, seguindo e posts, total de curtidas (TikTok) e, dos posts mais recentes (máximo 60, até 400 dias), legenda, data, link, link da miniatura e contagens públicas (curtidas, comentários, views, compartilhamentos, salvos).
- **Fontes:** Instagram pela API oficial Business Discovery da Meta (só devolve contas profissionais; a 1043 usa sua própria conta); TikTok pela ScrapeCreators, provedor terceiro de dados públicos, porque não há API oficial para perfis que não autorizaram o app.
- **Não tratados:** comentários e seus autores, identidade de seguidores, conteúdo privado, mensagens, dados de contato, localização precisa, cópias de imagens, dados de audiência. O campo "contato" é digitado pela equipe depois de uma conversa com o creator, nunca coletado.
- **Frequência:** uma busca manual por pessoa da equipe, cerca de 10 por mês. Uma cópia é reutilizada por 7 dias; atualização forçada só após 12 h. Não há coleta automática nem monitoramento contínuo.
- **Retenção:** exclusão automática após 12 meses sem nova busca ou edição, salvo parceria fechada (quando o creator passa a ser usuário e consente pelo fluxo normal).

Cada item é o mínimo para a finalidade: sem contagens não há avaliação, sem legendas não há detecção de publi nem de apostas, sem datas não há ritmo.

## 3. Balanceamento

- **Expectativa do titular:** dados tornados públicos pelo próprio titular, em perfis profissionais, para serem vistos por marcas e agências. O tratamento repete o que qualquer pessoa vê abrindo o perfil, com cálculo de medianas.
- **Impacto:** baixo. Nenhum dado sensível, nenhuma decisão automatizada com efeito jurídico, nenhuma exposição pública: a área é interna, restrita à equipe, e os números são rotulados como públicos e não comparáveis aos verificados.
- **Menores:** a plataforma não informa idade. Se a equipe identificar um menor, o perfil é excluído e suprimido pelo botão "excluir dados" (motivo "menor de idade"), e não pode ser buscado de novo. Recomenda-se não buscar perfis que pareçam ser de menores.
- **Risco residual:** um creator pode não esperar que a avaliação fique guardada por meses. A retenção de 12 meses e a opção de oposição mitigam.

## 4. Salvaguardas

- Acesso só com sessão de equipe (`isAdmin()`), verificado no servidor em toda página e rota.
- Dados em tabelas separadas do roster; nunca entram no ranking, nas exportações, na API comercial nem em páginas de creators.
- Minimização por código: só as colunas acima; snapshots guardam apenas contagens por post, sem legenda nem link.
- Registro de quem buscou (`fetched_by`, `created_by`).
- Oposição e exclusão: pedidos por contato@1043.ag, resposta em até 15 dias. A exclusão apaga a linha e os snapshots e grava um hash do @ em uma lista de supressão, impedindo nova busca. A lista guarda só o hash, não o @.
- Política de privacidade atualizada (`/privacy`, seção 9 em inglês e 10 em português) com finalidade, base legal, retenção, direitos e transferência internacional.
- Operadores: Vercel (hospedagem), Neon (banco), ScrapeCreators (dados do TikTok), todos nos EUA. Transferência internacional sob os termos contratuais padrão de cada um; conferir se as cláusulas atendem ao art. 33 da LGPD e à Resolução CD/ANPD 19/2024.

## 5. Pontos em aberto para o jurídico

1. **Termos da Plataforma Meta.** Os Platform Terms restringem a construção de perfis sobre pessoas sem consentimento e o uso de dados para avaliação de indivíduos. A Business Discovery existe justamente para analisar contas profissionais de terceiros, mas é preciso confirmar que guardar o histórico (snapshots) e o status de negociação está dentro do permitido, e se a política de privacidade cobre o exigido pela Meta.
2. **Orientação da ANPD sobre raspagem.** Verificar se a ANPD publicou orientação ou decisão específica sobre coleta de dados públicos de redes sociais (web scraping) e se ela afeta o uso da ScrapeCreators para o TikTok. Os termos de serviço do TikTok proíbem coleta automatizada; o risco contratual é do provedor, mas o risco reputacional e o enquadramento LGPD são da 1043.
3. **Base legal alternativa.** Avaliar se, para o status de negociação e as notas internas (dados inseridos pela equipe), a base mais adequada é o legítimo interesse ou a execução de procedimentos preliminares de contrato (art. 7º, V).
4. **Relatório de impacto.** Decidir se este documento, ampliado, deve virar um RIPD formal, dado o volume baixo e a ausência de dados sensíveis.

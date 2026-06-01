/*
  ============================================================
  ARQUIVO: backend/server.js
  
  O QUE É NODE.JS?
  Node.js é um ambiente que permite rodar JavaScript fora do
  navegador — no servidor (back-end).
  
  O QUE É EXPRESS?
  Express é a biblioteca mais popular do Node.js para criar
  servidores web e APIs REST.
  
  O QUE É UMA API REST?
  API (Application Programming Interface) = "contrato" de
  comunicação entre sistemas.
  
  REST = padrão de arquitetura web. Usa as operações HTTP:
  
  GET    → BUSCAR dados          (ex: ver disciplinas)
  POST   → CRIAR dados           (ex: fazer login, matricular)
  PUT    → ATUALIZAR dados       (ex: lançar nota)
  DELETE → DELETAR dados         (ex: cancelar matrícula)
  
  Cada operação é chamada via URL (rota):
  GET  /api/disciplinas         → lista todas as disciplinas
  POST /api/auth/login          → faz login
  POST /api/matriculas          → realiza matrícula
  ============================================================
*/

// ============================================================
// IMPORTAÇÕES (require)
// ============================================================

const express = require('express');
/*
  express: framework web que simplifica criar um servidor HTTP.
  Um servidor HTTP recebe requisições e envia respostas.
*/

const cors = require('cors');
/*
  cors: middleware que permite o HTML (rodando no navegador)
  fazer requisições para o servidor Node.js.
  
  Sem CORS, o navegador bloquearia as requisições por segurança
  (política de mesma origem).
  
  Middleware = função que processa requisições antes das rotas.
*/

const bcrypt = require('bcrypt');
/*
  bcrypt: biblioteca para criptografar senhas.
  
  Por que criptografar?
  Se o banco for invadido, o hacker não saberá as senhas reais.
  bcrypt transforma "minha_senha" em "$2b$10$Xjk..." (hash).
  
  É uma via de mão única: não dá para reverter o hash.
  Para verificar: compara o que foi digitado com o hash salvo.
*/

const { query, pool } = require('./db');
/*
  Importa nossa função de query e o pool do arquivo db.js
  { } = desestruturação: extrai propriedades específicas do módulo
*/

require('dotenv').config();
// Carrega variáveis de ambiente do arquivo .env


// ============================================================
// CONFIGURAÇÃO DO SERVIDOR EXPRESS
// ============================================================

const app = express();
// app é a instância do servidor Express

const PORT = process.env.PORT || 3001;
// Porta em que o servidor vai escutar requisições

/*
  app.use() registra middlewares — funções executadas antes das rotas.
*/

// Permite receber requisições de qualquer origem (CORS)
app.use(cors({
  origin: '*', // em produção, coloque o endereço do seu frontend
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Interpreta o corpo (body) das requisições como JSON
app.use(express.json());
/*
  Quando o front-end envia dados (ex: login), os dados chegam
  em formato JSON. Este middleware "desempacota" automaticamente.
  Sem ele, req.body seria undefined.
*/

// Loga todas as requisições recebidas (útil para debug)
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} - ${new Date().toLocaleTimeString()}`);
  next(); // chama o próximo middleware/rota
  /*
    next() é essencial nos middlewares!
    Sem ele, a requisição "trava" e nenhuma resposta é enviada.
  */
});


// ============================================================
// ROTA DE TESTE / SAÚDE DO SERVIDOR
// ============================================================

/*
  app.get(rota, handler) define uma rota GET.
  
  handler = função que recebe (req, res):
    req = objeto da requisição (o que o cliente enviou)
    res = objeto da resposta (o que vamos enviar de volta)
*/
app.get('/', (req, res) => {
  res.json({
    mensagem: '🎓 API do Sistema de Matrícula rodando!',
    versao: '1.0.0',
    status: 'ok'
  });
  /*
    res.json() envia uma resposta em formato JSON.
    O status HTTP padrão é 200 (OK).
  */
});

// Rota de verificação de saúde do banco
app.get('/health', async (req, res) => {
  try {
    await query('SELECT 1'); // query simples para testar conexão
    res.json({ status: 'ok', banco: 'conectado' });
  } catch (err) {
    res.status(500).json({ status: 'erro', banco: 'desconectado' });
    // res.status(500) define o código HTTP de erro de servidor
  }
});


// ============================================================
// ROTAS DE AUTENTICAÇÃO (/api/auth)
// ============================================================

/*
  POST /api/auth/login
  Recebe: { matricula, senha, tipo }
  Retorna: { sucesso, usuario, token }
  
  req.body contém os dados enviados pelo front-end em JSON.
*/
app.post('/api/auth/login', async (req, res) => {
  try {
    // Extrai matricula, senha e tipo do corpo da requisição
    const { matricula, senha, tipo } = req.body;
    /*
      Desestruturação: extrai propriedades de um objeto.
      Equivalente a:
        const matricula = req.body.matricula;
        const senha = req.body.senha;
        const tipo = req.body.tipo;
    */

    // Validação: todos os campos são obrigatórios
    if (!matricula || !senha || !tipo) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Matrícula, senha e tipo são obrigatórios.'
      });
      // 400 = Bad Request (requisição inválida)
    }

    // Busca o usuário no banco de dados
    const resultado = await query(
      // $1, $2 são placeholders — evitam SQL Injection!
      // SQL Injection é um ataque onde alguém digita código SQL malicioso.
      // Com placeholders, o valor é tratado como dado, nunca como código.
      `SELECT id, matricula, nome, email, senha_hash, tipo,
              curso_id, periodo, departamento, titulacao
       FROM usuarios
       WHERE matricula = $1 AND tipo = $2 AND ativo = TRUE`,
      [matricula, tipo] // $1 = matricula, $2 = tipo
    );

    // Se não encontrou o usuário
    if (resultado.rows.length === 0) {
      // resultado.rows é o array de linhas retornadas pelo SELECT
      return res.status(401).json({
        sucesso: false,
        mensagem: 'Matrícula, senha ou tipo incorretos.'
      });
      // 401 = Unauthorized (não autorizado)
    }

    const usuario = resultado.rows[0]; // pega o primeiro (e único) resultado

    // Verifica a senha usando bcrypt
    // bcrypt.compare() compara a senha digitada com o hash do banco
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);

    if (!senhaCorreta) {
      return res.status(401).json({
        sucesso: false,
        mensagem: 'Matrícula, senha ou tipo incorretos.'
      });
    }

    // NUNCA retorne a senha/hash para o cliente!
    delete usuario.senha_hash;
    /*
      delete remove uma propriedade de um objeto.
      Assim o hash não é enviado ao navegador.
    */

    // Se chegou aqui, login bem-sucedido!
    console.log(`✅ Login: ${usuario.nome} (${usuario.tipo})`);

    res.json({
      sucesso: true,
      mensagem: 'Login realizado com sucesso!',
      usuario: usuario
    });
    // 200 OK é o padrão do res.json()

  } catch (erro) {
    console.error('Erro no login:', erro);
    res.status(500).json({
      sucesso: false,
      mensagem: 'Erro interno do servidor.'
    });
    // 500 = Internal Server Error
  }
});


// ============================================================
// ROTAS DE DISCIPLINAS (/api/disciplinas)
// ============================================================

// GET /api/disciplinas → lista todas as disciplinas
app.get('/api/disciplinas', async (req, res) => {
  try {
    /*
      JOIN une tabelas em uma única consulta.
      
      INNER JOIN usuarios prof → une com a tabela usuarios
        renomeada como "prof" para representar o professor.
      
      LEFT JOIN → inclui disciplinas mesmo sem professor vinculado.
      
      AS → apelido (alias) para colunas e tabelas.
    */
    const resultado = await query(`
      SELECT
        d.id,
        d.codigo,
        d.nome,
        d.ementa,
        d.creditos,
        d.vagas_total,
        d.horario,
        d.local_aula,
        prof.nome        AS professor_nome,
        prof.matricula   AS professor_matricula,
        -- Subquery: conta quantas matrículas ativas existem
        (SELECT COUNT(*) FROM matriculas m
         WHERE m.disciplina_id = d.id
         AND m.status NOT IN ('cancelado', 'trancado')) AS vagas_ocupadas
      FROM disciplinas d
      LEFT JOIN usuarios prof ON prof.id = d.professor_id
      ORDER BY d.codigo ASC
    `);
    // ORDER BY ordena os resultados (ASC = crescente, DESC = decrescente)

    res.json({
      sucesso: true,
      disciplinas: resultado.rows
    });

  } catch (erro) {
    console.error('Erro ao buscar disciplinas:', erro);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar disciplinas.' });
  }
});


// ============================================================
// ROTAS DE MATRÍCULAS (/api/matriculas)
// ============================================================

// GET /api/matriculas/:alunoId → matrículas de um aluno específico
app.get('/api/matriculas/:alunoId', async (req, res) => {
  try {
    /*
      req.params contém parâmetros da URL.
      :alunoId na rota captura o valor após a /
      Ex: GET /api/matriculas/3  →  req.params.alunoId = "3"
    */
    const { alunoId } = req.params;

    const resultado = await query(`
      SELECT
        m.id              AS matricula_id,
        m.semestre,
        m.status,
        m.data_matricula,
        d.codigo,
        d.nome            AS disciplina_nome,
        d.creditos,
        d.horario,
        d.local_aula,
        prof.nome         AS professor,
        n.nota_av1,
        n.nota_av2,
        n.nota_final,
        n.frequencia
      FROM matriculas m
      JOIN disciplinas d   ON d.id = m.disciplina_id
      LEFT JOIN usuarios prof ON prof.id = d.professor_id
      LEFT JOIN notas n    ON n.matricula_id = m.id
      WHERE m.aluno_id = $1
        AND m.status != 'cancelado'
      ORDER BY d.codigo
    `, [alunoId]);

    res.json({
      sucesso: true,
      matriculas: resultado.rows
    });

  } catch (erro) {
    console.error('Erro ao buscar matrículas:', erro);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar matrículas.' });
  }
});


// POST /api/matriculas → realiza uma nova matrícula
app.post('/api/matriculas', async (req, res) => {
  // client = conexão individual para usar TRANSAÇÃO
  const client = await pool.connect();
  /*
    TRANSAÇÃO: garante que um conjunto de operações acontece
    TUDO ou NADA. Se uma falhar, todas são desfeitas (ROLLBACK).
    
    Exemplo:
    1. Verificar vagas
    2. Inserir matrícula
    3. Criar linha de notas
    Se o passo 3 falhar, o banco desfaz o passo 2 também.
    Assim os dados ficam sempre consistentes.
  */

  try {
    const { alunoId, disciplinaId, semestre } = req.body;

    if (!alunoId || !disciplinaId) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'alunoId e disciplinaId são obrigatórios.'
      });
    }

    await client.query('BEGIN'); // inicia a transação

    // 1. Verifica se a disciplina tem vagas disponíveis
    const discResult = await client.query(`
      SELECT
        d.vagas_total,
        COUNT(m.id) AS vagas_ocupadas
      FROM disciplinas d
      LEFT JOIN matriculas m ON m.disciplina_id = d.id
        AND m.status NOT IN ('cancelado', 'trancado')
      WHERE d.id = $1
      GROUP BY d.vagas_total
    `, [disciplinaId]);

    if (discResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ sucesso: false, mensagem: 'Disciplina não encontrada.' });
    }

    const { vagas_total, vagas_ocupadas } = discResult.rows[0];
    if (parseInt(vagas_ocupadas) >= parseInt(vagas_total)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ sucesso: false, mensagem: 'Não há vagas disponíveis.' });
      // 409 = Conflict
    }

    // 2. Verifica se já está matriculado
    const jaMatriculado = await client.query(`
      SELECT id FROM matriculas
      WHERE aluno_id = $1 AND disciplina_id = $2
        AND semestre = $3 AND status != 'cancelado'
    `, [alunoId, disciplinaId, semestre || '2024/2']);

    if (jaMatriculado.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ sucesso: false, mensagem: 'Já está matriculado nesta disciplina.' });
    }

    // 3. Insere a matrícula
    // RETURNING id retorna o id gerado automaticamente
    const novaMatricula = await client.query(`
      INSERT INTO matriculas (aluno_id, disciplina_id, semestre, status)
      VALUES ($1, $2, $3, 'cursando')
      RETURNING id
    `, [alunoId, disciplinaId, semestre || '2024/2']);

    const matriculaId = novaMatricula.rows[0].id;

    // 4. Cria a linha de notas (vazia) para esta matrícula
    await client.query(`
      INSERT INTO notas (matricula_id)
      VALUES ($1)
    `, [matriculaId]);

    await client.query('COMMIT'); // confirma todas as operações
    // Se chegou aqui, tudo deu certo!

    res.status(201).json({
      sucesso: true,
      mensagem: 'Matrícula realizada com sucesso!',
      matriculaId: matriculaId
    });
    // 201 = Created (recurso criado com sucesso)

  } catch (erro) {
    await client.query('ROLLBACK'); // desfaz tudo em caso de erro
    console.error('Erro ao realizar matrícula:', erro);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao realizar matrícula.' });
  } finally {
    client.release();
    // finally: executado SEMPRE, com erro ou sem.
    // release() devolve a conexão ao pool.
  }
});


// DELETE /api/matriculas/:matriculaId → cancela uma matrícula
app.delete('/api/matriculas/:matriculaId', async (req, res) => {
  try {
    const { matriculaId } = req.params;

    // Atualiza o status para 'cancelado' em vez de deletar
    // (boa prática: nunca delete dados, apenas marque como inativo)
    const resultado = await query(`
      UPDATE matriculas
      SET status = 'cancelado'
      WHERE id = $1
      RETURNING id
    `, [matriculaId]);
    // UPDATE modifica registros existentes
    // SET define os novos valores
    // RETURNING retorna os dados modificados

    if (resultado.rows.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Matrícula não encontrada.' });
    }

    res.json({ sucesso: true, mensagem: 'Matrícula cancelada com sucesso.' });

  } catch (erro) {
    console.error('Erro ao cancelar matrícula:', erro);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao cancelar matrícula.' });
  }
});


// ============================================================
// ROTAS DE NOTAS (/api/notas)
// ============================================================

// PUT /api/notas/:matriculaId → lança/atualiza nota de um aluno
app.put('/api/notas/:matriculaId', async (req, res) => {
  try {
    const { matriculaId } = req.params;
    const { nota_av1, nota_av2, frequencia, observacoes } = req.body;

    // Calcula a média automaticamente
    let nota_final = null;
    if (nota_av1 !== null && nota_av1 !== undefined &&
        nota_av2 !== null && nota_av2 !== undefined) {
      nota_final = (parseFloat(nota_av1) + parseFloat(nota_av2)) / 2;
      nota_final = Math.round(nota_final * 10) / 10; // arredonda 1 casa decimal
    }

    // INSERT OR UPDATE (upsert): insere se não existe, atualiza se existe
    // ON CONFLICT (matricula_id) = se já existe, executa DO UPDATE
    const resultado = await query(`
      INSERT INTO notas (matricula_id, nota_av1, nota_av2, nota_final, frequencia, observacoes, atualizado_em)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (matricula_id)
      DO UPDATE SET
        nota_av1      = EXCLUDED.nota_av1,
        nota_av2      = EXCLUDED.nota_av2,
        nota_final    = EXCLUDED.nota_final,
        frequencia    = EXCLUDED.frequencia,
        observacoes   = EXCLUDED.observacoes,
        atualizado_em = NOW()
      RETURNING *
    `, [matriculaId, nota_av1, nota_av2, nota_final, frequencia, observacoes]);
    // EXCLUDED. referencia os valores que tentou inserir

    // Atualiza o status da matrícula baseado na nota final
    if (nota_final !== null && frequencia !== null) {
      let novoStatus = 'cursando';
      if (frequencia < 75) {
        novoStatus = 'reprovado'; // reprovado por falta
      } else if (nota_final >= 7.0) {
        novoStatus = 'aprovado';
      } else if (nota_final >= 5.0) {
        novoStatus = 'recuperacao';
      } else {
        novoStatus = 'reprovado';
      }

      await query(`
        UPDATE matriculas SET status = $1 WHERE id = $2
      `, [novoStatus, matriculaId]);
    }

    res.json({
      sucesso: true,
      mensagem: 'Nota lançada com sucesso!',
      nota: resultado.rows[0]
    });

  } catch (erro) {
    console.error('Erro ao lançar nota:', erro);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao lançar nota.' });
  }
});


// ============================================================
// ROTAS DO PROFESSOR (/api/professor)
// ============================================================

// GET /api/professor/:profId/turmas → turmas de um professor
app.get('/api/professor/:profId/turmas', async (req, res) => {
  try {
    const { profId } = req.params;

    const resultado = await query(`
      SELECT
        d.id,
        d.codigo,
        d.nome,
        d.horario,
        d.local_aula,
        d.creditos,
        d.vagas_total,
        COUNT(m.id) FILTER (WHERE m.status = 'cursando') AS alunos_cursando,
        ROUND(AVG(n.nota_final), 1) AS media_turma
        -- ROUND arredonda o número
        -- AVG calcula a média dos valores
        -- FILTER aplica condição ao agregador
      FROM disciplinas d
      LEFT JOIN matriculas m ON m.disciplina_id = d.id
      LEFT JOIN notas n ON n.matricula_id = m.id
      WHERE d.professor_id = $1
      GROUP BY d.id
      -- GROUP BY agrupa os resultados para usar funções de agregação
      ORDER BY d.codigo
    `, [profId]);

    res.json({ sucesso: true, turmas: resultado.rows });

  } catch (erro) {
    console.error('Erro ao buscar turmas:', erro);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar turmas.' });
  }
});

// GET /api/professor/:profId/alunos → alunos de todas as turmas do professor
app.get('/api/professor/:profId/alunos', async (req, res) => {
  try {
    const { profId } = req.params;

    const resultado = await query(`
      SELECT
        u.matricula,
        u.nome         AS nome_aluno,
        d.codigo       AS codigo_disciplina,
        d.nome         AS nome_disciplina,
        m.id           AS matricula_id,
        m.status,
        n.nota_av1,
        n.nota_av2,
        n.nota_final,
        n.frequencia
      FROM matriculas m
      JOIN usuarios    u ON u.id = m.aluno_id
      JOIN disciplinas d ON d.id = m.disciplina_id
      LEFT JOIN notas  n ON n.matricula_id = m.id
      WHERE d.professor_id = $1
        AND m.status != 'cancelado'
      ORDER BY d.codigo, u.nome
    `, [profId]);

    res.json({ sucesso: true, alunos: resultado.rows });

  } catch (erro) {
    console.error('Erro ao buscar alunos:', erro);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar alunos.' });
  }
});


// ============================================================
// MIDDLEWARE DE ROTA NÃO ENCONTRADA (404)
// Deve ficar no final — captura rotas que não existem
// ============================================================
app.use((req, res) => {
  res.status(404).json({
    sucesso: false,
    mensagem: `Rota ${req.method} ${req.path} não encontrada.`
  });
});


// ============================================================
// INICIA O SERVIDOR
// app.listen() coloca o servidor para "escutar" requisições
// ============================================================
app.listen(PORT, () => {
  console.log('');
  console.log('🎓 ====================================');
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}`);
  console.log(`🏥 Saúde: http://localhost:${PORT}/health`);
  console.log('🎓 ====================================');
  console.log('');
});

/*
  ============================================================
  RESUMO DAS ROTAS DISPONÍVEIS:
  
  AUTENTICAÇÃO:
    POST  /api/auth/login              → fazer login

  DISCIPLINAS:
    GET   /api/disciplinas             → listar disciplinas

  MATRÍCULAS:
    GET   /api/matriculas/:alunoId     → ver matrículas de um aluno
    POST  /api/matriculas              → realizar matrícula
    DELETE /api/matriculas/:id         → cancelar matrícula

  NOTAS:
    PUT   /api/notas/:matriculaId      → lançar/atualizar nota

  PROFESSOR:
    GET   /api/professor/:id/turmas    → turmas do professor
    GET   /api/professor/:id/alunos    → alunos do professor
  ============================================================
*/
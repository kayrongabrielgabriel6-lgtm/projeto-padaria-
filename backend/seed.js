/*
  ============================================================
  ARQUIVO: backend/seed.js

  O QUE É UM SEED?
  "Seed" (semente) é um script que popula o banco com dados
  iniciais para desenvolvimento e testes.

  POR QUE ESTE ARQUIVO?
  O init.sql inseriu usuários com hashes fictícios.
  Este script ATUALIZA as senhas com hashes REAIS gerados
  pelo bcrypt — necessário para o login funcionar.

  COMO RODAR:
  (dentro do contêiner backend ou com Node instalado)
    node seed.js
  ============================================================
*/

const bcrypt = require('bcrypt');
const { query, pool } = require('./db');

/*
  SALT ROUNDS = 10
  "Salt" é um valor aleatório adicionado antes de fazer o hash.
  Evita ataques de tabela arco-íris (rainbow table attacks).
  
  10 rounds = o bcrypt faz 2^10 = 1024 iterações do hash.
  Mais rounds = mais seguro, mas mais lento.
  10 é o valor recomendado para produção.
*/
const SALT_ROUNDS = 10;

// Lista de usuários e suas senhas em texto puro
const usuariosParaAtualizar = [
  { matricula: '2024001', senha: 'aluno123' },
  { matricula: '2024002', senha: 'aluno123' },
  { matricula: '2024003', senha: 'aluno123' },
  { matricula: 'PROF001', senha: 'prof123'  },
  { matricula: 'PROF002', senha: 'prof123'  },
];

/**
 * Função principal do seed
 * Usa async/await pois operações de banco e hash são assíncronas
 */
async function executarSeed() {
  console.log('🌱 Iniciando atualização de senhas (seed)...\n');

  try {
    for (const usuario of usuariosParaAtualizar) {
      /*
        for...of percorre cada elemento de um array.
        Mais adequado que forEach quando usamos await dentro.
      */

      // Gera o hash da senha
      const hash = await bcrypt.hash(usuario.senha, SALT_ROUNDS);
      /*
        bcrypt.hash(senha, rounds) → retorna uma Promise com o hash.
        
        Exemplo de hash gerado:
        "aluno123" → "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh3S"
        
        Cada vez que roda gera um hash DIFERENTE (por causa do salt)
        mas bcrypt.compare() consegue verificar que é a mesma senha.
      */

      // Atualiza no banco de dados
      await query(
        'UPDATE usuarios SET senha_hash = $1 WHERE matricula = $2',
        [hash, usuario.matricula]
      );

      console.log(`  ✅ ${usuario.matricula} — senha atualizada`);
    }

    console.log('\n🎉 Seed concluído! Todos os usuários têm senhas válidas.');
    console.log('\n📋 Credenciais para teste:');
    console.log('   Aluno:     2024001 / aluno123');
    console.log('   Aluno:     2024002 / aluno123');
    console.log('   Aluno:     2024003 / aluno123');
    console.log('   Professor: PROF001 / prof123');
    console.log('   Professor: PROF002 / prof123');

  } catch (erro) {
    console.error('\n❌ Erro no seed:', erro.message);
  } finally {
    // Encerra o pool de conexões para o processo terminar
    await pool.end();
    process.exit(0);
  }
}

// Chama a função principal
executarSeed();
/* ============================================================
  ARQUIVO: frontend/script.js
  
  O QUE É O FRONT-END DINÂMICO?
  É o uso do JavaScript para manipular o HTML (DOM) e se 
  comunicar com o Servidor (Back-end) através de APIs.
  
  CONCEITOS CHAVE PARA A AULA:
  1. Event Listeners: "Ouvidores" que esperam um clique ou envio.
  2. Fetch API: O mensageiro que leva dados ao servidor.
  3. Async/Await: Forma de dizer ao JS para esperar o servidor responder.
  4. Manipulação de DOM: Alterar textos e classes CSS via código.
  ============================================================
*/

// Configuração da URL da sua API (onde o server.js está rodando)
const API_URL = 'http://localhost:3001/api';

// Variáveis Globais para manter o estado da aplicação
let usuarioLogado = null;
let tipoUsuarioAtual = 'aluno'; // Padrão inicial

/* ============================================================
  1. CONTROLE DE INTERFACE (UI)
  ============================================================ 
*/

// Função para alternar entre Aluno e Professor no Login
function setTipoUsuario(tipo) {
    tipoUsuarioAtual = tipo;
    
    // Remove a classe 'ativo' de todos e adiciona apenas no clicado
    document.querySelectorAll('.btn-tipo').forEach(btn => btn.classList.remove('ativo'));
    
    if (tipo === 'aluno') {
        document.getElementById('btn-tipo-aluno').classList.add('ativo');
    } else {
        document.getElementById('btn-tipo-prof').classList.add('ativo');
    }
    console.log(`Modo de login alterado para: ${tipo}`);
}

// Função para mostrar/esconder a senha
function toggleSenha() {
    const inputSenha = document.getElementById('login-senha');
    const icone = document.querySelector('.btn-olho i');
    
    if (inputSenha.type === 'password') {
        inputSenha.type = 'text';
        icone.classList.replace('far', 'fas'); // Muda o desenho do olho
    } else {
        inputSenha.type = 'password';
        icone.classList.replace('fas', 'far');
    }
}

/* ============================================================
  2. COMUNICAÇÃO COM O SERVIDOR (FETCH)
  ============================================================ 
*/

// LOGIN: Enviando dados para o POST /api/auth/login do server.js
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault(); // Impede a página de recarregar

    // Captura os valores digitados nos inputs
    const matricula = document.getElementById('login-matricula').value;
    const senha = document.getElementById('login-senha').value;

    try {
        // O fetch envia a "carta" para o servidor
        const resposta = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matricula, senha, tipo: tipoUsuarioAtual })
        });

        const dados = await resposta.json();

        if (dados.sucesso) {
            usuarioLogado = dados.usuario;
            entrarNoSistema();
        } else {
            alert(dados.mensagem || 'Erro ao realizar login');
        }
    } catch (erro) {
        console.error('Erro na requisição:', erro);
        alert('Não foi possível conectar ao servidor. Verifique se o server.js está rodando!');
    }
});

/* ============================================================
  3. LÓGICA DO DASHBOARD
  ============================================================ 
*/

function entrarNoSistema() {
    // Troca de telas (CSS manipulado pelo JS)
    document.getElementById('tela-login').classList.remove('ativa');
    document.getElementById('dashboard').classList.add('ativa');

    // Preenche os dados do perfil na Navbar
    document.getElementById('nome-usuario-display').innerText = usuarioLogado.nome;
    document.getElementById('matricula-display').innerText = usuarioLogado.matricula;
    document.getElementById('avatar-sigla').innerText = usuarioLogado.nome.charAt(0).toUpperCase();
    document.getElementById('saudacao-usuario').innerText = `Olá, ${usuarioLogado.nome}!`;

    // Carrega os dados iniciais do banco
    if (usuarioLogado.tipo === 'aluno') {
        carregarMatriculasAluno();
    } else {
        configurarPainelProfessor();
    }
}

// BUSCAR MATRÍCULAS: GET /api/matriculas/:id do server.js
async function carregarMatriculasAluno() {
    const container = document.getElementById('aba-conteudo-dinamico');
    container.innerHTML = '<p>Carregando histórico...</p>';

    try {
        const resposta = await fetch(`${API_URL}/matriculas/${usuarioLogado.id}`);
        const dados = await resposta.json();

        if (dados.sucesso) {
            renderizarTabelaMatriculas(dados.matriculas);
        }
    } catch (erro) {
        container.innerHTML = '<p>Erro ao carregar dados.</p>';
    }
}

/* ============================================================
  4. RENDERIZAÇÃO DE TABELAS (O "R" do CRUD)
  ============================================================ 
*/

function renderizarTabelaMatriculas(lista) {
    const container = document.getElementById('aba-conteudo-dinamico');
    
    // Criando a estrutura da tabela via String Template
    let html = `
        <div class="tabela-wrapper">
            <table class="tabela-dados">
                <thead>
                    <tr>
                        <th>CÓDIGO</th>
                        <th>DISCIPLINA</th>
                        <th>STATUS</th>
                        <th>AV1</th>
                        <th>AV2</th>
                        <th>MÉDIA</th>
                    </tr>
                </thead>
                <tbody>
    `;

    lista.forEach(m => {
        html += `
            <tr>
                <td><strong>${m.codigo}</strong></td>
                <td>${m.disciplina_nome}</td>
                <td><span class="badge-status ${m.status.toLowerCase()}">${m.status}</span></td>
                <td>${m.nota_av1 || '-'}</td>
                <td>${m.nota_av2 || '-'}</td>
                <td><strong>${m.nota_final || '-'}</strong></td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

/* ============================================================
  5. LOGOUT E ENCERRAMENTO
  ============================================================ 
*/

function logout() {
    // Limpa os dados e recarrega a página para o estado inicial
    usuarioLogado = null;
    window.location.reload();
}
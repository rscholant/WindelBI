<div style="text-align:center"><img src="./.github/logo.png" min-width="400px" max-width="400px" width="400px" align="center" alt="logo"></div>

---

## 💪 Projeto

Projeto criado para que se possa enviar dados do banco de dados local que está hospedado em Firebird, para um banco de dados em um servidor externo, para utilização de relatórios de clientes.

---

## 🔧 Configuração do banco de dados

### 🔧 BI_CONFIG

Tabela responsável por conter as configurações do servidor, tais como versão das tabelas, versão da engine e dados de autenticação da empresa.

| Campo | Tipo    | Tamanho | Null? |
| ----- | ------- | ------- | ----- |
| KEY   | Varchar | 100     | Não   |
| DATA  | Varchar | 200     | Não   |

### 🔧 BI_REPLIC_CONFIG

Tabela responsável por conter as configurações de exportação de dados, que serão inseridos pela API.

| Campo                | Tipo      | Tamanho | Null? |
| -------------------- | --------- | ------- | ----- |
| ID                   | INTEGER   |         | Não   |
| CNPJ                 | VARCHAR   | 20      | NÃO   |
| QUERY                | Varchar   | 2000    | Não   |
| DATE_SINCE_LAST_PULL | Timestamp |         | Não   |
| STATUS               | INTEGER   |         | NÃO   |
| TABLES               | Varchar   | 2000    | Não   |

---

## ⚙️ Funcionamento

Este projeto será executado no servidor do cliente, que irá executar ciclos de atualização a cada 5 minutos, levando para a API os dados atualizados, caso existam.
Ao iniciar a engine, ela verificará se o cliente ainda está habilitado para a utilização do mesmo, após esta verificação inicial irá verificar se há alguma nova configuração a ser salva no banco de dados local e só ao fim desta etapa irá iniciar os seus ciclos.

### ⚙️ Atualizações automáticas

A engine irá criar um canal de comunicação direto com a API através de websockets que irá ficar "escutando" se há novas configurações de sincronização ou alterações nas existentes, caso o usuário queira re-sincronizar algumas informações ou todas as informações que estão já configuradas.

---

## 💻 Instalação

### Para compilar um novo executável

```bash
# Clone este repositório
git clone https://github.com/rscholant/WindelBI
# Entre na pasta criada
cd WindelBI
# Instale as dependências
yarn
# Compile a nova versão
yarn pkg:windows
# ou
yarn pkg:linux
```

### Para a utilização em produção

Deverá ser salvo o executável gerado no passo anterior em qualquer pasta do sistema e após isto, ser colocado junto na mesma pasta o arquivo de configuração **_windel-bi.json_** que será disponibilizado através do front-end e assim poderá ser executado normalmente.
Caso haja a necessidade de execução como serviço, é recomendado o usu do software de terceiros **NSSM**

---

Feito com ❤️ e ☕ por **Rafael Scholant** 👋

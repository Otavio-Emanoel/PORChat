# 🚀 Guia de Deploy & Operação no Ubuntu Server — PORChat

Este guia fornece instruções completas passo a passo para implantar, orquestrar e manter o **PORChat** em produção em qualquer servidor **Ubuntu 20.04 LTS, 22.04 LTS ou 24.04 LTS**.

---

## 1. Inicialização Automatizada em 1 Comando

Para configurar um servidor Ubuntu recém-criado, o PORChat disponibiliza o script `setup_ubuntu.sh`, que automatiza todo o provisionamento:
- Atualiza os pacotes do sistema operacional via `apt`.
- Instala dependências essenciais (`curl`, `git`, `jq`, `ufw`, `ca-certificates`).
- **Instala automaticamente a versão oficial mais recente do Docker Engine e Docker Compose Plugin**.
- Configura o usuário no grupo `docker`.
- Prepara as pastas de persistência com permissões adequadas (`./data` e `./backups`).
- Configura as regras de firewall do **UFW** abrindo as portas dedicadas (`8081`, `3001`, `80`, `443`, `22`).

### Como executar no servidor Ubuntu:
```bash
# 1. Conecte ao seu servidor via SSH
ssh usuario@seu-servidor-ip

# 2. Clone o repositório
git clone https://github.com/Otavio-Emanoel/PORChat.git /opt/porchat
cd /opt/porchat

# 3. Execute o script de inicialização do Ubuntu
sudo ./scripts/setup_ubuntu.sh
```

---

## 2. Iniciar a Aplicação com Docker Compose

Após a conclusão do script de inicialização, você pode subir o stack completo de produção com:

```bash
./scripts/start_production.sh
```

O script irá:
1. Criar o arquivo `.env` com configurações padrão seguras caso não exista.
2. Executar a auditoria de portas (`./scripts/audit_ports.sh`).
3. Construir as imagens Docker (`porchat-api` e `porchat-web`).
4. Iniciar os containers em background (`docker compose up -d --build`).
5. Aguardar os *healthchecks* responderem com status saudável (`healthy`).
6. Exibir o status operacional com os links de acesso da Web e API.

---

## 3. Gerenciamento via Systemd (Inicialização no Boot)

Para garantir que o PORChat inicie automaticamente sempre que o servidor for reiniciado:

```bash
sudo ./scripts/install_systemd.sh
```

Comandos disponíveis via `systemctl`:
```bash
# Verificar status dos serviços
sudo systemctl status porchat

# Parar serviços
sudo systemctl stop porchat

# Reiniciar serviços
sudo systemctl restart porchat
```

---

## 4. Atualização Contínua em Produção (Zero Downtime)

Sempre que novas correções ou funcionalidades forem mescladas na branch `main`:

```bash
./scripts/deploy.sh
```

O script de deploy:
1. Gera um snapshot comprimido de segurança de todos os dados em `./backups/`.
2. Executa `git pull origin main`.
3. Reconstrói os containers atualizados sem perda de histórico de chat ou salas.
4. Valida se o endpoint `/health` voltou a responder com sucesso.

---

## 5. Rotina de Backup dos Dados

Os dados persistentes residem no diretório `./data` (`chat_store.json`, `user_store.json`, `game_stats.json`, `custom_bank.json`).

Para gerar um backup manual:
```bash
./scripts/backup_data.sh
```
Os arquivos são compactados em `./backups/porchat_data_YYYYMMDD_HHMMSS.tar.gz`. O script remove automaticamente backups com mais de 14 dias para evitar sobrecarga de disco.

### Agendar Backup Diário no Crontab:
```bash
# Abra o crontab
crontab -e

# Adicione para rodar todo dia às 03:00 da madrugada
0 3 * * * /opt/porchat/scripts/backup_data.sh > /dev/null 2>&1
```

---

## 6. Configuração de Domínio com Nginx e SSL (HTTPS / WSS)

Para expor o sistema sob um domínio oficial (ex.: `chat.seudominio.com`) nas portas padrão `80` e `443` com suporte total a **WebSockets Upgrade**:

### 6.1 Instalar Nginx e Certbot
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 6.2 Criar Configuração do Nginx (`/etc/nginx/sites-available/porchat`)
```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    server_name chat.seudominio.com;

    client_max_body_size 25M;

    # Frontend Web e Modo TV
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API REST
    location /api/ {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSockets em Tempo Real
    location /ws {
        proxy_pass http://127.0.0.1:8081/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # Healthcheck
    location /health {
        proxy_pass http://127.0.0.1:8081/health;
        proxy_http_version 1.1;
    }
}
```

### 6.3 Ativar Site e Emitir Certificado SSL Gratuito
```bash
sudo ln -s /etc/nginx/sites-available/porchat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Emitir certificado SSL automático
sudo certbot --nginx -d chat.seudominio.com
```

---

## 7. Tabela Resumo de Portas em Produção

| Porta | Serviço | Acesso Externo Recomendado |
| :--- | :--- | :--- |
| `80` | Nginx HTTP | Sim (Redireciona para 443) |
| `443` | Nginx HTTPS / WSS | Sim (Tráfego público com SSL) |
| `3001` | Next.js Web Container | Apenas localhost / Nginx |
| `8081` | Go API Container | Apenas localhost / Nginx |
| `22` | SSH | Sim (Acesso administrativo) |

Audite o status das portas a qualquer momento executando:
```bash
./scripts/audit_ports.sh
```

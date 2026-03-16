const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const os = require('os');

console.log('🤖 Iniciando ChatBot...');

// ✅ Detecta o sistema operacional e retorna o caminho correto do navegador
function getBrowserPath() {
    const platform = os.platform();
    console.log(`💻 Sistema operacional detectado: ${platform}`);

    if (platform === 'win32') {
        // Windows - tenta Edge primeiro, depois Chrome
        const paths = [
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        ];
        const fs = require('fs');
        for (const p of paths) {
            if (fs.existsSync(p)) {
                console.log(`✅ Navegador encontrado: ${p}`);
                return p;
            }
        }
        console.warn('⚠️ Nenhum navegador encontrado no Windows, usando Chromium do Puppeteer');
        return undefined;

    } else if (platform === 'darwin') {
        // macOS - tenta Chrome primeiro, depois Edge
        const paths = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
        ];
        const fs = require('fs');
        for (const p of paths) {
            if (fs.existsSync(p)) {
                console.log(`✅ Navegador encontrado: ${p}`);
                return p;
            }
        }
        console.warn('⚠️ Nenhum navegador encontrado no macOS, usando Chromium do Puppeteer');
        return undefined;

    } else {
        // Linux
        const paths = [
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
        ];
        const fs = require('fs');
        for (const p of paths) {
            if (fs.existsSync(p)) {
                console.log(`✅ Navegador encontrado: ${p}`);
                return p;
            }
        }
        console.warn('⚠️ Nenhum navegador encontrado no Linux, usando Chromium do Puppeteer');
        return undefined;
    }
}

const browserPath = getBrowserPath();

const puppeteerConfig = {
    headless: true,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
    ]
};

// Só adiciona executablePath se encontrou um navegador instalado
if (browserPath) {
    puppeteerConfig.executablePath = browserPath;
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: puppeteerConfig,
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    }
});

const delay = ms => new Promise(res => setTimeout(res, ms));

const greetingKeywords = [
    'quem','dia','ajudar','tudo',
    'noite', 'tarde','tudo bem','?','opa','oi','ola','olá','oi','qm','Pois não'
];

const numerosBloqueados = new Set([
    '5515997794656@c.us',
    '5511976128415@c.us',
    '5511977815100@c.us'
]);

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
    console.log('✅ Autenticado!');
});

client.on('loading_screen', (percent, message) => {
    console.log(`⏳ Carregando: ${percent}% - ${message}`);
});

client.on('ready', () => {
    console.log('✅ Cliente pronto! WhatsApp conectado!');
});

client.on('auth_failure', msg => {
    console.error('❌ Falha na autenticação:', msg);
});

client.on('disconnected', reason => {
    console.log('⚠️ Desconectado:', reason);
});

console.log('🚀 Inicializando cliente WhatsApp...');
client.initialize();
console.log('⏳ Aguardando resposta do servidor WhatsApp...');

client.on('message', async msg => {
    const numeroCliente = msg.from;
    const messageBody = msg.body.toLowerCase().trim();

    if (numeroCliente.includes('@g.us') || numeroCliente.includes('@broadcast')) {
        return;
    }

    if (numerosBloqueados.has(numeroCliente)) {
        return;
    }

    console.log(`Mensagem recebida de ${numeroCliente}: "${msg.body}"`);

    const temPalavraChave = greetingKeywords.some(keyword => messageBody.includes(keyword.toLowerCase()));
    
    if (temPalavraChave) {
        console.log(`✅ Palavra-chave detectada para ${numeroCliente}`);
        try {
            await delay(5000);
            console.log(`Enviando mensagem 1 para ${numeroCliente}...`);
            await client.sendMessage(numeroCliente, '✅ *Seja bem vindo ao Treinamento Chatbot 3.0!*', { sendSeen: false });

            await delay(5000);
            console.log(`Enviando mensagem 2 para ${numeroCliente}...`);
            await client.sendMessage(numeroCliente, 'Conheça todos os meus produtos: https://robsonwilliamacademy.com', { sendSeen: false });

            console.log(`✅ Mensagens enviadas com sucesso para ${numeroCliente}`);
        } catch (error) {
            console.error(`❌ ERRO ao enviar para ${numeroCliente}:`, error);
        }
    }
});
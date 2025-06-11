// server.js

const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const path = require('path');     // Import Node.js Path module

const app = express();
const PORT = 3001;

let browserInstance; // Variável global para armazenar a instância do navegador Puppeteer

// Função para iniciar a instância do navegador uma única vez
async function startBrowser() {
  try {
    browserInstance = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ],
      protocolTimeout: 90000 // Aumenta o timeout do protocolo para 90 segundos (90000 ms)
    });
    console.log('Puppeteer browser instance launched successfully.');
  } catch (error) {
    console.error('Failed to launch Puppeteer browser:', error);
    process.exit(1); // Sai do processo se o navegador não puder ser iniciado
  }
}

// Use o middleware CORS
app.use(cors());

// --- NOVIDADE AQUI ---
// Serve os arquivos estáticos (HTML, CSS, Imagens, etc.) do diretório atual.
// Isso permite que o Puppeteer acesse 'index.html', 'globals.css', 'img/image-2.png', etc.
app.use(express.static(path.join(__dirname)));
// --- FIM DA NOVIDADE ---

// Define o endpoint para geração de PDF
app.get('/generate-pdf', async (req, res) => {
  if (!browserInstance) {
    console.warn('Browser instance not found. Attempting to restart.');
    await startBrowser();
    if (!browserInstance) {
      return res.status(500).send('Server is not ready to generate PDFs.');
    }
  }

  let page; // Variável para a nova página
  try {
    // Cria uma nova página (aba) na instância do navegador existente
    page = await browserInstance.newPage();

    // --- NOVIDADE AQUI ---
    // Em vez de setContent, navegamos para a URL local do arquivo index.html.
    // Como o Express está servindo arquivos estáticos, o Puppeteer pode carregá-lo.
    // Isso é crucial para que os arquivos CSS e de imagem com caminhos relativos sejam carregados.
    const localUrl = `http://localhost:${PORT}/index.html`; // Usa a porta definida no servidor
    console.log(`Navigating Puppeteer to: ${localUrl}`);
    await page.goto(localUrl, {
      waitUntil: 'networkidle0', // Espera até que a rede esteja inativa (recursos carregados)
      timeout: 60000 // Aumenta o timeout de navegação para 60 segundos
    });
    // --- FIM DA NOVIDADE ---

    // Gera o PDF a partir da página renderizada.
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      },
    });

    // Configura os cabeçalhos da resposta para o download do PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="documento_gerado.pdf"');

    // Envia o buffer do PDF como resposta
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    res.status(500).send('Erro ao gerar PDF');
  } finally {
    if (page) {
      await page.close();
      console.log('Page closed to release resources.');
    }
  }
});

// Inicia o servidor Express E a instância do navegador
async function startServer() {
  await startBrowser(); // Inicia o navegador antes de começar a ouvir requisições
  app.listen(PORT, () => {
    console.log(`Node.js Express PDF server listening on port ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}/generate-pdf para gerar um PDF`);
  });
}

startServer();

// Gerenciamento de desligamento gracioso: Fecha o navegador quando o servidor for encerrado
process.on('SIGINT', async () => {
  console.log('Received SIGINT. Closing browser instance...');
  if (browserInstance) {
    await browserInstance.close();
    console.log('Browser instance closed.');
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Closing browser instance...');
  if (browserInstance) {
    await browserInstance.close();
    console.log('Browser instance closed.');
  }
  process.exit(0);
});

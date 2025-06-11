// server.js

const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

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
        '--single-process', // Importante para ambientes de servidor com recursos limitados
        '--disable-gpu'
      ]
    });
    console.log('Puppeteer browser instance launched successfully.');
  } catch (error) {
    console.error('Failed to launch Puppeteer browser:', error);
    process.exit(1); // Sai do processo se o navegador não puder ser iniciado
  }
}

// Use o middleware CORS
app.use(cors());

// Define o endpoint para geração de PDF
app.get('/generate-pdf', async (req, res) => {
  if (!browserInstance) {
    // Se, por algum motivo, a instância do navegador não estiver disponível, tenta reiniciar
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

    // Define o conteúdo HTML para a página. Este HTML pode ser dinâmico.
    await page.setContent(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Documento A4 Gerado</title>
          <style>
              body {
                  font-family: 'Inter', sans-serif;
                  margin: 0;
                  padding: 2cm;
                  font-size: 12pt;
                  color: #333;
                  line-height: 1.6;
              }
              h1 {
                  color: #2c3e50;
                  text-align: center;
                  margin-bottom: 1cm;
                  font-size: 24pt;
              }
              p {
                  margin-bottom: 0.5cm;
              }
              .footer {
                  position: fixed;
                  bottom: 1cm;
                  left: 2cm;
                  right: 2cm;
                  text-align: center;
                  font-size: 10pt;
                  color: #7f8c8d;
              }
              .page-break {
                  page-break-after: always;
              }
              .rounded-box {
                  border: 1px solid #ddd;
                  border-radius: 8px;
                  padding: 15px;
                  margin-bottom: 20px;
                  background-color: #f9f9f9;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
              }
              h2 {
                  font-size: 18pt;
                  color: #34495e;
                  margin-top: 1.5cm;
                  margin-bottom: 0.8cm;
              }
          </style>
      </head>
      <body>
          <h1>Documento A4 Gerado Dinamicamente</h1>
          <div class="rounded-box">
            <p>
                Este documento foi gerado em <strong>${new Date().toLocaleDateString()}</strong> às <strong>${new Date().toLocaleTimeString()}</strong>
                utilizando Node.js Express e uma instância reutilizada do Puppeteer.
            </p>
            <p>
                A reutilização da instância do navegador é uma otimização crucial para
                servidores que precisam gerar muitos PDFs, pois evita o custo de inicialização
                completa do navegador para cada requisição.
            </p>
            <p>
                O importante é que, após a geração do PDF, a página (aba) seja fechada para
                liberar seus recursos de memória, prevenindo assim vazamentos de memória.
            </p>
          </div>

          <div class="page-break"></div>

          <h2>Seção Adicional</h2>
          <p>
            Esta é uma seção de exemplo que aparece em uma nova página, demonstrando a
            capacidade de controlar as quebras de página via CSS.
          </p>
          <ul>
            <li>Exemplo de item de lista 1.</li>
            <li>Exemplo de item de lista 2.</li>
            <li>Exemplo de item de lista 3.</li>
          </ul>

          <div class="footer">
            Página <span class="pageNumber"></span>
          </div>
      </body>
      </html>
    `, {
      waitUntil: 'networkidle0'
    });

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
    // É CRUCIAL FECHAR A PÁGINA APÓS CADA REQUISIÇÃO PARA EVITAR VAZAMENTOS DE MEMÓRIA!
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

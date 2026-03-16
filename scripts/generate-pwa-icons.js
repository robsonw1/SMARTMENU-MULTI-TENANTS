#!/usr/bin/env node

/**
 * Script para gerar ícones PWA a partir do logo
 * Executa: node scripts/generate-pwa-icons.js
 * 
 * Requer: npm install sharp
 */

const fs = require('fs');
const path = require('path');

// Checar se sharp está instalado
let sharp;
try {
  sharp = require('sharp');
} catch (err) {
  console.error('❌ sharp não está instalado!');
  console.log('Execute: npm install -D sharp');
  console.log('Depois: npm run generate:pwa-icons');
  process.exit(1);
}

const logoSource = path.join(__dirname, '../src/assets/logo-forneiro.jpg');
const publicDir = path.join(__dirname, '../public');

async function generateIcons() {
  try {
    console.log('🎨 Gerando ícones PWA...');

    // 1️⃣ Verificar se logo existe
    if (!fs.existsSync(logoSource)) {
      throw new Error(`Logo não encontrado em: ${logoSource}`);
    }

    // 2️⃣ Gerar 192x192
    await sharp(logoSource)
      .resize(192, 192, {
        fit: 'cover',
        position: 'center',
      })
      .png()
      .toFile(path.join(publicDir, 'logo-192.png'));
    console.log('✅ logo-192.png criado');

    // 3️⃣ Gerar 512x512
    await sharp(logoSource)
      .resize(512, 512, {
        fit: 'cover',
        position: 'center',
      })
      .png()
      .toFile(path.join(publicDir, 'logo-512.png'));
    console.log('✅ logo-512.png criado');

    // 4️⃣ Gerar favicon.ico (192x192 como fallback)
    await sharp(logoSource)
      .resize(192, 192, {
        fit: 'cover',
        position: 'center',
      })
      .png()
      .toFile(path.join(publicDir, 'favicon.png'));
    console.log('✅ favicon.png criado');

    console.log('✨ Ícones gerados com sucesso!');
    console.log('📝 manifest.json será atualizado automaticamente');
  } catch (error) {
    console.error('❌ Erro ao gerar ícones:', error.message);
    process.exit(1);
  }
}

generateIcons();

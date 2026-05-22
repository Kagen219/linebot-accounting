const express = require('express');
const line = require('@line/bot-sdk');
const { google } = require('googleapis');

const app = express();

const lineConfig = {
  channelAccessToken: process.env.LINE_TOKEN,
  channelSecret: process.env.LINE_SECRET
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_TOKEN
});

// Google Sheets 設定
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

app.post('/webhook', line.middleware(lineConfig), async (req, res) => {
  res.status(200).send('OK');
  const events = req.body.events;
  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      await handleMessage(event);
    }
  }
});

async function handleMessage(event) {
  const text = event.message.text.trim();
  const result = parseMessage(text);

  if (result.success) {
    await writeToSheet(result.data);
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: `✅ 記帳成功！\n${result.data.type} | ${result.data.category} | ${result.data.item} | $${result.data.amount}` }]
    });
  } else {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: `❌ 格式錯誤，請輸入：\n收/支 分類 項目 金額\n\n📌 範例：\n支 餐飲 午餐 150\n收 薪水 月薪 50000` }]
    });
  }
}

function parseMessage(text) {
  const parts = text.split(/\s+/);
  if (parts.length < 4) return { success: false };
  const type = parts[0];
  const category = parts[1];
  const item = parts[2];
  const amount = parseFloat(parts[3]);
  if (!['收', '支'].includes(type)) return { success: false };
  if (isNaN(amount) || amount <= 0) return { success: false };
  return { success: true, data: { type, category, item, amount } };
}

async function writeToSheet(data) {
  const now = new Date();
  const timeStr = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Sheet1!A:E',
    valueInputOption: 'USER_ENTERED',
    resource: { values: [[timeStr, data.type, data.category, data.item, data.amount]] }
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

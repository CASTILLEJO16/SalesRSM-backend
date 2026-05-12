
require('dotenv').config();
const mongoose = require('mongoose');
const Client = require('./models/Client');

async function checkData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const clients = await Client.find().select('nombre historial');
    clients.forEach(c => {
      const hasImages = c.historial.some(h => h.imagen);
      const historyCount = c.historial.length;
      console.log(`Client ${c.nombre}: ${historyCount} history items, Has images: ${hasImages}`);
    });
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
checkData();

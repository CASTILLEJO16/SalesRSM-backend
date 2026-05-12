
require('dotenv').config();
const mongoose = require('mongoose');
const Client = require('./models/Client');

async function checkSize() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const clients = await Client.find();
    clients.forEach(c => {
      const size = Buffer.byteLength(JSON.stringify(c));
      console.log(`Client ${c.nombre} size: ${(size / 1024).toFixed(2)} KB`);
    });
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
checkSize();

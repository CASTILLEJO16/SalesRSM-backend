
require('dotenv').config();
const mongoose = require('mongoose');
const Client = require('./models/Client');

async function check() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');
    const count = await Client.countDocuments();
    console.log('Total clients:', count);
    
    console.log('Fetching first 5 clients to check speed...');
    const start = Date.now();
    const clients = await Client.find().limit(5);
    const end = Date.now();
    console.log(`Fetched 5 clients in ${end - start}ms`);
    
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}
check();

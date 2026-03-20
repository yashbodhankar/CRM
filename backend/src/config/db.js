const mongoose = require('mongoose');

async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in environment');
  }

  mongoose.set('strictQuery', true);
  // Avoid Mongoose buffering operations when the server is unreachable
  mongoose.set('bufferCommands', false);

  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Fail fast if the server is unreachable
      serverSelectionTimeoutMS: 5000
    });
    console.log('Connected to MongoDB');
  } catch (err) {
    // Re-throw with clearer message for caller to handle
    throw new Error(`MongoDB connection failed: ${err.message}`);
  }
}

module.exports = connectDb;


const mongoose = require("mongoose");
//connect to mongoose db
/**
 * @function connectDB
 * @description Establishes a connection to the MongoDB database using Mongoose.
 * It uses the DATABASE_URL found in the environment variables.
 * @returns {Promise<void>} A Promise that resolves if the connection is successful,
 * and rejects if there's an error during connection.
 */
const connectDB = async() => {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
    }catch(err) {
        throw err;
    }
}

module.exports = connectDB;
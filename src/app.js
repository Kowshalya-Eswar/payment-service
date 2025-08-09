require('dotenv').config();
const express = require("express");
const connectDB = require("./config/database");
const paymentRouter = require("./routes/payment");
const cors = require("cors");
//create app for subsequent request handling
const app = express();
const PORT = process.env.PORT || 7771;

await connectDB().then(()=>{
    console.log("DB connected sucessfully")
}).catch((err)=>{
    console.log("DB connection fails"+ err.message)
    process.exit(1);
})
app.use(cors({
    origin:"http://localhost:777",
    credentials:true
}))
app.use(express.json());
app.use("/",paymentRouter);

app.listen(PORT,()=>{
    console.log(`server listening on port ${PORT}`);
})

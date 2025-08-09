const mongoose = require("mongoose");
const paymentSchema = mongoose.Schema({
 method: {
        type: String,
        trim: true
    },
    orderId: {
        type: String,
        required: true,
        index: true
    },
    transactionId: {
        type: String,
        trim: true
    },
    notes: {
        type:Object,
    },
    receipt: {
        type: String,
        unique: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['created', 'captured', 'failed'],
        default: 'created',
        required: true
    },
    amountPaid: {
        type: Number,
        required: true,
        min: 0
    }
}, {timestamps:true})

const Payment = new mongoose.model("Payment", paymentSchema);
module.exports = Payment;
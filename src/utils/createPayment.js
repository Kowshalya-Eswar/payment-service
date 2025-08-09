const Payment = require('../models/Payment');
const razorpayInstance = require('./razorpay');
const { v4: uuidv4 } = require('uuid');
const validator = require("validator");
const amqp = require('amqplib');

const requestQueue = 'payment_request_queue';

async function startPaymentService() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();

    await channel.assertQueue(requestQueue, { durable: false });

    console.log('[PaymentService] Waiting for payment requests...');

    channel.consume(requestQueue, async (msg) => {
      if (msg !== null) {
        const paymentRequest = JSON.parse(msg.content.toString());
        const correlationId = msg.properties.correlationId;
        const replyToQueue = msg.properties.replyTo;

        // Process the payment (simulate async payment processing)
        const paymentResponse = await processPayment(paymentRequest);

        // Send response back to replyTo queue with same correlationId
        channel.sendToQueue(
          replyToQueue,
          Buffer.from(JSON.stringify(paymentResponse)),
          {
            correlationId: correlationId
          }
        );
        // Acknowledge the original message
        channel.ack(msg);
      }
    });

  } catch (error) {
    console.error('[PaymentService] Error:', error);
  }
}

startPaymentService();

async function processPayment(paymentRequestData) {
  try {
    const { userId, amount, firstName, lastName, email } = paymentRequestData;
    // Validation
    if (!userId || !amount || amount <= 0) {
      throw new Error("Missing or invalid fields");
    }

    if (typeof email !== 'string' || !validator.isEmail(email)) {
        throw new Error("Email is not valid or missing");
    }

    // Convert to paise
    const amountPaise = amount * 100;
   
    const receiptNo = `rec_${uuidv4()}`;

    // Create order in Razorpay
    const order = await razorpayInstance.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: receiptNo,
      partial_payment: false,
      notes: { firstName, lastName, email }
    });

    const paymentRecord = new Payment({
      orderId: order.id,
      receipt: order.receipt,
      amountPaid: order.amount,
      userId,
      status: order.status,
      notes: order.notes
    });

    await paymentRecord.save();

    return { status: 'success', data: paymentRecord };

  } catch (error) {
    return {
      status: 'failure',
      error: error.message
    };
}
}

